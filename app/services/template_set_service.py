"""
Template Set Service.
Manages workflow template sets and mode configurations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload
from loguru import logger

from app.core.database import get_session
from app.models.workflow_template_set import WorkflowTemplateSet, ModeConfiguration
from app.models.workflow import Workflow


class TemplateSetService:
    """Service for managing workflow template sets."""
    
    # ==================== Template Set Operations ====================
    
    async def create_template_set(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new template set."""
        async with get_session() as session:
            template_set = WorkflowTemplateSet(
                name=data["name"],
                description=data.get("description", ""),
                category=data["category"]
            )
            
            session.add(template_set)
            await session.commit()
            await session.refresh(template_set)
            
            logger.info(f"Created template set: {template_set.name} (ID: {template_set.id})")
            return template_set.to_dict()
    
    async def get_template_set(self, template_set_id: int, include_workflows: bool = False) -> Optional[Dict[str, Any]]:
        """Get a template set by ID."""
        async with get_session() as session:
            query = select(WorkflowTemplateSet).where(WorkflowTemplateSet.id == template_set_id)
            
            if include_workflows:
                query = query.options(selectinload(WorkflowTemplateSet.workflows))
            
            result = await session.execute(query)
            template_set = result.scalar_one_or_none()
            
            if template_set:
                return template_set.to_dict_with_workflows() if include_workflows else template_set.to_dict()
            return None
    
    async def list_template_sets(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all template sets, optionally filtered by category."""
        async with get_session() as session:
            query = select(WorkflowTemplateSet)
            
            if category:
                query = query.where(WorkflowTemplateSet.category == category)
            
            query = query.order_by(WorkflowTemplateSet.category, WorkflowTemplateSet.name)
            
            result = await session.execute(query)
            template_sets = result.scalars().all()
            
            return [ts.to_dict() for ts in template_sets]
    
    async def update_template_set(self, template_set_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a template set."""
        async with get_session() as session:
            result = await session.execute(
                select(WorkflowTemplateSet).where(WorkflowTemplateSet.id == template_set_id)
            )
            template_set = result.scalar_one_or_none()
            
            if not template_set:
                return None
            
            # Update fields
            if "name" in data:
                template_set.name = data["name"]
            if "description" in data:
                template_set.description = data["description"]
            if "category" in data:
                template_set.category = data["category"]
            
            template_set.updated_at = datetime.utcnow()
            
            await session.commit()
            await session.refresh(template_set)
            
            logger.info(f"Updated template set: {template_set.name} (ID: {template_set.id})")
            return template_set.to_dict()
    
    async def delete_template_set(self, template_set_id: int) -> bool:
        """Delete a template set."""
        async with get_session() as session:
            result = await session.execute(
                select(WorkflowTemplateSet).where(WorkflowTemplateSet.id == template_set_id)
            )
            template_set = result.scalar_one_or_none()
            
            if not template_set:
                return False
            
            await session.delete(template_set)
            await session.commit()
            
            logger.info(f"Deleted template set: {template_set.name} (ID: {template_set.id})")
            return True
    
    # ==================== Workflow Association Operations ====================
    
    async def add_workflow_to_set(self, template_set_id: int, workflow_id: int) -> bool:
        """Add a workflow to a template set."""
        async with get_session() as session:
            # Get template set
            ts_result = await session.execute(
                select(WorkflowTemplateSet)
                .options(selectinload(WorkflowTemplateSet.workflows))
                .where(WorkflowTemplateSet.id == template_set_id)
            )
            template_set = ts_result.scalar_one_or_none()
            
            if not template_set:
                logger.error(f"Template set {template_set_id} not found")
                return False
            
            # Get workflow
            wf_result = await session.execute(
                select(Workflow).where(Workflow.id == workflow_id)
            )
            workflow = wf_result.scalar_one_or_none()
            
            if not workflow:
                logger.error(f"Workflow {workflow_id} not found")
                return False
            
            # Add workflow if not already in set
            if workflow not in template_set.workflows:
                template_set.workflows.append(workflow)
                template_set.updated_at = datetime.utcnow()
                await session.commit()
                logger.info(f"Added workflow {workflow.name} to template set {template_set.name}")
            else:
                logger.warning(f"Workflow {workflow.name} already in template set {template_set.name}")
            
            return True
    
    async def remove_workflow_from_set(self, template_set_id: int, workflow_id: int) -> bool:
        """Remove a workflow from a template set."""
        async with get_session() as session:
            # Get template set with workflows
            result = await session.execute(
                select(WorkflowTemplateSet)
                .options(selectinload(WorkflowTemplateSet.workflows))
                .where(WorkflowTemplateSet.id == template_set_id)
            )
            template_set = result.scalar_one_or_none()
            
            if not template_set:
                return False
            
            # Find and remove workflow
            workflow_to_remove = None
            for workflow in template_set.workflows:
                if workflow.id == workflow_id:
                    workflow_to_remove = workflow
                    break
            
            if workflow_to_remove:
                template_set.workflows.remove(workflow_to_remove)
                template_set.updated_at = datetime.utcnow()
                await session.commit()
                logger.info(f"Removed workflow {workflow_to_remove.name} from template set {template_set.name}")
                return True
            
            return False
    
    async def get_workflows_in_set(self, template_set_id: int) -> List[Dict[str, Any]]:
        """Get all workflows in a template set."""
        async with get_session() as session:
            result = await session.execute(
                select(WorkflowTemplateSet)
                .options(selectinload(WorkflowTemplateSet.workflows))
                .where(WorkflowTemplateSet.id == template_set_id)
            )
            template_set = result.scalar_one_or_none()
            
            if not template_set:
                return []
            
            return [w.to_dict() for w in template_set.workflows]
    
    # ==================== Mode Configuration Operations ====================
    
    async def create_mode_configuration(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a mode configuration."""
        async with get_session() as session:
            config = ModeConfiguration(
                mode_name=data["mode_name"],
                month_year=data["month_year"],
                template_set_id=data["template_set_id"],
                is_active=data.get("is_active", True),
                priority=data.get("priority", 0)
            )
            
            session.add(config)
            await session.commit()
            await session.refresh(config, ["template_set"])
            
            logger.info(f"Created mode configuration: {config.mode_name} - {config.month_year}")
            return config.to_dict()
    
    async def get_active_configuration(self, mode_name: str, month_year: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get active configuration for a mode and month."""
        if month_year is None:
            # Use current month
            month_year = datetime.now().strftime("%Y-%m")
        
        async with get_session() as session:
            query = select(ModeConfiguration).options(
                selectinload(ModeConfiguration.template_set)
            ).where(
                and_(
                    ModeConfiguration.mode_name == mode_name,
                    ModeConfiguration.month_year == month_year,
                    ModeConfiguration.is_active == True
                )
            ).order_by(desc(ModeConfiguration.priority))
            
            result = await session.execute(query)
            config = result.scalar_one_or_none()
            
            if config:
                return config.to_dict()
            return None
    
    async def list_configurations(self, mode_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all mode configurations."""
        async with get_session() as session:
            query = select(ModeConfiguration).options(
                selectinload(ModeConfiguration.template_set)
            )
            
            if mode_name:
                query = query.where(ModeConfiguration.mode_name == mode_name)
            
            query = query.order_by(
                ModeConfiguration.mode_name,
                desc(ModeConfiguration.month_year),
                desc(ModeConfiguration.priority)
            )
            
            result = await session.execute(query)
            configs = result.scalars().all()
            
            return [c.to_dict() for c in configs]
    
    async def update_configuration(self, config_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a mode configuration."""
        async with get_session() as session:
            result = await session.execute(
                select(ModeConfiguration).where(ModeConfiguration.id == config_id)
            )
            config = result.scalar_one_or_none()
            
            if not config:
                return None
            
            # Update fields
            if "mode_name" in data:
                config.mode_name = data["mode_name"]
            if "month_year" in data:
                config.month_year = data["month_year"]
            if "template_set_id" in data:
                config.template_set_id = data["template_set_id"]
            if "is_active" in data:
                config.is_active = data["is_active"]
            if "priority" in data:
                config.priority = data["priority"]
            
            config.updated_at = datetime.utcnow()
            
            await session.commit()
            await session.refresh(config, ["template_set"])
            
            logger.info(f"Updated mode configuration: {config.mode_name} - {config.month_year}")
            return config.to_dict()
    
    async def delete_configuration(self, config_id: int) -> bool:
        """Delete a mode configuration."""
        async with get_session() as session:
            result = await session.execute(
                select(ModeConfiguration).where(ModeConfiguration.id == config_id)
            )
            config = result.scalar_one_or_none()
            
            if not config:
                return False
            
            await session.delete(config)
            await session.commit()
            
            logger.info(f"Deleted mode configuration: {config.mode_name} - {config.month_year}")
            return True
    
    async def get_master_workflow_for_mode(self, mode_name: str, month_year: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get the master workflow for a mode based on current configuration."""
        # Get active configuration
        config = await self.get_active_configuration(mode_name, month_year)
        
        if not config:
            logger.warning(f"No active configuration found for mode {mode_name}")
            return None
        
        # Get template set with workflows
        template_set = await self.get_template_set(config["template_set_id"], include_workflows=True)
        
        if not template_set or not template_set.get("workflows"):
            logger.warning(f"No workflows found in template set for mode {mode_name}")
            return None
        
        # Find master workflow in the set
        for workflow in template_set["workflows"]:
            if workflow.get("is_master"):
                return workflow
        
        # If no master workflow, return the first one
        logger.warning(f"No master workflow in template set, returning first workflow")
        return template_set["workflows"][0] if template_set["workflows"] else None


# Singleton service
_template_set_service = None


def get_template_set_service() -> TemplateSetService:
    """Get the singleton template set service."""
    global _template_set_service
    if _template_set_service is None:
        _template_set_service = TemplateSetService()
    return _template_set_service
