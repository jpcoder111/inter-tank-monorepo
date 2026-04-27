import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { ZodSchema } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, BadRequestException } from '@nestjs/common';

const VISION_MODEL = 'claude-sonnet-4-6';
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

type ContentBlock = { type?: string } & Record<string, unknown>;

@Injectable()
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

  async extractRate(
    system: string,
    content: string | ContentBlock[],
  ): Promise<{ text: string; model: string }> {
    if (!system || content === undefined || content === null) {
      throw new BadRequestException("Missing 'system' or 'content'");
    }

    const isArray = Array.isArray(content);
    const hasMedia =
      isArray &&
      (content as ContentBlock[]).some(
        (c) => c?.type === 'image' || c?.type === 'document',
      );
    const model = hasMedia ? VISION_MODEL : TEXT_MODEL;

    const userContent = isArray
      ? content
      : [{ type: 'text', text: content }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(
        `Anthropic API error ${response.status}: ${detail}`,
      );
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text =
      data.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';

    return { text, model };
  }
}
