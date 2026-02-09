import { GoogleGenAI } from "@google/genai";
import { Message, Role } from "../types";
import { DEFAULT_MODEL, SYSTEM_INSTRUCTION } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    // This value is replaced by Vite during build time.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey === "" || apiKey === "''") {
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
      yield "⚠️ **System Configuration Error:** The Gemini API Key is missing. \n\n**Keneilwe**, please ensure your developer has added the `API_KEY` to the Vercel Environment Variables and **Redeployed** the project in the Vercel dashboard.";
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
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error?.message?.includes('API_KEY_INVALID')) {
        yield "❌ **Invalid Key:** The provided API key is incorrect. Please check it on ai.google.dev and update Vercel.";
      } else {
        yield "❌ **Error:** I encountered an issue connecting to my brain. Please try again or check the console.";
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