---
type: glossary
description: Shipping domain terms used in the Inter-Tank system
tags: [glossary, domain]
last_synced: 2026-04-11
---

# Glossary

## Shipping Domain

- **Confirmation** — A document that confirms the details of a shipping arrangement between a shipper and an importer. In Inter-Tank, this is both the business concept and the primary entity.
- **Shipper** — The party sending/exporting goods. Entered manually on the confirmation form.
- **Importer** — The party receiving/importing goods. Entered manually on the confirmation form.
- **Incoterm** — International Commercial Terms (e.g., FOB, CIF, EXW). Standardized trade terms defining responsibilities between buyer and seller.
- **Bill of Lading (B/L)** — A shipping document issued by the carrier acknowledging receipt of cargo. Often the source PDF uploaded for confirmation.
- **Shipping Line** — The carrier company (e.g., HMM, Evergreen, Hapag-Lloyd). Extracted by AI from the uploaded document.
- **Commodity** — The type of goods being shipped (e.g., wine, chemicals). Extracted by AI.
- **Insulated Container** — A temperature-controlled shipping container. Tracked as a boolean flag on confirmations.
- **Flexitank** — A flexible bladder installed in a standard container for bulk liquid transport. Boolean flag.
- **Termografos** — Temperature recording devices placed in containers. Boolean flag.

## System Terms

- **Confirmation Pipeline** — The end-to-end process: PDF upload -> OCR -> AI extraction -> PDF generation.
- **Prompt Version** — A stored snapshot of the AI system prompt + model used for document extraction.
- **Active Config** — The highest-versioned prompt version, automatically used for new confirmations.
