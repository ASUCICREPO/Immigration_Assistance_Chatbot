"""
PDF generation service for exporting chat resources.
Uses FPDF2 with GoNotoKurrent universal font for multilingual support.

Supports 13+ languages including:
- Latin scripts: English, Spanish, French, Portuguese, Vietnamese, Haitian Creole, Swahili
- Cyrillic: Ukrainian
- Devanagari: Hindi
- Arabic script: Arabic, Urdu, Pashto, Dari
- CJK: Chinese (Simplified)
"""
import io
import logging
from typing import Dict, Any, List, Optional, TYPE_CHECKING
from datetime import datetime
from fpdf import FPDF

if TYPE_CHECKING:
    from .font_service import FontService

logger = logging.getLogger(__name__)

# RTL (Right-to-Left) languages that need special text direction handling
RTL_LANGUAGES = {'ar', 'ur', 'fa', 'ps', 'he'}  # Arabic, Urdu, Dari/Farsi, Pashto, Hebrew


class PDFGeneratorService:
    """
    Service for generating multilingual PDF exports of resources.

    Uses FPDF2 with HarfBuzz text shaping for proper rendering of:
    - Complex scripts (Hindi, Arabic, etc.)
    - Right-to-left languages (Arabic, Urdu, Pashto, Dari)
    - Bidirectional text (mixed LTR and RTL content)
    """

    # Header color
    HEADER_BLUE = (30, 100, 200)  # #1e64c8

    def __init__(self, font_service: Optional['FontService'] = None):
        """
        Initialize PDF generator service.

        Args:
            font_service: FontService instance for loading universal font.
                         If None, falls back to Helvetica (limited charset).
        """
        self.font_service = font_service

    def generate_resources_pdf(
        self,
        resources: Dict[str, List[Dict[str, Any]]],
        user_language: str = 'en'
    ) -> io.BytesIO:
        """
        Generate a PDF document containing resources organized by category.

        Args:
            resources: Dictionary of resources organized by category
                      (typically resources_by_category from geo_location_search)
            user_language: User's language code (e.g., 'en', 'es', 'hi', 'ar')

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()

        try:
            pdf = FPDF()
            pdf.set_auto_page_break(auto=True, margin=15)

            # Enable text shaping for complex scripts (Arabic, Hindi, etc.)
            # This uses HarfBuzz under the hood for proper glyph shaping
            pdf.set_text_shaping(True)

            # Load universal font if available
            font_loaded = self._load_font(pdf)
            if not font_loaded:
                logger.warning("Universal font not available, using Helvetica fallback")

            # Determine text alignment based on language direction
            is_rtl = user_language in RTL_LANGUAGES

            # Build PDF content
            pdf.add_page()
            self._add_header(pdf)
            self._add_resources(pdf, resources, is_rtl)
            self._add_footer(pdf)

            # Output to buffer
            pdf.output(buffer)
            buffer.seek(0)

            total_resources = sum(len(r) for r in resources.values())
            logger.info(f"Generated PDF with {total_resources} resources in {len(resources)} categories")
            return buffer

        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}", exc_info=True)
            # Return empty buffer on error
            buffer.seek(0)
            return buffer

    def _load_font(self, pdf: FPDF) -> bool:
        """
        Load universal font into PDF instance.

        Args:
            pdf: FPDF instance to load font into

        Returns:
            True if font loaded successfully, False otherwise
        """
        if not self.font_service:
            pdf.set_font('Helvetica', size=12)
            return False

        try:
            font_path = self.font_service.get_font_path()
            pdf.add_font('GoNoto', '', font_path)
            pdf.set_font('GoNoto', size=12)
            logger.debug(f"Loaded universal font from {font_path}")
            return True
        except Exception as e:
            logger.warning(f"Failed to load universal font: {e}")
            pdf.set_font('Helvetica', size=12)
            return False

    def _add_header(self, pdf: FPDF):
        """Add PDF header with title and generation date."""
        # Title
        pdf.set_font_size(24)
        pdf.set_text_color(*self.HEADER_BLUE)
        pdf.cell(0, 15, 'Community Resources', align='C', new_x='LMARGIN', new_y='NEXT')

        # Subtitle with date
        pdf.set_font_size(12)
        pdf.set_text_color(102, 102, 102)
        current_date = datetime.now().strftime("%B %d, %Y")
        pdf.cell(0, 10, f'Generated on {current_date}', align='C', new_x='LMARGIN', new_y='NEXT')

        pdf.ln(10)

    def _add_resources(self, pdf: FPDF, resources: Dict[str, List[Dict[str, Any]]], is_rtl: bool):
        """
        Add resources organized by category.

        Args:
            pdf: FPDF instance
            resources: Resources dictionary by category
            is_rtl: Whether to use right-to-left alignment
        """
        pdf.set_text_color(0, 0, 0)
        align = 'R' if is_rtl else 'L'

        total_resources = 0
        for category, resource_list in resources.items():
            if not resource_list:
                continue

            total_resources += len(resource_list)

            # Category header
            pdf.set_font_size(16)
            pdf.set_text_color(53, 62, 74)  # Dark gray
            pdf.cell(0, 12, f'{category} ({len(resource_list)})', align=align, new_x='LMARGIN', new_y='NEXT')

            # Individual resources
            pdf.set_font_size(11)
            for idx, resource in enumerate(resource_list, 1):
                self._add_resource_entry(pdf, idx, resource, align)

            pdf.ln(5)

        # If no resources found
        if total_resources == 0:
            pdf.set_text_color(102, 102, 102)
            pdf.cell(0, 10, 'No resources available.', align='C', new_x='LMARGIN', new_y='NEXT')

    def _add_resource_entry(self, pdf: FPDF, index: int, resource: Dict[str, Any], align: str):
        """
        Add a single resource entry to the PDF.

        Args:
            pdf: FPDF instance
            index: Resource number in the list
            resource: Resource dictionary with name, address, phone, website, additional_notes
            align: Text alignment ('L' for left, 'R' for right)
        """
        # Resource name (bold styling via larger size)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font_size(14)
        name = resource.get('name', 'Unknown')
        pdf.multi_cell(0, 8, f'{index}. {name}', align=align, new_x='LMARGIN', new_y='NEXT')

        # Resource details
        pdf.set_font_size(11)
        pdf.set_text_color(51, 51, 51)

        # Address
        if resource.get('address'):
            pdf.multi_cell(0, 6, f"    {resource['address']}", align=align, new_x='LMARGIN', new_y='NEXT')

        # Phone
        if resource.get('phone'):
            pdf.multi_cell(0, 6, f"    {resource['phone']}", align=align, new_x='LMARGIN', new_y='NEXT')

        # Website
        if resource.get('website'):
            pdf.multi_cell(0, 6, f"    {resource['website']}", align=align, new_x='LMARGIN', new_y='NEXT')

        # Additional notes
        if resource.get('additional_notes'):
            pdf.set_text_color(85, 85, 85)
            pdf.set_font_size(10)
            pdf.multi_cell(0, 6, f"    {resource['additional_notes']}", align=align, new_x='LMARGIN', new_y='NEXT')

        pdf.ln(3)

    def _add_footer(self, pdf: FPDF):
        """Add PDF footer."""
        pdf.ln(10)
        pdf.set_font_size(12)
        pdf.set_text_color(102, 102, 102)
        pdf.cell(0, 10, 'For more information, contact your local immigration services office.', align='C')
