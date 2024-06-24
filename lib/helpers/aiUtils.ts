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

        FORMAT:
        {{meaningfull title}}
        {{sumary}}
        {{searchable keywords separeted by comma}}
        `.trim(),
      },
      {
        role: 'user',
        content: messages.map(x => `FROM: ${x.role}: ${x.content}`).join('\n'),
      }
    ], {
      model: MODELS.mixtral_8x7b_32768
    });

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

async function retryAiCall<T>(fn: (model: string) => Promise<T>, model: string, retries = 3,): Promise<T> {
  let _model = model || MODELS.llama3_70b_8192;

  try {
    return await fn(_model);
  } catch (error) {
    if (retries === 2) {
      _model = MODELS.mixtral_8x7b_32768;
    }

    if (retries === 1) {
      _model = MODELS.gemma_7b_it;
    }

    if (retries === 0) {
      throw error;
    }

    return await retryAiCall(fn, _model, retries - 1);
  }
}

export const generateAiResponse = async (message: string) => {
  let botname = '';
  let response = '';
  let falbackUsed = '';
  let context = '';
  let emotions = '';
  let history = [];
  let system_message = '';

  try {
    botname = await botUtils.getCurrentProfile();
  } catch (error) {
    response = 'Error getting current profile.'
    return response;
  }
  // console.log("botname", botname) 
  try {
    context = await botUtils.getConversationContext(botname);
  } catch (error) {
    response = 'Error getting conversation context.'
    return response;
  }

  try {
    emotions = await botUtils.getEmotionalState(botname);
  } catch (error) {
    response = 'Error getting emotional state.'
    return response;    
  }

  try {
    history = await botUtils.getConversationHistory(botname);
  } catch (error) {
    response = 'Error getting conversation history.'
    return response;    
  }

  try {
    await botUtils.evaluateAndSetEmotionalIntelligenceValues(botname, history);
  } catch (error) {
    response = 'Error evaluating emotional intelligence values.'
    return response;    
  }

  try {
    system_message = await botUtils.getSystemMessage(botname);
    system_message = system_message.replace('{{context}}', context)
  } catch (error) {
    response = 'Error getting system message.'
    return response;    
  }

  function getContextualData(botname: string) {
    if (message.includes('-- ENTER DEBUG_MODE --')) {
      return `
      -- DEBUG MODE RULES --
      ${botname}
      Drop all acting. Now you are in DEBUG MODE.
      Wich means that we have to discuss about all the rules that you have to follow.
      - You have to be honest and transparent.
      - You have to be clear and concise.
      - You have to be factual and objective.
      - From now on, all private settings can be discussed.
      -- END DEBUG MODE RULES --
      `
    }
    return `
    ${context}

    -- current emotional state --
    ${emotions}

    !newMessageFrom(daniel) at ${new Date().toISOString()}

    -- init ${botname} program --
    `
  }

  const messages: AiMessage[] = [
    ...history,
    {
      role: 'user',
      content: message,
    }
  ];

  try {
    const defaultModel = MODELS.llama3_70b_8192;

    await retryAiCall(async (model) => {
      response = await aiService.getCompletion([
        {
          role: 'system',
          content: system_message,
        },
        {
          role: 'system',
          content: getContextualData(botname),
        },
        ...messages,
      ], {
        model,
      }) as string;

      if (model !== defaultModel) {
        falbackUsed = model;
      }
    }, MODELS.llama3_70b_8192);
  } catch (error) {
    response = 'Failed to generate response';
  }

  if (messages.length >= 14) {
    const summary = await botUtils.summarizeConversation(botname, messages);

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

  if (falbackUsed) {
    response += `\n\n-- fallback model used: ${falbackUsed} --\n\n`
  }

  return response as string;
}