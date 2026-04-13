---
type: module
scope: api
app_path: apps/api/src/ai
key_files:
  - apps/api/src/ai/ai.service.ts
depends_on: []
entities: []
tags: [module, api, ai]
last_synced: 2026-04-11
---

# AI Service

## Purpose
Provides structured AI completions using the Anthropic Claude API via the Vercel AI SDK's `generateObject` helper.

## Public API
- `createMessage(documentText, systemPrompt, schema, modelId?)` -- Sends a prompt to Claude and returns a Zod-validated object. Accepts an optional `modelId` (defaults to `claude-sonnet-4-5-20250929`).

## Internal Architecture
The service initialises a raw `@anthropic-ai/sdk` client in the constructor (reads `ANTHROPIC_API_KEY` from env), but the actual inference call goes through the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). `generateObject` is called with the Vercel `anthropic()` model wrapper, enforcing structured output against the provided Zod schema. Temperature is hard-coded to `0` and `maxTokens` to `1000`, making outputs deterministic and concise. The raw Anthropic client instance is constructed but currently unused beyond initialisation.

## Gotchas
- **No module file** -- `AiService` is a plain class (no `@Injectable` decorator, no NestJS module). Consumers must instantiate it directly or register it manually.
- `maxTokens` is fixed at 1000; long extractions may be silently truncated.
- Temperature 0 means identical inputs always produce identical outputs (good for data extraction, bad for creative tasks).
- The default model string is pinned to a dated snapshot (`claude-sonnet-4-5-20250929`); it will not auto-upgrade.

## Related
- [[ai-config]] -- manages prompt versions and model selection stored in the database
- [[ocr]] -- extracts text from PDFs that is then passed to `createMessage`
