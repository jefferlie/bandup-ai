import { Send, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  subject?: string; // speaking mode support
  onAudioSubmit?: (blob: Blob) => void; // audio submit callback
}
const InputArea = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  subject,
  onAudioSubmit,
}: InputAreaProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        if (onAudioSubmit) {
          onAudioSubmit(audioBlob);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Audio recording error:", error);
    }
  };
  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(e);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  };
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
  };
  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-border">
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={handleTextareaChange}
          placeholder={placeholder}
          className="flex-1 min-h-[56px] max-h-32 py-4 px-4 border border-input rounded-xl bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-tight"
          rows={1}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className={`w-14 p-0 flex items-center justify-center min-h-[56px] transition-all duration-200 ${value.trim() && !disabled
              ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            } rounded-xl`}
        >
          <Send size={20} className={value.trim() && !disabled ? "translate-x-0.5" : ""} />
        </button>
        
        {subject === "speaking" && (
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={disabled}
            className={`w-12 p-0 flex items-center justify-center min-h-[48px] rounded-lg transition-all duration-200 ${isRecording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-accent text-foreground hover:bg-accent/80"
              }`}
          >
            {isRecording ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground mt-2 text-center">
        Press Enter to send, Shift+Enter for a new line
      </div>
    </form>
  );
};
export default InputArea;
