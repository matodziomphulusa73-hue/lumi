import { GoogleGenAI } from "@google/genai";
import { Message, Role } from "../types";
import { DEFAULT_MODEL, SYSTEM_INSTRUCTION } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    // Vite replaces process.env.API_KEY at build time from the Vercel environment
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey === "") {
      console.error("Luminol Error: API_KEY is missing. Check Vercel Project Settings.");
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
      yield "⚠️ **System Configuration Error:** The Gemini API Key is missing. Keneilwe, please ensure your developer has added the `API_KEY` to the **Vercel Environment Variables** and redeployed the project.";
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
          topP: 0.95,
          topK: 40,
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
        yield "❌ **Error:** The API Key provided is invalid. Please update it in Vercel.";
      } else {
        yield "❌ **Error:** Failed to connect to the AI brain. Please check your internet or try again later.";
      }
    }
  }

  async generateTitle(firstMessage: string): Promise<string> {
    const ai = this.getClient();
    if (!ai) return "New Chat";

    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Summarize this message into a short 3-5 word title for a chat thread: "${firstMessage}"`,
        config: {
          maxOutputTokens: 20
        }
      });
      return response.text?.replace(/"/g, '').trim() || "New Chat";
    } catch {
      return "New Chat";
    }
  }
}

export const geminiService = new GeminiService();