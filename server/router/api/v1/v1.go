package v1

import (
	"context"
	"encoding/json"
	"net/http"

	"connectrpc.com/connect"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/sync/semaphore"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/plugin/markdown"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

type APIV1Service struct {
	v1pb.UnimplementedInstanceServiceServer
	v1pb.UnimplementedAuthServiceServer
	v1pb.UnimplementedUserServiceServer
	v1pb.UnimplementedMemoServiceServer
	v1pb.UnimplementedAttachmentServiceServer
	v1pb.UnimplementedShortcutServiceServer
	v1pb.UnimplementedActivityServiceServer
	v1pb.UnimplementedIdentityProviderServiceServer
	v1pb.UnimplementedChatServiceServer

	Secret          string
	Profile         *profile.Profile
	Store           *store.Store
	MarkdownService markdown.Service

	// thumbnailSemaphore limits concurrent thumbnail generation to prevent memory exhaustion
	thumbnailSemaphore *semaphore.Weighted
}

func NewAPIV1Service(secret string, profile *profile.Profile, store *store.Store) *APIV1Service {
	markdownService := markdown.NewService(
		markdown.WithTagExtension(),
	)
	return &APIV1Service{
		Secret:             secret,
		Profile:            profile,
		Store:              store,
		MarkdownService:    markdownService,
		thumbnailSemaphore: semaphore.NewWeighted(3), // Limit to 3 concurrent thumbnail generations
	}
}

// RegisterGateway registers the gRPC-Gateway and Connect handlers with the given Echo instance.
func (s *APIV1Service) RegisterGateway(ctx context.Context, echoServer *echo.Echo) error {
	// Auth middleware for gRPC-Gateway - runs after routing, has access to method name.
	// Uses the same PublicMethods config as the Connect AuthInterceptor.
	authenticator := auth.NewAuthenticator(s.Store, s.Secret)
	gatewayAuthMiddleware := func(next runtime.HandlerFunc) runtime.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request, pathParams map[string]string) {
			ctx := r.Context()

			// Get the RPC method name from context (set by grpc-gateway after routing)
			rpcMethod, ok := runtime.RPCMethod(ctx)

			// Extract credentials from HTTP headers
			authHeader := r.Header.Get("Authorization")

			result := authenticator.Authenticate(ctx, authHeader)

			// Enforce authentication for non-public methods
			// If rpcMethod cannot be determined, allow through, service layer will handle visibility checks
			if result == nil && ok && !IsPublicMethod(rpcMethod) {
				http.Error(w, `{"code": 16, "message": "authentication required"}`, http.StatusUnauthorized)
				return
			}

			// Set context based on auth result (may be nil for public endpoints)
			if result != nil {
				if result.Claims != nil {
					// Access Token V2 - stateless, use claims
					ctx = auth.SetUserClaimsInContext(ctx, result.Claims)
					ctx = context.WithValue(ctx, auth.UserIDContextKey, result.Claims.UserID)
				} else if result.User != nil {
					// PAT - have full user
					ctx = auth.SetUserInContext(ctx, result.User, result.AccessToken)
				}
				r = r.WithContext(ctx)
			}

			next(w, r, pathParams)
		}
	}

	// Create gRPC-Gateway mux with auth middleware.
	gwMux := runtime.NewServeMux(
		runtime.WithMiddlewares(gatewayAuthMiddleware),
	)
	if err := v1pb.RegisterInstanceServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterAuthServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterUserServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterMemoServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterAttachmentServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterShortcutServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterActivityServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterIdentityProviderServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}
	if err := v1pb.RegisterChatServiceHandlerServer(ctx, gwMux, s); err != nil {
		return err
	}

	gwGroup := echoServer.Group("")
	gwGroup.Use(middleware.CORS())
	handler := echo.WrapHandler(gwMux)

	// ============================================================
	// 手动注册 Chat 路由，绕过 grpc-gateway 的进程内流式限制
	// ============================================================
	gwGroup.POST("/api/v1/chat/completions", func(c echo.Context) error {
		// 1. 绑定请求参数
		req := &v1pb.ChatRequest{}
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		}

		// 2. 设置响应头，准备流式输出
		c.Response().Header().Set(echo.HeaderContentType, "application/json")
		c.Response().WriteHeader(http.StatusOK)

		// 3. 调用我们在 chat_service.go 中抽取的公共业务逻辑
		// 注意：这里直接调用 s.streamChatWithOpenAI
		err := s.streamChatWithOpenAI(c.Request().Context(), req.Message, func(content string) error {
			// 构造响应对象
			resp := &v1pb.ChatResponse{
				Content: content,
				Type:    "text",
			}

			// 序列化为 JSON
			// 为了简化，这里手动构造 JSON 字符串，或者使用 json.Marshal
			// 注意：gRPC-Gateway 默认行为是返回 {"result": ...}，这里我们直接返回数据对象
			b, _ := json.Marshal(resp)

			// 写入 Response Writer
			if _, err := c.Response().Write(b); err != nil {
				return err
			}
			// 写入换行符，方便前端按行解析
			c.Response().Write([]byte("\n"))
			c.Response().Flush() // 必须 Flush 才能实现流式效果
			return nil
		})

		if err != nil {
			// 如果流传输中途出错，记录日志（此时通常无法再修改状态码了）
			return nil
		}
		return nil
	})

	gwGroup.Any("/api/v1/*", handler)
	gwGroup.Any("/file/*", handler)

	// Connect handlers for browser clients (replaces grpc-web).
	logStacktraces := s.Profile.Demo
	connectInterceptors := connect.WithInterceptors(
		NewMetadataInterceptor(), // Convert HTTP headers to gRPC metadata first
		NewLoggingInterceptor(logStacktraces),
		NewRecoveryInterceptor(logStacktraces),
		NewAuthInterceptor(s.Store, s.Secret),
	)
	connectMux := http.NewServeMux()
	connectHandler := NewConnectServiceHandler(s)
	connectHandler.RegisterConnectHandlers(connectMux, connectInterceptors)

	// Wrap with CORS for browser access
	corsHandler := middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOriginFunc: func(_ string) (bool, error) {
			return true, nil
		},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowHeaders:     []string{"*"},
		AllowCredentials: true,
	})
	connectGroup := echoServer.Group("", corsHandler)
	connectGroup.Any("/memos.api.v1.*", echo.WrapHandler(connectMux))

	return nil
}
