import unittest
from types import SimpleNamespace
from unittest.mock import patch

from docling.backend.docling_parse_backend import DoclingParseDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import RapidOcrOptions

from app.services.ingestion import parsers


class FakeTextItem:
    def __init__(self, label: str, text: str, page_no: int = 1) -> None:
        self.label = SimpleNamespace(value=label)
        self.text = text
        self.prov = [SimpleNamespace(page_no=page_no)]


class FakeTableItem:
    def __init__(self, markdown: str, page_no: int = 1, csv_text: str = "") -> None:
        self.label = SimpleNamespace(value="table")
        self.prov = [SimpleNamespace(page_no=page_no)]
        self._markdown = markdown
        self._csv_text = csv_text

    def export_to_markdown(self, doc=None) -> str:
        return self._markdown

    def export_to_dataframe(self):
        return SimpleNamespace(to_csv=lambda index=False: self._csv_text)


class FakeDoc:
    def __init__(self, items, tables=None, markdown: str = "") -> None:
        self._items = items
        self.tables = tables or []
        self._markdown = markdown

    def iterate_items(self):
        for item in self._items:
            yield item, 0

    def export_to_markdown(self) -> str:
        return self._markdown

    def export_to_text(self) -> str:
        return self._markdown


class DoclingParserTests(unittest.TestCase):
    def tearDown(self) -> None:
        parsers._DOCLING_CONVERTER = None

    def test_docling_format_options_configure_pdf_backend_and_ocr(self) -> None:
        options = parsers._docling_format_options()

        self.assertIn(InputFormat.PDF, options)
        pdf_option = options[InputFormat.PDF]
        self.assertIs(pdf_option.backend, DoclingParseDocumentBackend)
        self.assertTrue(pdf_option.pipeline_options.do_ocr)
        self.assertIsInstance(pdf_option.pipeline_options.ocr_options, RapidOcrOptions)

    def test_get_docling_converter_uses_configured_format_options(self) -> None:
        expected_options = parsers._docling_format_options()

        with patch.object(parsers, "DocumentConverter") as document_converter:
            document_converter.return_value = SimpleNamespace()

            converter = parsers._get_docling_converter()

        document_converter.assert_called_once()
        _, kwargs = document_converter.call_args
        self.assertEqual(kwargs["format_options"].keys(), expected_options.keys())
        self.assertIs(converter, document_converter.return_value)

    def test_parse_for_tier_uses_direct_text_for_markdown(self) -> None:
        result = parsers.parse_for_tier(b"# Hello\nworld", "file.md", ".md")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].text, "# Hello\nworld")
        self.assertEqual(result[0].page, 1)

    def test_parse_for_tier_routes_rich_docs_through_docling(self) -> None:
        fake_doc = FakeDoc(
            items=[
                FakeTextItem("title", "Policy Guide", page_no=1),
                FakeTextItem("section_header", "Coverage", page_no=2),
                FakeTextItem("paragraph", "The policy covers fire damage.", page_no=2),
                FakeTableItem("| Item | Covered |\n| --- | --- |\n| Fire | Yes |", page_no=3),
            ]
        )

        with patch.object(parsers, "_docling_document", return_value=fake_doc):
            result = parsers.parse_for_tier(b"%PDF", "policy.pdf", ".pdf")

        self.assertEqual([element.element_type for element in result], ["Title", "Header", "NarrativeText", "Table"])
        self.assertEqual(result[1].section, "Coverage")
        self.assertEqual(result[2].page, 2)
        self.assertEqual(result[3].metadata["conversion_format"], "markdown")

    def test_parse_docling_rich_converts_xlsx_to_csv_like_text(self) -> None:
        fake_table = FakeTableItem(
            markdown="| quarter | revenue |",
            page_no=1,
            csv_text="quarter,revenue\nQ1,120\nQ2,150",
        )
        fake_doc = FakeDoc(items=[], tables=[fake_table])

        with patch.object(parsers, "_docling_document", return_value=fake_doc):
            result = parsers.parse_docling_rich(b"xlsx-bytes", "metrics.xlsx", ".xlsx")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].element_type, "Table")
        self.assertEqual(result[0].metadata["conversion_format"], "csv")
        self.assertIn("quarter,revenue", result[0].text)

    def test_docling_failure_falls_back_for_pdf(self) -> None:
        with (
            patch.object(parsers, "_docling_document", side_effect=RuntimeError("boom")),
            patch.object(
                parsers,
                "parse_basic",
                return_value=[parsers.ParsedElement(text="fallback")],
            ) as parse_basic,
            self.assertLogs(parsers.logger, level="WARNING") as logs,
        ):
            result = parsers.parse_docling_rich(b"pdf-bytes", "file.pdf", ".pdf")

        parse_basic.assert_called_once_with(b"pdf-bytes", "file.pdf", ".pdf")
        self.assertEqual(result[0].text, "fallback")
        self.assertIn("backend=docling_parse", logs.output[0])
        self.assertIn("ocr_engine=RapidOCR", logs.output[0])
        self.assertIn("error_type=RuntimeError", logs.output[0])


if __name__ == "__main__":
    unittest.main()
