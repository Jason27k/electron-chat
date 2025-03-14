export interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning?: string;
    };
  }>;
}

export const sendPrompt = async (prompt: string): Promise<ApiResponse> => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "o3-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
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
  prompt: string
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
          messages: [{ role: "user", content: prompt }],
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
  input: string | { content: string; image: string }
): Promise<ApiResponse> => {
  try {
    const isImageInput = typeof input !== "string";
    const messages = isImageInput
      ? [
          {
            role: "user",
            content: [
              { type: "text", text: input.content },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${input.image}` },
              },
            ],
          },
        ]
      : [
          {
            role: "user",
            content: input,
          },
        ];

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
  input: string | { content: string; image: string }
): Promise<ApiResponse> => {
  console.log("Sending prompt to Gemini:", input);
  try {
    // Get API key from environment variable
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key not found. Please set VITE_GEMINI_API_KEY in your environment variables."
      );
    }

    const isImageInput = typeof input !== "string";
    let requestBody;

    if (isImageInput) {
      // For image + text input
      requestBody = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: input.image,
                  mimeType: "image/jpeg",
                },
              },
              { text: input.content },
            ],
          },
        ],
      };
    } else {
      // For text-only input
      requestBody = {
        contents: [
          {
            parts: [{ text: input }],
          },
        ],
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
