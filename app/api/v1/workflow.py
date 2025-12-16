"""
Workflow API endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.services.workflow_service import get_workflow_service

router = APIRouter(prefix="/api/v1/workflows", tags=["Workflows"])


# ==================== Request/Response Models ====================

class StepModel(BaseModel):
    step_type: str
    x: Optional[int] = None
    y: Optional[int] = None
    end_x: Optional[int] = None
    end_y: Optional[int] = None
    swipe_duration_ms: Optional[int] = 300
    wait_duration_ms: Optional[int] = None
    template_path: Optional[str] = None
    template_name: Optional[str] = None
    threshold: Optional[float] = 0.8
    match_all: Optional[bool] = False
    on_match_action: Optional[str] = "click"
    condition_type: Optional[str] = None
    goto_step_on_true: Optional[int] = None
    goto_step_on_false: Optional[int] = None
    description: Optional[str] = ""
    group_name: Optional[str] = None
    
    # Retry options (image_match, find_all_click)
    skip_if_not_found: Optional[bool] = False
    max_wait_seconds: Optional[int] = 10
    max_retries: Optional[int] = None
    retry_interval: Optional[float] = 1.0
    
    # Loop click options
    max_iterations: Optional[int] = 20
    not_found_threshold: Optional[int] = 3
    click_delay: Optional[float] = 1.5
    retry_delay: Optional[float] = 2.0
    
    # Wait for color options
    expected_color: Optional[List[int]] = None  # [B, G, R]
    tolerance: Optional[int] = 30
    check_interval: Optional[float] = 1.0


class WorkflowCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    screen_width: Optional[int] = 960
    screen_height: Optional[int] = 540
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_master: Optional[bool] = False
    mode_name: Optional[str] = None  # NEW: simple mode assignment
    month_year: Optional[str] = None  # NEW: simple month assignment
    steps: Optional[List[StepModel]] = []


class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_master: Optional[bool] = None
    mode_name: Optional[str] = None  # NEW: simple mode assignment
    month_year: Optional[str] = None  # NEW: simple month assignment
    steps: Optional[List[StepModel]] = None


class CaptureTemplateRequest(BaseModel):
    device_serial: str
    name: str
    x: int
    y: int
    width: int
    height: int


class ExecuteWorkflowRequest(BaseModel):
    device_serial: str


class ReorderStepsRequest(BaseModel):
    step_ids: List[int]  # New order of step IDs


# ==================== Endpoints ====================

@router.get("")
async def list_workflows():
    """Get all workflows."""
    service = get_workflow_service()
    workflows = await service.list_workflows()
    return {"success": True, "workflows": workflows}


@router.get("/master")
async def get_master_workflow():
    """Get the current master workflow."""
    service = get_workflow_service()
    workflow = await service.get_master_workflow()
    if workflow:
        return {"success": True, "workflow": workflow}
    return {"success": False, "message": "No master workflow set", "workflow": None}


@router.get("/mode/{mode_name}")
async def get_workflow_for_mode(mode_name: str, month_year: Optional[str] = None):
    """Get the workflow assigned to a specific mode and month."""
    service = get_workflow_service()
    workflow = await service.get_workflow_for_mode(mode_name, month_year)
    if workflow:
        return {"success": True, "workflow": workflow}
    return {"success": False, "message": f"No workflow found for mode '{mode_name}'", "workflow": None}


@router.get("/mode/{mode_name}/all")
async def list_workflows_for_mode(mode_name: str):
    """Get all workflows assigned to a specific mode."""
    service = get_workflow_service()
    workflows = await service.list_workflows_for_mode(mode_name)
    return {"success": True, "workflows": workflows}


@router.get("/templates")
async def list_templates():
    """Get all image templates."""
    service = get_workflow_service()
    templates = await service.list_templates()
    return {"success": True, "templates": templates}


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: int):
    """Get a single workflow."""
    service = get_workflow_service()
    workflow = await service.get_workflow(workflow_id)
    if workflow:
        return {"success": True, "workflow": workflow}
    raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("")
async def create_workflow(request: WorkflowCreateRequest):
    """Create a new workflow."""
    service = get_workflow_service()
    
    data = request.dict()
    # Convert date strings to datetime
    if data.get("valid_from"):
        data["valid_from"] = datetime.fromisoformat(data["valid_from"])
    if data.get("valid_until"):
        data["valid_until"] = datetime.fromisoformat(data["valid_until"])
    
    # Convert steps to dict
    if data.get("steps"):
        data["steps"] = [s.dict() if hasattr(s, 'dict') else s for s in data["steps"]]
    
    workflow = await service.create_workflow(data)
    return {"success": True, "workflow": workflow}


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: int, request: WorkflowUpdateRequest):
    """Update a workflow."""
    service = get_workflow_service()
    
    data = {k: v for k, v in request.dict().items() if v is not None}
    
    # Convert date strings to datetime
    if data.get("valid_from"):
        data["valid_from"] = datetime.fromisoformat(data["valid_from"])
    if data.get("valid_until"):
        data["valid_until"] = datetime.fromisoformat(data["valid_until"])
    
    # Convert steps to dict
    if data.get("steps"):
        data["steps"] = [s.dict() if hasattr(s, 'dict') else s for s in data["steps"]]
    
    workflow = await service.update_workflow(workflow_id, data)
    if workflow:
        return {"success": True, "workflow": workflow}
    raise HTTPException(status_code=404, detail="Workflow not found")


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: int):
    """Delete a workflow."""
    service = get_workflow_service()
    success = await service.delete_workflow(workflow_id)
    if success:
        return {"success": True, "message": "Workflow deleted"}
    raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/{workflow_id}/set-master")
async def set_master_workflow(workflow_id: int):
    """Set a workflow as the master."""
    service = get_workflow_service()
    success = await service.set_master_workflow(workflow_id)
    if success:
        return {"success": True, "message": "Master workflow set"}
    raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/{workflow_id}/execute")
async def execute_workflow(workflow_id: int, request: ExecuteWorkflowRequest):
    """Execute a workflow on a device."""
    service = get_workflow_service()
    result = await service.execute_workflow(workflow_id, request.device_serial)
    return result


@router.post("/capture-template")
async def capture_template(request: CaptureTemplateRequest):
    """Capture a screen region as an image template."""
    service = get_workflow_service()
    
    region = {
        "x": request.x,
        "y": request.y,
        "width": request.width,
        "height": request.height
    }
    
    template = await service.capture_template(
        request.device_serial,
        region,
        request.name
    )
    
    if template:
        return {"success": True, "template": template}
    return {"success": False, "message": "Failed to capture template"}
