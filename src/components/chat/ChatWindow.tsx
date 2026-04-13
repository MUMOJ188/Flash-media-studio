import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  author: "me" | "admin";
  text?: string;
  imageUrl?: string;
  createdAt: Date;
}

const ChatWindow = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", author: "admin", text: "Hi! Share details and files here.", createdAt: new Date() },
  ]);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const send = () => {
    if (!text && !fileRef.current?.files?.length) return;
    const newMsg: Message = {
      id: Math.random().toString(36).slice(2),
      author: "me",
      text: text || undefined,
      createdAt: new Date(),
    };
    if (fileRef.current?.files?.[0]) {
      const file = fileRef.current.files[0];
      newMsg.imageUrl = URL.createObjectURL(file);
      toast({ title: "File sharing (demo)", description: `Selected: ${file.name}` });
      fileRef.current.value = "";
    }
    setMessages((m) => [...m, newMsg]);
    setText("");
  };

  return (
    <div className="grid gap-4">
      <div className="h-72 overflow-y-auto rounded-md border p-4 bg-background">
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={m.author === "me" ? "text-right" : "text-left"}>
              <div className={`inline-block max-w-[85%] rounded-md border p-3 ${m.author === "me" ? "bg-secondary" : "bg-card"}`}>
                {m.text && <p className="text-sm">{m.text}</p>}
                {m.imageUrl && (
                  <img src={m.imageUrl} alt="Shared file preview" className="mt-2 max-h-48 rounded" />
                )}
                <span className="block mt-1 text-[10px] text-muted-foreground">
                  {m.createdAt.toLocaleTimeString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="min-h-10"
        />
        <Input ref={fileRef} type="file" accept="image/*" className="max-w-[220px]" />
        <Button onClick={send} variant="hero">Send</Button>
      </div>
    </div>
  );
};

export default ChatWindow;
