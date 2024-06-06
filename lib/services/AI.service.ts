import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface AiMessage {
  role: 'user' | 'assistant';
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
  const _model = model || 'mixtral-8x7b-32768';

  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: "Explain the importance of fast language models",
      },
    ],
    model: _model,
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