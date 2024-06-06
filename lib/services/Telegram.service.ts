import axios, { AxiosInstance } from 'axios';
import { handleAxiosError } from '../helpers/handleAxiosError';


const TelegramClient = axios.create({
  baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_API_KEY}`
});

class TelegramService {
  client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  public async sendMessage(params: {
    chatId: string;
    text: string;
  }) {
    try {
      const {} = await this.client.post('/sendMessage', {
        chat_id: params.chatId,
        text: params.text,
      });      
    } catch (error: unknown) {
      handleAxiosError(error as Error);
    }
  } 
}

export const telegramService = new TelegramService(TelegramClient);
