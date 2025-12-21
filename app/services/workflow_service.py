"""
Workflow Service - CRUD operations and workflow execution.
"""
from typing import List, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from datetime import datetime
from pathlib import Path
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
    
    async def get_workflow_for_mode(self, mode_name: str, month_year: Optional[str] = None) -> Optional[dict]:
        """Get the workflow assigned to a specific mode and month.
        
        Args:
            mode_name: The game mode name (e.g., 'daily-login', 'stage-farm')
            month_year: Optional month/year in format 'YYYY-MM'. If not provided, uses current month.
        
        Returns:
            Workflow dict if found, None otherwise
        """
        from datetime import datetime
        
        if month_year is None:
            month_year = datetime.now().strftime("%Y-%m")
        
        async with async_session_maker() as session:
            # First try to find exact match for mode + month
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps))
                .where(Workflow.mode_name == mode_name)
                .where(Workflow.month_year == month_year)
                .order_by(Workflow.is_master.desc())  # Prefer master workflows
            )
            workflow = result.scalars().first()  # Use first() to handle multiple matches
            
            if workflow:
                return workflow.to_dict()
            
            # If no exact match, try to find any workflow for this mode
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps))
                .where(Workflow.mode_name == mode_name)
                .order_by(Workflow.is_master.desc(), Workflow.updated_at.desc())
            )
            workflow = result.scalars().first()  # Use first() to handle multiple matches
            
            return workflow.to_dict() if workflow else None
    
    async def list_workflows_for_mode(self, mode_name: str) -> List[dict]:
        """Get all workflows assigned to a specific mode."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workflow).options(selectinload(Workflow.steps))
                .where(Workflow.mode_name == mode_name)
                .order_by(Workflow.month_year.desc(), Workflow.is_master.desc())
            )
            workflows = result.scalars().all()
            return [w.to_dict() for w in workflows]
    
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
                is_master=data.get("is_master", False),
                mode_name=data.get("mode_name"),
                month_year=data.get("month_year")
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
            if "mode_name" in data:
                workflow.mode_name = data["mode_name"]
            if "month_year" in data:
                workflow.month_year = data["month_year"]
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
            description=data.get("description", ""),
            group_name=data.get("group_name"),
            # Retry options
            skip_if_not_found=data.get("skip_if_not_found", False),
            max_wait_seconds=data.get("max_wait_seconds", 10),
            max_retries=data.get("max_retries"),
            retry_interval=data.get("retry_interval", 1.0),
            # Loop click options  
            max_iterations=data.get("max_iterations", 20),
            not_found_threshold=data.get("not_found_threshold", 3),
            click_delay=data.get("click_delay", 1.5),
            retry_delay=data.get("retry_delay", 2.0),
            # Wait for color options
            expected_color=data.get("expected_color"),
            tolerance=data.get("tolerance", 30),
            check_interval=data.get("check_interval", 1.0),
            # Repeat group options
            loop_group_name=data.get("loop_group_name"),
            stop_template_path=data.get("stop_template_path"),
            stop_on_not_found=data.get("stop_on_not_found", True),
            loop_max_iterations=data.get("loop_max_iterations", 100),
            # Gacha check options
            ocr_region=data.get("ocr_region"),
            target_characters=data.get("target_characters"),
            gacha_save_folder=data.get("gacha_save_folder")
        )
    
    # ==================== Workflow Execution ====================
    
    async def execute_workflow(self, workflow_id: int, device_serial: str) -> dict:
        """Execute a workflow on a device."""
        from app.services.adb_service import AdbService
        from app.services.template_service import TemplateService
        
        workflow_data = await self.get_workflow(workflow_id)
        if not workflow_data:
            return {"success": False, "message": "Workflow not found"}
        
        adb = AdbService()
        adb.device_address = device_serial
        template_service = TemplateService()
        
        steps = workflow_data.get("steps", [])
        step_index = 0
        
        # Collect group names that have a repeat_group step
        repeat_groups = set()
        for s in steps:
            if s.get("step_type") == "repeat_group" and s.get("loop_group_name"):
                repeat_groups.add(s.get("loop_group_name"))
        
        while step_index < len(steps):
            step = steps[step_index]
            step_type = step["step_type"]
            
            # Skip steps that belong to a repeat_group - they'll be executed in the loop
            group_name = step.get("group_name")
            if group_name and group_name in repeat_groups and step_type != "repeat_group":
                step_index += 1
                continue
            
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
                
                elif step_type == "image_match" or step_type == "find_all_click":
                    # Capture screen and find template
                    screenshot = adb.screenshot()
                    if screenshot is None:
                        return {"success": False, "message": f"Failed to capture screen at step {step_index + 1}"}
                    
                    # find_all_click always finds all matches
                    should_find_all = step_type == "find_all_click" or step.get("match_all", False)
                    
                    # Retry logic with timeout and retry count limit
                    import time
                    max_wait = step.get("max_wait_seconds", 10)  # Default 10 seconds
                    max_retries = step.get("max_retries", None)  # Default None = unlimited (only time limit)
                    retry_interval = step.get("retry_interval", 1)  # Default 1 second
                    start_time = time.time()
                    retry_count = 0
                    found = False
                    
                    if max_retries:
                        template_name = Path(step.get("template_path", "unknown")).name if step.get("template_path") else "unknown"
                        print(f"[DEBUG] Searching for template: {template_name}, max {max_retries} retries, {retry_interval}s interval")
                    else:
                        template_name = Path(step.get("template_path", "unknown")).name if step.get("template_path") else "unknown"
                        print(f"[DEBUG] Searching for template: {template_name}, max wait: {max_wait}s")
                    
                    while True:
                        # Check timeout
                        if (time.time() - start_time) >= max_wait:
                            print(f"[DEBUG] Timeout reached ({max_wait}s)")
                            break
                        
                        # Check retry count limit
                        if max_retries and retry_count >= max_retries:
                            print(f"[DEBUG] Max retries reached ({max_retries})")
                            break
                        
                        # Capture fresh screenshot each retry
                        screenshot = adb.screenshot()
                        if screenshot is None:
                            await asyncio.sleep(retry_interval)
                            retry_count += 1
                            continue
                        
                        if should_find_all:
                            # Find all matches
                            matches = template_service.find_all_templates(
                                screenshot, 
                                step["template_path"],
                                step.get("threshold", 0.8),
                                max_matches=50
                            )
                            if matches:
                                print(f"[DEBUG] Found {len(matches)} matches after {retry_count} retries ({time.time() - start_time:.1f}s)")
                                for idx, match in enumerate(matches):
                                    print(f"[DEBUG] Clicking match {idx + 1}/{len(matches)} at ({match[0]}, {match[1]})")
                                    adb.tap(match[0], match[1])
                                    await asyncio.sleep(0.3)
                                found = True
                                break
                        else:
                            # Find single match - USE OPTIMIZED METHOD
                            result = template_service.find_template_fast(
                                screenshot,
                                step["template_path"],
                                step.get("threshold", 0.8)
                            )
                            if result:
                                print(f"[DEBUG] Found template at ({result[0]}, {result[1]}) after {retry_count} retries ({time.time() - start_time:.1f}s)")
                                adb.tap(result[0], result[1])
                                await asyncio.sleep(0.3)
                                found = True
                                break
                        
                        # Not found yet, wait and retry
                        retry_count += 1
                        elapsed = time.time() - start_time
                        if max_retries:
                            print(f"[DEBUG] Retry {retry_count}/{max_retries} - not found, waiting {retry_interval}s...")
                        else:
                            print(f"[DEBUG] Template not found yet ({elapsed:.1f}/{max_wait}s), retrying...")
                        await asyncio.sleep(retry_interval)
                    
                    # Check if we found it
                    if not found:
                        if max_retries:
                            print(f"[DEBUG] Template not found after {retry_count} retries")
                        else:
                            print(f"[DEBUG] Template not found after {max_wait}s timeout")
                        
                        if not step.get("skip_if_not_found", False):
                            if max_retries:
                                return {"success": False, "message": f"Template not found at step {step_index + 1} after {retry_count} retries: {step.get('template_name', 'unknown')}"}
                            else:
                                return {"success": False, "message": f"Template not found at step {step_index + 1} after {max_wait}s: {step.get('template_name', 'unknown')}"}
                        else:
                            print(f"[DEBUG] Skipping step (skip_if_not_found=True)")
                
                elif step_type == "loop_click":
                    # Loop click: Keep finding and clicking until template not found
                    # Similar to daily-login auto claim
                    template_path = step.get("template_path")
                    if not template_path:
                        return {"success": False, "message": f"loop_click step {step_index + 1} missing template_path"}
                    
                    max_iterations = step.get("max_iterations", 20)  # Safety limit
                    not_found_threshold = step.get("not_found_threshold", 3)  # Stop after N consecutive not found
                    click_delay = step.get("click_delay", 1.5)  # Delay after each click
                    retry_delay = step.get("retry_delay", 2)  # Delay when not found
                    threshold = step.get("threshold", 0.8)
                    
                    template_name = Path(template_path).name
                    print(f"[DEBUG] Loop click: {template_name}, max {max_iterations} iterations")
                    
                    iteration = 0
                    not_found_count = 0
                    total_clicks = 0
                    
                    while iteration < max_iterations:
                        iteration += 1
                        print(f"[DEBUG] Loop iteration #{iteration}...")
                        
                        # Take screenshot
                        screenshot = adb.screenshot()
                        if screenshot is None:
                            print(f"[DEBUG] Screenshot failed, retrying...")
                            await asyncio.sleep(1)
                            continue
                        
                        # Find template
                        result = template_service.find_template_fast(
                            screenshot,
                            template_path,
                            threshold
                        )
                        
                        if result:
                            # Found! Click it
                            print(f"[DEBUG] ✓ Found at ({result[0]}, {result[1]}), clicking... (click #{total_clicks + 1})")
                            adb.tap(result[0], result[1])
                            total_clicks += 1
                            not_found_count = 0  # Reset counter
                            await asyncio.sleep(click_delay)
                        else:
                            # Not found
                            not_found_count += 1
                            print(f"[DEBUG] ✗ Not found ({not_found_count}/{not_found_threshold})")
                            
                            # Check if we should stop
                            if not_found_count >= not_found_threshold:
                                print(f"[DEBUG] ✅ Template not found {not_found_threshold} times, loop complete!")
                                print(f"[DEBUG] Total clicks: {total_clicks}")
                                break
                            
                            await asyncio.sleep(retry_delay)
                    
                    if iteration >= max_iterations:
                        print(f"[DEBUG] ⚠️ Reached max iterations ({max_iterations})")
                        print(f"[DEBUG] Total clicks: {total_clicks}")
                
                elif step_type == "wait_for_color":
                    # Wait until color at position matches expected color
                    x = step.get("x")
                    y = step.get("y")
                    expected_color = step.get("expected_color")
                    if expected_color is None:
                        expected_color = [255, 255, 255]  # Default white [B, G, R]
                    tolerance = step.get("tolerance", 30)  # Color difference tolerance
                    max_wait = step.get("max_wait_seconds", 30)
                    check_interval = step.get("check_interval", 1)  # Check every 1 second
                    
                    if x is None or y is None:
                        return {"success": False, "message": f"wait_for_color step {step_index + 1} missing x or y"}
                    
                    print(f"[DEBUG] Wait for color at ({x}, {y}), expecting RGB({expected_color[2]},{expected_color[1]},{expected_color[0]}) ±{tolerance}")
                    
                    import time
                    start_time = time.time()
                    found = False
                    
                    while (time.time() - start_time) < max_wait:
                        screenshot = adb.screenshot()
                        if screenshot is None:
                            await asyncio.sleep(1)
                            continue
                        
                        # Check bounds
                        h, w = screenshot.shape[:2]
                        if y >= h or x >= w:
                            print(f"[DEBUG] Position ({x},{y}) out of bounds ({w}x{h})")
                            return {"success": False, "message": f"Position out of bounds at step {step_index + 1}"}
                        
                        # Get pixel color (BGR format)
                        pixel = screenshot[y, x]
                        
                        # Calculate color difference
                        diff = abs(int(pixel[0]) - expected_color[0]) + \
                               abs(int(pixel[1]) - expected_color[1]) + \
                               abs(int(pixel[2]) - expected_color[2])
                        
                        print(f"[DEBUG] Current color: RGB({pixel[2]},{pixel[1]},{pixel[0]}), diff: {diff}")
                        
                        if diff <= tolerance:
                            print(f"[DEBUG] ✅ Color matched! (diff: {diff} ≤ {tolerance})")
                            found = True
                            break
                        
                        elapsed = time.time() - start_time
                        remaining = int(max_wait - elapsed)
                        if remaining % 5 == 0:  # Log every 5 seconds
                            print(f"[DEBUG] Waiting for color... ({remaining}s remaining)")
                        
                        await asyncio.sleep(check_interval)
                    
                    if not found:
                        print(f"[DEBUG] ❌ Color not matched after {max_wait}s")
                        return {"success": False, "message": f"Color not matched at step {step_index + 1} after {max_wait}s"}
                
                elif step_type == "conditional":
                    screenshot = adb.screenshot()
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
                
                elif step_type == "press_back":
                    # Press Android back key
                    adb.press_key("KEYCODE_BACK")
                    await asyncio.sleep(0.5)
                
                elif step_type == "start_game":
                    # Start Line Rangers (without force stop)
                    package_name = "com.linecorp.LGRGS"
                    print(f"[DEBUG] Starting game: {package_name}")
                    result = adb.start_app(package_name)
                    print(f"[DEBUG] Start game result: {result}")
                    await asyncio.sleep(3)  # Wait for game to load
                
                elif step_type == "restart_game":
                    # Restart Line Rangers
                    package_name = "com.linecorp.LGRGS"
                    adb.force_stop_app(package_name)
                    await asyncio.sleep(1)
                    adb.start_app(package_name)
                    await asyncio.sleep(3)  # Wait for game to load
                
                elif step_type == "repeat_group":
                    # Repeat a group of steps until stop condition is met
                    loop_group_name = step.get("loop_group_name")
                    stop_template_path = step.get("stop_template_path")
                    stop_on_not_found = step.get("stop_on_not_found", True)
                    loop_max_iterations = step.get("loop_max_iterations", 100)
                    threshold = step.get("threshold", 0.8)
                    
                    if not loop_group_name:
                        return {"success": False, "message": f"repeat_group step {step_index + 1} missing loop_group_name"}
                    
                    # Collect steps that belong to the group
                    group_steps = [s for s in steps if s.get("group_name") == loop_group_name]
                    
                    if not group_steps:
                        print(f"[DEBUG] Warning: No steps found with group_name '{loop_group_name}'")
                        step_index += 1
                        continue
                    
                    print(f"[DEBUG] repeat_group: Looping {len(group_steps)} steps in group '{loop_group_name}'")
                    print(f"[DEBUG] Stop condition: template '{Path(stop_template_path).name if stop_template_path else 'None'}' {'NOT found' if stop_on_not_found else 'FOUND'}")
                    
                    iteration = 0
                    while iteration < loop_max_iterations:
                        iteration += 1
                        print(f"[DEBUG] === Loop iteration #{iteration}/{loop_max_iterations} ===")
                        
                        # Execute all steps in the group
                        for group_step in group_steps:
                            group_step_type = group_step["step_type"]
                            
                            try:
                                if group_step_type == "click":
                                    adb.tap(group_step["x"], group_step["y"])
                                    await asyncio.sleep(0.3)
                                
                                elif group_step_type == "swipe":
                                    adb.swipe(
                                        group_step["x"], group_step["y"],
                                        group_step["end_x"], group_step["end_y"],
                                        group_step.get("swipe_duration_ms", 300)
                                    )
                                    await asyncio.sleep(0.5)
                                
                                elif group_step_type == "wait":
                                    await asyncio.sleep(group_step.get("wait_duration_ms", 1000) / 1000)
                                
                                elif group_step_type == "image_match":
                                    # Simple image match with click
                                    import time
                                    max_wait = group_step.get("max_wait_seconds", 5)
                                    start_time = time.time()
                                    
                                    while (time.time() - start_time) < max_wait:
                                        screenshot = adb.screenshot()
                                        if screenshot is None:
                                            await asyncio.sleep(0.5)
                                            continue
                                        
                                        result = template_service.find_template_fast(
                                            screenshot,
                                            group_step["template_path"],
                                            group_step.get("threshold", 0.8)
                                        )
                                        
                                        if result:
                                            adb.tap(result[0], result[1])
                                            await asyncio.sleep(0.3)
                                            break
                                        
                                        await asyncio.sleep(0.5)
                                
                                elif group_step_type == "press_back":
                                    adb.press_key("KEYCODE_BACK")
                                    await asyncio.sleep(0.5)
                                
                                elif group_step_type == "gacha_check":
                                    # OCR check for gacha character
                                    from app.services.ocr_service import get_ocr_service
                                    from datetime import datetime
                                    
                                    print(f"[DEBUG] 🔍 === GACHA CHECK (Iteration #{iteration}) ===")
                                    
                                    ocr_service = get_ocr_service()
                                    
                                    # Check if Tesseract is available
                                    if not ocr_service.is_available():
                                        print(f"[DEBUG] ❌ Tesseract OCR is NOT installed or not found!")
                                        print(f"[DEBUG] Please install from: https://github.com/UB-Mannheim/tesseract/wiki")
                                        continue
                                    
                                    target_chars = group_step.get("target_characters", [])
                                    save_folder = group_step.get("gacha_save_folder", "")
                                    ocr_region = group_step.get("ocr_region")
                                    
                                    print(f"[DEBUG] Target characters: {target_chars}")
                                    print(f"[DEBUG] Save folder: {save_folder}")
                                    print(f"[DEBUG] OCR Region: {ocr_region}")
                                    
                                    if not target_chars:
                                        print(f"[DEBUG] ⚠️ No target characters configured!")
                                        continue
                                    
                                    screenshot = adb.screenshot()
                                    if screenshot is None:
                                        print(f"[DEBUG] ❌ Failed to capture screenshot!")
                                        continue
                                    
                                    # Use ocr_region if available, otherwise full screen
                                    if ocr_region:
                                        region_tuple = (
                                            ocr_region.get("x", 320),
                                            ocr_region.get("y", 140),
                                            ocr_region.get("width", 320),
                                            ocr_region.get("height", 60)
                                        )
                                        print(f"[DEBUG] 📷 Screenshot captured ({screenshot.shape}), running OCR on region {region_tuple}...")
                                        text = ocr_service.extract_text(screenshot, region=region_tuple)
                                    else:
                                        print(f"[DEBUG] 📷 Screenshot captured ({screenshot.shape}), running OCR on FULL SCREEN...")
                                        text = ocr_service.extract_text(screenshot, region=None)
                                    
                                    print(f"[DEBUG] 📝 OCR Result: '{text[:200] if len(text) > 200 else text}'")
                                    
                                    # Check if matches any target
                                    matched = ocr_service.fuzzy_match(text, target_chars, threshold=0.6)
                                    if matched:
                                        print(f"[DEBUG] ✅✅✅ GACHA MATCH! Character: {matched} ✅✅✅")
                                        
                                        # Export XML
                                        if save_folder:
                                            timestamp = datetime.now().strftime("%Y%m%d")
                                            # Clean character name for filename
                                            clean_name = matched.replace(" ", "_").replace("/", "_")
                                            filename = f"{clean_name}_{timestamp}_LINE_COCOS_PREF_KEY.xml"
                                            
                                            print(f"[DEBUG] 💾 Exporting XML to: {save_folder}/{filename}")
                                            
                                            from app.services.daily_login_service import LINERANGERS_PREF_PATH
                                            temp_path = "/sdcard/_temp_gacha_export.xml"
                                            
                                            # Copy and pull file
                                            adb.shell_su(f"cp {LINERANGERS_PREF_PATH} {temp_path}")
                                            adb.shell_su(f"chmod 644 {temp_path}")
                                            
                                            output_path = Path(save_folder) / filename
                                            if adb.pull_file(temp_path, str(output_path)):
                                                print(f"[DEBUG] ✅ Exported successfully: {output_path}")
                                            else:
                                                print(f"[DEBUG] ❌ Failed to export XML!")
                                            
                                            adb.shell(f"rm {temp_path}")
                                        else:
                                            print(f"[DEBUG] ⚠️ No save folder configured, skipping export")
                                        
                                        # Set flag to stop the repeat_group loop
                                        # We use a special return mechanism
                                        raise StopIteration("GACHA_MATCH")
                                    else:
                                        print(f"[DEBUG] ❌ No match found. OCR: '{text}' vs Targets: {target_chars}")
                                        print(f"[DEBUG] Continuing to next iteration...")
                                    
                            except StopIteration as e:
                                if str(e) == "GACHA_MATCH":
                                    print(f"[DEBUG] ✅ Gacha check matched, stopping repeat_group loop")
                                    iteration = loop_max_iterations  # Force exit outer loop
                                    break
                                raise
                            except Exception as e:
                                print(f"[DEBUG] Error in group step: {e}")
                                # Continue with next step in group
                        
                        # Check stop condition AFTER running all group steps
                        if stop_template_path:
                            screenshot = adb.screenshot()
                            if screenshot is not None:
                                result = template_service.find_template_fast(
                                    screenshot,
                                    stop_template_path,
                                    threshold
                                )
                                template_found = result is not None
                                
                                should_stop = (stop_on_not_found and not template_found) or (not stop_on_not_found and template_found)
                                
                                if should_stop:
                                    if stop_on_not_found:
                                        print(f"[DEBUG] ✅ Stop condition met: template NOT found, exiting loop")
                                    else:
                                        print(f"[DEBUG] ✅ Stop condition met: template FOUND, exiting loop")
                                    break
                                else:
                                    if stop_on_not_found:
                                        print(f"[DEBUG] Template still found, continuing to next iteration...")
                                    else:
                                        print(f"[DEBUG] Template not found yet, continuing to next iteration...")
                    
                    if iteration >= loop_max_iterations:
                        print(f"[DEBUG] ⚠️ Reached max iterations ({loop_max_iterations})")
                    
                    print(f"[DEBUG] repeat_group completed after {iteration} iterations")
                
                elif step_type == "gacha_check":
                    # Standalone gacha_check step (not in repeat_group)
                    from app.services.ocr_service import get_ocr_service
                    from datetime import datetime
                    
                    ocr_service = get_ocr_service()
                    ocr_region = step.get("ocr_region", {})
                    target_chars = step.get("target_characters", [])
                    save_folder = step.get("gacha_save_folder", "")
                    
                    if not ocr_region:
                        return {"success": False, "message": f"gacha_check step {step_index + 1} missing ocr_region"}
                    
                    screenshot = adb.screenshot()
                    if screenshot is None:
                        return {"success": False, "message": f"Failed to capture screen at step {step_index + 1}"}
                    
                    # Extract text from region
                    text = ocr_service.extract_text(
                        screenshot,
                        region=(
                            ocr_region.get("x", 320),
                            ocr_region.get("y", 140),
                            ocr_region.get("width", 320),
                            ocr_region.get("height", 60)
                        )
                    )
                    print(f"[DEBUG] OCR extracted: '{text}'")
                    
                    # Check if matches any target
                    if target_chars:
                        matched = ocr_service.fuzzy_match(text, target_chars, threshold=0.6)
                        if matched:
                            print(f"[DEBUG] ✅ GACHA MATCH! Character: {matched}")
                            
                            # Export XML
                            if save_folder:
                                timestamp = datetime.now().strftime("%Y%m%d")
                                clean_name = matched.replace(" ", "_").replace("/", "_")
                                filename = f"{clean_name}_{timestamp}_LINE_COCOS_PREF_KEY.xml"
                                
                                from app.services.daily_login_service import LINERANGERS_PREF_PATH
                                temp_path = "/sdcard/_temp_gacha_export.xml"
                                
                                adb.shell_su(f"cp {LINERANGERS_PREF_PATH} {temp_path}")
                                adb.shell_su(f"chmod 644 {temp_path}")
                                
                                output_path = Path(save_folder) / filename
                                if adb.pull_file(temp_path, str(output_path)):
                                    print(f"[DEBUG] ✅ Exported: {output_path}")
                                else:
                                    print(f"[DEBUG] ❌ Failed to export XML")
                                
                                adb.shell(f"rm {temp_path}")
                            
                            return {"success": True, "message": f"Gacha match found: {matched}"}
                        else:
                            print(f"[DEBUG] No match for '{text}' in targets: {target_chars}")
                
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
        from app.services.adb_service import AdbService
        import cv2
        import numpy as np
        
        adb = AdbService()
        adb.device_address = device_serial
        
        screenshot = adb.screenshot()
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
