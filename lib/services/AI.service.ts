import Groq from "groq-sdk";
import { config } from "../config";
import { kv } from "@vercel/kv";

const groq = new Groq({ apiKey: config.groq_api_key });

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AIClient = (messages: AiMessage[], model?: string) => Promise<any>;

type AIOptions = {
  model?: string;
  temperature?: number;
  response_format?: {
    type: 'json_object' | 'text';
  };
  stream?: boolean;
}

export const MODELS = {
  llama3_8b_8192: 'llama3-8b-8192',
  llama3_70b_8192: 'llama3-70b-8192',
  mixtral_8x7b_32768: 'mixtral-8x7b-32768',
  gemma_7b_it: 'gemma-7b-it',
} as const;

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

async function groqClient(messages: AiMessage[], options?: AIOptions) {
  const { model } = options || {};

  const _model = model || MODELS.llama3_70b_8192;

  const defaultOptions: AIOptions = {
    model: _model,
    temperature: 1,
  };

  // Merge default options with user options
  Object.assign(defaultOptions, options || {});

  return groq.chat.completions.create({
    messages,
    ...defaultOptions as any,
  });
}

class AIService {
  client: typeof groqClient;

  constructor(client: AIClient) {
    this.client = client as any
  }

  async getCompletion(messages: AiMessage[], options?: AIOptions) {
    try {
      const completion = await this.client(messages, options || {});

      await kv.set('last_token_count', `
        token_count:
        ${JSON.stringify(completion.usage, null, 2)}

        last model used:
        ${completion.model}
      `)
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error fetching AI response:', error);
    }
  }
}

export const aiService = new AIService(groqClient as any);