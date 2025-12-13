import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DeviceInfo {
  serial: string;
  status: string;
  assigned_task: string;
  screen_size: string;
  is_running: boolean;
}

@Component({
  selector: 'app-device-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="device-manager-page">
      <div class="header">
        <h2 class="page-title">📱 Device Manager</h2>
        <button class="btn btn-primary" (click)="refreshDevices()" [disabled]="isRefreshing()">
          {{ isRefreshing() ? '⏳ Refreshing...' : '🔄 Refresh Devices' }}
        </button>
      </div>

      <div class="devices-grid" *ngIf="devices().length > 0">
        <div 
          *ngFor="let device of devices()" 
          class="device-card"
          [class.online]="device.status === 'online'"
          [class.offline]="device.status !== 'online'"
          [class.running]="device.is_running"
        >
          <div class="device-header">
            <span class="device-status-dot" [class]="device.status"></span>
            <span class="device-serial">{{ device.serial }}</span>
            <span class="device-size" *ngIf="device.screen_size">{{ device.screen_size }}</span>
          </div>
          
          <div class="device-body">
            <div class="task-select">
              <label>Task:</label>
              <select 
                [(ngModel)]="device.assigned_task" 
                (change)="assignTask(device)"
                [disabled]="device.status !== 'online'"
              >
                <option value="none">None</option>
                <option value="daily_login">Daily Login</option>
                <option value="re_id">Re-ID</option>
              </select>
            </div>
            
            <div class="device-status-text">
              {{ getStatusText(device) }}
            </div>
          </div>
          
          <div class="device-actions">
            <button 
              class="btn btn-success btn-small"
              (click)="openDevicePanel(device)"
              [disabled]="device.status !== 'online' || device.assigned_task === 'none'"
            >
              ⚙️ Configure
            </button>
            <button 
              class="btn btn-danger btn-small"
              *ngIf="device.is_running"
              (click)="stopDevice(device)"
            >
              🛑 Stop
            </button>
          </div>
        </div>
      </div>

      <div class="no-devices" *ngIf="devices().length === 0 && !isRefreshing()">
        <span class="no-devices-icon">📵</span>
        <p>No devices found</p>
        <p class="hint">Make sure emulators are running and ADB is configured</p>
        <button class="btn btn-primary" (click)="refreshDevices()">🔄 Scan for Devices</button>
      </div>

      <!-- Device Config Modal -->
      <div class="modal-overlay" *ngIf="selectedDevice()" (click)="closeDevicePanel()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ selectedDevice()?.serial }} - {{ getTaskName(selectedDevice()?.assigned_task || '') }}</h3>
            <button class="close-btn" (click)="closeDevicePanel()">✕</button>
          </div>
          
          <div class="modal-body" *ngIf="selectedDevice()?.assigned_task === 'daily_login'">
            <div class="form-group">
              <label>Account Folder:</label>
              <div class="input-row">
                <input 
                  type="text" 
                  [(ngModel)]="folderPath" 
                  placeholder="C:\\path\\to\\accounts"
                  class="folder-input"
                />
                <button class="btn btn-secondary" (click)="scanFolder()">📂 Scan</button>
              </div>
            </div>
            
            <div class="accounts-info" *ngIf="deviceStatus()?.total_accounts > 0">
              <p>✅ Found {{ deviceStatus()?.total_accounts }} accounts</p>
            </div>
            
            <div class="status-info">
              <p><strong>Status:</strong> {{ deviceStatus()?.state | uppercase }}</p>
              <p><strong>Progress:</strong> {{ deviceStatus()?.processed_count }}/{{ deviceStatus()?.total_accounts }}</p>
              <p *ngIf="deviceStatus()?.current_account"><strong>Current:</strong> {{ deviceStatus()?.current_account }}</p>
            </div>
          </div>
          
          <div class="modal-footer">
            <button 
              class="btn btn-success"
              (click)="startDevice()"
              [disabled]="!deviceStatus()?.total_accounts || deviceStatus()?.state === 'running'"
            >
              ▶️ Start
            </button>
            <button 
              class="btn btn-danger"
              (click)="stopSelectedDevice()"
              [disabled]="deviceStatus()?.state !== 'running'"
            >
              🛑 Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .device-manager-page {
      padding: 1.5rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .page-title {
      font-family: 'Orbitron', monospace;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #00f5ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }

    .devices-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .device-card {
      background: #1a1a2e;
      border: 1px solid rgba(100, 116, 139, 0.3);
      border-radius: 12px;
      padding: 1rem;
      transition: all 0.3s ease;
    }

    .device-card.online {
      border-color: rgba(16, 185, 129, 0.5);
    }

    .device-card.running {
      border-color: rgba(0, 245, 255, 0.8);
      box-shadow: 0 0 15px rgba(0, 245, 255, 0.2);
    }

    .device-card.offline {
      opacity: 0.6;
    }

    .device-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .device-status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .device-status-dot.online {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    .device-status-dot.offline {
      background: #64748b;
    }

    .device-serial {
      font-weight: 600;
      font-size: 1.1rem;
    }

    .device-size {
      color: #64748b;
      font-size: 0.85rem;
      margin-left: auto;
    }

    .device-body {
      margin-bottom: 1rem;
    }

    .task-select {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .task-select label {
      color: #94a3b8;
    }

    .task-select select {
      flex: 1;
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 6px;
      color: white;
    }

    .device-status-text {
      color: #64748b;
      font-size: 0.85rem;
    }

    .device-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn {
      padding: 0.6rem 1rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
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

    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }

    .btn-small {
      padding: 0.4rem 0.75rem;
      font-size: 0.85rem;
    }

    .no-devices {
      text-align: center;
      padding: 3rem;
      color: #64748b;
    }

    .no-devices-icon {
      font-size: 4rem;
      display: block;
      margin-bottom: 1rem;
    }

    .hint {
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(0, 245, 255, 0.1);
    }

    .modal-header h3 {
      margin: 0;
      color: #00f5ff;
    }

    .close-btn {
      background: none;
      border: none;
      color: #64748b;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
    }

    .folder-input {
      flex: 1;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      color: white;
    }

    .accounts-info {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 1rem;
    }

    .status-info {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 0.75rem;
    }

    .status-info p {
      margin: 0.25rem 0;
      font-size: 0.9rem;
    }

    .modal-footer {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(0, 245, 255, 0.1);
    }

    .modal-footer .btn {
      flex: 1;
    }
  `]
})
export class DeviceManagerComponent implements OnInit {
  devices = signal<DeviceInfo[]>([]);
  isRefreshing = signal(false);
  selectedDevice = signal<DeviceInfo | null>(null);
  deviceStatus = signal<any>(null);
  folderPath = '';
  
  private statusInterval: any;

  ngOnInit(): void {
    this.refreshDevices();
  }

  async refreshDevices(): Promise<void> {
    this.isRefreshing.set(true);
    try {
      const response = await fetch('/api/v1/devices');
      const result = await response.json();
      if (result.success) {
        this.devices.set(result.devices);
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error);
    } finally {
      this.isRefreshing.set(false);
    }
  }

  async assignTask(device: DeviceInfo): Promise<void> {
    try {
      await fetch(`/api/v1/devices/${device.serial}/task/${device.assigned_task}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  }

  openDevicePanel(device: DeviceInfo): void {
    this.selectedDevice.set(device);
    this.refreshDeviceStatus();
    this.statusInterval = setInterval(() => this.refreshDeviceStatus(), 2000);
  }

  closeDevicePanel(): void {
    this.selectedDevice.set(null);
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }

  async refreshDeviceStatus(): Promise<void> {
    const device = this.selectedDevice();
    if (!device) return;
    
    try {
      const response = await fetch(`/api/v1/devices/${device.serial}/daily-login/status`);
      const status = await response.json();
      this.deviceStatus.set(status);
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  }

  async scanFolder(): Promise<void> {
    const device = this.selectedDevice();
    if (!device || !this.folderPath) return;
    
    try {
      const response = await fetch(`/api/v1/devices/${device.serial}/daily-login/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: this.folderPath })
      });
      await response.json();
      this.refreshDeviceStatus();
    } catch (error) {
      console.error('Failed to scan folder:', error);
    }
  }

  async startDevice(): Promise<void> {
    const device = this.selectedDevice();
    if (!device) return;
    
    try {
      await fetch(`/api/v1/devices/${device.serial}/daily-login/start`, {
        method: 'POST'
      });
      this.refreshDevices();
      this.refreshDeviceStatus();
    } catch (error) {
      console.error('Failed to start:', error);
    }
  }

  async stopDevice(device: DeviceInfo): Promise<void> {
    try {
      await fetch(`/api/v1/devices/${device.serial}/daily-login/stop`, {
        method: 'POST'
      });
      this.refreshDevices();
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  }

  async stopSelectedDevice(): Promise<void> {
    const device = this.selectedDevice();
    if (device) {
      await this.stopDevice(device);
      this.refreshDeviceStatus();
    }
  }

  getStatusText(device: DeviceInfo): string {
    if (device.status !== 'online') return 'Offline';
    if (device.is_running) return '🟢 Running';
    if (device.assigned_task === 'none') return 'No task assigned';
    return `Ready: ${this.getTaskName(device.assigned_task)}`;
  }

  getTaskName(task: string): string {
    const names: Record<string, string> = {
      'none': 'None',
      'daily_login': 'Daily Login',
      're_id': 'Re-ID'
    };
    return names[task] || task;
  }
}
