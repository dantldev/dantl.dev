import axios from 'axios';
import { NextRequest } from 'next/server';

const fetchQuote = async () => {
  try {
    const response = await axios.get('https://api.quotable.io/random');
    return response.data.content;
  } catch (error) {
    console.error('Error fetching the quote:', error);
    return null;
  }
};

const sendTelegramMessage = async (message: string) => {
  const telegramApiKey = process.env.TELEGRAM_API_KEY;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${telegramApiKey}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: telegramChatId,
      text: message,
    });
  } catch (error) {
    console.error('Error sending the message:', error);
  }
};

export async function GET(_req: NextRequest) {
  const quote = await fetchQuote();

  if (quote) {
    await sendTelegramMessage(quote);
    return new Response(JSON.stringify({ message: 'Quote sent successfully' }), { status: 200 });
  } else {
    return new Response(JSON.stringify({ error: 'Failed to fetch the quote' }), { status: 500 });
  }
}
