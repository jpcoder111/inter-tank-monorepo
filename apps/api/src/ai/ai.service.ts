import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { ZodSchema } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

export class AiService {
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async createMessage(
    documentText: string,
    systemPrompt: string,
    schema: ZodSchema,
    modelId: string = 'claude-sonnet-4-5-20250929',
  ): Promise<any> {
    const { object } = await generateObject({
      model: anthropic(modelId),
      system: systemPrompt,
      prompt: documentText,
      maxTokens: 1000,
      temperature: 0,
      schema,
    });

    return object;
  }
}
