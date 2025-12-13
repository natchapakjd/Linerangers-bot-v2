import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';

interface WorkflowStep {
  id?: number;
  order_index: number;
  step_type: 'click' | 'swipe' | 'wait' | 'image_match' | 'find_all_click' | 'conditional';
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
  on_match_action?: string;
  description?: string;
}

interface Workflow {
  id?: number;
  name: string;
  description: string;
  screen_width: number;
  screen_height: number;
  is_master: boolean;
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
    <div class="workflow-builder">
      <div class="header-section">
        <h2 class="page-title">🔧 Workflow Builder</h2>
        <div class="header-actions">
          <select [(ngModel)]="selectedWorkflowId" (change)="loadWorkflow()" class="workflow-select">
            <option value="">-- New Workflow --</option>
            @for (w of workflows(); track w.id) {
              <option [value]="w.id">{{ w.name }} {{ w.is_master ? '⭐' : '' }}</option>
            }
          </select>
          <button class="btn btn-primary" (click)="saveWorkflow()" [disabled]="isSaving()">
            {{ isSaving() ? '⏳' : '💾' }} Save
          </button>
          <button class="btn btn-success" (click)="executeWorkflow()" [disabled]="!currentWorkflow.id || isExecuting()">
            {{ isExecuting() ? '⏳' : '▶️' }} Run
          </button>
          <button class="btn btn-warning" (click)="setAsMaster()" [disabled]="!currentWorkflow.id">
            ⭐ Set Master
          </button>
        </div>
      </div>

      <!-- Workflow Info -->
      <div class="workflow-info card">
        <div class="info-row">
          <div class="form-group">
            <label>Workflow Name</label>
            <input type="text" [(ngModel)]="currentWorkflow.name" placeholder="Enter workflow name..." />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" [(ngModel)]="currentWorkflow.description" placeholder="Description..." />
          </div>
          <div class="form-group">
            <label>Device</label>
            <select [(ngModel)]="selectedDevice">
              @for (device of devices(); track device.serial) {
                <option [value]="device.serial">{{ device.serial }} {{ device.status === 'online' ? '🟢' : '🔴' }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      <div class="main-content">
        <!-- Screen Preview -->
        <div class="preview-section">
          <div class="preview-header">
            <h3>📱 Screen Preview ({{ currentWorkflow.screen_width }}x{{ currentWorkflow.screen_height }})</h3>
            <div class="mode-selector">
              <button 
                class="mode-btn" 
                [class.active]="currentMode === 'click'"
                (click)="currentMode = 'click'"
              >📍 Click</button>
              <button 
                class="mode-btn" 
                [class.active]="currentMode === 'swipe'"
                (click)="currentMode = 'swipe'"
              >👆 Swipe</button>
              <button 
                class="mode-btn" 
                [class.active]="currentMode === 'capture'"
                (click)="currentMode = 'capture'"
              >📷 Capture</button>
            </div>
            <button class="btn btn-secondary btn-small" (click)="refreshScreen()">🔄</button>
          </div>
          
          <div 
            class="screen-container"
            #screenContainer
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp($event)"
            (mouseleave)="onMouseUp($event)"
          >
            @if (screenImage()) {
              <img [src]="screenImage()" alt="Screen" class="screen-image" />
            } @else {
              <div class="no-screen">
                <span class="no-screen-icon">📱</span>
                <span>Select a device and click refresh</span>
              </div>
            }
            
            <!-- Overlay for drawing -->
            <canvas 
              #overlayCanvas 
              class="overlay-canvas"
              [width]="currentWorkflow.screen_width"
              [height]="currentWorkflow.screen_height"
            ></canvas>
            
            <!-- Show click/swipe preview -->
            @if (isDragging && currentMode === 'swipe') {
              <div 
                class="swipe-preview" 
                [style.left.px]="dragStart.x" 
                [style.top.px]="dragStart.y"
              >
                <div class="swipe-line" 
                  [style.width.px]="getSwipeDistance()"
                  [style.transform]="'rotate(' + getSwipeAngle() + 'deg)'"
                ></div>
              </div>
            }
          </div>
          
          <div class="coords-display">
            Position: ({{ mouseX }}, {{ mouseY }})
          </div>
        </div>

        <!-- Steps Panel -->
        <div class="steps-section">
          <div class="steps-header">
            <h3>📋 Steps ({{ currentWorkflow.steps.length }})</h3>
            <div class="step-actions">
              <button class="btn btn-small" (click)="addStep('wait')">⏱️ Wait</button>
              <button class="btn btn-small" (click)="addStep('image_match')">🖼️ Image</button>
            </div>
          </div>

          <div 
            class="steps-list"
            cdkDropList
            (cdkDropListDropped)="dropStep($event)"
          >
            @for (step of currentWorkflow.steps; track step.order_index; let i = $index) {
              <div 
                class="step-item"
                cdkDrag
                [class.selected]="selectedStepIndex === i"
                (click)="selectStep(i)"
              >
                <div class="step-drag-handle" cdkDragHandle>⋮⋮</div>
                <span class="step-index">{{ i + 1 }}</span>
                <span class="step-icon">{{ getStepIcon(step) }}</span>
                <span class="step-info">{{ getStepDescription(step) }}</span>
                <button class="btn-icon" (click)="editStep(i); $event.stopPropagation()">✏️</button>
                <button class="btn-icon danger" (click)="deleteStep(i); $event.stopPropagation()">🗑️</button>
              </div>
            }

            @if (currentWorkflow.steps.length === 0) {
              <div class="no-steps">
                <p>No steps yet. Click on the screen preview to add steps.</p>
              </div>
            }
          </div>

          <!-- Step Editor -->
          @if (selectedStepIndex >= 0 && editingStep) {
            <div class="step-editor card">
              <h4>Edit Step {{ selectedStepIndex + 1 }}</h4>
              
              <div class="form-group">
                <label>Type</label>
                <select [(ngModel)]="editingStep.step_type">
                  <option value="click">Click</option>
                  <option value="swipe">Swipe</option>
                  <option value="wait">Wait</option>
                  <option value="image_match">Image Match</option>
                  <option value="find_all_click">Find All & Click</option>
                </select>
              </div>

              @if (editingStep.step_type === 'click' || editingStep.step_type === 'swipe') {
                <div class="form-row">
                  <div class="form-group">
                    <label>X</label>
                    <input type="number" [(ngModel)]="editingStep.x" />
                  </div>
                  <div class="form-group">
                    <label>Y</label>
                    <input type="number" [(ngModel)]="editingStep.y" />
                  </div>
                </div>
              }

              @if (editingStep.step_type === 'swipe') {
                <div class="form-row">
                  <div class="form-group">
                    <label>End X</label>
                    <input type="number" [(ngModel)]="editingStep.end_x" />
                  </div>
                  <div class="form-group">
                    <label>End Y</label>
                    <input type="number" [(ngModel)]="editingStep.end_y" />
                  </div>
                </div>
                <div class="form-group">
                  <label>Duration (ms)</label>
                  <input type="number" [(ngModel)]="editingStep.swipe_duration_ms" />
                </div>
              }

              @if (editingStep.step_type === 'wait') {
                <div class="form-group">
                  <label>Wait Duration (ms)</label>
                  <input type="number" [(ngModel)]="editingStep.wait_duration_ms" />
                </div>
              }

              @if (editingStep.step_type === 'image_match' || editingStep.step_type === 'find_all_click') {
                <div class="form-group">
                  <label>Template</label>
                  <select [(ngModel)]="editingStep.template_path">
                    @for (t of templates(); track t.id) {
                      <option [value]="t.file_path">{{ t.name }}</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label>Threshold</label>
                  <input type="number" [(ngModel)]="editingStep.threshold" min="0" max="1" step="0.1" />
                </div>
                @if (editingStep.step_type === 'find_all_click') {
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="editingStep.match_all" />
                    Click all matches
                  </label>
                }
              }

              <div class="form-group">
                <label>Description</label>
                <input type="text" [(ngModel)]="editingStep.description" placeholder="Optional description..." />
              </div>

              <button class="btn btn-primary" (click)="applyStepEdit()">✅ Apply</button>
            </div>
          }
        </div>
      </div>

      <!-- Log Area -->
      <div class="log-section card">
        <h3>📋 Log</h3>
        <div class="log-area">
          @for (log of logs(); track log) {
            <div class="log-line">{{ log }}</div>
          }
        </div>
      </div>

      <!-- Capture Template Modal -->
      @if (showCaptureModal) {
        <div class="modal-overlay" (click)="showCaptureModal = false">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <h3>📷 Save Captured Region</h3>
            <div class="form-group">
              <label>Template Name</label>
              <input type="text" [(ngModel)]="captureTemplateName" placeholder="e.g., checkbox, agree_button" />
            </div>
            <div class="captured-info">
              Region: ({{ captureRegion.x }}, {{ captureRegion.y }}) - {{ captureRegion.width }}x{{ captureRegion.height }}
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="showCaptureModal = false">Cancel</button>
              <button class="btn btn-primary" (click)="saveCapturedTemplate()">💾 Save Template</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .workflow-builder {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: calc(100vh - 60px);
      overflow-y: auto;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      font-family: 'Orbitron', monospace;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #00f5ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .workflow-select {
      padding: 0.5rem 1rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      color: white;
      min-width: 200px;
    }

    .card {
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 12px;
      padding: 1rem;
    }

    .workflow-info .info-row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
      min-width: 150px;
    }

    .form-group label {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .form-group input, .form-group select {
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 6px;
      color: white;
    }

    .form-row {
      display: flex;
      gap: 0.5rem;
    }

    .main-content {
      display: grid;
      grid-template-columns: 960px 1fr;
      gap: 1rem;
      flex: 1;
      min-height: 0;
    }

    /* Screen Preview */
    .preview-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .preview-header h3 {
      margin: 0;
      font-size: 1rem;
      color: #94a3b8;
    }

    .mode-selector {
      display: flex;
      gap: 0.25rem;
    }

    .mode-btn {
      padding: 0.4rem 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 6px;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s;
    }

    .mode-btn.active {
      background: rgba(0, 245, 255, 0.2);
      border-color: #00f5ff;
      color: #00f5ff;
    }

    .screen-container {
      width: 960px;
      height: 540px;
      background: #0a0a0f;
      border: 2px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      cursor: crosshair;
    }

    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    .no-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #64748b;
    }

    .no-screen-icon {
      font-size: 4rem;
      opacity: 0.5;
    }

    .coords-display {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #00f5ff;
      padding: 0.25rem 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      align-self: flex-start;
    }

    .swipe-preview {
      position: absolute;
      pointer-events: none;
    }

    .swipe-line {
      height: 3px;
      background: linear-gradient(90deg, #00f5ff, #7c3aed);
      transform-origin: left center;
    }

    /* Steps Section */
    .steps-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 600px;
    }

    .steps-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .steps-header h3 {
      margin: 0;
      font-size: 1rem;
      color: #94a3b8;
    }

    .step-actions {
      display: flex;
      gap: 0.25rem;
    }

    .steps-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      min-height: 200px;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: rgba(0, 245, 255, 0.05);
      border: 1px solid rgba(0, 245, 255, 0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .step-item:hover {
      border-color: rgba(0, 245, 255, 0.3);
    }

    .step-item.selected {
      border-color: #00f5ff;
      background: rgba(0, 245, 255, 0.1);
    }

    .step-item.cdk-drag-preview {
      box-shadow: 0 4px 20px rgba(0, 245, 255, 0.3);
    }

    .step-drag-handle {
      cursor: grab;
      color: #64748b;
      font-size: 1.2rem;
    }

    .step-index {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 245, 255, 0.2);
      border-radius: 50%;
      font-size: 0.75rem;
      color: #00f5ff;
    }

    .step-icon {
      font-size: 1.2rem;
    }

    .step-info {
      flex: 1;
      font-size: 0.85rem;
      color: #e2e8f0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 0.25rem;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .btn-icon:hover {
      opacity: 1;
    }

    .btn-icon.danger:hover {
      filter: brightness(1.5);
    }

    .no-steps {
      text-align: center;
      color: #64748b;
      padding: 2rem;
    }

    /* Step Editor */
    .step-editor {
      margin-top: 0.5rem;
    }

    .step-editor h4 {
      margin: 0 0 0.75rem 0;
      color: #00f5ff;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #e2e8f0;
      cursor: pointer;
    }

    /* Buttons */
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, #00f5ff, #0ea5e9);
      color: #0a0a0f;
    }

    .btn-secondary {
      background: rgba(0, 245, 255, 0.1);
      border: 1px solid rgba(0, 245, 255, 0.3);
      color: #00f5ff;
    }

    .btn-success {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }

    .btn-warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
    }

    .btn-small {
      padding: 0.3rem 0.6rem;
      font-size: 0.8rem;
    }

    /* Log Section */
    .log-section {
      max-height: 150px;
    }

    .log-section h3 {
      margin: 0 0 0.5rem 0;
      font-size: 0.9rem;
      color: #94a3b8;
    }

    .log-area {
      max-height: 100px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .log-line {
      padding: 0.2rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 12px;
      padding: 1.5rem;
      min-width: 400px;
    }

    .modal-content h3 {
      margin: 0 0 1rem 0;
      color: #00f5ff;
    }

    .captured-info {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #94a3b8;
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      margin: 0.5rem 0;
    }

    .modal-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 1rem;
    }

    @media (max-width: 1200px) {
      .main-content {
        grid-template-columns: 1fr;
      }

      .screen-container {
        width: 100%;
        max-width: 960px;
        height: auto;
        aspect-ratio: 16/9;
      }
    }
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
  currentMode: 'click' | 'swipe' | 'capture' = 'click';
  isDragging = false;
  dragStart = { x: 0, y: 0 };
  dragEnd = { x: 0, y: 0 };
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
        this.addLog(`✅ Loaded: ${data.workflow.name}`);
      }
    } catch (error) {
      this.addLog(`❌ Failed to load workflow: ${error}`);
    }
  }

  async saveWorkflow(): Promise<void> {
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

  async refreshScreen(): Promise<void> {
    if (!this.selectedDevice) return;

    try {
      const response = await fetch(`/api/v1/devices/${this.selectedDevice}/screenshot`);
      const data = await response.json();
      if (data.success && data.image) {
        this.screenImage.set(data.image);
      }
    } catch (error) {
      // Silent fail
    }
  }

  // Mouse handlers for screen preview
  onMouseDown(event: MouseEvent): void {
    const rect = this.screenContainer.nativeElement.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * (this.currentWorkflow.screen_width / rect.width));
    const y = Math.round((event.clientY - rect.top) * (this.currentWorkflow.screen_height / rect.height));

    this.dragStart = { x, y };
    this.isDragging = true;
  }

  onMouseMove(event: MouseEvent): void {
    const rect = this.screenContainer.nativeElement.getBoundingClientRect();
    this.mouseX = Math.round((event.clientX - rect.left) * (this.currentWorkflow.screen_width / rect.width));
    this.mouseY = Math.round((event.clientY - rect.top) * (this.currentWorkflow.screen_height / rect.height));

    if (this.isDragging) {
      this.dragEnd = { x: this.mouseX, y: this.mouseY };
      this.drawOverlay();
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const rect = this.screenContainer.nativeElement.getBoundingClientRect();
    const endX = Math.round((event.clientX - rect.left) * (this.currentWorkflow.screen_width / rect.width));
    const endY = Math.round((event.clientY - rect.top) * (this.currentWorkflow.screen_height / rect.height));

    const distance = Math.sqrt(Math.pow(endX - this.dragStart.x, 2) + Math.pow(endY - this.dragStart.y, 2));

    if (this.currentMode === 'click' && distance < 10) {
      // Click
      this.addClickStep(this.dragStart.x, this.dragStart.y);
    } else if (this.currentMode === 'swipe' && distance >= 10) {
      // Swipe
      this.addSwipeStep(this.dragStart.x, this.dragStart.y, endX, endY);
    } else if (this.currentMode === 'capture' && distance >= 10) {
      // Capture region
      const minX = Math.min(this.dragStart.x, endX);
      const minY = Math.min(this.dragStart.y, endY);
      const width = Math.abs(endX - this.dragStart.x);
      const height = Math.abs(endY - this.dragStart.y);
      this.captureRegion = { x: minX, y: minY, width, height };
      this.showCaptureModal = true;
    }

    this.clearOverlay();
  }

  drawOverlay(): void {
    const canvas = this.overlayCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.currentMode === 'swipe') {
      ctx.beginPath();
      ctx.moveTo(this.dragStart.x, this.dragStart.y);
      ctx.lineTo(this.dragEnd.x, this.dragEnd.y);
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(this.dragEnd.y - this.dragStart.y, this.dragEnd.x - this.dragStart.x);
      ctx.beginPath();
      ctx.moveTo(this.dragEnd.x, this.dragEnd.y);
      ctx.lineTo(this.dragEnd.x - 15 * Math.cos(angle - Math.PI / 6), this.dragEnd.y - 15 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(this.dragEnd.x - 15 * Math.cos(angle + Math.PI / 6), this.dragEnd.y - 15 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = '#00f5ff';
      ctx.fill();
    } else if (this.currentMode === 'capture') {
      const minX = Math.min(this.dragStart.x, this.dragEnd.x);
      const minY = Math.min(this.dragStart.y, this.dragEnd.y);
      const width = Math.abs(this.dragEnd.x - this.dragStart.x);
      const height = Math.abs(this.dragEnd.y - this.dragStart.y);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(minX, minY, width, height);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fillRect(minX, minY, width, height);
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
      description: type === 'wait' ? 'Wait 1000ms' : 'Image match'
    };

    if (type === 'wait') {
      step.wait_duration_ms = 1000;
    } else if (type === 'image_match') {
      step.threshold = 0.8;
      step.match_all = false;
    }

    this.currentWorkflow.steps.push(step);
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

  async saveCapturedTemplate(): Promise<void> {
    if (!this.captureTemplateName.trim()) {
      this.addLog('❌ Please enter a template name');
      return;
    }

    try {
      const response = await fetch('/api/v1/workflows/capture-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_serial: this.selectedDevice,
          name: this.captureTemplateName,
          ...this.captureRegion
        })
      });

      const data = await response.json();
      if (data.success) {
        await this.loadTemplates();
        this.addLog(`📷 Template saved: ${this.captureTemplateName}`);
        this.showCaptureModal = false;
        this.captureTemplateName = '';
      } else {
        this.addLog(`❌ ${data.message}`);
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  getStepIcon(step: WorkflowStep): string {
    switch (step.step_type) {
      case 'click': return '📍';
      case 'swipe': return '👆';
      case 'wait': return '⏱️';
      case 'image_match': return '🖼️';
      case 'find_all_click': return '🔄';
      case 'conditional': return '❓';
      default: return '•';
    }
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
