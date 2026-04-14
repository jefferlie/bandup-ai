import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
}

const ChatMessage = ({ message, isUser, timestamp }: ChatMessageProps) => {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`chat-message ${isUser ? "chat-user" : "chat-ai"}`}>
        <div className="text-sm leading-relaxed space-y-1 prose prose-sm max-w-none">
          <ReactMarkdown>{message}</ReactMarkdown>
        </div>
        {timestamp && (
          <p className="text-xs opacity-70 mt-2">
            {new Date(timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
