# Sample Documents for RAG Arena Testing

Place sample documents here for testing the RAG pipeline across all 4 tiers.

## Supported formats
- `.pdf` — Best for testing layout-aware parsing (Tier 2+)
- `.docx` / `.doc` — Word documents
- `.txt` / `.md` — Plain text / Markdown
- `.csv` — Tabular data
- `.json` — Structured data

## Recommended test docs
- A multi-page PDF with tables (tests Unstructured table extraction)
- A scanned PDF (tests OCR capabilities)
- A long-form technical doc (tests chunking strategies)
- A doc with clear section headings (tests layout-aware chunking)

## Usage
Upload via the UI or use the API directly:
```bash
curl -X POST http://localhost:8000/docs/upload \
  -F "file=@samples/your-doc.pdf"
```
