import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button"; // Memos 使用 Joy UI 或 Tailwind
// import Icon from "@/components/Icon"; // Memos 的图标组件
import ReactMarkdown from "react-markdown"; // Memos 应该已经包含 markdown 渲染库
import { chatServiceClient } from "@/connect";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    // 先添加一个空的 AI 消息用于流式填充
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    // try {
    //   // Memos 的 gRPC-Gateway 通常将 HTTP POST 转发到 gRPC
    //   // 这里直接使用 fetch 请求我们定义的 HTTP 路径
    //   const response = await fetch("/api/v1/chat/completions", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({ message: userMsg }),
    //   });

    //   if (!response.body) throw new Error("No response body");

    //   const reader = response.body.getReader();
    //   const decoder = new TextDecoder("utf-8");
    //   let aiResponseAccumulated = "";

    //   while (true) {
    //     const { done, value } = await reader.read();
    //     if (done) break;

    //     const chunk = decoder.decode(value, { stream: true });
        
    //     // gRPC-Gateway 返回的数据通常是分块的 JSON 对象
    //     // 格式通常是: {"result": {"content": "...", "type": "..."}}
    //     // 需要解析这些块。注意：TCP 粘包可能导致一次收到多个 JSON 或不完整的 JSON
    //     // 这里做一个简单的处理逻辑 (实际生产可能需要更严谨的 NDJSON 解析器)
        
    //     // 假设 gRPC-Gateway 返回的是换行分隔的 JSON
    //     const lines = chunk.split("\n").filter((line) => line.trim() !== "");
        
    //     for (const line of lines) {
    //        try {
    //          const json = JSON.parse(line);
    //          // 根据 gRPC-Gateway 的默认封装，数据可能在 result 字段里
    //          const content = json.result?.content || json.content || ""; 
             
    //          aiResponseAccumulated += content;
             
    //          // 更新最后一条消息 (AI 的消息)
    //          setMessages((prev) => {
    //            const newMsgs = [...prev];
    //            const lastMsg = newMsgs[newMsgs.length - 1];
    //            if (lastMsg.role === "ai") {
    //              lastMsg.content = aiResponseAccumulated;
    //            }
    //            return newMsgs;
    //          });
    //        } catch (e) {
    //          console.log("Chunk parse error (ignorable for stream fragments)", e);
    //          // 如果是纯文本流而不是 JSON，直接追加
    //          // aiResponseAccumulated += chunk; 
    //        }
    //     }
    //   }
    // } catch (error) {
    //   console.error("Chat error:", error);
    //   setMessages((prev) => [...prev, { role: "ai", content: "Error: Failed to fetch response." }]);
    // } finally {
    //   setIsLoading(false);
    // }

    // ==========================================
      // 核心修改：使用 gRPC Client 进行流式调用
      // ==========================================
    try {
      // client.chat 返回一个异步可迭代对象 (AsyncIterable)
      for await (const res of chatServiceClient.chat({ message: userMsg })) {
        // res 是 ChatResponse 类型，有代码提示，非常安全
        const delta = res.content;
        
        setMessages((prev) => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === "ai") {
            lastMsg.content += delta; // 直接追加内容
          }
          return newMsgs;
        });
      }
    } catch (error) {
      console.error("RPC Error:", error);
      setMessages((prev) => [...prev, { role: "ai", content: "Error: AI disconnected." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Assistant</h1>
      
      {/* 消息列表 */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto mb-4 space-y-4 border rounded-lg p-4 bg-gray-50 dark:bg-zinc-800"
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            Tell me something...
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-zinc-700 shadow-sm"
              }`}
            >
              {/* 使用 Markdown 渲染 AI 回复 */}
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <input
          className="flex-1 p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask AI anything..."
          disabled={isLoading}
        />
        <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
          {isLoading ? "..." : "Send"}
        </Button>
      </div>
    </div>
  );
};

export default Chat;