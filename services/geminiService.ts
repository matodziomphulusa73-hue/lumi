
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Role } from "../types";
import { DEFAULT_MODEL, SYSTEM_INSTRUCTION } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async *streamChat(history: Message[], latestMessage: Message) {
    // Format history for the API
    const contents = history.map(msg => ({
      role: msg.role === Role.USER ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    }));

    // Add current message
    contents.push({
      role: 'user',
      parts: latestMessage.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    });

    try {
      const responseStream = await this.ai.models.generateContentStream({
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
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  async generateTitle(firstMessage: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
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
