---
type: flow
triggers: ["User submits new confirmation form"]
touches_modules: ["[[web-confirmations]]", "[[confirmation]]", "[[ocr]]", "[[ai]]", "[[ai-config]]", "[[file-storage]]"]
touches_entities: ["[[file-entity]]", "[[confirmation-entity]]"]
tags: [flow, core]
last_synced: 2026-04-11
---

# Confirmation Flow

## Trigger

User fills out the "Nueva Confirmacion" form at `/confirmations/new` and clicks "Solicitar confirmacion".

## Sequence

### Frontend (`apps/web`)

1. **Load users** -- Page mounts, calls `getUsers()` to populate the client dropdown.
2. **Fill form** -- User selects a client, optionally enters shipper/importer/ref/incoterm, toggles checkboxes (insulado, flexitank, termografos), and attaches a booking PDF.
3. **Build FormData** -- `onSubmit` resolves the selected user to `customerName` (first + last) and `customerPhone`, appends all fields plus the file to a `FormData` object.
4. **Server action** -- `submitConfirmation(formData)` sends `POST /confirmation` with Bearer token. On 401, it attempts a token refresh via `POST /auth/refresh` and retries once.
5. **Receive PDF** -- Response blob is read, converted to base64, and returned to the client.
6. **Download** -- Client converts base64 back to a Blob and triggers a browser download with the filename from `Content-Disposition`.

### Backend (`apps/api`)

1. **Validate** -- `ParseFilePipe` enforces PDF type and 1 MB max. `CreateConfirmationDto` validates body fields via `class-validator`.
2. **Store input** -- Original PDF uploaded to file storage under `confirmation-input` category.
3. **OCR** -- Text extracted from PDF via `OcrService`.
4. **AI extraction** -- OCR text sent to Claude with `CONFIRMATION_SCHEMA` (Zod). Active AI config overrides default prompt/model.
5. **Post-process** -- Shipping line and commodity fixups applied to AI output.
6. **Generate PDF** -- PDFKit renders a 2-page branded confirmation document merging AI-extracted data with user-supplied fields.
7. **Store output** -- Generated PDF uploaded to file storage under `confirmation-output` category.
8. **Persist** -- `Confirmation` record created linking both file records.
9. **Stream** -- PDF buffer returned as `StreamableFile` with attachment headers.

## Error Handling

- **Frontend**: Catches all errors in `submitConfirmation`; returns `{ success: false, error }`. The page shows an `alert()` with the error message. Token refresh failure redirects to `/auth/signin`.
- **Backend**: Validation errors (wrong file type, missing fields) return standard NestJS 400/422. AI or OCR failures propagate as 500. No explicit retry logic on the backend side.

## Data Flow

```
User Form                POST /confirmation              OCR Service
   |                          |                              |
   +-- FormData (file + DTO) -->  Upload input PDF           |
                              |      |                       |
                              |      +-- extractTextFromPdf --+
                              |      |
                              |   AI Config (prompt/model)
                              |      |
                              |      +-- AI structured extraction
                              |      |       (OCR text --> Zod schema)
                              |      |
                              |      +-- Post-process fixups
                              |      |
                              |      +-- PDFKit: generate confirmation PDF
                              |      |
                              |      +-- Upload output PDF
                              |      |
                              |      +-- Save Confirmation record
                              |      |
                              |  <-- StreamableFile (PDF buffer)
                              |
   <-- base64 PDF ------------|
   |
   Browser download
```
