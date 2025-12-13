"""
Workflow Service - CRUD operations and workflow execution.
"""
from typing import List, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from datetime import datetime
import asyncio
import os

from app.core.database import async_session_maker
from app.models.workflow import Workflow, WorkflowStep, WorkflowTemplate


class WorkflowService:
    """Service for managing workflows and executing them on devices."""
    
    def __init__(self):
        self.templates_dir = os.path.join(os.path.dirname(__file__), "..", "..", "workflow_templates")
        os.makedirs(self.templates_dir, exist_ok=True)
    
    # ==================== Workflow CRUD ====================
    
    async def list_workflows(self) -> List[dict]:
        """Get all workflows."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps)).order_by(Workflow.created_at.desc())
            )
            workflows = result.scalars().all()
            return [w.to_dict() for w in workflows]
    
    async def get_workflow(self, workflow_id: int) -> Optional[dict]:
        """Get a single workflow by ID."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps)).where(Workflow.id == workflow_id)
            )
            workflow = result.scalar_one_or_none()
            return workflow.to_dict() if workflow else None
    
    async def get_master_workflow(self) -> Optional[dict]:
        """Get the current master workflow."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps)).where(Workflow.is_master == True)
            )
            workflow = result.scalar_one_or_none()
            return workflow.to_dict() if workflow else None
    
    async def create_workflow(self, data: dict) -> dict:
        """Create a new workflow."""
        async with async_session_maker() as session:
            workflow = Workflow(
                name=data.get("name", "New Workflow"),
                description=data.get("description", ""),
                screen_width=data.get("screen_width", 960),
                screen_height=data.get("screen_height", 540),
                valid_from=data.get("valid_from"),
                valid_until=data.get("valid_until"),
                is_master=data.get("is_master", False)
            )
            session.add(workflow)
            await session.commit()
            await session.refresh(workflow)
            
            # Add steps if provided
            if "steps" in data:
                for idx, step_data in enumerate(data["steps"]):
                    step = self._create_step(workflow.id, idx, step_data)
                    session.add(step)
                await session.commit()
            
            # Reload with steps
            await session.refresh(workflow)
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps)).where(Workflow.id == workflow.id)
            )
            workflow = result.scalar_one()
            return workflow.to_dict()
    
    async def update_workflow(self, workflow_id: int, data: dict) -> Optional[dict]:
        """Update a workflow and its steps."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps)).where(Workflow.id == workflow_id)
            )
            workflow = result.scalar_one_or_none()
            
            if not workflow:
                return None
            
            # Update workflow fields
            if "name" in data:
                workflow.name = data["name"]
            if "description" in data:
                workflow.description = data["description"]
            if "screen_width" in data:
                workflow.screen_width = data["screen_width"]
            if "screen_height" in data:
                workflow.screen_height = data["screen_height"]
            if "valid_from" in data:
                workflow.valid_from = data["valid_from"]
            if "valid_until" in data:
                workflow.valid_until = data["valid_until"]
            if "is_master" in data:
                # If setting as master, unset other masters
                if data["is_master"]:
                    await session.execute(
                        update(Workflow).where(Workflow.id != workflow_id).values(is_master=False)
                    )
                workflow.is_master = data["is_master"]
            
            # Update steps if provided
            if "steps" in data:
                # Delete existing steps
                await session.execute(
                    delete(WorkflowStep).where(WorkflowStep.workflow_id == workflow_id)
                )
                # Add new steps
                for idx, step_data in enumerate(data["steps"]):
                    step = self._create_step(workflow_id, idx, step_data)
                    session.add(step)
            
            workflow.updated_at = datetime.utcnow()
            await session.commit()
            
            # Reload with steps
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps)).where(Workflow.id == workflow_id)
            )
            workflow = result.scalar_one()
            return workflow.to_dict()
    
    async def delete_workflow(self, workflow_id: int) -> bool:
        """Delete a workflow."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workflow).where(Workflow.id == workflow_id)
            )
            workflow = result.scalar_one_or_none()
            
            if not workflow:
                return False
            
            await session.delete(workflow)
            await session.commit()
            return True
    
    async def set_master_workflow(self, workflow_id: int) -> bool:
        """Set a workflow as the master."""
        async with async_session_maker() as session:
            # Unset all masters
            await session.execute(
                update(Workflow).values(is_master=False)
            )
            # Set new master
            result = await session.execute(
                update(Workflow).where(Workflow.id == workflow_id).values(is_master=True)
            )
            await session.commit()
            return result.rowcount > 0
    
    def _create_step(self, workflow_id: int, order_index: int, data: dict) -> WorkflowStep:
        """Create a WorkflowStep instance from data."""
        return WorkflowStep(
            workflow_id=workflow_id,
            order_index=order_index,
            step_type=data.get("step_type", "click"),
            x=data.get("x"),
            y=data.get("y"),
            end_x=data.get("end_x"),
            end_y=data.get("end_y"),
            swipe_duration_ms=data.get("swipe_duration_ms", 300),
            wait_duration_ms=data.get("wait_duration_ms"),
            template_path=data.get("template_path"),
            template_name=data.get("template_name"),
            threshold=data.get("threshold", 0.8),
            match_all=data.get("match_all", False),
            on_match_action=data.get("on_match_action", "click"),
            condition_type=data.get("condition_type"),
            goto_step_on_true=data.get("goto_step_on_true"),
            goto_step_on_false=data.get("goto_step_on_false"),
            description=data.get("description", "")
        )
    
    # ==================== Workflow Execution ====================
    
    async def execute_workflow(self, workflow_id: int, device_serial: str) -> dict:
        """Execute a workflow on a device."""
        from app.services.adb_service import ADBService
        from app.services.template_service import TemplateService
        
        workflow_data = await self.get_workflow(workflow_id)
        if not workflow_data:
            return {"success": False, "message": "Workflow not found"}
        
        adb = ADBService()
        adb.device_address = device_serial
        template_service = TemplateService()
        
        steps = workflow_data.get("steps", [])
        step_index = 0
        
        while step_index < len(steps):
            step = steps[step_index]
            step_type = step["step_type"]
            
            try:
                if step_type == "click":
                    adb.tap(step["x"], step["y"])
                    await asyncio.sleep(0.3)
                
                elif step_type == "swipe":
                    adb.swipe(
                        step["x"], step["y"],
                        step["end_x"], step["end_y"],
                        step.get("swipe_duration_ms", 300)
                    )
                    await asyncio.sleep(0.5)
                
                elif step_type == "wait":
                    await asyncio.sleep(step.get("wait_duration_ms", 1000) / 1000)
                
                elif step_type == "image_match":
                    # Capture screen and find template
                    screenshot = adb.capture_screen()
                    if screenshot is None:
                        return {"success": False, "message": f"Failed to capture screen at step {step_index + 1}"}
                    
                    if step.get("match_all"):
                        # Find all matches
                        matches = template_service.find_all_templates(
                            screenshot, 
                            step["template_path"],
                            step.get("threshold", 0.8)
                        )
                        for match in matches:
                            adb.tap(match["x"], match["y"])
                            await asyncio.sleep(0.3)
                    else:
                        # Find single match
                        result = template_service.find_template(
                            screenshot,
                            step["template_path"],
                            step.get("threshold", 0.8)
                        )
                        if result:
                            adb.tap(result["x"], result["y"])
                            await asyncio.sleep(0.3)
                
                elif step_type == "conditional":
                    screenshot = adb.capture_screen()
                    result = template_service.find_template(
                        screenshot,
                        step["template_path"],
                        step.get("threshold", 0.8)
                    )
                    
                    if step["condition_type"] == "image_exists":
                        if result:
                            if step.get("goto_step_on_true") is not None:
                                step_index = step["goto_step_on_true"] - 1  # Will be incremented
                        else:
                            if step.get("goto_step_on_false") is not None:
                                step_index = step["goto_step_on_false"] - 1
                
                step_index += 1
                
            except Exception as e:
                return {"success": False, "message": f"Error at step {step_index + 1}: {str(e)}"}
        
        return {"success": True, "message": f"Workflow completed ({len(steps)} steps)"}
    
    # ==================== Template Management ====================
    
    async def list_templates(self) -> List[dict]:
        """Get all image templates."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(WorkflowTemplate).order_by(WorkflowTemplate.created_at.desc())
            )
            templates = result.scalars().all()
            return [t.to_dict() for t in templates]
    
    async def capture_template(self, device_serial: str, region: dict, name: str) -> Optional[dict]:
        """Capture a region from screen as a template."""
        from app.services.adb_service import ADBService
        import cv2
        import numpy as np
        
        adb = ADBService()
        adb.device_address = device_serial
        
        screenshot = adb.capture_screen()
        if screenshot is None:
            return None
        
        # Crop region
        x = region.get("x", 0)
        y = region.get("y", 0)
        width = region.get("width", 100)
        height = region.get("height", 100)
        
        cropped = screenshot[y:y+height, x:x+width]
        
        # Save to file
        filename = f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        filepath = os.path.join(self.templates_dir, filename)
        cv2.imwrite(filepath, cropped)
        
        # Save to database
        async with async_session_maker() as session:
            template = WorkflowTemplate(
                name=name,
                file_path=filepath,
                region_x=x,
                region_y=y,
                region_width=width,
                region_height=height
            )
            session.add(template)
            await session.commit()
            await session.refresh(template)
            return template.to_dict()


# Singleton instance
_workflow_service: Optional[WorkflowService] = None

def get_workflow_service() -> WorkflowService:
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
    return _workflow_service
