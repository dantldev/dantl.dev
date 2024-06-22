import Groq from "groq-sdk";
import { config } from "../config";

const groq = new Groq({ apiKey: config.groq_api_key });

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AIClient = (messages: AiMessage[], model?: string) => Promise<any>;

/**
 * llama3-8b-8192
 * Context Window: 8,192 tokens
 * 
 * llama3-70b-8192
 * Context Window: 8,192 tokens
 * 
 * mixtral-8x7b-32768
 * 32,768 tokens
 * 
 * gemma-7b-it
 * 8,192 tokens
 */

async function groqClient(messages: AiMessage[], model?: string) {
  const _model = model || 'llama3-70b-8192';

  return groq.chat.completions.create({
    messages,
    model: _model,
    temperature: 1
  });
}

class AIService {
  client: typeof groqClient;

  constructor(client: AIClient) {
    this.client = client;
  }

  async getCompletion(messages: AiMessage[], model?: string) {
    try {
      const completion = await this.client(messages, model);

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error fetching AI response:', error);
    }
  }
}

export const aiService = new AIService(groqClient);