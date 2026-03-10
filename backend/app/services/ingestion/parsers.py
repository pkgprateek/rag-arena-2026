"""RAG Arena 2026 — Document Parsers.

Tier 1: Basic text extraction (pypdf/docx)
Tier 2, 3 & 4: True layout-aware extraction via Unstructured Serverless API

Returns structured elements (list[ParsedElement]) so chunkers can use real
page numbers, section headings, and content types.
"""

import io
import logging
from dataclasses import dataclass, field
from typing import Any

from pypdf import PdfReader
from docx import Document as DocxDocument

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ParsedElement:
    """A single extracted element from a document."""

    text: str
    element_type: str = "NarrativeText"  # Title, NarrativeText, Table, Header, etc.
    page: int = 1
    section: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


def parse_basic(file_bytes: bytes, filename: str, ext: str) -> list[ParsedElement]:
    """Tier 1: Naive parsing — lightweight, zero external dependencies.

    Returns structured elements so the interface is consistent across tiers.
    """
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

        elif ext in (".docx", ".doc"):
            doc = DocxDocument(io.BytesIO(file_bytes))
            # Group paragraphs — each paragraph is one element
            elements = []
            for para in doc.paragraphs:
                if para.text.strip():
                    # Detect headings by style
                    style_name = para.style.name if para.style else ""
                    el_type = (
                        "Title" if "heading" in style_name.lower() else "NarrativeText"
                    )
                    elements.append(
                        ParsedElement(
                            text=para.text.strip(),
                            element_type=el_type,
                            page=1,  # DOCX doesn't have page info without rendering
                        )
                    )
            return elements if elements else [ParsedElement(text="")]

        else:
            # Plain text / markdown / csv / json
            text = file_bytes.decode("utf-8")
            return [ParsedElement(text=text, element_type="NarrativeText", page=1)]

    except Exception as e:
        raise ValueError(f"Failed to parse doc {filename}: {str(e)}")


def parse_layout_aware(
    file_bytes: bytes, filename: str, ext: str
) -> list[ParsedElement]:
    """Tier 2+: Real layout extraction via Unstructured Platform Serverless API.

    Uses the official unstructured-client SDK which handles auth and URL routing.
    Falls back gracefully to basic parser if the API key is not configured.
    """
    api_key = settings.unstructured_api_key
    if not api_key:
        logger.warning(
            "UNSTRUCTURED_API_KEY not set. Falling back to basic parser for Tier 2+ ingestion."
        )
        return parse_basic(file_bytes, filename, ext)

    try:
        from unstructured_client import UnstructuredClient
        from unstructured_client.models import shared, operations

        client = UnstructuredClient(api_key_auth=api_key)

        req = operations.PartitionRequest(
            partition_parameters=shared.PartitionParameters(
                files=shared.Files(
                    content=file_bytes,
                    file_name=filename,
                ),
                strategy=shared.Strategy.HI_RES,
                pdf_infer_table_structure=True,
                languages=["eng"],
            ),
        )

        response = client.general.partition(request=req)
        raw_elements = response.elements or []

        elements: list[ParsedElement] = []
        current_section = ""

        for el in raw_elements:
            el_type = el.get("type", "NarrativeText")
            text = el.get("text", "")
            metadata = el.get("metadata", {})

            # Real page number from Unstructured metadata
            page = metadata.get("page_number", 1)

            if el_type in ("Title", "Header"):
                current_section = text.strip()

            # Preserve table HTML for better RAG context
            if el_type == "Table" and "text_as_html" in metadata:
                text = metadata["text_as_html"]

            if text.strip():
                elements.append(
                    ParsedElement(
                        text=text.strip(),
                        element_type=el_type,
                        page=page,
                        section=current_section,
                        metadata={
                            k: v
                            for k, v in metadata.items()
                            if k in ("filename", "filetype", "languages", "parent_id")
                        },
                    )
                )

        return elements if elements else parse_basic(file_bytes, filename, ext)

    except Exception as e:
        logger.warning(f"Unstructured API failed, falling back to basic parser: {e}")
        return parse_basic(file_bytes, filename, ext)
