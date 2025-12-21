"""
OCR Service - Text extraction using Tesseract OCR.
"""
import os
from typing import Optional, Tuple
import numpy as np
from loguru import logger

# Try to import pytesseract
try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not installed. Run: pip install pytesseract pillow")


class OcrService:
    """Service for extracting text from images using Tesseract OCR."""
    
    def __init__(self, tesseract_path: Optional[str] = None):
        """
        Initialize OCR service.
        
        Args:
            tesseract_path: Path to tesseract executable. If None, uses system PATH.
        """
        self.tesseract_path = tesseract_path
        
        # Set tesseract path if provided
        if tesseract_path and TESSERACT_AVAILABLE:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
        elif TESSERACT_AVAILABLE:
            # Try common Windows paths
            common_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for path in common_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    logger.info(f"Found Tesseract at: {path}")
                    break
    
    def is_available(self) -> bool:
        """Check if Tesseract is available."""
        if not TESSERACT_AVAILABLE:
            return False
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
            return False
    
    def extract_text(
        self, 
        image: np.ndarray, 
        region: Optional[Tuple[int, int, int, int]] = None,
        lang: str = "eng"
    ) -> str:
        """
        Extract text from an image or region.
        
        Args:
            image: OpenCV image (BGR format)
            region: Optional (x, y, width, height) to crop
            lang: Tesseract language code (default: "eng")
            
        Returns:
            Extracted text string
        """
        if not TESSERACT_AVAILABLE:
            logger.error("pytesseract not installed")
            return ""
        
        try:
            # Crop region if specified
            if region:
                x, y, w, h = region
                image = image[y:y+h, x:x+w]
            
            # Convert BGR to RGB
            import cv2
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Convert to PIL Image
            pil_image = Image.fromarray(rgb_image)
            
            # Apply some preprocessing for better OCR
            # 1. Convert to grayscale
            gray = pil_image.convert('L')
            
            # 2. Increase contrast
            from PIL import ImageEnhance
            enhancer = ImageEnhance.Contrast(gray)
            enhanced = enhancer.enhance(2.0)
            
            # Extract text
            text = pytesseract.image_to_string(
                enhanced, 
                lang=lang,
                config='--psm 7'  # Treat as single line of text
            )
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return ""
    
    def extract_text_from_region(
        self,
        image: np.ndarray,
        x: int, y: int, 
        width: int, height: int,
        lang: str = "eng"
    ) -> str:
        """
        Convenience method to extract text from a specific region.
        
        Args:
            image: OpenCV image
            x, y: Top-left corner of region
            width, height: Size of region
            lang: Language code
            
        Returns:
            Extracted text
        """
        return self.extract_text(image, region=(x, y, width, height), lang=lang)
    
    def fuzzy_match(self, text: str, targets: list, threshold: float = 0.6) -> Optional[str]:
        """
        Check if extracted text fuzzy matches any target string.
        
        Args:
            text: Extracted OCR text
            targets: List of target strings to match
            threshold: Match threshold (0-1)
            
        Returns:
            Matched target string, or None if no match
        """
        if not text or not targets:
            return None
        
        text_lower = text.lower().strip()
        
        for target in targets:
            target_lower = target.lower().strip()
            
            # Exact match
            if target_lower in text_lower or text_lower in target_lower:
                return target
            
            # Simple similarity check
            similarity = self._simple_similarity(text_lower, target_lower)
            if similarity >= threshold:
                logger.info(f"Fuzzy match: '{text}' ~ '{target}' (similarity: {similarity:.2f})")
                return target
        
        return None
    
    def _simple_similarity(self, s1: str, s2: str) -> float:
        """Calculate simple string similarity ratio."""
        if not s1 or not s2:
            return 0.0
        
        # Use longest common subsequence approach
        len1, len2 = len(s1), len(s2)
        
        # Count matching characters
        matches = 0
        for c in s1:
            if c in s2:
                matches += 1
        
        return matches / max(len1, len2)


# Singleton instance
_ocr_service: Optional[OcrService] = None

def get_ocr_service() -> OcrService:
    """Get the OCR service singleton."""
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OcrService()
    return _ocr_service
