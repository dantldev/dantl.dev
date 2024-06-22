interface DecodedUser {
  timestamp: number;
  privileges: string[];
}

declare namespace NodeJS {
  interface ProcessEnv {
    UPLOADTHING_SECRET: string;
    UPLOADTHING_APP_ID: string;
    TELEGRAM_API_KEY: string;
    TELEGRAM_CHAT_ID: string;
    GROQ_API_KEY: string;
    GROQ_API_KEY: string;
    WHITELISTED_USERS: string;
    REDIS_URI: string;
    SECRET: string;
    KV_URL: string;
    KV_REST_API_URL: string;
    KV_REST_API_TOKEN: string;
    KV_REST_API_READ_ONLY_TOKEN: string;
  }
}

interface WebhookBody {
    update_id: number;
    message: {
      message_id: number;
      from: {
        id: number;
        is_bot: false;
        first_name: string;
        last_name: string;
        username: string;
        language_code: 'en' | string;
      },
      chat: {
        id: number,
        first_name: string,
        last_name: string,
        username: string,
        type: 'private' | 'public'
      },
      date: string,
      text: string;
    }
  }