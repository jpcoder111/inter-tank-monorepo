---
type: module
scope: api
app_path: apps/api/src/confirmation
key_files:
  - apps/api/src/confirmation/confirmation.service.ts
  - apps/api/src/confirmation/confirmation.controller.ts
  - apps/api/src/confirmation/confirmation.module.ts
depends_on: ["[[ai]]", "[[file-storage]]", "[[ocr]]", "[[ai-config]]"]
entities: ["[[confirmation-entity]]", "[[file-entity]]"]
tags: [module, api, core-feature]
last_synced: 2026-04-11
---

# Confirmation Module

## Purpose

Accepts a shipping-line booking PDF, extracts structured data via OCR + AI, and generates a branded Inter-Tank Booking Confirmation PDF with the extracted details merged with user-supplied metadata.

## Public API

### `POST /confirmation`

- **Auth**: `@Public()` decorator -- no JWT required.
- **Content-Type**: `multipart/form-data` (uses `FileInterceptor('file')`).
- **File validation**: PDF only, max 1 MB.
- **Body** (`CreateConfirmationDto`):
  - Required: `customerName`, `customerPhone`, `isInsulated`, `isFlexitank`, `isTermografos`.
  - Optional: `shipper`, `importer`, `ref`, `incoterm`.
  - Booleans are sent as strings (`"true"/"false"`) and transformed via `class-transformer`.
- **Response**: Streamed PDF (`StreamableFile`) with `Content-Disposition: attachment` header. Filename follows `confirmation_{booking_number}.pdf`.

## Internal Architecture

1. **Upload input file** -- `FileService.uploadFile(file, 'confirmation-input')` stores the original PDF and creates a `File` record.
2. **OCR extraction** -- `OcrService.extractTextFromPdf(file)` returns raw text from the booking PDF.
3. **Resolve AI config** -- `AiConfigService.getActiveConfig()` fetches the active prompt/model override. Falls back to `CONFIRMATION_SYSTEM_PROMPT` and `claude-sonnet-4-5-20250929`.
4. **AI structured extraction** -- `AiService.createMessage(ocrText, prompt, CONFIRMATION_SCHEMA, model)` sends OCR text to the AI with a Zod schema. Returns a typed object with 13 shipping fields (booking_number, vessel, voyage_number, shipping_line, etd, eta, pol, pod, depot, terminal, container_quantity, container_type, container_commodity).
5. **Post-processing fixups** -- Hard-coded corrections applied to AI output (see Gotchas).
6. **Generate output PDF** -- `generatePDF()` uses PDFKit to build a 2-page PDF: page 1 has header, contact, vessel, cargo, depot/terminal, and deadlines sections; page 2 has static "Notas Importantes" in Spanish.
7. **Upload output file** -- Output PDF stored via `FileService.uploadFile(tempFile, 'confirmation-output')`.
8. **Persist record** -- `Confirmation` entity created in Prisma linking `inputFile`, `outputFile`, `shipper`, and `importer`.
9. **Return PDF buffer** -- Controller wraps it in `StreamableFile` for download.

## Gotchas

- **Typo in constants filename**: imported as `./confirmatino.constants` (misspelled). Renaming requires updating the import in `confirmation.service.ts`.
- **Hard-coded commodity override**: If `container_commodity` matches specific wine descriptions (case-insensitive), it gets replaced with `"Wine"`.
- **Shipping line fixups**: `"hmm"` is normalized to `"HMM (HYUNDAI)"`. If shipping line is `"evergreen line"`, both `eta` and `etd` are nulled out.
- **Deadlines always placeholder**: SI Cut-Off and Stacking are hard-coded as `"POR CONFIRMAR"` (never filled from AI).
- **Depot fallback**: If AI returns no depot, the PDF shows `"POR CONFIRMAR"`.
- **Email derived from name**: `customerEmail` is auto-generated as `firstname.lastname@inter-tank.com` -- never passed from the frontend.
- **AiService is a direct provider**, not imported via AiModule. It is listed in the module's `providers` array instead of importing `AiModule`.
- **Endpoint is public**: The `@Public()` decorator bypasses auth. The frontend still sends a Bearer token, but the backend does not require it for this route.
- **Logo path**: Reads `../../assets/intertank.jpeg` relative to `__dirname` (compiled `dist/`). Build must include this asset.

## Related

- [[confirmation-flow]] -- end-to-end flow from form submission to PDF download.
- [[confirmation-entity]] -- Prisma model linking input/output files.
- [[ai]] -- AI message creation with structured output.
- [[ocr]] -- PDF text extraction.
- [[ai-config]] -- runtime prompt/model override.
