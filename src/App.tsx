import React from "react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import TitleBar from "./components/TitleBar";

// Define types for messages
interface DocumentInfo {
  id: number;
  name: string;
  contentType: string;
  size: number;
  isTruncated: boolean;
}

interface Message {
  id?: string;
  type: "user" | "response";
  content: string;
  model?: string;
  images?: string[]; // Array of image IDs or URLs
  imageIds?: number[]; // Add imageIds array to store image IDs
  documentIds?: number[]; // Add documentIds array to store document IDs
  documents?: string[]; // Array of document names or URLs
  documentInfo?: DocumentInfo[]; // Add documentInfo array to store detailed document information
  timestamp?: number; // Add timestamp for messages
}

// Define props for CodeBlock component
interface CodeBlockProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Define the available models
const MODELS = {
  OPEN_AI: ["o3-mini", "gpt-4o"],
  DEEPSEEK: ["deepseek-chat", "deepseek-reasoner"],
  CLAUDE: ["claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"],
  GEMINI: ["gemini-2.0-flash"],
};

// Models that support image input
const IMAGE_MODELS = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-haiku-20241022",
  "gpt-4o",
  "gemini-2.0-flash",
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.0-flash"); // Default model
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(false);
  const [showModelSidebar, setShowModelSidebar] = useState<boolean>(true);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string>("0");
  const [serverConversations, setServerConversations] = useState<
    Conversation[]
  >([]);

  // Define Conversation type
  interface Conversation {
    id: number;
    title: string;
    created_at: string;
  }

  // Define ServerMessage type
  interface ServerMessage {
    id: number;
    role: string;
    content: string;
    model: string;
    timestamp: string;
    image_id?: number;
    document_id?: number;
    document_info?: {
      filename: string;
      content_type: string;
      size: number;
      is_truncated: boolean;
    };
  }

  // Load conversations from the server
  useEffect(() => {
    const loadConversations = async () => {
      const conversations = await fetchConversations();
      setServerConversations(conversations);
    };

    loadConversations();
    // Refresh conversations every 30 seconds
    const intervalId = setInterval(loadConversations, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // Function to upload an image to the server
  const uploadImage = async (file: File): Promise<number | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/upload-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Image upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("Image uploaded successfully:", data);
      return data.image_id;
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  };

  // Function to send message to the API
  const sendMessage = async (
    userPrompt: string,
    imageId: number | null,
    documentId: number | null = null
  ) => {
    setIsPending(true);
    setError(null);

    try {
      // Determine which endpoint to use based on the content
      let endpointUrl: string;

      if (imageId !== null) {
        endpointUrl = `${import.meta.env.VITE_SERVER_URL}/image-chat-stream`;
      } else if (documentId !== null) {
        endpointUrl = `${import.meta.env.VITE_SERVER_URL}/chat-with-document`;
      } else {
        endpointUrl = `${import.meta.env.VITE_SERVER_URL}/text-chat-stream`;
      }

      // Build the URL with query parameters
      const url = new URL(endpointUrl);
      url.searchParams.append("model", selectedModel);
      url.searchParams.append("prompt", userPrompt);
      url.searchParams.append("max_history", "10");
      url.searchParams.append("conversation_id", conversationId);

      if (imageId !== null) {
        url.searchParams.append("image_id", imageId.toString());
      }

      if (documentId !== null) {
        url.searchParams.append("document_id", documentId.toString());
      }

      // Create a placeholder for the streaming response
      const streamingMessageId = Date.now().toString();

      // Add an initial empty response message
      setMessages((prev) => [
        ...prev,
        {
          id: streamingMessageId,
          type: "response",
          model: selectedModel,
          content: "",
          timestamp: Date.now(),
        },
      ]);

      // Create a controller to abort the fetch if needed
      const controller = new AbortController();
      const { signal } = controller;

      // Use fetch with text streaming instead of EventSource
      const response = await fetch(url.toString(), {
        method: "GET",
        signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Get conversation ID from headers
      const newConversationId = response.headers.get("X-Conversation-ID");
      if (newConversationId) {
        setConversationId(newConversationId);
        setCurrentChatId(newConversationId);

        // Refresh the conversation list to include the new conversation
        const conversations = await fetchConversations();
        setServerConversations(conversations);
      }

      // Get the reader from the response body
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is null");

      // Create a decoder for the stream
      const decoder = new TextDecoder();
      let responseText = "";
      let done = false;

      // Process the stream
      while (!done) {
        const result = await reader.read();
        done = result.done;

        if (done) {
          // Stream is complete
          setIsPending(false);
          break;
        }

        // Decode the chunk
        const chunk = decoder.decode(result.value, { stream: true });

        // Process the SSE format - each line starts with "data: "
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            // Extract the data part (remove "data: " prefix)
            // Use JSON.parse to handle quoted strings and preserve spaces
            try {
              const data = JSON.parse(line.substring(6));

              // Check if we've received the [DONE] marker
              if (data === "[DONE]") {
                setIsPending(false);
                done = true;
                break;
              }

              // Append the data to the response text
              responseText += data;

              // Update the streaming message by its ID
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamingMessageId
                    ? { ...msg, content: responseText, timestamp: Date.now() }
                    : msg
                )
              );
            } catch (e) {
              // If JSON parsing fails, just use the raw string
              const data = line.substring(6);

              if (data === "[DONE]") {
                setIsPending(false);
                done = true;
                break;
              }

              responseText += data;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamingMessageId
                    ? { ...msg, content: responseText, timestamp: Date.now() }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !selectedImage && !selectedDocument) return;

    // Add user message to chat with prompt, image, and/or document
    const userMessage: Message = {
      type: "user",
      content: prompt || (selectedImage ? "Image upload" : "Document upload"),
      images: [],
      imageIds: [],
      documents: [],
      documentIds: [],
      documentInfo: [],
      timestamp: Date.now(),
    };

    let imageId: number | null = null;
    let documentId: number | null = null;

    // If there's a selected image, upload it first
    if (selectedImage) {
      imageId = await uploadImage(selectedImage);

      if (imageId) {
        // Store the image ID in the message
        userMessage.imageIds = [imageId];

        // Create image preview URL
        const imageUrl = `${import.meta.env.VITE_SERVER_URL}/images/${imageId}`;
        userMessage.images = [imageUrl];

        console.log(`Image uploaded with ID: ${imageId}, URL: ${imageUrl}`);
      } else {
        console.error("Failed to upload image");
        setError(new Error("Failed to upload image"));
        return;
      }
    }

    // If there's a selected document, upload it
    if (selectedDocument) {
      try {
        const formData = new FormData();
        formData.append("file", selectedDocument);
        formData.append("file_type", selectedDocument.type);

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/process-document`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(`Document upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log("Document uploaded successfully:", data);

        documentId = data.document_id;

        // Store the document ID in the message
        userMessage.documentIds = [documentId || 0];

        // Store the document name
        userMessage.documents = [documentName || selectedDocument.name];

        // Store detailed document information
        userMessage.documentInfo = [
          {
            id: data.document_id,
            name: data.filename,
            contentType: data.content_type,
            size: data.size,
            isTruncated: data.is_truncated,
          },
        ];

        console.log(
          `Document uploaded with ID: ${documentId}, Name: ${data.filename}`
        );
      } catch (err) {
        console.error("Error uploading document:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return;
      }
    }

    // Add the new user message to the messages array
    setMessages((prev) => [...prev, userMessage]);

    // Send the message with image ID and/or document ID if available
    sendMessage(prompt, imageId, documentId);

    // Clear inputs
    setPrompt("");
    setSelectedImage(null);
    setImagePreview(null);
    setSelectedDocument(null);
    setDocumentName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (documentInputRef.current) {
      documentInputRef.current.value = "";
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

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedDocument(file || null);
    setDocumentName(file ? file.name : null);
  };

  const removeSelectedDocument = () => {
    setSelectedDocument(null);
    setDocumentName(null);
    if (documentInputRef.current) {
      documentInputRef.current.value = "";
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
    if (modelId.includes("o3-mini")) return "OpenAI o3-mini";
    if (modelId.includes("gpt-4o")) return "GPT-4o";
    if (modelId.includes("deepseek-chat")) return "DeepSeek Chat";
    if (modelId.includes("deepseek-reasoner")) return "DeepSeek Reasoner";
    if (modelId.includes("claude-3-7-sonnet")) return "Claude 3.7 Sonnet";
    if (modelId.includes("claude-3-5-haiku")) return "Claude 3.5 Haiku";
    if (modelId.includes("gemini-2.0-flash")) return "Gemini 2.0 Flash";
    return modelId;
  };

  // Load a chat history
  const loadChatHistory = async (chatId: string) => {
    setIsPending(true);

    try {
      const history = await fetchConversationHistory(chatId);

      if (history) {
        // Convert server messages format to our app format
        const formattedMessages = history.history.map((msg: ServerMessage) => {
          const formattedMsg: Message = {
            id: msg.id.toString(),
            type: msg.role === "user" ? "user" : "response",
            content: msg.content,
            model: msg.model,
            timestamp: new Date(msg.timestamp).getTime(),
          };

          // Add image information if present
          if (msg.image_id) {
            formattedMsg.imageIds = [msg.image_id];
            formattedMsg.images = [
              `${import.meta.env.VITE_SERVER_URL}/images/${msg.image_id}`,
            ];
          }

          // Add document information if present
          if (msg.document_id) {
            formattedMsg.documentIds = [msg.document_id];

            if (msg.document_info) {
              formattedMsg.documentInfo = [
                {
                  id: msg.document_id,
                  name: msg.document_info.filename,
                  contentType: msg.document_info.content_type,
                  size: msg.document_info.size,
                  isTruncated: msg.document_info.is_truncated,
                },
              ];
              formattedMsg.documents = [msg.document_info.filename];
            } else {
              formattedMsg.documents = [`Document ID: ${msg.document_id}`];
            }
          }

          return formattedMsg;
        });

        setMessages(formattedMessages);
        setCurrentChatId(chatId);
        setConversationId(chatId);

        // If there's at least one message with a model, set that as the selected model
        const lastModelMsg = [...formattedMessages]
          .reverse()
          .find((msg) => msg.model);
        if (lastModelMsg?.model) {
          setSelectedModel(lastModelMsg.model);
        }

        setShowHistorySidebar(false);
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  };

  // Start a new chat
  const startNewChat = async () => {
    await saveCurrentChatBeforeSwitching();
    setMessages([]);
    setCurrentChatId(null);
    setConversationId("0"); // Reset to default conversation ID
    setShowHistorySidebar(false);
  };

  // Delete a chat history
  const deleteChatHistory = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler

    try {
      await deleteConversation(chatId);

      // Update the local state
      setServerConversations((prev) =>
        prev.filter((chat) => chat.id.toString() !== chatId)
      );

      if (currentChatId === chatId) {
        startNewChat();
      }
    } catch (err) {
      console.error("Error deleting chat history:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Function to check if a model supports image uploads
  const modelSupportsImages = (model: string) => {
    return IMAGE_MODELS.includes(model);
  };

  // Add these functions to fetch conversations and history from the API

  // Function to fetch all conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/conversations`
      );
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error("Error fetching conversations:", err);
      return [];
    }
  };

  // Function to fetch conversation history
  const fetchConversationHistory = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_SERVER_URL
        }/chat-history/${conversationId}?max_history=50`
      );
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`Error fetching conversation ${conversationId}:`, err);
      return null;
    }
  };

  // Function to delete a conversation
  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/conversations/${conversationId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`Error deleting conversation ${conversationId}:`, err);
      return null;
    }
  };

  // Add a function to save the current chat state before switching
  const saveCurrentChatBeforeSwitching = async () => {
    if (currentChatId && messages.length > 0) {
      // We don't need to do anything here since the messages are saved on the server
      // when they're sent. This is just a placeholder in case you want to add
      // additional logic later.
    }
  };

  // Modify the chat history sidebar to use server conversations
  const renderChatHistorySidebar = () => {
    return (
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
          {serverConversations.length === 0 ? (
            <div className="text-center p-6 text-gray-500">
              No chat history yet
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {serverConversations.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => loadChatHistory(chat.id.toString())}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    currentChatId === chat.id.toString()
                      ? "bg-blue-50 border-blue-500"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-gray-800 truncate flex-1">
                      {chat.title}
                    </div>
                    <button
                      onClick={(e) => deleteChatHistory(chat.id.toString(), e)}
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
                    <span>
                      {new Date(chat.created_at).toLocaleDateString()}
                    </span>
                    <span>
                      {new Date(chat.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      <TitleBar title={`${getModelDisplayName(selectedModel)}`} />
      <div className="flex w-full flex-1 overflow-hidden">
        {/* Toggle button for model sidebar */}
        <button
          onClick={() => setShowModelSidebar(!showModelSidebar)}
          className={`absolute top-16 left-0 z-20 p-2 bg-white border border-gray-200 rounded-r-lg shadow-sm hover:bg-gray-50 transition-all ${
            showModelSidebar ? "left-[280px]" : "left-0"
          }`}
          aria-label={showModelSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {showModelSidebar ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            )}
          </svg>
        </button>

        {/* Model selection sidebar - conditionally rendered based on showModelSidebar */}
        {showModelSidebar && (
          <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="font-semibold mb-4 text-gray-800">
                Select Model:
              </div>

              {/* OpenAI Models */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  OpenAI
                </h3>
                <div className="flex flex-col gap-2">
                  {MODELS.OPEN_AI.map((model) => (
                    <label
                      key={model}
                      className={`flex items-start p-3 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                        selectedModel === model
                          ? "bg-blue-50 border-blue-500"
                          : ""
                      } hover:bg-blue-50 hover:border-blue-500`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model}
                        checked={selectedModel === model}
                        onChange={() => setSelectedModel(model)}
                        disabled={isPending}
                        className="mr-3 mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {getModelDisplayName(model)}
                        </div>
                        {modelSupportsImages(model) && (
                          <div className="text-xs text-blue-600 mt-1">
                            Supports images
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Claude Models */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  Claude
                </h3>
                <div className="flex flex-col gap-2">
                  {MODELS.CLAUDE.map((model) => (
                    <label
                      key={model}
                      className={`flex items-start p-3 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                        selectedModel === model
                          ? "bg-blue-50 border-blue-500"
                          : ""
                      } hover:bg-blue-50 hover:border-blue-500`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model}
                        checked={selectedModel === model}
                        onChange={() => setSelectedModel(model)}
                        disabled={isPending}
                        className="mr-3 mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {getModelDisplayName(model)}
                        </div>
                        {modelSupportsImages(model) && (
                          <div className="text-xs text-blue-600 mt-1">
                            Supports images
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* DeepSeek Models */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  DeepSeek
                </h3>
                <div className="flex flex-col gap-2">
                  {MODELS.DEEPSEEK.map((model) => (
                    <label
                      key={model}
                      className={`flex items-start p-3 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                        selectedModel === model
                          ? "bg-blue-50 border-blue-500"
                          : ""
                      } hover:bg-blue-50 hover:border-blue-500`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model}
                        checked={selectedModel === model}
                        onChange={() => setSelectedModel(model)}
                        disabled={isPending}
                        className="mr-3 mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {getModelDisplayName(model)}
                        </div>
                        {modelSupportsImages(model) && (
                          <div className="text-xs text-blue-600 mt-1">
                            Supports images
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Gemini Models */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  Gemini
                </h3>
                <div className="flex flex-col gap-2">
                  {MODELS.GEMINI.map((model) => (
                    <label
                      key={model}
                      className={`flex items-start p-3 rounded-lg border border-gray-200 cursor-pointer transition-all ${
                        selectedModel === model
                          ? "bg-blue-50 border-blue-500"
                          : ""
                      } hover:bg-blue-50 hover:border-blue-500`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model}
                        checked={selectedModel === model}
                        onChange={() => setSelectedModel(model)}
                        disabled={isPending}
                        className="mr-3 mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {getModelDisplayName(model)}
                        </div>
                        {modelSupportsImages(model) && (
                          <div className="text-xs text-blue-600 mt-1">
                            Supports images
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
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
        )}

        {/* Chat history sidebar - conditionally rendered */}
        {showHistorySidebar && renderChatHistorySidebar()}

        <div
          className={`flex-1 flex flex-col h-full bg-gray-50 transition-all ${
            !showModelSidebar ? "ml-0" : ""
          }`}
        >
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
                        {msg.documents && msg.documents.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {msg.documentInfo && msg.documentInfo.length > 0
                              ? // Display detailed document info if available
                                msg.documentInfo.map((doc, docIndex) => (
                                  <div
                                    key={docIndex}
                                    className="flex flex-col p-3 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-[250px]"
                                  >
                                    <div className="flex items-center mb-1">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5 text-blue-500 mr-2"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="text-sm font-medium text-blue-700 truncate">
                                        {doc.name}
                                      </span>
                                    </div>
                                    <div className="text-xs text-blue-600 ml-7">
                                      {(doc.size / 1024).toFixed(1)} KB
                                      {doc.isTruncated && (
                                        <span className="ml-2 text-amber-600 font-medium">
                                          (Truncated)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              : // Fallback to simple document display
                                msg.documents.map((doc, docIndex) => (
                                  <div
                                    key={docIndex}
                                    className="flex items-center p-2 bg-blue-50 border border-blue-200 rounded-lg"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5 text-blue-500 mr-2"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <span className="text-sm text-blue-700">
                                      {doc}
                                    </span>
                                  </div>
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
                  <div>Error: {error.message}</div>
                </div>
              </div>
            )}
          </div>

          <form
            className="p-4 bg-gray-100 border-t border-gray-200"
            onSubmit={handleSubmit}
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-wrap gap-3 mb-3">
                {modelSupportsImages(selectedModel) && imagePreview && (
                  <div className="relative inline-block">
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

                {documentName && (
                  <div className="relative inline-flex items-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-blue-500 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-blue-700">
                      {documentName}
                    </span>
                    <button
                      type="button"
                      onClick={removeSelectedDocument}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Type your message here..."
                  disabled={isPending}
                  className="flex-1 p-2 border border-gray-300 rounded text-base"
                />

                <div className="flex gap-1">
                  {modelSupportsImages(selectedModel) && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPending || selectedDocument !== null}
                      className={`p-2 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors ${
                        selectedDocument !== null
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
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
                        disabled={isPending || selectedDocument !== null}
                        className="hidden"
                        ref={fileInputRef}
                      />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => documentInputRef.current?.click()}
                    disabled={isPending || selectedImage !== null}
                    className={`p-2 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors ${
                      selectedImage !== null
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    title="Upload document"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleDocumentChange}
                      disabled={isPending || selectedImage !== null}
                      className="hidden"
                      ref={documentInputRef}
                    />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={
                    isPending ||
                    (!prompt.trim() && !selectedImage && !selectedDocument)
                  }
                  className="flex items-center gap-1 p-2 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <span className="flex gap-1">
                      <span className="animate-loadingDots w-2 h-2 bg-white rounded-full"></span>
                      <span className="animate-loadingDots [animation-delay:0.2s] w-2 h-2 bg-white rounded-full"></span>
                      <span className="animate-loadingDots [animation-delay:0.4s] w-2 h-2 bg-white rounded-full"></span>
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
