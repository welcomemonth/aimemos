package main

import (
	"context"
	"fmt"
	"log"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

func main() {
	// 初始化客户端，设定 BaseURL 和 API Key
	client := openai.NewClient(
		option.WithBaseURL("https://ark.cn-beijing.volces.com/api/v3"),
		option.WithAPIKey("7c176ce0-60c7-41c2-b223-0499eca8c6fa"),
	)

	ctx := context.Background()

	// 流式请求参数
	params := openai.ChatCompletionNewParams{
		Model: "doubao-1-5-pro-32k-250115",
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage("Hello from Go! This is a streaming test."),
		},
		// 这里不需要额外的 StreamOptions 字段
		// 流式由 NewStreaming() 方法自动处理
	}

	// 调用流式接口
	stream := client.Chat.Completions.NewStreaming(ctx, params)

	if stream == nil {
		log.Fatal("failed to create streaming request")
	}
	defer stream.Close()

	// 逐段读取事件
	fmt.Println("Streaming response:")
	for stream.Next() {
		chunk := stream.Current()

		// 内容增量在 chunk.Choices[*].Delta.Content
		for _, choice := range chunk.Choices {
			if content := choice.Delta.Content; content != "" {
				fmt.Print(content) // 实时打印生成的文本
			}
		}
	}

	// 检查流是否有错误
	if err := stream.Err(); err != nil {
		log.Fatalf("stream error: %v", err)
	}

	fmt.Println("\nStreaming finished.")
}
