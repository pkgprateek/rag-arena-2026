"""RAG Arena 2026 — Document parsing.

Uses Docling for rich document formats and direct text handling for already
textual sources. Basic local parsing remains as a fallback where it is reliable.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from pathlib import Path
import tempfile
from typing import Any

from docling.backend.docling_parse_backend import DoclingParseDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from pypdf import PdfReader
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)

DIRECT_TEXT_EXTENSIONS = {".md", ".txt", ".json", ".csv"}
DOCLING_RICH_EXTENSIONS = {".pdf", ".pptx", ".docx", ".html", ".htm", ".xlsx"}
_DOCLING_CONVERTER: DocumentConverter | None = None
PDF_BACKEND_NAME = "docling_parse"
PDF_OCR_ENGINE_NAME = "RapidOCR"


@dataclass
class ParsedElement:
    """A single extracted element from a document."""

    text: str
    element_type: str = "NarrativeText"
    page: int = 1
    section: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


def _docling_format_options() -> dict[InputFormat, PdfFormatOption]:
    pipeline_options = PdfPipelineOptions(do_ocr=True)
    pipeline_options.ocr_options = RapidOcrOptions()

    return {
        InputFormat.PDF: PdfFormatOption(
            backend=DoclingParseDocumentBackend,
            pipeline_options=pipeline_options,
        )
    }


def _get_docling_converter() -> DocumentConverter:
    global _DOCLING_CONVERTER
    if _DOCLING_CONVERTER is None:
        _DOCLING_CONVERTER = DocumentConverter(
            format_options=_docling_format_options()
        )
    return _DOCLING_CONVERTER


def _page_number(item: Any) -> int:
    prov = getattr(item, "prov", None) or []
    if not prov:
        return 1
    page_no = getattr(prov[0], "page_no", 1)
    return page_no if isinstance(page_no, int) and page_no > 0 else 1


def _label_name(item: Any) -> str:
    label = getattr(item, "label", None)
    value = getattr(label, "value", label)
    return str(value or "").lower()


def _element_type(label_name: str) -> str:
    if label_name == "title":
        return "Title"
    if label_name in {"section_header", "page_header"}:
        return "Header"
    if label_name == "table":
        return "Table"
    return "NarrativeText"


def _text_from_docling_item(item: Any, doc: Any) -> str:
    label_name = _label_name(item)
    if label_name == "table":
        if hasattr(item, "export_to_markdown"):
            return item.export_to_markdown(doc=doc).strip()
        return ""
    text = getattr(item, "text", "")
    return text.strip()


def parse_basic(file_bytes: bytes, filename: str, ext: str) -> list[ParsedElement]:
    """Local fallback parsing for simple and locally supported file formats."""
    try:
        if ext == ".pdf":
            reader = PdfReader(io.BytesIO(file_bytes))
            elements = []
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                if text.strip():
                    elements.append(
                        ParsedElement(
                            text=text.strip(),
                            element_type="NarrativeText",
                            page=page_num,
                        )
                    )
            return elements if elements else [ParsedElement(text="")]

        if ext == ".docx":
            doc = DocxDocument(io.BytesIO(file_bytes))
            elements = []
            for para in doc.paragraphs:
                if not para.text.strip():
                    continue
                style_name = para.style.name if para.style else ""
                el_type = (
                    "Title" if "heading" in style_name.lower() else "NarrativeText"
                )
                elements.append(
                    ParsedElement(
                        text=para.text.strip(),
                        element_type=el_type,
                        page=1,
                    )
                )
            return elements if elements else [ParsedElement(text="")]

        text = file_bytes.decode("utf-8")
        return [ParsedElement(text=text, element_type="NarrativeText", page=1)]
    except Exception as exc:
        raise ValueError(f"Failed to parse doc {filename}: {exc}") from exc


def parse_direct_text(file_bytes: bytes, filename: str, ext: str) -> list[ParsedElement]:
    """Directly use plain-text-like formats without Docling."""
    if ext not in DIRECT_TEXT_EXTENSIONS:
        raise ValueError(f"Unsupported direct-text extension '{ext}' for {filename}")
    return parse_basic(file_bytes, filename, ext)


def _docling_document(file_bytes: bytes, filename: str, ext: str) -> Any:
    suffix = ext or Path(filename).suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(file_bytes)
        temp_path = Path(handle.name)

    try:
        result = _get_docling_converter().convert(str(temp_path))
        return result.document
    finally:
        temp_path.unlink(missing_ok=True)


def _parse_xlsx_with_docling(doc: Any, filename: str) -> list[ParsedElement]:
    elements: list[ParsedElement] = []
    tables = list(getattr(doc, "tables", []))

    for index, table in enumerate(tables, start=1):
        csv_text = ""
        if hasattr(table, "export_to_dataframe"):
            csv_text = table.export_to_dataframe().to_csv(index=False).strip()
        elif hasattr(table, "export_to_markdown"):
            csv_text = table.export_to_markdown(doc=doc).strip()

        if not csv_text:
            continue

        elements.append(
            ParsedElement(
                text=csv_text,
                element_type="Table",
                page=_page_number(table),
                section=f"sheet_{index}",
                metadata={
                    "filename": filename,
                    "filetype": "xlsx",
                    "conversion_format": "csv",
                },
            )
        )

    if not elements and hasattr(doc, "export_to_text"):
        text = doc.export_to_text().strip()
        if text:
            elements.append(
                ParsedElement(
                    text=text,
                    element_type="NarrativeText",
                    page=1,
                    metadata={
                        "filename": filename,
                        "filetype": "xlsx",
                        "conversion_format": "csv",
                    },
                )
            )

    return elements


def parse_docling_rich(
    file_bytes: bytes,
    filename: str,
    ext: str,
) -> list[ParsedElement]:
    """Parse rich documents with Docling and normalize into ParsedElement."""
    if ext not in DOCLING_RICH_EXTENSIONS:
        raise ValueError(f"Unsupported Docling extension '{ext}' for {filename}")

    try:
        doc = _docling_document(file_bytes, filename, ext)
    except Exception as exc:
        if ext in {".pdf", ".docx", ".html", ".htm"}:
            logger.warning(
                (
                    "Docling parse failed for '%s'; falling back to basic parser "
                    "(backend=%s, ocr_engine=%s, error_type=%s): %s"
                ),
                filename,
                PDF_BACKEND_NAME if ext == ".pdf" else "default",
                PDF_OCR_ENGINE_NAME if ext == ".pdf" else "n/a",
                type(exc).__name__,
                exc,
            )
            return parse_basic(file_bytes, filename, ".txt" if ext in {".html", ".htm"} else ext)
        raise ValueError(f"Docling failed to parse {filename}: {exc}") from exc

    if ext == ".xlsx":
        elements = _parse_xlsx_with_docling(doc, filename)
        if elements:
            return elements
        raise ValueError(f"Docling returned no spreadsheet content for {filename}")

    elements: list[ParsedElement] = []
    current_section = ""

    for item, _level in doc.iterate_items():
        label_name = _label_name(item)
        text = _text_from_docling_item(item, doc)
        if not text:
            continue

        element_type = _element_type(label_name)
        if element_type in {"Title", "Header"}:
            current_section = text

        elements.append(
            ParsedElement(
                text=text,
                element_type=element_type,
                page=_page_number(item),
                section=current_section,
                metadata={
                    "filename": filename,
                    "filetype": ext.lstrip("."),
                    "conversion_format": "markdown",
                    "docling_label": label_name,
                },
            )
        )

    if elements:
        return elements

    markdown = doc.export_to_markdown().strip()
    if markdown:
        return [
            ParsedElement(
                text=markdown,
                element_type="NarrativeText",
                page=1,
                metadata={
                    "filename": filename,
                    "filetype": ext.lstrip("."),
                    "conversion_format": "markdown",
                },
            )
        ]

    raise ValueError(f"Docling returned no content for {filename}")


def parse_for_tier(file_bytes: bytes, filename: str, ext: str) -> list[ParsedElement]:
    """Route parsing by file extension using direct text or Docling."""
    if ext in DIRECT_TEXT_EXTENSIONS:
        return parse_direct_text(file_bytes, filename, ext)

    if ext in DOCLING_RICH_EXTENSIONS:
        return parse_docling_rich(file_bytes, filename, ext)

    if ext == ".doc":
        raise ValueError("Legacy .doc files are not supported. Please upload .docx instead.")

    return parse_basic(file_bytes, filename, ext)
