"""
Template Set API endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.services.template_set_service import get_template_set_service

router = APIRouter(prefix="/api/v1/template-sets", tags=["Template Sets"])
mode_config_router = APIRouter(prefix="/api/v1/mode-configs", tags=["Mode Configurations"])


# ==================== Request/Response Models ====================

class TemplateSetCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str  # e.g., "daily-login", "stage-farm", "pvp", "gacha"


class TemplateSetUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class ModeConfigCreateRequest(BaseModel):
    mode_name: str
    month_year: str  # Format: "YYYY-MM"
    template_set_id: int
    is_active: Optional[bool] = True
    priority: Optional[int] = 0


class ModeConfigUpdateRequest(BaseModel):
    mode_name: Optional[str] = None
    month_year: Optional[str] = None
    template_set_id: Optional[int] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


# ==================== Template Set Endpoints ====================

@router.get("")
async def list_template_sets(category: Optional[str] = None):
    """List all template sets, optionally filtered by category."""
    service = get_template_set_service()
    template_sets = await service.list_template_sets(category)
    return {"success": True, "template_sets": template_sets}


@router.get("/{template_set_id}")
async def get_template_set(template_set_id: int, include_workflows: bool = False):
    """Get a specific template set."""
    service = get_template_set_service()
    template_set = await service.get_template_set(template_set_id, include_workflows)
    
    if template_set:
        return {"success": True, "template_set": template_set}
    raise HTTPException(status_code=404, detail="Template set not found")


@router.post("")
async def create_template_set(request: TemplateSetCreateRequest):
    """Create a new template set."""
    service = get_template_set_service()
    template_set = await service.create_template_set(request.dict())
    return {"success": True, "template_set": template_set}


@router.put("/{template_set_id}")
async def update_template_set(template_set_id: int, request: TemplateSetUpdateRequest):
    """Update a template set."""
    service = get_template_set_service()
    data = {k: v for k, v in request.dict().items() if v is not None}
    
    template_set = await service.update_template_set(template_set_id, data)
    if template_set:
        return {"success": True, "template_set": template_set}
    raise HTTPException(status_code=404, detail="Template set not found")


@router.delete("/{template_set_id}")
async def delete_template_set(template_set_id: int):
    """Delete a template set."""
    service = get_template_set_service()
    success = await service.delete_template_set(template_set_id)
    
    if success:
        return {"success": True, "message": "Template set deleted"}
    raise HTTPException(status_code=404, detail="Template set not found")


@router.get("/category/{category}")
async def get_template_sets_by_category(category: str):
    """Get all template sets in a category."""
    service = get_template_set_service()
    template_sets = await service.list_template_sets(category)
    return {"success": True, "template_sets": template_sets, "category": category}


@router.post("/{template_set_id}/workflows/{workflow_id}")
async def add_workflow_to_set(template_set_id: int, workflow_id: int):
    """Add a workflow to a template set."""
    service = get_template_set_service()
    success = await service.add_workflow_to_set(template_set_id, workflow_id)
    
    if success:
        return {"success": True, "message": "Workflow added to template set"}
    raise HTTPException(status_code=404, detail="Template set or workflow not found")


@router.delete("/{template_set_id}/workflows/{workflow_id}")
async def remove_workflow_from_set(template_set_id: int, workflow_id: int):
    """Remove a workflow from a template set."""
    service = get_template_set_service()
    success = await service.remove_workflow_from_set(template_set_id, workflow_id)
    
    if success:
        return {"success": True, "message": "Workflow removed from template set"}
    raise HTTPException(status_code=404, detail="Template set or workflow not found")


@router.get("/{template_set_id}/workflows")
async def get_workflows_in_set(template_set_id: int):
    """Get all workflows in a template set."""
    service = get_template_set_service()
    workflows = await service.get_workflows_in_set(template_set_id)
    return {"success": True, "workflows": workflows}


# ==================== Mode Configuration Endpoints ====================

@mode_config_router.get("")
async def list_mode_configurations(mode_name: Optional[str] = None):
    """List all mode configurations."""
    service = get_template_set_service()
    configurations = await service.list_configurations(mode_name)
    return {"success": True, "configurations": configurations}


@mode_config_router.get("/active/{mode_name}")
async def get_active_configuration(mode_name: str, month_year: Optional[str] = None):
    """Get active configuration for a mode."""
    service = get_template_set_service()
    config = await service.get_active_configuration(mode_name, month_year)
    
    if config:
        return {"success": True, "configuration": config}
    return {"success": False, "message": "No active configuration found", "configuration": None}


@mode_config_router.get("/master/{mode_name}")
async def get_master_workflow_for_mode(mode_name: str, month_year: Optional[str] = None):
    """Get the master workflow for a mode based on current date."""
    service = get_template_set_service()
    workflow = await service.get_master_workflow_for_mode(mode_name, month_year)
    
    if workflow:
        return {"success": True, "workflow": workflow}
    return {"success": False, "message": "No master workflow found for this mode", "workflow": None}


@mode_config_router.post("")
async def create_mode_configuration(request: ModeConfigCreateRequest):
    """Create a new mode configuration."""
    service = get_template_set_service()
    config = await service.create_mode_configuration(request.dict())
    return {"success": True, "configuration": config}


@mode_config_router.put("/{config_id}")
async def update_mode_configuration(config_id: int, request: ModeConfigUpdateRequest):
    """Update a mode configuration."""
    service = get_template_set_service()
    data = {k: v for k, v in request.dict().items() if v is not None}
    
    config = await service.update_configuration(config_id, data)
    if config:
        return {"success": True, "configuration": config}
    raise HTTPException(status_code=404, detail="Mode configuration not found")


@mode_config_router.delete("/{config_id}")
async def delete_mode_configuration(config_id: int):
    """Delete a mode configuration."""
    service = get_template_set_service()
    success = await service.delete_configuration(config_id)
    
    if success:
        return {"success": True, "message": "Mode configuration deleted"}
    raise HTTPException(status_code=404, detail="Mode configuration not found")
