import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [messages, setMessages] = useState<{ from: string; text: string }[]>(
    []
  );
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    const userMessage = { from: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const res = await axios.post("/api/chat", { message: input });
    const aiMessage = { from: "bot", text: res.data.message };
    setMessages((prev) => [...prev, aiMessage]);
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">AI Travel Planner</h1>
      <div className="border p-2 h-80 overflow-y-scroll">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`my-1 ${
              msg.from === "user" ? "text-right" : "text-left"
            }`}
          >
            <span className="bg-gray-200 rounded px-2 py-1 inline-block">
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <div className="flex mt-2">
        <input
          className="border p-2 flex-grow"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 ml-2"
        >
          Send
        </button>
      </div>
    </div>
  );
}
