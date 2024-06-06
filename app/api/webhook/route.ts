import { aiService } from '@/lib/services/AI.service';
import { telegramService } from '@/lib/services/Telegram.service';
import { waitUntil } from '@vercel/functions';
import { NextRequest } from 'next/server';

const WHITELISTED_USERS = (process.env.WHITELISTED_USERS || '').split(',');

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

if (!WHITELISTED_USERS) {
  throw new Error('Please provide a comma-separated list of whitelisted users in the WHITELISTED_USERS environment variable.');
}

async function validateWhitelistedUser(message: WebhookBody['message']) {
  const { from } = message;
  if (from?.username && !WHITELISTED_USERS.includes(from.username)) {
    throw new Error('User is not authorized to use this bot.');
  }
}

export async function POST(request: NextRequest) {
  const { message } = await request.json() as WebhookBody;

  try {
    validateWhitelistedUser(message);
  } catch (error) {
    const err = error as Error;

    await telegramService.sendMessage({
      chatId: String(message.chat.id),
      text: 'You are not authorized to use this bot.',
    });

    return new Response(JSON.stringify({ error: err.message }), { status: 403 });
  }

  waitUntil(new Promise(async (resolve) => {
    try {
      const aiResponse = await aiService.getCompletion(
        [
          {
            role: 'user',
            content: message.text,
          }
        ]
      );
      console.log('aiResponse', aiResponse)
      console.log('message', message)
      if (aiResponse) {
        await telegramService.sendMessage({
          chatId: String(message.chat.id),
          text: aiResponse,
        });
      }

    } catch (error) {
      const err = error as Error;

      await telegramService.sendMessage({
        chatId: String(message.chat.id),
        text: 'An error occurred while processing your request.',
      });
    } finally {
      resolve({});
    }
  }));

  return new Response(JSON.stringify({ message: 'webhook recieved' }), { status: 200 });
}
