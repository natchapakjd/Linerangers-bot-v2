"""
License model for the database.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class License(Base):
    """License model for storing customer licenses."""
    
    __tablename__ = "licenses"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    license_key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)  # License validity in days
    
    # Hardware binding
    hardware_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # SHA256 hash
    
    # Activation tracking
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    @property
    def is_activated(self) -> bool:
        """Check if license has been activated."""
        return self.hardware_id is not None and self.activated_at is not None
    
    @property
    def is_expired(self) -> bool:
        """Check if license has expired."""
        if not self.activated_at:
            return False
        expiry_date = self.activated_at + __import__('datetime').timedelta(days=self.duration_days)
        return datetime.utcnow() > expiry_date
    
    @property
    def days_remaining(self) -> int:
        """Get number of days remaining on the license."""
        if not self.activated_at:
            return self.duration_days
        expiry_date = self.activated_at + __import__('datetime').timedelta(days=self.duration_days)
        remaining = (expiry_date - datetime.utcnow()).days
        return max(0, remaining)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "license_key": self.license_key,
            "customer_name": self.customer_name,
            "duration_days": self.duration_days,
            "hardware_id": self.hardware_id[:8] + "..." if self.hardware_id else None,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_active": self.is_active,
            "is_activated": self.is_activated,
            "is_expired": self.is_expired,
            "days_remaining": self.days_remaining
        }
