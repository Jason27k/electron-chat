import React from "react";
import { useState, useRef, useEffect } from "react";
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
import TitleBar from "./components/TitleBar";

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
  timestamp?: number; // Add timestamp for messages
}

// Define type for chat history
interface ChatHistory {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// Define props for CodeBlock component
interface CodeBlockProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<
    "o3-mini" | "deepseek" | "gpt-4o" | "gemini-flash"
  >("o3-mini"); // Default model
  const [selectedImage, setSelectedImage] = useState<File | null>(null); // Add state for image
  const [imagePreview, setImagePreview] = useState<string | null>(null); // Add state for image preview
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(false);

  // Load chat histories from localStorage on component mount
  useEffect(() => {
    const savedHistories = localStorage.getItem("chatHistories");
    if (savedHistories) {
      setChatHistories(JSON.parse(savedHistories));
    }
  }, []);

  // Save chat histories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("chatHistories", JSON.stringify(chatHistories));
  }, [chatHistories]);

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
    mutationFn: (input: string | { content: string; image: string }) =>
      sendPromptToGemini(input),
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

    const newMessage = {
      type: "response" as const,
      model: selectedModel,
      content: responseContent || "No response content found in API response",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);

    // Update chat history if we're in an existing chat
    if (currentChatId) {
      updateChatHistory(currentChatId, [...messages, newMessage]);
    } else if (messages.length > 0) {
      // Create a new chat history if this is the first response
      createNewChatHistory([...messages, newMessage]);
    }

    // Log the full response for debugging
    console.log("Full API response:", data);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !selectedImage) return;

    // Add user message to chat with both prompt and image if present
    const userMessage: Message = {
      type: "user",
      content: prompt || "Image upload",
      images: [],
      timestamp: Date.now(),
    };

    if (selectedImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const imageDataUrl = reader.result as string;
        userMessage.images = [imageDataUrl];
        setMessages((prev) => [...prev, userMessage]);

        // Handle image upload for GPT-4o and Gemini
        if (selectedModel === "gpt-4o" || selectedModel === "gemini-flash") {
          const base64Image = imageDataUrl.split(",")[1];

          if (selectedModel === "gpt-4o") {
            // Use the specific mutation directly instead of the generic mutate
            gpt4oMutation.mutate({
              content: prompt || "Analyze this image",
              image: base64Image,
            });
          } else if (selectedModel === "gemini-flash") {
            // Use the Gemini mutation for image
            geminiMutation.mutate({
              content: prompt || "Analyze this image",
              image: base64Image,
            });
          }
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
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedImage(file || null);

    // Create and set image preview
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  // Create a new chat history
  const createNewChatHistory = (msgs: Message[]) => {
    // Generate a title from the first user message
    const firstUserMsg = msgs.find((msg) => msg.type === "user");
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 30) +
        (firstUserMsg.content.length > 30 ? "..." : "")
      : "New Chat";

    const newChatHistory: ChatHistory = {
      id: Date.now().toString(),
      title,
      model: selectedModel,
      messages: msgs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setChatHistories((prev) => [newChatHistory, ...prev]);
    setCurrentChatId(newChatHistory.id);
  };

  // Update an existing chat history
  const updateChatHistory = (chatId: string, msgs: Message[]) => {
    setChatHistories((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: msgs, updatedAt: Date.now() }
          : chat
      )
    );
  };

  // Load a chat history
  const loadChatHistory = (chatId: string) => {
    const chat = chatHistories.find((c) => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setSelectedModel(
        chat.model as "o3-mini" | "deepseek" | "gpt-4o" | "gemini-flash"
      );
      setCurrentChatId(chatId);
      setShowHistorySidebar(false);
    }
  };

  // Start a new chat
  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setShowHistorySidebar(false);
  };

  // Delete a chat history
  const deleteChatHistory = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler
    setChatHistories((prev) => prev.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      startNewChat();
    }
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      <TitleBar title={`${getModelDisplayName(selectedModel)}`} />
      <div className="flex w-full flex-1 overflow-hidden">
        {/* Model selection sidebar */}
        <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="font-semibold mb-4 text-gray-800">
              Select Model:
            </div>
            <div className="flex flex-col gap-4">
              <label
                className={`flex items-start p-4 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                  selectedModel === "o3-mini"
                    ? "bg-blue-50 border-blue-500"
                    : ""
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
                  selectedModel === "deepseek"
                    ? "bg-blue-50 border-blue-500"
                    : ""
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

          {/* Chat history controls */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className="w-full py-2 px-4 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Chat History</span>
            </button>

            <button
              onClick={startNewChat}
              className="w-full mt-2 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {/* Chat history sidebar - conditionally rendered */}
        {showHistorySidebar && (
          <div className="w-[300px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Chat History</h2>
              <button
                onClick={() => setShowHistorySidebar(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {chatHistories.length === 0 ? (
                <div className="text-center p-6 text-gray-500">
                  No chat history yet
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {chatHistories.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => loadChatHistory(chat.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        currentChatId === chat.id
                          ? "bg-blue-50 border-blue-500"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-gray-800 truncate flex-1">
                          {chat.title}
                        </div>
                        <button
                          onClick={(e) => deleteChatHistory(chat.id, e)}
                          className="text-gray-400 hover:text-red-500 ml-2"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex justify-between">
                        <span>{getModelDisplayName(chat.model)}</span>
                        <span>{formatDate(chat.updatedAt)}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate">
                        {chat.messages.length} messages
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col h-full bg-gray-50">
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
                  <p className="text-lg mb-2">
                    Send a message to start chatting
                  </p>
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
                    {msg.timestamp && (
                      <div className="text-xs opacity-60 mt-2 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
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
            <div className="max-w-3xl mx-auto">
              {(selectedModel === "gpt-4o" ||
                selectedModel === "gemini-flash") &&
                imagePreview && (
                  <div className="mb-3 relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-20 rounded-lg border border-gray-300 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeSelectedImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Type your message here..."
                  disabled={isPending}
                  className="flex-1 p-2 border border-gray-300 rounded text-base"
                />
                {(selectedModel === "gpt-4o" ||
                  selectedModel === "gemini-flash") && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                    className="p-2 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
                    title="Upload image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={isPending}
                      className="hidden"
                      ref={fileInputRef}
                    />
                  </button>
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
