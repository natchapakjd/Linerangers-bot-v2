import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';

interface WorkflowStep {
  id?: number;
  order_index: number;
  step_type: 'click' | 'swipe' | 'wait' | 'wait_for_color' | 'image_match' | 'find_all_click' | 'loop_click' | 'conditional' | 'press_back' | 'restart_game' | 'start_game' | 'repeat_group';
  x?: number;
  y?: number;
  end_x?: number;
  end_y?: number;
  swipe_duration_ms?: number;
  wait_duration_ms?: number;
  template_path?: string;
  template_name?: string;
  threshold?: number;
  match_all?: boolean;
  skip_if_not_found?: boolean;  // Skip step if template not found instead of failing
  max_wait_seconds?: number;     // Max seconds to wait for template (default: 10)
  max_retries?: number;          // Max retry attempts (default: unlimited, use time limit)
  retry_interval?: number;       // Seconds between retries (default: 1)
  on_match_action?: string;
  description?: string;
  group_name?: string;
  
  // Loop click properties
  max_iterations?: number;
  not_found_threshold?: number;
  click_delay?: number;
  retry_delay?: number;
  
  // Wait for color properties
  expected_color?: number[];  // [B, G, R]
  tolerance?: number;
  check_interval?: number;
  
  // Repeat group properties
  loop_group_name?: string;
  stop_template_path?: string;
  stop_on_not_found?: boolean;
  loop_max_iterations?: number;
}

interface Workflow {
  id?: number;
  name: string;
  description: string;
  screen_width: number;
  screen_height: number;
  is_master: boolean;
  mode_name?: string;  // NEW: simple mode assignment
  month_year?: string;  // NEW: simple month assignment (YYYY-MM)
  steps: WorkflowStep[];
}

interface DeviceInfo {
  serial: string;
  status: string;
}

@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="workflow-builder container">
      <!-- Header / Toolbar -->
      <div class="builder-header glass-panel">
        <div class="title-group">
          <h2>WORKFLOW <span class="text-gradient">ENGINEER</span></h2>
        </div>
        
        <div class="toolbar">
          <div class="select-wrapper">
             <select [(ngModel)]="selectedWorkflowId" (change)="loadWorkflow()" class="glass-input">
              <option value="">-- New Workflow --</option>
              @for (w of workflows(); track w.id) {
                <option [value]="w.id">{{ w.name }} {{ w.is_master ? '(Master)' : '' }}</option>
              }
            </select>
          </div>
         
          <div class="button-group">
            <button class="glass-button success" (click)="saveWorkflow()" [disabled]="isSaving()">
              {{ isSaving() ? 'SAVING...' : '💾 SAVE' }}
            </button>
            <button class="glass-button primary" (click)="executeWorkflow()" [disabled]="!currentWorkflow.id || isExecuting()">
              {{ isExecuting() ? 'RUNNING...' : '▶ EXECUTE' }}
            </button>
            <button class="glass-button warning" (click)="setAsMaster()" [disabled]="!currentWorkflow.id">
              ⭐ MASTER
            </button>
            <button class="glass-button danger-btn" (click)="deleteWorkflow()" [disabled]="!currentWorkflow.id">
              🗑️ DELETE
            </button>
          </div>
        </div>
      </div>

      <!-- Settings Row -->
      <div class="settings-row glass-panel">
        <div class="input-group">
          <label>WORKFLOW NAME</label>
          <input type="text" class="glass-input" [(ngModel)]="currentWorkflow.name" placeholder="Enter name..." />
        </div>
        <div class="input-group flex-2">
          <label>DESCRIPTION</label>
          <input type="text" class="glass-input" [(ngModel)]="currentWorkflow.description" placeholder="Optional description..." />
        </div>
        <div class="input-group">
          <label>MODE</label>
          <select [(ngModel)]="currentWorkflow.mode_name" class="glass-input">
            <option value="">-- Select Mode --</option>
            <option value="daily-login">Daily Login</option>
            <option value="stage-farm">Stage Farm</option>
            <option value="pvp">PVP Battle</option>
            <option value="gacha">Gacha Pull</option>
            <option value="event">Event</option>
            <option value="gai-ruby">Gai-Ruby</option>
            <option value="re-id">Re-ID</option>
          </select>
        </div>
        <div class="input-group">
          <label>MONTH/YEAR</label>
          <input type="month" class="glass-input" [(ngModel)]="currentWorkflow.month_year" placeholder="YYYY-MM" />
        </div>
        <div class="input-group">
          <label>TARGET DEVICE</label>
          <select [(ngModel)]="selectedDevice" class="glass-input">
            @for (device of devices(); track device.serial) {
              <option [value]="device.serial">{{ device.serial }} {{ device.status === 'online' ? '🟢' : '🔴' }}</option>
            }
          </select>
        </div>
      </div>

      <div class="builder-columns">
        <!-- Visualization / Canvas -->
        <div class="canvas-column">
          <div class="panel-header">
            <h3>VISUALIZATION</h3>
            <div class="canvas-controls">
               <div class="mode-toggles">
                <button [class.active]="currentMode === 'click'" (click)="setMode('click')" title="Click Mode">📍</button>
                <button [class.active]="currentMode === 'swipe'" (click)="setMode('swipe')" title="Swipe Mode">👆</button>
                <button [class.active]="currentMode === 'swipe_2point'" (click)="setMode('swipe_2point')" title="2-Point Swipe Mode">✌️</button>
                <button [class.active]="currentMode === 'capture'" (click)="setMode('capture')" title="Capture Template (Drag Rectangle)">📷</button>
                <button [class.active]="currentMode === 'color_picker'" (click)="setMode('color_picker')" title="Pick Color">🎨</button>
              </div>
              <div class="device-controls">
                <button class="icon-btn" (click)="pressBack()" title="Press Back (Android)">⬅️</button>
                <button class="icon-btn" (click)="restartGame()" title="Restart Game">🔄🎮</button>
              </div>
              <button class="icon-btn" (click)="refreshScreen()" title="Refresh Screen">🔄</button>
            </div>
          </div>

          <!-- Mode Indicator -->
          @if (currentMode !== 'click') {
            <div class="mode-indicator">
              @if (currentMode === 'swipe') { <span>👆 SWIPE MODE: Drag to swipe</span> }
              @if (currentMode === 'swipe_2point') { <span>✌️ 2-POINT SWIPE: Click start, then end</span> }
              @if (currentMode === 'capture') { <span>📷 CAPTURE MODE: Drag rectangle over target area</span> }
              @if (currentMode === 'color_picker') { <span>🎨 COLOR PICKER: Click to get RGB value</span> }
            </div>
          }
          
          <div class="screen-wrapper glass-panel">
            <div 
              class="screen-container"
              #screenContainer
              (mousedown)="onMouseDown($event)"
              (mousemove)="onMouseMove($event)"
              (mouseup)="onMouseUp($event)"
              (mouseleave)="onMouseUp($event)"
              [style.cursor]="currentMode === 'capture' ? 'crosshair' : 'default'"
            >
              @if (screenImage()) {
                <img [src]="screenImage()" alt="Screen" class="screen-image" draggable="false" />
              } @else {
                <div class="no-screen">
                  <span class="no-screen-icon">📡</span>
                  <p>NO SIGNAL SOURCE</p>
                  <small>Select a device to begin</small>
                </div>
              }
              
              <!-- Overlays -->
              <canvas #overlayCanvas class="overlay-canvas"></canvas>
              
              <div class="scanlines"></div>
            </div>
            
            <div class="status-bar">
              <span>RES: {{ currentWorkflow.screen_width }}x{{ currentWorkflow.screen_height }}</span>
              <span>XY: {{ mouseX }}, {{ mouseY }}</span>
            </div>
          </div>
        </div>

        <!-- Logic / Steps -->
        <div class="logic-column">
           <div class="panel-header">
            <h3>SEQUENCE LOGIC ({{ currentWorkflow.steps.length }})</h3>
            <div class="add-buttons">
              <button class="glass-button x-small" (click)="addStep('wait')">+ WAIT</button>
              <button class="glass-button x-small" (click)="addStep('wait_for_color')">🎨 COLOR</button>
              <button class="glass-button x-small" (click)="addStep('image_match')">+ IMAGE</button>
              <button class="glass-button x-small" (click)="addStep('loop_click')">🔁 LOOP</button>
              <button class="glass-button x-small" (click)="addStep('repeat_group')">🔄 REPEAT GRP</button>
              <button class="glass-button x-small" (click)="addStep('press_back')">⬅️ BACK</button>
              <button class="glass-button x-small" (click)="addStep('start_game')">▶️ START</button>
              <button class="glass-button x-small" (click)="addStep('restart_game')">🔄 RESTART</button>
            </div>
          </div>

          <div class="steps-container glass-panel" cdkDropList (cdkDropListDropped)="dropStep($event)">
             @for (step of currentWorkflow.steps; track $index; let i = $index) {
              <div 
                class="step-card"
                cdkDrag
                [class.selected]="selectedStepIndex === i"
                (click)="selectStep(i)"
              >
                <div class="step-handle" cdkDragHandle>⋮</div>
                
                <div class="step-content">
                  <div class="step-top">
                    <span class="step-number">#{{ i + 1 }}</span>
                    <span class="step-type">{{ step.step_type | uppercase }}</span>
                    @if (step.group_name) {
                      <span class="group-tag" [style.background-color]="getGroupColor(step.group_name)">{{ step.group_name }}</span>
                    }
                  </div>
                  <div class="step-desc">{{ getStepDescription(step) }}</div>
                </div>

                <div class="step-actions">
                  <button class="action-btn" (click)="editStep(i); $event.stopPropagation()">✏️</button>
                  <button class="action-btn danger" (click)="deleteStep(i); $event.stopPropagation()">×</button>
                </div>
              </div>
            }

            @if (currentWorkflow.steps.length === 0) {
              <div class="empty-steps">
                <span>Start by clicking on the screen or adding a logic step.</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Properties Panel (Bottom or Overlay) -->
      @if (selectedStepIndex >= 0 && editingStep) {
        <div class="properties-panel glass-panel animate-slide-up">
          <div class="panel-header">
            <h4>PROPERTIES: STEP #{{ selectedStepIndex + 1 }}</h4>
            <button class="close-btn" (click)="selectedStepIndex = -1; editingStep = null">×</button>
          </div>
          
          <div class="props-grid">
            <div class="input-group">
              <label>ACTION TYPE</label>
              <select [(ngModel)]="editingStep.step_type" class="glass-input">
                <option value="click">Click</option>
                <option value="swipe">Swipe</option>
                <option value="wait">Wait</option>
                <option value="wait_for_color">Wait for Color</option>
                <option value="image_match">Image Match</option>
                <option value="find_all_click">Find All & Click</option>
                <option value="loop_click">Loop Click</option>
                <option value="repeat_group">Repeat Group</option>
              </select>
            </div>

            <!-- Conditional Inputs based on Type -->
            @if (['click', 'swipe'].includes(editingStep.step_type)) {
              <div class="input-group-row">
                <div class="input-group"><label>X</label><input type="number" class="glass-input" [(ngModel)]="editingStep.x" /></div>
                <div class="input-group"><label>Y</label><input type="number" class="glass-input" [(ngModel)]="editingStep.y" /></div>
              </div>
            }

            @if (editingStep.step_type === 'swipe') {
              <div class="input-group-row">
                <div class="input-group"><label>END X</label><input type="number" class="glass-input" [(ngModel)]="editingStep.end_x" /></div>
                <div class="input-group"><label>END Y</label><input type="number" class="glass-input" [(ngModel)]="editingStep.end_y" /></div>
              </div>
              <div class="input-group"><label>DURATION (MS)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.swipe_duration_ms" /></div>
            }

            @if (editingStep.step_type === 'wait') {
              <div class="input-group"><label>DURATION (MS)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.wait_duration_ms" /></div>
            }
            
            @if (editingStep.step_type === 'wait_for_color') {
              <div class="input-group-row">
                <div class="input-group"><label>X</label><input type="number" class="glass-input" [(ngModel)]="editingStep.x" /></div>
                <div class="input-group"><label>Y</label><input type="number" class="glass-input" [(ngModel)]="editingStep.y" /></div>
              </div>
              <div class="input-group">
                <label>EXPECTED COLOR (R, G, B)</label>
                <div class="color-inputs">
                  <input type="number" class="glass-input small" 
                    [ngModel]="getColorValue(2)" 
                    (ngModelChange)="updateColor(2, $event)" 
                    placeholder="R" min="0" max="255" />
                  <input type="number" class="glass-input small" 
                    [ngModel]="getColorValue(1)" 
                    (ngModelChange)="updateColor(1, $event)" 
                    placeholder="G" min="0" max="255" />
                  <input type="number" class="glass-input small" 
                    [ngModel]="getColorValue(0)" 
                    (ngModelChange)="updateColor(0, $event)" 
                    placeholder="B" min="0" max="255" />
                </div>
              </div>
              <div class="input-group-row">
                <div class="input-group"><label>TOLERANCE</label><input type="number" class="glass-input" [(ngModel)]="editingStep.tolerance" placeholder="30" /></div>
                <div class="input-group"><label>MAX WAIT(s)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.max_wait_seconds" placeholder="30" /></div>
              </div>
              <div class="input-group"><label>CHECK INTERVAL(s)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.check_interval" placeholder="1" step="0.5" /></div>
            }


            @if (['image_match', 'find_all_click', 'loop_click'].includes(editingStep.step_type)) {
               <div class="input-group">
                <label>TEMPLATE</label>
                <select [(ngModel)]="editingStep.template_path" class="glass-input">
                  @for (t of templates(); track t.id) {
                    <option [value]="t.file_path">{{ t.name }}</option>
                  }
                </select>
              </div>
              <div class="input-group"><label>THRESHOLD</label><input type="number" class="glass-input" [(ngModel)]="editingStep.threshold" step="0.05" /></div>
              
              @if (editingStep.step_type === 'loop_click') {
                <!-- Loop Click Specific Options -->
                <div class="input-group-row">
                  <div class="input-group"><label>MAX ITERATIONS</label><input type="number" class="glass-input" [(ngModel)]="editingStep.max_iterations" placeholder="20" /></div>
                  <div class="input-group"><label>NOT FOUND LIMIT</label><input type="number" class="glass-input" [(ngModel)]="editingStep.not_found_threshold" placeholder="3" /></div>
                </div>
                <div class="input-group-row">
                  <div class="input-group"><label>CLICK DELAY(s)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.click_delay" step="0.1" placeholder="1.5" /></div>
                  <div class="input-group"><label>RETRY DELAY(s)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.retry_delay" step="0.1" placeholder="2" /></div>
                </div>
              } @else {
                <!-- Image Match / Find All Click Options -->
                <div class="input-group-row">
                  <div class="input-group"><label>MAX WAIT(s)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.max_wait_seconds" placeholder="10" /></div>
                  <div class="input-group"><label>MAX RETRIES</label><input type="number" class="glass-input" [(ngModel)]="editingStep.max_retries" placeholder="∞" /></div>
                </div>
                <div class="input-group"><label>RETRY INTERVAL(s)</label><input type="number" class="glass-input" [(ngModel)]="editingStep.retry_interval" placeholder="1" step="0.5" /></div>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="editingStep.skip_if_not_found">
                  <span>Skip if not found</span>
                </label>
              }
            }
            
            @if (editingStep.step_type === 'repeat_group') {
              <div class="input-group">
                <label>LOOP GROUP NAME</label>
                <select [(ngModel)]="editingStep.loop_group_name" class="glass-input">
                  <option [value]="undefined">-- Select Group --</option>
                  @for (group of availableGroups(); track group) {
                    <option [value]="group">{{ group }}</option>
                  }
                </select>
              </div>
              <div class="input-group">
                <label>STOP TEMPLATE</label>
                <select [(ngModel)]="editingStep.stop_template_path" class="glass-input">
                  <option [value]="undefined">-- None --</option>
                  @for (t of templates(); track t.id) {
                    <option [value]="t.file_path">{{ t.name }}</option>
                  }
                </select>
              </div>
              <div class="input-group-row">
                <div class="input-group"><label>MAX ITERATIONS</label><input type="number" class="glass-input" [(ngModel)]="editingStep.loop_max_iterations" placeholder="100" /></div>
                <div class="input-group"><label>THRESHOLD</label><input type="number" class="glass-input" [(ngModel)]="editingStep.threshold" step="0.05" placeholder="0.8" /></div>
              </div>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editingStep.stop_on_not_found">
                <span>Stop when template NOT found (e.g., button disappears)</span>
              </label>
            }

             <div class="input-group">
              <label>GROUP</label>
              <div class="flex-row">
                 <select [(ngModel)]="editingStep.group_name" class="glass-input">
                  <option [value]="undefined">-- None --</option>
                  @for (group of availableGroups(); track group) {
                    <option [value]="group">{{ group }}</option>
                  }
                </select>
                <button class="glass-button small" (click)="showGroupModal = true">+</button>
              </div>
            </div>

             <div class="input-group full-width">
              <label>DESCRIPTION</label>
              <input type="text" class="glass-input" [(ngModel)]="editingStep.description" />
            </div>
          </div>
          
          <div class="panel-footer">
            <button class="glass-button primary" (click)="applyStepEdit()">UPDATE STEP</button>
          </div>
        </div>
      }
      
      <!-- Log Panel -->
      <div class="log-panel glass-panel">
        <div class="log-content">
          @for (log of logs(); track log) {
            <div class="log-entry">{{ log }}</div>
          }
        </div>
      </div>

       <!-- Capture Modal - REMOVED (Using SweetAlert2) -->

      <!-- Group Modal -->
      @if (showGroupModal) {
        <div class="modal-backdrop">
           <div class="modal-card glass-panel">
            <h3>NEW GROUP</h3>
            <div class="input-group">
              <label>GROUP NAME</label>
              <input type="text" class="glass-input" [(ngModel)]="newGroupName" (keyup.enter)="createGroup()" />
            </div>
             <div class="modal-actions">
              <button class="glass-button" (click)="showGroupModal = false">CANCEL</button>
              <button class="glass-button primary" (click)="createGroup()">CREATE</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .workflow-builder {
      padding-top: 2rem;
      padding-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      height: calc(100vh - 80px); /* Adjust based on header height */
    }

    button { cursor: pointer; }

    /* --- Header --- */
    .builder-header {
      padding: 1rem 1.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .button-group {
      display: flex;
      gap: 0.5rem;
    }
    
    .page-title {
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: 1px;
    }

    /* --- Settings Row --- */
    .settings-row {
      padding: 1rem 1.75rem;
      display: flex;
      gap: 2rem;
      align-items: flex-end;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }

    .input-group.flex-2 { flex: 2; }
    .input-group.full-width { grid-column: 1 / -1; }
    .input-group-row { 
      display: flex; 
      gap: 1rem; 
      flex-wrap: wrap;
    }
    
    .input-group-row > .input-group {
      min-width: 120px;
    }

    .flex-row { display: flex; gap: 0.5rem; }

    label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* --- Columns Layout --- */
    .builder-columns {
      display: flex;
      gap: 1.5rem;
      flex: 1;
      min-height: 0; /* Enable scroll in children */
    }

    .canvas-column {
      flex: 2; /* 66% width */
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .logic-column {
      flex: 1; /* 33% width */
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 350px;
    }

    /* --- Headers & Controls --- */
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .panel-header h3 {
      font-size: 0.9rem;
      margin: 0;
      color: var(--primary);
      letter-spacing: 0.5px;
    }

    .canvas-controls {
      display: flex;
      gap: 1rem;
    }

    .mode-toggles {
      display: flex;
      background: rgba(0,0,0,0.2);
      border: 1px solid var(--glass-border);
      border-radius: 6px;
      padding: 3px;
    }

    .mode-toggles button {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .mode-toggles button.active {
      background: var(--primary);
      color: #000;
      box-shadow: 0 0 10px var(--primary-dim);
    }
    
    .icon-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--glass-border);
      color: var(--text-main);
      width: 32px; height: 32px;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(255,255,255,0.1);
        border-color: var(--text-muted);
      }
    }

    .device-controls {
      display: flex;
      gap: 0.5rem;
      margin-left: 0.5rem;
      padding-left: 0.5rem;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Mode Indicator Banner */
    .mode-indicator {
      padding: 0.5rem 1rem;
      background: linear-gradient(90deg, rgba(56, 189, 248, 0.1), rgba(192, 132, 252, 0.1));
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: var(--radius-sm);
      margin-bottom: 0.75rem;
      text-align: center;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--primary);
      letter-spacing: 0.5px;
      animation: fadeIn 0.3s ease-out, pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    /* --- Screen Canvas --- */
    .screen-wrapper {
      position: relative;
      width: 100%;
      max-width: 960px; /* Limit to native resolution size to avoid pixelation */
      aspect-ratio: 16 / 9; /* Fixed Landscape Aspect Ratio */
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      background: #000;
      border: 4px solid #1a1b26; /* Emulator-like bezel */
      border-radius: 4px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      margin: 0 auto; /* Center it */
    }

    .screen-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }

    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: contain; /* Ensure no distortion */
      image-rendering: high-quality;
      user-select: none; /* Prevent selection */
      -webkit-user-drag: none; /* Prevent drag on webkit browsers */
      pointer-events: none; /* Allow mouse events to pass through to container */
    }

    /* Scanlines removed for clarity (LD Player style) */

    .status-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 2px 8px;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: space-between;
      font-family: 'Consolas', monospace;
      font-size: 0.7rem;
      color: #aaa;
      z-index: 20;
      pointer-events: none;
    }

    .overlay-canvas {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 15;
    }

    .no-screen {
      text-align: center;
      color: var(--text-dim);
      display: flex; flex-direction: column; align-items: center;
    }

    .no-screen-icon { font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3; }

    /* --- Steps List --- */
    .steps-container {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .step-card {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.8rem;
      background: rgba(255,255,255,0.02);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
      cursor: pointer;
    }

    .step-card:hover {
      background: rgba(255,255,255,0.04);
      border-color: var(--glass-border);
      transform: translateX(4px);
    }

    .glass-button.warning {
      background: rgba(251, 191, 36, 0.1);
      color: var(--warning);
      border-color: rgba(251, 191, 36, 0.3);
    }

    .glass-button.danger-btn {
      background: rgba(251, 113, 133, 0.1);
      color: var(--danger);
      border-color: rgba(251, 113, 133, 0.3);
      
      &:hover:not(:disabled) {
        background: rgba(251, 113, 133, 0.2);
        box-shadow: 0 0 15px rgba(251, 113, 133, 0.2);
      }
    }
    .step-card.selected {
      background: rgba(56, 189, 248, 0.05); /* Blue tint */
      border-color: var(--primary);
      box-shadow: inset 3px 0 0 var(--primary);
    }

    .step-handle {
      color: var(--text-dim);
      cursor: grab;
      padding: 0 0.5rem;
    }

    .step-content {
      flex: 1;
      overflow: hidden;
    }

    .step-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.2rem;
    }

    .step-number { font-family: 'Consolas', monospace; color: var(--text-muted); font-size: 0.8rem; }
    .step-type { font-weight: 700; font-size: 0.75rem; color: var(--text-main); }
    .step-desc { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .group-tag { font-size: 0.6rem; padding: 1px 4px; border-radius: 4px; color: #fff; }

    .step-actions { opacity: 0; transition: opacity 0.2s; }
    .step-card:hover .step-actions { opacity: 1; }

    .action-btn {
      background: none; border: none; padding: 0.2rem 0.4rem; color: var(--text-muted);
      &:hover { color: var(--text-main); scale: 1.1; }
      &.danger:hover { color: var(--danger); }
    }
    
    .empty-steps {
      display: flex; align-items: center; justify-content: center; height: 100px;
      color: var(--text-muted); font-style: italic; opacity: 0.7;
      border: 1px dashed var(--glass-border); border-radius: 8px;
    }

    /* --- Properties Panel --- */
    .properties-panel {
      position: absolute;
      bottom: 2rem; right: 2rem; left: 50%;
      background: rgba(11, 16, 27, 0.95); /* Matches palette surface */
      border-top: 1px solid var(--primary);
      box-shadow: 0 -20px 50px rgba(0,0,0,0.6);
      z-index: 100;
      padding: 1.75rem;
      animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    
    .close-btn {
      background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted);
      &:hover { color: var(--danger); }
    }

    .props-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 1.5rem 0;
    }

    /* Color inputs for wait_for_color step */
    .color-inputs {
      display: flex;
      gap: 0.5rem;
      flex-wrap: nowrap;
    }

    .color-inputs input {
      width: 80px;
      min-width: 80px;
      flex-shrink: 0;
      text-align: center;
    }

    .glass-input.small {
      width: 80px;
      min-width: 80px;
      flex-shrink: 0;
      padding: 0.5rem;
      text-align: center;
    }

    @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    /* --- Log Panel --- */
    .log-panel {
      height: 120px;
      overflow-y: auto;
      font-family: 'Consolas', monospace;
      font-size: 0.75rem;
      padding: 0.75rem;
      background: #000;
      border-top: 1px solid var(--glass-border);
    }
    
    .log-entry { margin-bottom: 2px; color: var(--text-muted); }

    /* --- Modals --- */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(5px);
    }
    .modal-card { width: 450px; padding: 2rem; background: var(--bg-surface); }
    .modal-card h3 { color: var(--primary); margin-bottom: 1.5rem; }
    .modal-actions { margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem; }

  `]
})
export class WorkflowBuilderComponent implements OnInit, OnDestroy {
  @ViewChild('screenContainer') screenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  // Signals
  workflows = signal<Workflow[]>([]);
  templates = signal<any[]>([]);
  devices = signal<DeviceInfo[]>([]);
  screenImage = signal<string>('');
  logs = signal<string[]>(['🚀 Workflow Builder ready']);
  isSaving = signal(false);
  isExecuting = signal(false);

  // Current workflow
  currentWorkflow: Workflow = {
    name: 'New Workflow',
    description: '',
    screen_width: 960,
    screen_height: 540,
    is_master: false,
    steps: []
  };

  selectedWorkflowId = '';
  selectedDevice = '';
  selectedStepIndex = -1;
  editingStep: WorkflowStep | null = null;

  // Drawing state
  currentMode: 'click' | 'swipe' | 'swipe_2point' | 'capture' | 'color_picker' = 'click';
  isDragging = false;
  dragStart = { x: 0, y: 0 };
  dragEnd = { x: 0, y: 0 };  mousePos = { x: 0, y: 0 };
  
  // 2-point swipe mode
  swipeFirstPoint: { x: number; y: number } | null = null;
  swipePoints: Array<{ x: number; y: number; endX: number; endY: number }> = [];
  
  // Grouping
  availableGroups = signal<string[]>([]);
  showGroupModal = false;
  newGroupName = '';
  mouseX = 0;
  mouseY = 0;

  // Capture modal
  showCaptureModal = false;
  captureTemplateName = '';
  captureRegion = { x: 0, y: 0, width: 0, height: 0 };

  private screenRefreshInterval: any;

  ngOnInit(): void {
    this.loadWorkflows();
    this.loadDevices();
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    if (this.screenRefreshInterval) {
      clearInterval(this.screenRefreshInterval);
    }
  }

  async loadWorkflows(): Promise<void> {
    try {
      const response = await fetch('/api/v1/workflows');
      const data = await response.json();
      if (data.success) {
        this.workflows.set(data.workflows);
      }
    } catch (error) {
      this.addLog(`❌ Failed to load workflows: ${error}`);
    }
  }

  async loadDevices(): Promise<void> {
    try {
      const response = await fetch('/api/v1/devices');
      const data = await response.json();
      if (data.success) {
        this.devices.set(data.devices);
        if (data.devices.length > 0 && !this.selectedDevice) {
          this.selectedDevice = data.devices[0].serial;
          this.refreshScreen();
        }
      }
    } catch (error) {
      this.addLog(`❌ Failed to load devices: ${error}`);
    }
  }

  async loadTemplates(): Promise<void> {
    try {
      const response = await fetch('/api/v1/workflows/templates');
      const data = await response.json();
      if (data.success) {
        this.templates.set(data.templates);
      }
    } catch (error) {
      this.addLog(`❌ Failed to load templates: ${error}`);
    }
  }

  async loadWorkflow(): Promise<void> {
    if (!this.selectedWorkflowId) {
      // New workflow
      this.currentWorkflow = {
        name: 'New Workflow',
        description: '',
        screen_width: 960,
        screen_height: 540,
        is_master: false,
        steps: []
      };
      this.selectedStepIndex = -1;
      this.editingStep = null;
      return;
    }

    try {
      const response = await fetch(`/api/v1/workflows/${this.selectedWorkflowId}`);
      const data = await response.json();
      if (data.success) {
        this.currentWorkflow = data.workflow;
        
        // Parse expected_color for each step (may be JSON string from DB)
        this.currentWorkflow.steps.forEach(step => {
          if (step.expected_color && typeof step.expected_color === 'string') {
            try {
              step.expected_color = JSON.parse(step.expected_color);
            } catch (e) {
              step.expected_color = [255, 255, 255];
            }
          }
        });
        
        this.updateAvailableGroups();
        this.addLog(`✅ Loaded: ${data.workflow.name}`);
      }
    } catch (error) {
      this.addLog(`❌ Failed to load workflow: ${error}`);
    }
  }

  async saveWorkflow(): Promise<void> {
    // Auto-apply any pending step edits before saving
    if (this.selectedStepIndex >= 0 && this.editingStep) {
      this.currentWorkflow.steps[this.selectedStepIndex] = { ...this.editingStep };
      this.addLog(`💾 Auto-applied pending changes to step ${this.selectedStepIndex + 1}`);
    }
    
    this.isSaving.set(true);
    
    try {
      const isNew = !this.currentWorkflow.id;
      const url = isNew 
        ? '/api/v1/workflows' 
        : `/api/v1/workflows/${this.currentWorkflow.id}`;
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.currentWorkflow)
      });
      
      const data = await response.json();
      if (data.success) {
        this.currentWorkflow = data.workflow;
        this.selectedWorkflowId = String(data.workflow.id);
        await this.loadWorkflows();
        this.addLog(`✅ Saved: ${data.workflow.name}`);
      } else {
        this.addLog(`❌ Save failed: ${data.message}`);
      }
    } catch (error) {
      this.addLog(`❌ Save error: ${error}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  async executeWorkflow(): Promise<void> {
    if (!this.currentWorkflow.id || !this.selectedDevice) {
      this.addLog('❌ Select a workflow and device first');
      return;
    }

    this.isExecuting.set(true);
    this.addLog(`▶️ Executing on ${this.selectedDevice}...`);

    try {
      const response = await fetch(`/api/v1/workflows/${this.currentWorkflow.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_serial: this.selectedDevice })
      });
      
      const data = await response.json();
      this.addLog(data.success ? `✅ ${data.message}` : `❌ ${data.message}`);
    } catch (error) {
      this.addLog(`❌ Execution error: ${error}`);
    } finally {
      this.isExecuting.set(false);
    }
  }

  async setAsMaster(): Promise<void> {
    if (!this.currentWorkflow.id) return;

    try {
      const response = await fetch(`/api/v1/workflows/${this.currentWorkflow.id}/set-master`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        this.currentWorkflow.is_master = true;
        await this.loadWorkflows();
        this.addLog(`⭐ Set as master: ${this.currentWorkflow.name}`);
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  async deleteWorkflow(): Promise<void> {
    if (!this.currentWorkflow.id) return;

    // Confirm deletion with SweetAlert2
    const workflowName = this.currentWorkflow.name;
    
    const result = await Swal.fire({
      title: 'Delete Workflow?',
      html: `Are you sure you want to delete <strong>"${workflowName}"</strong>?<br><br>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#fb7185',
      cancelButtonColor: '#64748b',
      confirmButtonText: '🗑️ Yes, Delete',
      cancelButtonText: 'Cancel',
      background: 'rgba(11, 16, 27, 0.95)',
      color: '#f8fafc',
      customClass: {
        popup: 'swal-glass-popup',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn'
      }
    });
    
    if (!result.isConfirmed) return;

    try {
      const response = await fetch(`/api/v1/workflows/${this.currentWorkflow.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        // Success notification
        Swal.fire({
          title: 'Deleted!',
          text: `Workflow "${workflowName}" has been deleted.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          background: 'rgba(11, 16, 27, 0.95)',
          color: '#f8fafc'
        });
        
        this.addLog(`🗑️ Deleted: ${workflowName}`);
        // Reset to new workflow
        this.selectedWorkflowId = '';
        await this.loadWorkflows();
        await this.loadWorkflow();
      } else {
        Swal.fire({
          title: 'Error!',
          text: data.message || 'Failed to delete workflow',
          icon: 'error',
          background: 'rgba(11, 16, 27, 0.95)',
          color: '#f8fafc'
        });
        this.addLog(`❌ Delete failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: `Delete error: ${error}`,
        icon: 'error',
        background: 'rgba(11, 16, 27, 0.95)',
        color: '#f8fafc'
      });
      this.addLog(`❌ Delete error: ${error}`);
    }
  }

  async refreshScreen(): Promise<void> {
    if (!this.selectedDevice) {
      this.addLog('❌ No device selected');
      return;
    }

    try {
      this.addLog(`🔄 Refreshing screen for ${this.selectedDevice}...`);
      const response = await fetch(`/api/v1/devices/${this.selectedDevice}/screenshot`);
      const data = await response.json();
      
      if (data.success && data.image) {
        this.screenImage.set(data.image);
        this.addLog(`✅ Screen refreshed`);
      } else {
        this.addLog(`❌ Refresh failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      this.addLog(`❌ Refresh error: ${error}`);
      console.error('Screen refresh error:', error);
    }
  }

  // Press Android Back button
  async pressBack(): Promise<void> {
    if (!this.selectedDevice) {
      this.addLog('❌ No device selected');
      return;
    }

    try {
      const response = await fetch(`/api/v1/devices/${this.selectedDevice}/key/back`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        this.addLog('⬅️ Pressed Back');
        await this.refreshScreen();
      } else {
        this.addLog(`❌ Back failed: ${data.message}`);
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  // Restart the game
  async restartGame(): Promise<void> {
    if (!this.selectedDevice) {
      this.addLog('❌ No device selected');
      return;
    }

    try {
      this.addLog('🔄 Restarting game...');
      const response = await fetch(`/api/v1/devices/${this.selectedDevice}/restart-game`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        this.addLog('✅ Game restarted');
        await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds
        await this.refreshScreen();
      } else {
        this.addLog(`❌ Restart failed: ${data.message}`);
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  // Helper method to get actual image position accounting for object-fit: contain
  private getImageCoordinates(event: MouseEvent): { x: number; y: number } {
    const container = this.screenContainer.nativeElement;
    const containerRect = container.getBoundingClientRect();
    
    // Get the actual image element
    const img = container.querySelector('.screen-image') as HTMLImageElement;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      // Fallback to old calculation if image not loaded
      return {
        x: Math.round((event.clientX - containerRect.left) * (this.currentWorkflow.screen_width / containerRect.width)),
        y: Math.round((event.clientY - containerRect.top) * (this.currentWorkflow.screen_height / containerRect.height))
      };
    }

    // Calculate the displayed image size (accounting for object-fit: contain)
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = this.currentWorkflow.screen_width / this.currentWorkflow.screen_height;
    
    let displayedWidth: number;
    let displayedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (containerAspect > imageAspect) {
      // Container is wider - image is limited by height
      displayedHeight = containerRect.height;
      displayedWidth = displayedHeight * imageAspect;
      offsetX = (containerRect.width - displayedWidth) / 2;
      offsetY = 0;
    } else {
      // Container is taller - image is limited by width
      displayedWidth = containerRect.width;
      displayedHeight = displayedWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerRect.height - displayedHeight) / 2;
    }

    // Calculate click position relative to the actual image
    const relativeX = event.clientX - containerRect.left - offsetX;
    const relativeY = event.clientY - containerRect.top - offsetY;

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(relativeX, displayedWidth));
    const clampedY = Math.max(0, Math.min(relativeY, displayedHeight));

    // Scale to actual coordinates
    const x = Math.round(clampedX * (this.currentWorkflow.screen_width / displayedWidth));
    const y = Math.round(clampedY * (this.currentWorkflow.screen_height / displayedHeight));

    return { x, y };
  }

  // Mouse handlers for screen preview
  onMouseDown(event: MouseEvent): void {
    const coords = this.getImageCoordinates(event);
    this.dragStart = coords;
    this.isDragging = true;
  }

  onMouseMove(event: MouseEvent): void {
    const coords = this.getImageCoordinates(event);
    this.mouseX = coords.x;
    this.mouseY = coords.y;

    if (this.isDragging) {
      this.dragEnd = coords;
      this.drawOverlay();
    } else if (this.currentMode === 'swipe_2point' && this.swipeFirstPoint) {
      this.drawOverlay();
    }
  }

  onMouseUp(event: MouseEvent): void {
    const coords = this.getImageCoordinates(event);
    const clickX = coords.x;
    const clickY = coords.y;

    // Handle 2-point swipe mode
    if (this.currentMode === 'swipe_2point') {
      if (!this.swipeFirstPoint) {
        // First click - store start point
        this.swipeFirstPoint = { x: clickX, y: clickY };
        this.drawOverlay();
        this.addLog(`👆 Swipe start: (${clickX}, ${clickY})`);
        return;
      } else {
        // Second click - create swipe step
        this.addSwipeStep(this.swipeFirstPoint.x, this.swipeFirstPoint.y, clickX, clickY);
        this.swipePoints.push({
          x: this.swipeFirstPoint.x,
          y: this.swipeFirstPoint.y,
          endX: clickX,
          endY: clickY
        });
        this.swipeFirstPoint = null;
        this.drawOverlay();
        return;
      }
    }

    if (!this.isDragging) return;
    this.isDragging = false;

    const distance = Math.sqrt(Math.pow(clickX - this.dragStart.x, 2) + Math.pow(clickY - this.dragStart.y, 2));
    
    console.log('onMouseUp:', {
      mode: this.currentMode,
      distance,
      dragStart: this.dragStart,
      clickPos: { x: clickX, y: clickY }
    });

    if (this.currentMode === 'color_picker' && distance < 10) {
      // Color picker - get color at position
      this.pickColorAtPosition(this.dragStart.x, this.dragStart.y);
    } else if (this.currentMode === 'click' && distance < 10) {
      // Click
      this.addClickStep(this.dragStart.x, this.dragStart.y);
    } else if (this.currentMode === 'swipe' && distance >= 10) {
      // Swipe
      this.addSwipeStep(this.dragStart.x, this.dragStart.y, clickX, clickY);
    } else if (this.currentMode === 'capture' && distance >= 10) {
      // Capture region - show SweetAlert2 input
      console.log('Entering capture save flow...');
      const minX = Math.min(this.dragStart.x, clickX);
      const minY = Math.min(this.dragStart.y, clickY);
      const width = Math.abs(clickX - this.dragStart.x);
      const height = Math.abs(clickY - this.dragStart.y);
      this.captureRegion = { x: minX, y: minY, width, height };
      
      console.log('Capture region:', this.captureRegion);
      this.addLog(`📷 Captured region: ${width}x${height} @ (${minX}, ${minY})`);
      
      // Clear overlay before showing dialog
      this.clearOverlay();
      
      console.log('Calling promptSaveTemplate...');
      // Show SweetAlert2 input (async, non-blocking)
      this.promptSaveTemplate();
      return; // Don't clear overlay again
    }

    this.clearOverlay();
  }

  // Helper to set mode with feedback
  setMode(mode: 'click' | 'swipe' | 'swipe_2point' | 'capture' | 'color_picker'): void {
    this.currentMode = mode;
    if (mode === 'swipe_2point') {
      this.swipeFirstPoint = null;
    }
    this.addLog(`📡 Mode: ${mode.toUpperCase().replace('_', ' ')}`);
  }
  
  // Pick color at position
  async pickColorAtPosition(x: number, y: number): Promise<void> {
    if (!this.selectedDevice) {
      this.addLog('❌ No device selected');
      return;
    }

    try {
      // Get fresh screenshot
      const response = await fetch(`/api/v1/devices/${this.selectedDevice}/screenshot`);
      const data = await response.json();
      
      if (!data.success || !data.image) {
        this.addLog('❌ Failed to get screenshot');
        return;
      }

      // Create image to read pixel data
      const img = new Image();
      img.src = data.image;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Create canvas to read pixel
      const canvas = document.createElement('canvas');
      canvas.width = this.currentWorkflow.screen_width;
      canvas.height = this.currentWorkflow.screen_height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        this.addLog('❌ Canvas error');
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(x, y, 1, 1);
      const r = imageData.data[0];
      const g = imageData.data[1];
      const b = imageData.data[2];

      this.addLog(`🎨 Color at (${x}, ${y}): RGB(${r}, ${g}, ${b})`);

      // If editing a wait_for_color step, fill in the values
      if (this.editingStep && this.editingStep.step_type === 'wait_for_color') {
        this.editingStep.x = x;
        this.editingStep.y = y;
        this.editingStep.expected_color = [b, g, r];  // BGR format
        this.addLog(`✅ Color set to step: RGB(${r}, ${g}, ${b})`);
        
        // Return to click mode
        this.setMode('click');
      } else {
        // Show color in alert
        await Swal.fire({
          title: '🎨 Color Picked',
          html: `
            <p>Position: (${x}, ${y})</p>
            <p style="font-size: 1.2rem; margin: 1rem 0;">
              <strong>RGB(${r}, ${g}, ${b})</strong>
            </p>
            <div style="width: 100px; height: 100px; background: rgb(${r},${g},${b}); margin: 0 auto; border: 2px solid white; border-radius: 8px;"></div>
          `,
          icon: 'info',
          confirmButtonText: 'OK',
          background: 'rgba(11, 16, 27, 0.95)',
          color: '#f8fafc'
        });
        
        this.setMode('click');
      }
    } catch (error) {
      this.addLog(`❌ Color picker error: ${error}`);
      console.error('Color picker error:', error);
    }
  }
  
  // Helper to get color value safely
  getColorValue(index: number): number {
    if (!this.editingStep?.expected_color) return 255;
    if (!Array.isArray(this.editingStep.expected_color)) return 255;
    return this.editingStep.expected_color[index] ?? 255;
  }

  // Helper to update color array values
  updateColor(index: number, value: number): void {
    if (!this.editingStep) return;
    
    // Initialize array if not exists
    if (!this.editingStep.expected_color) {
      this.editingStep.expected_color = [255, 255, 255];  // Default white [B, G, R]
    }
    
    // Update specific index
    this.editingStep.expected_color[index] = value;
  }

  // Prompt to save template with SweetAlert2
  async promptSaveTemplate(): Promise<void> {
    console.log('promptSaveTemplate called!', this.captureRegion);
    
    const result = await Swal.fire({
      title: '📷 Save Template',
      html: `<p style="color: var(--text-muted); margin-bottom: 1rem;">Region: ${this.captureRegion.width}x${this.captureRegion.height} @ (${this.captureRegion.x}, ${this.captureRegion.y})</p>`,
      input: 'text',
      inputPlaceholder: 'button_confirm',
      inputAttributes: {
        autocapitalize: 'off',
        autocomplete: 'off'
      },
      showCancelButton: true,
      confirmButtonText: '💾 Save',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#38bdf8',
      cancelButtonColor: '#64748b',
      background: 'rgba(11, 16, 27, 0.95)',
      color: '#f8fafc',
      inputValidator: (value) => {
        if (!value) {
          return 'Template name is required!';
        }
        return null;
      },
      customClass: {
        popup: 'swal-glass-popup',
        input: 'swal-input-field'
      }
    });

    if (result.isConfirmed && result.value) {
      await this.saveCapturedTemplate(result.value);
    } else {
      this.addLog('❌ Template capture cancelled');
    }
  }

  async saveCapturedTemplate(templateName: string): Promise<void> {
    if (!templateName.trim()) {
      this.addLog('❌ Please enter a template name');
      return;
    }

    try {
      const response = await fetch('/api/v1/workflows/capture-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_serial: this.selectedDevice,
          name: templateName,
          ...this.captureRegion
        })
      });

      const data = await response.json();
      if (data.success) {
        await this.loadTemplates();
        Swal.fire({
          title: 'Saved!',
          text: `Template "${templateName}" has been saved.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          background: 'rgba(11, 16, 27, 0.95)',
          color: '#f8fafc'
        });
        this.addLog(`📷 Template saved: ${templateName}`);
        // Return to click mode
        this.setMode('click');
      } else {
        Swal.fire({
          title: 'Error!',
          text: data.message || 'Failed to save template',
          icon: 'error',
          background: 'rgba(11, 16, 27, 0.95)',
          color: '#f8fafc'
        });
        this.addLog(`❌ ${data.message}`);
      }
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: `Error: ${error}`,
        icon: 'error',
        background: 'rgba(11, 16, 27, 0.95)',
        color: '#f8fafc'
      });
      this.addLog(`❌ Error: ${error}`);
    }
  }

  drawOverlay(): void {
    const canvas = this.overlayCanvas?.nativeElement;
    const container = this.screenContainer?.nativeElement;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    
    // Resize canvas to match container size (CSS pixels)
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate display scaling (to convert 960x540 coords to display coords)
    const img = container.querySelector('.screen-image') as HTMLImageElement;
    if (!img) return;

    const imageAspect = this.currentWorkflow.screen_width / this.currentWorkflow.screen_height;
    const containerAspect = containerRect.width / containerRect.height;

    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (containerAspect > imageAspect) {
      // Container is wider - image is limited by height
      displayHeight = containerRect.height;
      displayWidth = displayHeight * imageAspect;
      offsetX = (containerRect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      // Container is taller - image is limited by width
      displayWidth = containerRect.width;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerRect.height - displayHeight) / 2;
    }

    const scaleX = displayWidth / this.currentWorkflow.screen_width;
    const scaleY = displayHeight / this.currentWorkflow.screen_height;

    // Convert workflow coords to display coords
    const toDisplayX = (x: number) => x * scaleX + offsetX;
    const toDisplayY = (y: number) => y * scaleY + offsetY;

    if (this.currentMode === 'swipe') {
      const startX = toDisplayX(this.dragStart.x);
      const startY = toDisplayY(this.dragStart.y);
      const endX = toDisplayX(this.dragEnd.x);
      const endY = toDisplayY(this.dragEnd.y);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(endY - startY, endX - startX);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 15 * Math.cos(angle - Math.PI / 6), endY - 15 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 15 * Math.cos(angle + Math.PI / 6), endY - 15 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = '#00f5ff';
      ctx.fill();
    } else if (this.currentMode === 'capture') {
      const minX = toDisplayX(Math.min(this.dragStart.x, this.dragEnd.x));
      const minY = toDisplayY(Math.min(this.dragStart.y, this.dragEnd.y));
      const maxX = toDisplayX(Math.max(this.dragStart.x, this.dragEnd.x));
      const maxY = toDisplayY(Math.max(this.dragStart.y, this.dragEnd.y));
      const width = maxX - minX;
      const height = maxY - minY;

      // Draw dashed rectangle
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(minX, minY, width, height);
      ctx.setLineDash([]);

      // Fill with semi-transparent color
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(minX, minY, width, height);

      // Draw size label
      const actualWidth = Math.abs(this.dragEnd.x - this.dragStart.x);
      const actualHeight = Math.abs(this.dragEnd.y - this.dragStart.y);
      if (actualWidth > 0 && actualHeight > 0) {
        const label = `${actualWidth}×${actualHeight}`;
        ctx.font = 'bold 14px "Rajdhani", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(label, minX + 5, minY + 20);
        ctx.fillText(label, minX + 5, minY + 20);
      }
    } else if (this.currentMode === 'swipe_2point' && this.swipeFirstPoint) {
      // Draw first point marker
      const firstX = toDisplayX(this.swipeFirstPoint.x);
      const firstY = toDisplayY(this.swipeFirstPoint.y);
      
      ctx.beginPath();
      ctx.arc(firstX, firstY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#00f5ff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw line to current mouse position
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      ctx.lineTo(toDisplayX(this.mouseX), toDisplayY(this.mouseY));
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  clearOverlay(): void {
    const canvas = this.overlayCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  getSwipeDistance(): number {
    return Math.sqrt(Math.pow(this.dragEnd.x - this.dragStart.x, 2) + Math.pow(this.dragEnd.y - this.dragStart.y, 2));
  }

  getSwipeAngle(): number {
    return Math.atan2(this.dragEnd.y - this.dragStart.y, this.dragEnd.x - this.dragStart.x) * (180 / Math.PI);
  }

  // Step management
  addClickStep(x: number, y: number): void {
    const step: WorkflowStep = {
      order_index: this.currentWorkflow.steps.length,
      step_type: 'click',
      x,
      y,
      description: `Click at (${x}, ${y})`
    };
    this.currentWorkflow.steps.push(step);
    this.addLog(`📍 Added click at (${x}, ${y})`);
  }

  addSwipeStep(x: number, y: number, endX: number, endY: number): void {
    const step: WorkflowStep = {
      order_index: this.currentWorkflow.steps.length,
      step_type: 'swipe',
      x,
      y,
      end_x: endX,
      end_y: endY,
      swipe_duration_ms: 300,
      description: `Swipe (${x},${y}) → (${endX},${endY})`
    };
    this.currentWorkflow.steps.push(step);
    this.addLog(`👆 Added swipe (${x},${y}) → (${endX},${endY})`);
  }

  addStep(type: string): void {
    const step: WorkflowStep = {
      order_index: this.currentWorkflow.steps.length,
      step_type: type as any,
      description: type === 'wait' ? 'Wait 1000ms' : 
                   type === 'wait_for_color' ? 'Wait for color' :
                   type === 'press_back' ? 'Press Back key' : 
                   type === 'start_game' ? 'Start game' : 
                   type === 'restart_game' ? 'Restart game' : 
                   type === 'loop_click' ? 'Loop click until not found' : 
                   'Image match'
    };

    if (type === 'wait') {
      step.wait_duration_ms = 1000;
    } else if (type === 'wait_for_color') {
      // Use center of screen based on workflow resolution
      step.x = Math.floor(this.currentWorkflow.screen_width / 2);
      step.y = Math.floor(this.currentWorkflow.screen_height / 2);
      step.expected_color = [255, 255, 255];  // Default white [B, G, R]
      step.tolerance = 30;
      step.max_wait_seconds = 30;
      step.check_interval = 1;
    } else if (type === 'image_match') {
      step.threshold = 0.8;
      step.match_all = false;
    } else if (type === 'loop_click') {
      step.threshold = 0.8;
      step.max_iterations = 20;
      step.not_found_threshold = 3;
      step.click_delay = 1.5;
      step.retry_delay = 2;
    }


    // Create new array reference to trigger change detection
    this.currentWorkflow.steps = [...this.currentWorkflow.steps, step];
    this.selectedStepIndex = this.currentWorkflow.steps.length - 1;
    this.editingStep = { ...step };
    this.addLog(`➕ Added ${type} step`);
  }

  selectStep(index: number): void {
    this.selectedStepIndex = index;
    this.editingStep = null;
  }

  editStep(index: number): void {
    this.selectedStepIndex = index;
    this.editingStep = { ...this.currentWorkflow.steps[index] };
    
    // Parse expected_color if it's a string (from database JSON)
    if (this.editingStep.expected_color && typeof this.editingStep.expected_color === 'string') {
      try {
        this.editingStep.expected_color = JSON.parse(this.editingStep.expected_color as any);
      } catch (e) {
        this.editingStep.expected_color = [255, 255, 255]; // Default white
      }
    }
  }

  applyStepEdit(): void {
    if (this.selectedStepIndex >= 0 && this.editingStep) {
      this.currentWorkflow.steps[this.selectedStepIndex] = { ...this.editingStep };
      this.editingStep = null;
      this.addLog(`✏️ Updated step ${this.selectedStepIndex + 1}`);
    }
  }

  deleteStep(index: number): void {
    this.currentWorkflow.steps.splice(index, 1);
    // Reorder
    this.currentWorkflow.steps.forEach((s, i) => s.order_index = i);
    if (this.selectedStepIndex === index) {
      this.selectedStepIndex = -1;
      this.editingStep = null;
    }
    this.addLog(`🗑️ Deleted step ${index + 1}`);
  }

  dropStep(event: CdkDragDrop<WorkflowStep[]>): void {
    moveItemInArray(this.currentWorkflow.steps, event.previousIndex, event.currentIndex);
    // Update order indices
    this.currentWorkflow.steps.forEach((s, i) => s.order_index = i);
    this.addLog(`🔀 Reordered steps`);
  }

  // OLD saveCapturedTemplate function removed - now using SweetAlert2 version above

  getStepIcon(step: WorkflowStep): string {
    switch (step.step_type) {
      case 'click': return '📍';
      case 'swipe': return '👆';
      case 'wait': return '⏱️';
      case 'wait_for_color': return '🎨';
      case 'image_match': return '🖼️';
      case 'find_all_click': return '🔄';
      case 'loop_click': return '🔁';
      case 'conditional': return '❓';
      case 'press_back': return '⬅️';
      case 'start_game': return '▶️';
      case 'restart_game': return '🔄🎮';
      default: return '•';
    }
  }
  
  clearSwipeOverlay(): void {
    this.swipePoints = [];
    this.drawOverlay();
  }
  
  createGroup(): void {
    if (!this.newGroupName.trim()) {
      this.addLog('❌ Please enter a group name');
      return;
    }
    
    const groupName = this.newGroupName.trim();
    const currentGroups = this.availableGroups();
    
    if (currentGroups.includes(groupName)) {
      this.addLog('⚠️ Group already exists');
      return;
    }
    
    this.availableGroups.set([...currentGroups, groupName]);
    
    if (this.editingStep) {
      this.editingStep.group_name = groupName;
    }
    
    this.showGroupModal = false;
    this.newGroupName = '';
    this.addLog(`✅ Created group: ${groupName}`);
  }
  
  updateAvailableGroups(): void {
    const groups = new Set<string>();
    this.currentWorkflow.steps.forEach(step => {
      if (step.group_name) {
        groups.add(step.group_name);
      }
    });
    this.availableGroups.set(Array.from(groups).sort());
  }
  
  getGroupColor(groupName: string): string {
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
      hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#7c3aed', '#2563eb', '#059669', '#dc2626',
      '#ea580c', '#4f46e5', '#0891b2', '#c026d3'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }

  getStepDescription(step: WorkflowStep): string {
    if (step.description) return step.description;

    switch (step.step_type) {
      case 'click':
        return `Click (${step.x}, ${step.y})`;
      case 'swipe':
        return `Swipe (${step.x},${step.y}) → (${step.end_x},${step.end_y})`;
      case 'wait':
        return `Wait ${step.wait_duration_ms}ms`;
      case 'image_match':
        return `Match: ${step.template_name || step.template_path || 'No template'}`;
      case 'repeat_group':
        return `Loop group "${step.loop_group_name || '?'}" until ${step.stop_on_not_found ? 'template NOT found' : 'template found'}`;
      default:
        return step.step_type;
    }
  }

  private addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logs = this.logs();
    this.logs.set([...logs.slice(-49), `[${timestamp}] ${message}`]);
  }
}
