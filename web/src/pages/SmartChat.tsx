import {  SendIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Memos 主要使用 Joy UI
// import Icon from "@/components/Icon"; // Memos 内部封装的图标组件
import MobileHeader from "@/components/MobileHeader";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // 模拟调用 AI 接口（你可以替换为 OpenAI 或 Memos 后端 API）
      // 如果 Memos 后端已配置 AI，可以调用类似 /api/v1/ai/chat 的接口
      const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer 7c176ce0-60c7-41c2-b223-0499eca8c6fa`,
        },
        body: JSON.stringify({
          model: "doubao-1-5-pro-32k-250115",
          messages: [...messages, userMsg],
        }),
      });

      const data = await response.json();
      const aiContent = data.choices[0].message.content;

      setMessages((prev) => [...prev, { role: "assistant", content: aiContent }]);
    } catch (error) {
      console.error("AI 响应错误:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <section className="w-full max-w-2xl min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
      <MobileHeader className="AI Assistant" />
      
      {/* 消息展示区 */}
      <div 
        ref={scrollRef}
        className="flex-grow p-4 overflow-y-auto space-y-4"
      >
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] p-3 rounded-2xl ${
              msg.role === "user" 
                ? "bg-blue-600 text-white rounded-br-none" 
                : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-bl-none"
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="text-zinc-400 text-xs animate-pulse">AI 正在思考...</div>
        )}
      </div>

      {/* 输入区 - 复用 Memos 的样式 */}
      <div className="p-4 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-2 items-end">
          <Textarea
            className="flex-grow"
            placeholder="问问 AI..."
            // minRows={1}
            // maxRows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!input.trim() || isTyping}
            className="mb-1"
          >
            <SendIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Chat;