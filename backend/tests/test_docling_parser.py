import unittest
from unittest.mock import patch

from app.services.ingestion import parsers


class DoclingParserTests(unittest.TestCase):
    def test_layout_parser_falls_back_to_basic_when_api_key_missing(self) -> None:
        with patch.object(parsers.settings, "unstructured_api_key", ""), patch.object(
            parsers,
            "parse_basic",
            return_value=["fallback text"],
        ) as parse_basic:
            result = parsers.parse_layout_aware(b"pdf-bytes", "file.pdf", ".pdf")

        parse_basic.assert_called_once_with(b"pdf-bytes", "file.pdf", ".pdf")
        self.assertEqual(result, ["fallback text"])


if __name__ == "__main__":
    unittest.main()
