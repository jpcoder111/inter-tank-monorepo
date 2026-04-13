---
type: module
scope: api
app_path: apps/api/src/ocr
key_files:
  - apps/api/src/ocr/ocr.service.ts
  - apps/api/src/ocr/ocr.module.ts
depends_on: []
entities: []
tags: [module, api, ocr]
last_synced: 2026-04-11
---

# OCR Module

## Purpose
Extracts text from uploaded PDF files using a pdf-to-image conversion pipeline followed by Tesseract OCR.

## Public API
- `extractTextFromPdf(file: Express.Multer.File)` -- Returns an `OcrResponseDto` with `{ success, text }`. The text from all pages is joined with `--- Page Break ---` separators.

## Internal Architecture
1. **Validation** -- Rejects requests where the file buffer is missing or the MIME type is not `application/pdf`.
2. **Temp file write** -- The PDF buffer is written to a `temp/` directory under `process.cwd()` with a timestamp-prefixed filename.
3. **PDF-to-image conversion** -- Uses `pdf2pic`'s `fromPath` to render each page as a PNG at 300 DPI, 2048x2048 px. Pages are converted one at a time in a while-loop that increments the page number until `pdf2pic` throws (signalling no more pages).
4. **OCR** -- A single `tesseract.js` worker is created with the `eng` language pack. Each page image is recognised sequentially, and the trimmed text is collected.
5. **Cleanup** -- All temp files (source PDF + generated PNGs) are deleted after processing, even on error paths.

## Gotchas
- **English only** -- The Tesseract worker is hard-coded to `eng`; documents in other languages will produce poor results.
- **Sequential page conversion** -- Pages are converted and OCR'd one at a time; large PDFs will be slow.
- **No page limit** -- There is no cap on the number of pages, so a 500-page PDF will happily attempt conversion.
- **Temp directory** -- Files land in `<cwd>/temp`, which may not exist on first run (the service creates it). In containerised environments, ensure this path is writable.
- **Error swallowing** -- When `pdf2pic` throws on a page, the loop simply stops; a genuine mid-document error looks identical to "end of pages."

## Related
- [[file-storage]] -- the File module imports OcrModule
- [[ai]] -- OCR text is typically forwarded to the AI service for structured extraction
