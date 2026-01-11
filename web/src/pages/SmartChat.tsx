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
        const response = await fetch("/api/v1/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input }),
        });

        if (!response.body) return;

        // 1. 获取读取器
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        // 2. 循环读取数据块
        while (true) {
          const { done, value } = await reader.read();
          if (done) break; // 读取完成

          // 3. 解码并追加内容
          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // 4. 实时更新界面上最后一条消息的内容
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = accumulatedContent;
            return newMessages;
          });
        }
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