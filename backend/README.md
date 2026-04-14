# Backend Runtime Notes

PDF ingestion uses Docling with the `docling_parse` backend and RapidOCR enabled.
The Docker image intentionally swaps `opencv-python` for `opencv-python-headless`
after `uv sync` because this backend runs in a headless container environment.

The runtime image installs `libglib2.0-0` for headless OpenCV support and does
not install `libgl1` by default. If Docling still fails for supported formats,
the service keeps the existing basic-parser fallback for `.pdf`, `.docx`,
`.html`, and `.htm`.
