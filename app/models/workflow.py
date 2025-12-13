"""
Workflow models for Visual Workflow Builder.
Stores automation workflows with action steps.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Workflow(Base):
    """Workflow template containing action steps."""
    __tablename__ = "workflows"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    screen_width = Column(Integer, default=960)
    screen_height = Column(Integer, default=540)
    
    # Validity period (e.g., "December 2024 Re-ID")
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    
    # Master workflow flag - used as default
    is_master = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to steps
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowStep.order_index")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height,
            "valid_from": self.valid_from.isoformat() if self.valid_from else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "is_master": self.is_master,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "steps": [step.to_dict() for step in self.steps]
        }


class WorkflowStep(Base):
    """Single action step within a workflow."""
    __tablename__ = "workflow_steps"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False)  # For drag-drop ordering
    
    # Step type: click, swipe, wait, image_match, find_all_click, conditional
    step_type = Column(String(50), nullable=False)
    
    # Click coordinates
    x = Column(Integer, nullable=True)
    y = Column(Integer, nullable=True)
    
    # Swipe end coordinates
    end_x = Column(Integer, nullable=True)
    end_y = Column(Integer, nullable=True)
    swipe_duration_ms = Column(Integer, default=300)
    
    # Wait duration
    wait_duration_ms = Column(Integer, nullable=True)
    
    # Image matching
    template_path = Column(String(500), nullable=True)
    template_name = Column(String(255), nullable=True)
    threshold = Column(Float, default=0.8)
    match_all = Column(Boolean, default=False)  # Click all matches
    
    # Action after match: click, swipe, wait
    on_match_action = Column(String(50), default="click")
    
    # Conditional logic
    condition_type = Column(String(50), nullable=True)  # image_exists, image_not_exists
    goto_step_on_true = Column(Integer, nullable=True)
    goto_step_on_false = Column(Integer, nullable=True)
    
    # Description for UI
    description = Column(String(500), default="")
    
    # Relationship
    workflow = relationship("Workflow", back_populates="steps")
    
    def to_dict(self):
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "order_index": self.order_index,
            "step_type": self.step_type,
            "x": self.x,
            "y": self.y,
            "end_x": self.end_x,
            "end_y": self.end_y,
            "swipe_duration_ms": self.swipe_duration_ms,
            "wait_duration_ms": self.wait_duration_ms,
            "template_path": self.template_path,
            "template_name": self.template_name,
            "threshold": self.threshold,
            "match_all": self.match_all,
            "on_match_action": self.on_match_action,
            "condition_type": self.condition_type,
            "goto_step_on_true": self.goto_step_on_true,
            "goto_step_on_false": self.goto_step_on_false,
            "description": self.description
        }


class WorkflowTemplate(Base):
    """Image templates captured for workflow matching."""
    __tablename__ = "workflow_templates"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    description = Column(Text, default="")
    
    # Region captured (for reference)
    region_x = Column(Integer, nullable=True)
    region_y = Column(Integer, nullable=True)
    region_width = Column(Integer, nullable=True)
    region_height = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "file_path": self.file_path,
            "description": self.description,
            "region_x": self.region_x,
            "region_y": self.region_y,
            "region_width": self.region_width,
            "region_height": self.region_height,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
