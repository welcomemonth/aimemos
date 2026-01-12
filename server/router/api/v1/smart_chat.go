package v1

import (
	"context"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

// 定义请求和响应结构
type SmartChatRequest struct {
	Content string `json:"content"`
}

type SmartChatResponse struct {
	Reply string `json:"reply"`
}

// CreateAIChat 是我们要添加的新函数
func (s *APIV1Service) CreateAIChat(c echo.Context) error {
	ctx := context.Background()
	req := &SmartChatRequest{}
	if err := c.Bind(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	// 初始化客户端 (建议以后把 API Key 放在 s.Profile 里)
	client := openai.NewClient(
		option.WithBaseURL(os.Getenv("ARK_BASE_URL")),
		option.WithAPIKey(os.Getenv("ARK_API_KEY")),
	)

	// 1. 设置响应头，告诉浏览器：这是一个流式输出（SSE）
	c.Response().Header().Set(echo.HeaderContentType, "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().WriteHeader(http.StatusOK)

	params := openai.ChatCompletionNewParams{
		Model: "doubao-1-5-pro-32k-250115",
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage(req.Content),
		},
		// 这里不需要额外的 StreamOptions 字段
		// 流式由 NewStreaming() 方法自动处理
	}
	stream := client.Chat.Completions.NewStreaming(ctx, params)
	defer stream.Close()
	// 调用 AI
	// 3. 循环读取流
	for stream.Next() {
		chunk := stream.Current()
		for _, choice := range chunk.Choices {
			if content := choice.Delta.Content; content != "" {
				// 将内容实时写入响应体
				// 注意：这里我们直接输出文本，也可以按照 SSE 格式 "data: 内容\n\n" 输出
				_, _ = c.Response().Write([]byte(content))
				c.Response().Flush() // 强制把缓冲区的数据刷给前端
			}
		}
	}

	if err := stream.Err(); err != nil {
		return err
	}

	return nil
}
