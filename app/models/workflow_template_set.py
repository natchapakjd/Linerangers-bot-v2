"""
Workflow Template Set models.
Organizes workflows into reusable sets with mode and time-based configurations.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


# Association table for many-to-many relationship between template sets and workflows
template_set_workflow_association = Table(
    'template_set_workflow_association',
    Base.metadata,
    Column('template_set_id', Integer, ForeignKey('workflow_template_sets.id', ondelete='CASCADE'), primary_key=True),
    Column('workflow_id', Integer, ForeignKey('workflows.id', ondelete='CASCADE'), primary_key=True),
    Column('order_index', Integer, default=0)  # For ordering workflows within a set
)


class WorkflowTemplateSet(Base):
    """Collection of workflows grouped together as a template set."""
    __tablename__ = "workflow_template_sets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), default="")
    
    # Category for organization (e.g., "daily-login", "stage-farm", "pvp", "gacha")
    category = Column(String(100), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Many-to-many relationship with workflows
    workflows = relationship(
        "Workflow",
        secondary=template_set_workflow_association,
        backref="template_sets"
    )
    
    # One-to-many relationship with mode configurations
    mode_configurations = relationship(
        "ModeConfiguration",
        back_populates="template_set",
        cascade="all, delete-orphan"
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "workflow_count": len(self.workflows) if self.workflows else 0
        }
    
    def to_dict_with_workflows(self):
        """Return dict with full workflow details."""
        data = self.to_dict()
        data["workflows"] = [w.to_dict() for w in self.workflows] if self.workflows else []
        return data


class ModeConfiguration(Base):
    """Maps game modes and time periods to template sets."""
    __tablename__ = "mode_configurations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Mode name (e.g., "daily-login", "stage-farm", "pvp")
    mode_name = Column(String(100), nullable=False, index=True)
    
    # Month and year (e.g., "2024-12", "2025-01")
    month_year = Column(String(7), nullable=False, index=True)
    
    # Reference to template set
    template_set_id = Column(Integer, ForeignKey("workflow_template_sets.id", ondelete="CASCADE"), nullable=False)
    
    # Active flag
    is_active = Column(Boolean, default=True)
    
    # Priority for overlapping configurations (higher = more priority)
    priority = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    template_set = relationship("WorkflowTemplateSet", back_populates="mode_configurations")
    
    def to_dict(self):
        return {
            "id": self.id,
            "mode_name": self.mode_name,
            "month_year": self.month_year,
            "template_set_id": self.template_set_id,
            "template_set_name": self.template_set.name if self.template_set else None,
            "is_active": self.is_active,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
