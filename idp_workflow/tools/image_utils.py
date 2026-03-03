"""PDF-to-image utilities for multimodal extraction."""

import base64
import logging
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# Default DPI for rendering PDF pages as images
DEFAULT_DPI = 150


def pdf_to_base64_images(
    pdf_path: str,
    *,
    dpi: int = DEFAULT_DPI,
    max_pages: int | None = None,
) -> list[str]:
    """Convert PDF pages to base64-encoded PNG images.

    Args:
        pdf_path: Path to PDF file (local path or will raise for URLs).
        dpi: Resolution for rendering. Higher = better quality but larger payload.
        max_pages: Maximum number of pages to convert. None = all pages.

    Returns:
        List of base64-encoded PNG strings (one per page), ready for dspy.Image.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    images: list[str] = []
    zoom = dpi / 72  # PyMuPDF default is 72 DPI
    matrix = fitz.Matrix(zoom, zoom)

    doc = fitz.open(str(path))
    try:
        page_count = min(len(doc), max_pages) if max_pages else len(doc)
        for page_num in range(page_count):
            page = doc[page_num]
            pix = page.get_pixmap(matrix=matrix)
            png_bytes = pix.tobytes("png")
            b64 = base64.b64encode(png_bytes).decode("ascii")
            images.append(f"data:image/png;base64,{b64}")
            logger.debug(
                f"Converted page {page_num + 1}/{page_count} to PNG "
                f"({pix.width}x{pix.height}, {len(png_bytes):,} bytes)"
            )
    finally:
        doc.close()

    logger.info(f"Converted {len(images)} page(s) from {path.name} to base64 PNG at {dpi} DPI")
    return images
