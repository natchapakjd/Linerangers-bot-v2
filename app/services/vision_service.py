"""
Vision Service - Handles image recognition using OpenCV.
"""
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, List
from loguru import logger
from app.config import MATCH_THRESHOLD


class VisionService:
    """Service class for image recognition operations."""
    
    def __init__(self, threshold: float = MATCH_THRESHOLD):
        self.threshold = threshold
        self._template_cache: dict = {}
    
    def load_template(self, template_path: Path) -> Optional[np.ndarray]:
        """Load a template image from disk with caching."""
        path_str = str(template_path)
        if path_str in self._template_cache:
            return self._template_cache[path_str]
        
        if not template_path.exists():
            logger.warning(f"Template not found: {template_path}")
            return None
        
        template = cv2.imread(str(template_path), cv2.IMREAD_COLOR)
        if template is not None:
            self._template_cache[path_str] = template
        return template
    
    def find_template(
        self, 
        screen: np.ndarray, 
        template: np.ndarray,
        threshold: Optional[float] = None
    ) -> Optional[Tuple[int, int, float]]:
        """
        Find a template in the screen image.
        Returns: (center_x, center_y, confidence) or None if not found.
        """
        if screen is None or template is None:
            return None
        
        threshold = threshold or self.threshold
        
        try:
            result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
            
            if max_val >= threshold:
                h, w = template.shape[:2]
                center_x = max_loc[0] + w // 2
                center_y = max_loc[1] + h // 2
                logger.debug(f"Template found at ({center_x}, {center_y}) with confidence {max_val:.2f}")
                return (center_x, center_y, max_val)
            return None
        except Exception as e:
            logger.error(f"Template matching error: {e}")
            return None
    
    def find_all_templates(
        self,
        screen: np.ndarray,
        template: np.ndarray,
        threshold: Optional[float] = None
    ) -> List[Tuple[int, int, float]]:
        """
        Find all occurrences of a template in the screen.
        Returns: List of (center_x, center_y, confidence)
        """
        if screen is None or template is None:
            return []
        
        threshold = threshold or self.threshold
        results = []
        
        try:
            result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
            locations = np.where(result >= threshold)
            h, w = template.shape[:2]
            
            for pt in zip(*locations[::-1]):
                center_x = pt[0] + w // 2
                center_y = pt[1] + h // 2
                confidence = result[pt[1], pt[0]]
                results.append((center_x, center_y, float(confidence)))
            
            return results
        except Exception as e:
            logger.error(f"Find all templates error: {e}")
            return []
    
    def clear_cache(self):
        """Clear the template cache."""
        self._template_cache.clear()
        logger.debug("Template cache cleared")
