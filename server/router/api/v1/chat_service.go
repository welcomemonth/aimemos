package v1

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/responses"
	"github.com/openai/openai-go/v3/shared"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// ==========================================
// 1. 核心逻辑 (抽取出来供下面两个方法共用)
// ==========================================
func (s *APIV1Service) streamChatWithOpenAI(ctx context.Context, message string, sendFunc func(string) error) error {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		apiKey = "3c350db4-30b6-4863-b1fd-3f306f5f63e9"
		// return status.Error(codes.Internal, "OpenAI API Key not configured")
	}

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL("https://ark.cn-beijing.volces.com/api/v3"),
	)

	// 发起流式请求
	openAIStream := client.Responses.NewStreaming(ctx, responses.ResponseNewParams{
		Model: shared.ChatModel("doubao-seed-1-8-251228"), // 请确保模型名称正确
		Input: responses.ResponseNewParamsInputUnion{
			OfString: openai.String(message),
		},
	})
	defer openAIStream.Close()

	// 循环读取流
	for openAIStream.Next() {
		response := openAIStream.Current()
		content := response.Delta

		if content == "" {
			continue
		}

		// 调用回调函数发送数据
		if err := sendFunc(content); err != nil {
			// 如果客户端断开连接，通常会返回 io.EOF 或 canceled，停止处理即可
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}

	if err := openAIStream.Err(); err != nil {
		fmt.Printf("OpenAI stream error: %v", err)
		return status.Errorf(codes.Internal, "OpenAI stream error: %v", err)
	}

	return nil
}

// ==========================================
// 2. Standard gRPC 实现 (用于 gRPC-Gateway / Backend)
// ==========================================
func (s *APIV1Service) Chat(req *v1pb.ChatRequest, stream v1pb.ChatService_ChatServer) error {
	ctx := stream.Context()
	return s.streamChatWithOpenAI(ctx, req.Message, func(content string) error {
		return stream.Send(&v1pb.ChatResponse{
			Content: content,
			Type:    "text",
		})
	})
}
