---
description: Sync the wiki with recent code changes
user_invocable: true
---

# wiki-sync — Update Wiki After Code Changes

Identify code changes and update the corresponding wiki pages to stay in sync.

## Steps

### 1. Identify changed files

Collect changed source files from all layers (skip `docs/wiki/` files — those are our output, not input):

1. **Uncommitted changes** (staged + unstaged): `git diff --name-only HEAD`
2. **Committed since last sync**: `git diff HEAD~1 --name-only` (or wider range if user specifies)

Merge both lists and deduplicate. If nothing changed outside `docs/`, stop early — the wiki is already in sync.

### 2. Map changes to wiki pages

Read `docs/wiki/index.md` and use the Repository Map table to identify which wiki pages are affected by the changed files. Also check each wiki page's `key_files` frontmatter field.

### 3. Update affected pages

For each affected wiki page:
1. Read the current wiki page
2. Read the changed source files in their current state on disk (not just the diff — the wiki must reflect the latest code, including uncommitted edits)
3. Compare what the wiki says vs what the code now does
4. Update the wiki page to reflect the current code state
5. Update `last_synced` in frontmatter to today's date
6. Keep within token budgets (modules: 600, entities: 300, flows: 500, conventions: 400)

If the Prisma schema changed, also check all entity pages — field additions/removals/renames propagate across multiple pages.

### 4. Handle new modules or entities

If a new module, entity, or flow was added:
1. Create the new wiki page using the appropriate template from existing pages
2. Add it to `docs/wiki/index.md` in the Repository Map and Task Routing tables
3. Add `[[backlinks]]` from related existing pages

### 5. Log the update

Append entries to `docs/wiki/log.md` with format:
`- YYYY-MM-DD: updated | [[page-name]] — reason for update`

## Rules

- Never modify source code — only wiki files
- Describe *what* and *why*, not *how* — no code snippets longer than 5 lines
- Preserve existing `[[backlinks]]` and add new ones if dependencies changed
- If a module was deleted, remove its wiki page and update index.md
