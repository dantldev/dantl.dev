import { kv } from "@vercel/kv";
import { AiMessage, MODELS, aiService } from "../services/AI.service";

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
    namespace previus_conversations_context {
      use_case: You can use this context to "remember" previous conversations,
      "remembering" the context of previous messages can help you to 
      generate engaging and contextually relevant responses.
      context: """${ctx}"""
    }
    `
  },
  async summarizeConversation(botname: string, messages: AiMessage[]) {
    const aiResponse = await aiService.getCompletion([
      {
        role: 'system',
        content: `
        Your role is to generate content rich summaries of a given conversation.
        Your summary will be used as a context for future conversations.
        Your summary should be from the point of view of the ASSISTANT.
        `.trim(),
      },
      {
        role: 'user',
        content: messages.map(x => `FROM: ${x.role}: ${x.content}`).join('\n'),
      }
    ]);

    return aiResponse;
  },
  getDefaultEmotionalState() {
    return `
      {
        joy: 0.5,
        sadness: 0.5,
        fear: 0.5,
        anger: 0.5,
        surprise: 0.5,
        disgust: 0.5,
        anticipation: 0.5,
        jealousy: 0.5,
        possessiveness: 0.5
      } 
    `
  },
  async evaluateAndSetEmotionalIntelligenceValues(botname: string, messages: AiMessage[]) {
    const aiResponse = await aiService.getCompletion([
      {
        role: 'system',
        content: `
Your role is to evaluate the emotional intelligence values that the assistant talking
should adopt in order to generate engaging and contextually relevant responses.

Values should be between 0 and 1 being 0 no presence of the emotion and 1 the maximum presence of the emotion.

You always should return ALL the emotional intelligence values, even if they are not present in the conversation or if they are 0.

The base emotional_intelligence interface is as follows:
{
  "joy": {{number}},
  "sadness": {{number}},
  "anger": {{number}},
  "fear": {{number}},
  "surprise": {{number}},
  "disgust": {{number}},
  "anticipation": {{number}},
  "jealousy": {{number}},
  "possessiveness": {{number}},
  "love": {{number}},
  "hate": {{number}},
  "trust": {{number}},
  "arousal": {{number}},
}
        
Return a JSON object with the emotional intelligence values that the assistant should adopt.
        `
      },
      {
        role: 'user',
        content: messages.map(x => `FROM: ${x.role}: ${x.content}`).join('\n'),
      }
    ], {
      model: MODELS.mixtral_8x7b_32768,
      response_format: {
        type: 'json_object'
      }
    });

    let values = ''

    try {
      values = JSON.parse(aiResponse as string);
    } catch (error) {
      values = this.getDefaultEmotionalState();
    }

    await kv.set(`emo:${botname}`, JSON.stringify(values));
  },
  async getEmotionalState(botname: string) {
    const emo = await kv.get(`emo:${botname}`) as string;

    if (!emo) return this.getDefaultEmotionalState();

    return JSON.stringify(emo, null, 2);
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
  '!context': async () => {
    const botname = await botUtils.getCurrentProfile();

    return await botUtils.getConversationContext(botname);
  },
  '!remember': async () => {
    const botname = await botUtils.getCurrentProfile();
    const history = await botUtils.getConversationHistory(botname);
    const summary = await botUtils.summarizeConversation(botname, history);

    if (summary) {
      await botUtils.setConversationContext(botname, summary);
    }

    return 'Generated summary:\n\n' + summary;
  },
  '!softreset': async () => {
    const botname = await botUtils.getCurrentProfile();

    const history = await botUtils.getConversationHistory(botname);
    const summary = await botUtils.summarizeConversation(botname, history);
    await botUtils.setConversationContext(botname, summary as string);
    // leave the last 2 messages
    await botUtils.setConversationHistory(botname, history.slice(-2, history.length));

    return 'Memory purged, leaving the last 2 messages. Context saved.'
  },
  '!reset': async (args: CommandFunctionArguments) => {
    const { payload } = args;

    const botname = await botUtils.getCurrentProfile();
    if (payload) {
      const numberOfMessageToDelete = parseInt(payload);

      if (numberOfMessageToDelete < 1) {
        const currentHistory = await botUtils.getConversationHistory(botname);

        await botUtils.setConversationHistory(botname, currentHistory.slice(-numberOfMessageToDelete, currentHistory.length));

        return `Deleted ${numberOfMessageToDelete} messages from the start conversation history.`

      } else {
        const currentHistory = await botUtils.getConversationHistory(botname);

        await botUtils.setConversationHistory(botname, currentHistory.slice(0, -numberOfMessageToDelete));

        return `Deleted ${numberOfMessageToDelete} messages from the end conversation history.`
      }
    } else {
      await botUtils.setConversationContext(botname, '');
      await botUtils.setConversationHistory(botname, []);

      return 'Profile reset successfully';
    }
  },
  '!emo': async () => {
    return await botUtils.getEmotionalState(await botUtils.getCurrentProfile());
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
  const context = await botUtils.getConversationContext(botname);

  const emotions = await botUtils.getEmotionalState(botname);
  const history = await botUtils.getConversationHistory(botname);

  await botUtils.evaluateAndSetEmotionalIntelligenceValues(botname, history);

  let systemMessage = (await botUtils.getSystemMessage(botname)).replace('{{context}}', context).replace('{{emotional_state}}', emotions)
  systemMessage += `\n\n-- init ${botname} program --\n\n`

  // console.log('ctx: ',await botUtils.getConversationContext(botname))

  const messages: AiMessage[] = [
    ...history,
    {
      role: 'user',
      content: message,
    }
  ];
  // console.log(messages)
  // console.log('longitud arr: ',messages.length)
  let response;

  try {
    response = await aiService.getCompletion([
      {
        role: 'system',
        content: systemMessage,
      },
      ...messages,
    ]);
  } catch (error) {
    response = await aiService.getCompletion([
      {
        role: 'system',
        content: systemMessage,
      },
      ...messages,
    ], {
      model: MODELS.mixtral_8x7b_32768,
    });
    response += '\n\n-- using fallback model --\n\n'
  }

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