import React from "react";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  sendPrompt,
  sendPromptToDeepSeek,
  sendPromptToGpt4o,
  sendPromptToGemini,
} from "./api/api";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Define types for API responses
interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning?: string;
    };
  }>;
}

// Define types for messages
interface Message {
  type: "user" | "response";
  content: string;
  model?: string;
  images?: string[]; // Add images array to store image data URLs
}

// Define props for CodeBlock component
interface CodeBlockProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Add type for Chat Session
interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<
    "o3-mini" | "deepseek" | "gpt-4o" | "gemini-flash"
  >("o3-mini"); // Default model
  const [selectedImage, setSelectedImage] = useState<File | null>(null); // Add state for image
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]); // Add chat history state
  const [currentChatId, setCurrentChatId] = useState<string | null>(null); // Add current chat ID
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutation for o3-mini
  const o3Mutation = useMutation({
    mutationFn: (input: string) => sendPrompt(input),
    onSuccess: handleApiSuccess,
  });

  // Mutation for deepseek
  const deepseekMutation = useMutation({
    mutationFn: (input: string) => sendPromptToDeepSeek(input),
    onSuccess: handleApiSuccess,
  });

  // Mutation for GPT-4o
  const gpt4oMutation = useMutation({
    mutationFn: (input: string | { content: string; image: string }) =>
      sendPromptToGpt4o(input),
    onSuccess: handleApiSuccess,
  });

  // Mutation for Gemini 2.0 Flash
  const geminiMutation = useMutation({
    mutationFn: (input: string) => sendPromptToGemini(input),
    onSuccess: handleApiSuccess,
  });

  // Get the current active mutation based on selected model
  const getCurrentMutation = () => {
    switch (selectedModel) {
      case "o3-mini":
        return o3Mutation;
      case "deepseek":
        return deepseekMutation;
      case "gpt-4o":
        return gpt4oMutation;
      case "gemini-flash":
        return geminiMutation;
      default:
        return o3Mutation;
    }
  };

  const currentMutation = getCurrentMutation();
  const { mutate, isPending, error } = currentMutation;

  // Shared success handler for all mutations
  function handleApiSuccess(data: ApiResponse) {
    // Extract the response content from the API response structure
    let responseContent = data.choices && data.choices[0]?.message?.content;

    // Clean up LaTeX formatting for DeepSeek responses only
    if (selectedModel === "deepseek" && responseContent) {
      responseContent = responseContent
        .replace(/\\boxed{/g, "") // Remove opening \boxed{
        .replace(/}/g, "") // Remove closing }
        .trim(); // Remove any extra whitespace
    }

    setMessages((prev) => [
      ...prev,
      {
        type: "response",
        model: selectedModel,
        content: responseContent || "No response content found in API response",
      },
    ]);

    // Log the full response for debugging
    console.log("Full API response:", data);
  }

  // Add function to save current chat
  const saveCurrentChat = () => {
    if (messages.length === 0) return;

    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: messages[0].content.substring(0, 30) + "...", // Use first message as title (truncated)
      messages: [...messages],
      timestamp: Date.now(),
    };

    setChatHistory((prev) => [...prev, newChat]);
    setCurrentChatId(newChat.id);
  };

  // Add function to load chat from history
  const loadChat = (chatId: string) => {
    const chat = chatHistory.find((c) => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentChatId(chatId);
    }
  };

  // Add function to start new chat
  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !selectedImage) return;

    // Add user message to chat with both prompt and image if present
    const userMessage: Message = {
      type: "user",
      content: prompt || "Image upload",
      images: [],
    };

    if (selectedImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const imageDataUrl = reader.result as string;
        userMessage.images = [imageDataUrl];
        setMessages((prev) => [...prev, userMessage]);

        // Handle image upload for GPT-4o
        if (selectedModel === "gpt-4o") {
          const base64Image = imageDataUrl.split(",")[1];
          // Use the specific mutation directly instead of the generic mutate
          gpt4oMutation.mutate({
            content: prompt || "Analyze this image",
            image: base64Image,
          });
        } else {
          // For other models, use the text prompt
          mutate(prompt);
        }
      };
      reader.readAsDataURL(selectedImage);
    } else {
      // Regular text prompt
      setMessages((prev) => [...prev, userMessage]);
      mutate(prompt);
    }

    // Clear inputs
    setPrompt("");
    setSelectedImage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedImage(file || null);
  };

  // Custom renderer for code blocks
  const CodeBlock = ({
    inline,
    className,
    children,
    ...props
  }: CodeBlockProps) => {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  const getModelDisplayName = (modelId: string) => {
    switch (modelId) {
      case "o3-mini":
        return "OpenAI o3-mini";
      case "deepseek":
        return "DeepSeek";
      case "gpt-4o":
        return "GPT-4o";
      case "gemini-flash":
        return "Gemini 2.0 Flash";
      default:
        return modelId;
    }
  };

  return (
    <div className="flex w-full h-screen overflow-hidden">
      <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">AI Chat Models</h1>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-gray-800">Chat History</div>
              <button
                onClick={saveCurrentChat}
                disabled={messages.length === 0}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                Save Chat
              </button>
            </div>
            <button
              onClick={startNewChat}
              className="w-full text-left p-2 mb-2 bg-blue-50 rounded hover:bg-blue-100"
            >
              + New Chat
            </button>
            {chatHistory.length === 0 ? (
              <div className="text-sm text-gray-500">No saved chats</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                {chatHistory
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => loadChat(chat.id)}
                      className={`text-left p-2 rounded ${
                        currentChatId === chat.id
                          ? "bg-blue-100"
                          : "hover:bg-blue-50"
                      }`}
                    >
                      <div className="font-medium truncate">{chat.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(chat.timestamp).toLocaleTimeString()}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div className="font-semibold mb-4 text-gray-800">Select Model:</div>
          <div className="flex flex-col gap-4">
            <label
              className={`flex items-start p-4 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                selectedModel === "o3-mini" ? "bg-blue-50 border-blue-500" : ""
              } hover:bg-blue-50 hover:border-blue-500`}
            >
              <input
                type="radio"
                name="model"
                value="o3-mini"
                checked={selectedModel === "o3-mini"}
                onChange={() => setSelectedModel("o3-mini")}
                disabled={isPending}
                className="mr-3 mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold mb-1">OpenAI o3-mini</div>
                <div className="text-sm text-gray-500">
                  Fast, efficient responses
                </div>
              </div>
            </label>

            <label
              className={`flex items-start p-4 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                selectedModel === "gpt-4o" ? "bg-blue-50 border-blue-500" : ""
              } hover:bg-blue-50 hover:border-blue-500`}
            >
              <input
                type="radio"
                name="model"
                value="gpt-4o"
                checked={selectedModel === "gpt-4o"}
                onChange={() => setSelectedModel("gpt-4o")}
                disabled={isPending}
                className="mr-3 mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold mb-1">GPT-4o</div>
                <div className="text-sm text-gray-500">
                  Advanced capabilities, more accurate
                </div>
              </div>
            </label>

            <label
              className={`flex items-start p-4 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                selectedModel === "gemini-flash"
                  ? "bg-blue-50 border-blue-500"
                  : ""
              } hover:bg-blue-50 hover:border-blue-500`}
            >
              <input
                type="radio"
                name="model"
                value="gemini-flash"
                checked={selectedModel === "gemini-flash"}
                onChange={() => setSelectedModel("gemini-flash")}
                disabled={isPending}
                className="mr-3 mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold mb-1">Gemini 2.0 Flash</div>
                <div className="text-sm text-gray-500">
                  Google's fast and powerful model
                </div>
              </div>
            </label>

            <label
              className={`flex items-start p-4 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                selectedModel === "deepseek" ? "bg-blue-50 border-blue-500" : ""
              } hover:bg-blue-50 hover:border-blue-500`}
            >
              <input
                type="radio"
                name="model"
                value="deepseek"
                checked={selectedModel === "deepseek"}
                onChange={() => setSelectedModel("deepseek")}
                disabled={isPending}
                className="mr-3 mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold mb-1">DeepSeek</div>
                <div className="text-sm text-gray-500">
                  Alternative model with unique strengths
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-800">
            Chat with {getModelDisplayName(selectedModel)}
          </h2>
          {isPending && (
            <div className="text-sm text-blue-600 font-medium animate-pulse">
              Processing...
            </div>
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="flex flex-col items-center text-center max-w-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-12 h-12 text-blue-600 opacity-70 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <p className="text-lg mb-2">Send a message to start chatting</p>
                <p className="text-sm opacity-70">
                  Choose a model from the sidebar and type your message below
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`max-w-[85%] animate-fadeIn ${
                  msg.type === "user" ? "self-end" : "self-start"
                }`}
              >
                <div
                  className={`p-4 rounded-lg shadow-sm ${
                    msg.type === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white rounded-bl-none"
                  }`}
                >
                  {msg.type === "response" && msg.model && (
                    <div className="text-xs font-semibold uppercase mb-2 opacity-70 tracking-wide">
                      {getModelDisplayName(msg.model)}
                    </div>
                  )}
                  {msg.type === "user" ? (
                    <div className="whitespace-pre-wrap">
                      {msg.content}
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.images.map((img, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={img}
                              alt={`Uploaded image ${imgIndex + 1}`}
                              className="max-w-[200px] max-h-[200px] rounded-lg border border-gray-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <ReactMarkdown
                      components={{
                        code: (props) => <CodeBlock {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          )}
          {isPending && (
            <div className="max-w-[85%] self-start animate-fadeIn">
              <div className="p-4 rounded-lg shadow-sm bg-white rounded-bl-none">
                <div className="text-xs font-semibold uppercase mb-2 opacity-70 tracking-wide">
                  {getModelDisplayName(selectedModel)}
                </div>
                <div className="flex gap-1 justify-start">
                  <span className="animate-loadingDots w-2 h-2 bg-gray-500 rounded-full"></span>
                  <span className="animate-loadingDots [animation-delay:0.2s] w-2 h-2 bg-gray-500 rounded-full"></span>
                  <span className="animate-loadingDots [animation-delay:0.4s] w-2 h-2 bg-gray-500 rounded-full"></span>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="max-w-[70%] self-center">
              <div className="p-4 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center gap-2">
                <div className="text-lg">⚠️</div>
                <div>Error: {(error as Error).message}</div>
              </div>
            </div>
          )}
        </div>

        <form
          className="p-4 bg-gray-100 border-t border-gray-200"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type your message here..."
              disabled={isPending}
              className="flex-1 p-2 border border-gray-300 rounded text-base"
            />
            {selectedModel === "gpt-4o" && (
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isPending}
                className="p-2 border border-gray-300 rounded bg-white"
                ref={fileInputRef}
              />
            )}
            <button
              type="submit"
              disabled={isPending || (!prompt.trim() && !selectedImage)}
              className="flex items-center gap-1 p-2 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex gap-1">
                  <span className="animate-loadingDots w-2 h-2 bg-gray-500 rounded-full"></span>
                  <span className="animate-loadingDots [animation-delay:0.2s] w-2 h-2 bg-gray-500 rounded-full"></span>
                  <span className="animate-loadingDots [animation-delay:0.4s] w-2 h-2 bg-gray-500 rounded-full"></span>
                </span>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
