import { kv } from "@vercel/kv";
import { AiMessage, aiService } from "../services/AI.service";

export const botUtils = {
  async setCurrentProfile(botname: string) {
    await kv.set(`currentprofile`, botname);
  },
  async getCurrentProfile() {
    return await kv.get(`currentprofile`) as string;
  },
  async setConversationContext(botname: string, key: string) {
    await kv.set(`conversationcontext:${botname}`, key);
  },
  async getConversationContext(botname: string) {
    const ctx = await kv.get(`conversationcontext:${botname}`);

    if (!ctx) return '';

    return `
    Este texto encerrado con el "namespace" "conversationcontext" es un resumen
    de tu conversación con Daniel. Internamente usas esto para "recordar" eventos
    pasados en la conversación.

    namespace conversationcontext {
      context: """${ctx}"""
    }
    `
  },
  async summarizeConversation(botname: string, messages: AiMessage[]) {
    const aiResponse = await aiService.getCompletion([
      {
        role: 'system',
        content: `
        Eres un asistente de IA que ayuda a resumir conversaciones.
        Tus resumenes deben ser detallados y precisos. Serán utilizados
        para ayudar a otros LLMs a entender conversaciones pasadas.

        Debes usar el español para resumir conversaciones.
        `.trim(),
      },
      {
        role: 'assistant',
        content: `
        Perfecto, envíame el mensaje que quieres que resuma y te responderé
        con el resumen.
        `.trim(),
      },
      {
        role: 'user',
        content: messages.map(x => `MENSAJE DE: ${x.role}: ${x.content}`).join('\n'),
      }
    ]);

    return aiResponse;
  },
  async getSystemMessage(botname: string) {
    const smsg = await kv.get(`profile:${botname}`) as string;

    if (!smsg) return '';

    return smsg;
  },
  async getConversationHistory(botname: string): Promise<AiMessage[]> {
    const conversation = await kv.get(`conversation:${botname}`);

    if (conversation) {
      return conversation as AiMessage[];
    }

    return [];
  },
  async setConversationHistory(botname: string, messages: AiMessage[]) {
    // console.log('setting conversation history', messages)
    await kv.set(`conversation:${botname}`, JSON.stringify(messages));
  }
}

type CommandFunctionArguments = {
  payload: string;
}
type CommandFunction = (args?: CommandFunctionArguments) => Promise<string>;

const botCommands = {
  '!profile': async (args: CommandFunctionArguments) => {
    const { payload: botname } = args;

    await botUtils.setCurrentProfile(botname);

    return 'Profile set successfully to ' + botname;
  },
  '!reset': async (args: CommandFunctionArguments) => {
    const { payload } = args;

    const botname = await botUtils.getCurrentProfile();


    if (payload) {
      const numberOfMessageToDelete = parseInt(payload);
      const currentHistory = await botUtils.getConversationHistory(botname);

      await botUtils.setConversationHistory(botname, currentHistory.slice(0, -numberOfMessageToDelete));

      return `Deleted ${numberOfMessageToDelete} messages from the conversation history.`
    } else {
      await botUtils.setConversationContext(botname, '');
      await botUtils.setConversationHistory(botname, []);

      return 'Profile reset successfully';
    }

  },
  '!whoami': async () => {
    return await botUtils.getCurrentProfile();
  },
} as Record<string, CommandFunction>;

export const handleBotCommand = async (command: string, payload: string) => {
  const response = await botCommands[command]({ payload });

  return response;
}

export const generateAiResponse = async (message: string) => {
  const botname = await botUtils.getCurrentProfile();
  // console.log("botname", botname) 
  const systemMessage = `
    ${await botUtils.getSystemMessage(botname)}
    ${await botUtils.getConversationContext(botname)}
  `;

  // console.log('ctx: ',await botUtils.getConversationContext(botname))

  const history = await botUtils.getConversationHistory(botname);

  const messages: AiMessage[] = [
    ...history,
    {
      role: 'user',
      content: message,
    }
  ];
  // console.log(messages)
  // console.log('longitud arr: ',messages.length)
  const response = await aiService.getCompletion([
    {
      role: 'system',
      content: systemMessage,
    },
    ...messages,
  ]);

  if (messages.length >= 14) {
    // console.log('limit reached, summarizing conversation')
    const summary = await botUtils.summarizeConversation(botname, messages);
    // console.log('summary', summary)
    if (summary) {
      await botUtils.setConversationHistory(botname, []);
      await botUtils.setConversationContext(botname, summary);
    }
  } else {
    await botUtils.setConversationHistory(botname, [...messages, {
      role: 'assistant',
      content: response as string,
    }]);
  }

  return response;
}