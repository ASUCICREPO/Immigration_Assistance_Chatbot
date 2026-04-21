"""
Font download service for multilingual PDF generation.
Downloads GoNotoKurrent universal font from S3 and caches locally.
"""
import os
import logging
import boto3
from botocore.exceptions import ClientError
from typing import Optional

logger = logging.getLogger(__name__)


class FontService:
    """
    Download and cache fonts from S3 for PDF generation.

    Uses GoNotoKurrent universal font which supports 80+ scripts including:
    - Latin (English, Spanish, French, Portuguese, Vietnamese, Haitian Creole, Swahili)
    - Cyrillic (Ukrainian)
    - Devanagari (Hindi)
    - Arabic (Arabic, Urdu, Pashto, Dari)
    - CJK (Chinese Simplified via IICore subset)
    """

    FONT_CACHE_DIR = "/tmp/fonts"
    FONT_FILE = "GoNotoKurrent-Regular.ttf"

    def __init__(self, bucket_name: Optional[str] = None, region_name: str = "us-east-1"):
        """
        Initialize the font service.

        Args:
            bucket_name: S3 bucket containing font files. Defaults to FONT_BUCKET_NAME env var.
            region_name: AWS region for S3 client.
        """
        self.bucket_name = bucket_name or os.environ.get('FONT_BUCKET_NAME', 'immigration-chatbot-fonts')
        self.s3 = boto3.client('s3', region_name=region_name)
        self._font_path: Optional[str] = None

    def get_font_path(self) -> str:
        """
        Get path to universal font, downloading from S3 if not cached.

        Returns:
            Local file path to the font file.

        Raises:
            ClientError: If S3 download fails.
            OSError: If local file operations fail.
        """
        # Return cached path if still valid
        if self._font_path and os.path.exists(self._font_path):
            return self._font_path

        # Ensure cache directory exists
        os.makedirs(self.FONT_CACHE_DIR, exist_ok=True)
        local_path = os.path.join(self.FONT_CACHE_DIR, self.FONT_FILE)

        # Check if font is already cached locally
        if os.path.exists(local_path):
            logger.info(f"Using cached font: {local_path}")
            self._font_path = local_path
            return local_path

        # Download from S3
        try:
            logger.info(f"Downloading font from s3://{self.bucket_name}/{self.FONT_FILE}")
            self.s3.download_file(self.bucket_name, self.FONT_FILE, local_path)
            self._font_path = local_path
            logger.info(f"Font downloaded successfully: {local_path} ({os.path.getsize(local_path)} bytes)")
            return local_path
        except ClientError as e:
            logger.error(f"Failed to download font from S3: {e}")
            raise

    def is_font_available(self) -> bool:
        """
        Check if font is available (either cached or downloadable).

        Returns:
            True if font can be loaded, False otherwise.
        """
        try:
            self.get_font_path()
            return True
        except Exception as e:
            logger.warning(f"Font not available: {e}")
            return False
