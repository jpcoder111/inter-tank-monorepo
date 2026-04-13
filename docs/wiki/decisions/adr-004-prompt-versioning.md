---
type: decision
status: accepted
date: 2026-04-11
tags: [decision, adr, ai]
last_synced: 2026-04-11
---

# ADR-004: Prompt Versioning

## Context
The AI extraction prompt evolves as the team learns what works for different shipping document formats. Changes to the prompt can significantly affect output quality, so they need to be tracked.

## Decision
Store prompts as `PromptVersion` records in the database with an auto-incrementing `version` number. The "active" prompt is always the highest version number (no explicit "active" flag). Admins create new versions via the UI, which shows a diff view for comparing versions. Old versions are never deleted.

## Consequences
- Full audit trail of every prompt change (who created it, when, exact text)
- No rollback mechanism — to revert, create a new version with the old text
- No A/B testing capability — only one active prompt at a time
- Model string (e.g., `claude-sonnet-4-5-20250929`) is stored per version, enabling model changes alongside prompt changes

## Related
- [[prompt-versioning-flow]], [[ai-config]], [[ai]]
