"""
License Service - Handles license generation, activation, and validation.
"""
import hashlib
import platform
import subprocess
import uuid
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.database import async_session_maker
from app.models.license import License


class LicenseService:
    """Service for managing software licenses."""
    
    @staticmethod
    def generate_license_key() -> str:
        """Generate a unique license key in format LRG-XXXX-XXXX-XXXX."""
        raw = uuid.uuid4().hex.upper()
        return f"LRG-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"
    
    @staticmethod
    def get_hardware_id() -> str:
        """
        Get a unique hardware identifier for this machine.
        Combines CPU ID, MAC address, and hostname.
        """
        components = []
        
        # Get hostname
        components.append(platform.node())
        
        # Get CPU ID (Windows)
        try:
            if platform.system() == "Windows":
                result = subprocess.run(
                    ["wmic", "cpu", "get", "processorid"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                cpu_id = result.stdout.strip().split('\n')[-1].strip()
                components.append(cpu_id)
        except Exception as e:
            logger.debug(f"Could not get CPU ID: {e}")
        
        # Get MAC address
        try:
            mac = uuid.getnode()
            mac_str = ':'.join(('%012x' % mac)[i:i+2] for i in range(0, 12, 2))
            components.append(mac_str)
        except Exception as e:
            logger.debug(f"Could not get MAC address: {e}")
        
        # Hash all components
        combined = "|".join(components)
        return hashlib.sha256(combined.encode()).hexdigest()
    
    async def create_license(
        self,
        customer_name: str,
        duration_days: int
    ) -> License:
        """
        Create a new license for a customer.
        
        Args:
            customer_name: Name of the customer
            duration_days: Number of days the license is valid
            
        Returns:
            The created License object
        """
        async with async_session_maker() as session:
            license_key = self.generate_license_key()
            
            new_license = License(
                license_key=license_key,
                customer_name=customer_name,
                duration_days=duration_days,
                is_active=True
            )
            
            session.add(new_license)
            await session.commit()
            await session.refresh(new_license)
            
            logger.info(f"Created license {license_key} for {customer_name} ({duration_days} days)")
            return new_license
    
    async def activate_license(
        self,
        license_key: str,
        hardware_id: str
    ) -> Tuple[bool, str, Optional[License]]:
        """
        Activate a license and bind it to hardware.
        
        Args:
            license_key: The license key to activate
            hardware_id: The hardware ID to bind to
            
        Returns:
            Tuple of (success, message, license)
        """
        async with async_session_maker() as session:
            # Find the license
            result = await session.execute(
                select(License).where(License.license_key == license_key)
            )
            license_obj = result.scalar_one_or_none()
            
            if not license_obj:
                return False, "Invalid license key", None
            
            if not license_obj.is_active:
                return False, "License has been revoked", None
            
            # Check if already activated
            if license_obj.is_activated:
                # Check if same hardware
                if license_obj.hardware_id == hardware_id:
                    # Same device, check expiry
                    if license_obj.is_expired:
                        return False, f"License expired. Please purchase a new one.", license_obj
                    return True, f"Welcome back! {license_obj.days_remaining} days remaining", license_obj
                else:
                    return False, "License already activated on another device", None
            
            # Activate the license
            license_obj.hardware_id = hardware_id
            license_obj.activated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(license_obj)
            
            logger.info(f"Activated license {license_key} on hardware {hardware_id[:8]}...")
            return True, f"License activated! Valid for {license_obj.duration_days} days", license_obj
    
    async def validate_license(
        self,
        license_key: str,
        hardware_id: str
    ) -> Tuple[bool, str, Optional[License]]:
        """
        Validate a license for the current hardware.
        
        Returns:
            Tuple of (is_valid, message, license)
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(License).where(License.license_key == license_key)
            )
            license_obj = result.scalar_one_or_none()
            
            if not license_obj:
                return False, "Invalid license key", None
            
            if not license_obj.is_active:
                return False, "License has been revoked", None
            
            if not license_obj.is_activated:
                return False, "License not activated", license_obj
            
            if license_obj.hardware_id != hardware_id:
                return False, "License bound to different device", None
            
            if license_obj.is_expired:
                return False, "License expired", license_obj
            
            return True, f"{license_obj.days_remaining} days remaining", license_obj
    
    async def get_license_by_key(self, license_key: str) -> Optional[License]:
        """Get a license by its key."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(License).where(License.license_key == license_key)
            )
            return result.scalar_one_or_none()
    
    async def list_licenses(self) -> List[License]:
        """List all licenses (for admin)."""
        async with async_session_maker() as session:
            result = await session.execute(select(License).order_by(License.created_at.desc()))
            return list(result.scalars().all())
    
    async def revoke_license(self, license_key: str) -> Tuple[bool, str]:
        """Revoke a license (admin only)."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(License).where(License.license_key == license_key)
            )
            license_obj = result.scalar_one_or_none()
            
            if not license_obj:
                return False, "License not found"
            
            license_obj.is_active = False
            await session.commit()
            
            logger.info(f"Revoked license {license_key}")
            return True, "License revoked"
    
    async def reset_hardware(self, license_key: str) -> Tuple[bool, str]:
        """Reset hardware binding (admin only) - allows re-activation on new device."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(License).where(License.license_key == license_key)
            )
            license_obj = result.scalar_one_or_none()
            
            if not license_obj:
                return False, "License not found"
            
            license_obj.hardware_id = None
            license_obj.activated_at = None
            await session.commit()
            
            logger.info(f"Reset hardware binding for license {license_key}")
            return True, "Hardware binding reset. License can be activated on a new device."

    async def check_hardware_has_valid_license(self, hardware_id: str) -> bool:
        """
        Check if the given hardware ID has a valid license.
        
        Returns:
            True if there's an active, non-expired license bound to this hardware.
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(License).where(License.hardware_id == hardware_id)
            )
            license_obj = result.scalar_one_or_none()
            
            if not license_obj:
                return False
            
            if not license_obj.is_active:
                return False
            
            if license_obj.is_expired:
                return False
            
            return True


# Singleton instance
_license_service: Optional[LicenseService] = None


def get_license_service() -> LicenseService:
    """Get or create the license service instance."""
    global _license_service
    if _license_service is None:
        _license_service = LicenseService()
    return _license_service
