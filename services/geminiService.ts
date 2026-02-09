import { GoogleGenAI } from "@google/genai";
import { Message, Role } from "../types";
import { DEFAULT_MODEL, SYSTEM_INSTRUCTION } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    // This value is injected by Vite during the 'build' process on Vercel.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      console.error("Luminol Error: API_KEY is missing from build environment.");
      return null;
    }
    
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async *streamChat(history: Message[], latestMessage: Message) {
    const ai = this.getClient();
    if (!ai) {
      yield "⚠️ **Configuration Error:** The AI key is missing from the build. \n\n**To fix this:**\n1. Add `API_KEY` to **Environment Variables** in your Vercel Project Settings.\n2. Go to the **Deployments** tab and click **Redeploy** (this is required to 'bake' the key into the app).";
      return;
    }

    const contents = history.map(msg => ({
      role: msg.role === Role.USER ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    }));

    contents.push({
      role: 'user',
      parts: latestMessage.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    });

    try {
      const responseStream = await ai.models.generateContentStream({
        model: DEFAULT_MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          yield text;
        }
      }
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error?.message?.includes('API_KEY_INVALID')) {
        yield "❌ **Invalid Key:** The API key in Vercel is incorrect. Please double-check it and redeploy.";
      } else {
        yield "❌ **Connection Error:** I couldn't reach my brain. Please check your connection or redeploy the app on Vercel.";
      }
    }
  }

  async generateTitle(firstMessage: string): Promise<string> {
    const ai = this.getClient();
    if (!ai) return "New Discussion";

    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Create a very short (2-3 word) title for a chat starting with: "${firstMessage}"`,
        config: {
          maxOutputTokens: 20
        }
      });
      return response.text?.replace(/[#*"]/g, '').trim() || "New Discussion";
    } catch {
      return "New Discussion";
    }
  }
}

export const geminiService = new GeminiService();