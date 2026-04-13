---
type: decision
status: accepted
date: 2026-04-11
tags: [decision, adr, ocr]
last_synced: 2026-04-11
---

# ADR-002: OCR via Tesseract.js

## Context
Shipping confirmation documents arrive as scanned PDFs. The system needs to extract text before AI processing.

## Decision
Use `pdf2pic` to convert PDF pages to PNG images (300 DPI, 2048x2048), then `Tesseract.js` (English-only worker) to extract text from each image. Pages are processed sequentially and joined with `--- Page Break ---` separators.

## Consequences
- Runs entirely on the Node.js server — no external OCR API dependency or cost
- 300 DPI gives good accuracy for standard shipping documents
- Sequential processing means multi-page PDFs are slow (seconds per page)
- English-only — would need reconfiguration for multilingual documents
- Temp PNG files are written to disk and cleaned up after processing

## Related
- [[ocr]], [[confirmation-flow]]
