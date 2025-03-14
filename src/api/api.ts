export interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning?: string;
    };
  }>;
}

export const sendPrompt = async (
  messages: Array<{ role: string; content: string }>
): Promise<ApiResponse> => {
  console.log("Sending prompt to OpenAI:", messages);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "o3-mini",
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const sendPromptToDeepSeek = async (
  messages: Array<{ role: string; content: string }>
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1-zero:free",
          messages: messages,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const sendPromptToGpt4o = async (
  messages: Array<{ role: string; content: any }>,
  latestImage?: string
): Promise<ApiResponse> => {
  console.log("Sending prompt to OpenAI:", messages);
  try {
    if (latestImage && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (typeof lastMessage.content === "string") {
        // Convert the last message to the format needed for images
        messages[messages.length - 1] = {
          role: lastMessage.role,
          content: [
            { type: "text", text: lastMessage.content },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${latestImage}` },
            },
          ],
        };
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

// Function to send prompt to Gemini 2.0 Flash
export const sendPromptToGemini = async (
  messages: Array<{ role: string; content: string }>,
  latestImage?: string
): Promise<ApiResponse> => {
  console.log("Sending prompt to Gemini with history:", messages);
  try {
    // Get API key from environment variable
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key not found. Please set VITE_GEMINI_API_KEY in your environment variables."
      );
    }

    // Format messages for Gemini API
    // Note: Gemini uses a different format than OpenAI
    let requestBody;

    // If there's a new image in the latest message
    if (latestImage && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      requestBody = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: latestImage,
                  mimeType: "image/jpeg",
                },
              },
              { text: lastMessage.content },
            ],
          },
        ],
      };
    } else {
      // Convert OpenAI message format to Gemini format
      const geminiContents = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      requestBody = {
        contents: geminiContents,
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Gemini API error: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Transform Gemini response format to match our app's expected format
    return {
      choices: [
        {
          message: {
            content:
              data.candidates?.[0]?.content?.parts?.[0]?.text ||
              "No response content found",
          },
        },
      ],
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};
