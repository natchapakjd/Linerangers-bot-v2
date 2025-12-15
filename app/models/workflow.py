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
    
    # Mode assignment - NEW SIMPLE APPROACH
    mode_name = Column(String(100), nullable=True, index=True)  # e.g., "daily-login", "stage-farm"
    month_year = Column(String(7), nullable=True, index=True)   # e.g., "2024-12", "2025-01"
    
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
            "mode_name": self.mode_name,
            "month_year": self.month_year,
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
    
    # Retry options for image matching
    skip_if_not_found = Column(Boolean, default=False)  # Skip step if template not found
    max_wait_seconds = Column(Integer, default=10)  # Max seconds to wait for template
    max_retries = Column(Integer, nullable=True)  # Max retry attempts (None = unlimited)
    retry_interval = Column(Float, default=1.0)  # Seconds between retries
    
    # Action after match: click, swipe, wait
    on_match_action = Column(String(50), default="click")
    
    # Conditional logic
    condition_type = Column(String(50), nullable=True)  # image_exists, image_not_exists
    goto_step_on_true = Column(Integer, nullable=True)
    goto_step_on_false = Column(Integer, nullable=True)
    
    # Description for UI
    description = Column(String(500), default="")
    
    # Group organization (e.g., "re-id", "before-re-id")
    group_name = Column(String(100), nullable=True, index=True)
    
    # Loop click options
    max_iterations = Column(Integer, default=20)
    not_found_threshold = Column(Integer, default=3)
    click_delay = Column(Float, default=1.5)
    retry_delay = Column(Float, default=2.0)
    
    # Wait for color options
    expected_color = Column(JSON, nullable=True)  # [B, G, R]
    tolerance = Column(Integer, default=30)
    check_interval = Column(Float, default=1.0)
    
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
            "skip_if_not_found": self.skip_if_not_found,
            "max_wait_seconds": self.max_wait_seconds,
            "max_retries": self.max_retries,
            "retry_interval": self.retry_interval,
            "on_match_action": self.on_match_action,
            "condition_type": self.condition_type,
            "goto_step_on_true": self.goto_step_on_true,
            "goto_step_on_false": self.goto_step_on_false,
            "description": self.description,
            "group_name": self.group_name,
            # Loop click options
            "max_iterations": self.max_iterations,
            "not_found_threshold": self.not_found_threshold,
            "click_delay": self.click_delay,
            "retry_delay": self.retry_delay,
            # Wait for color options
            "expected_color": self.expected_color,
            "tolerance": self.tolerance,
            "check_interval": self.check_interval
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
