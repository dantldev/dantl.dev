import { aiService } from '@/lib/services/AI.service';
import { telegramService } from '@/lib/services/Telegram.service';
import axios from 'axios';
import { NextRequest } from 'next/server';
import Typegram, { Message, Update } from 'typegram';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
const WHITELISTED_USERS = (process.env.WHITELISTED_USERS || '').split(',');

if (!WHITELISTED_USERS) {
  throw new Error('Please provide a comma-separated list of whitelisted users in the WHITELISTED_USERS environment variable.');
}

const sendTelegramMessage = async (chatId: string, message: string) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
  } catch (error) {
    console.error('Error sending the message:', error);
  }
};

async function validateWhitelistedUser(message: Message) {
  const { from } = message;
  if (from?.username && !WHITELISTED_USERS.includes(from.username)) {
    throw new Error('User is not authorized to use this bot.');
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  console.log(body);

  return new Response(JSON.stringify({ message: 'Response sent successfully' }), { status: 200 });

  // try {
  //   validateWhitelistedUser(message);
  // } catch (error) {
  //   const err = error as Error;
  //   await telegramService.sendMessage({
  //     chatId: String(message.chat.id),
  //     text: 'You are not authorized to use this bot.',
  //   });

  //   return new Response(JSON.stringify({ error: err.message }), { status: 403 });
  // }

  // const aiResponse = await aiService.getCompletion(
  //   [
  //     {
  //       role: 'user',
  //       content: message.
  //     }
  //   ]
  // )

  // const aiResponse = await getAIResponse(userMessage);
  // await sendTelegramMessage(chatId, aiResponse);

  // return new Response(JSON.stringify({ message: 'Response sent successfully' }), { status: 200 });
}
