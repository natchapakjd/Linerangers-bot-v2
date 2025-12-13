import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DeviceInfo {
  serial: string;
  status: string;
  assigned_task: string;
  screen_size: string;
  is_running: boolean;
  selected?: boolean;
}

interface AccountInfo {
  filename: string;
  filepath: string;
  processed: boolean;
  success: boolean;
  error_message: string;
}

interface DailyLoginStatus {
  state: string;
  folder_path: string;
  total_accounts: number;
  processed_count: number;
  current_account: string;
  message: string;
  auto_claim_enabled: boolean;
  accounts: AccountInfo[];
}

@Component({
  selector: 'app-daily-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="daily-login-page">
      <h2 class="page-title">📅 Daily Login Automation</h2>
      
      <!-- Device Selection Section -->
      <div class="card device-selection-section">
        <div class="device-header">
          <h3>📱 Select Devices</h3>
          <button class="btn btn-secondary btn-small" (click)="refreshDevices()">
            {{ isLoadingDevices() ? '⏳' : '🔄' }} Refresh
          </button>
        </div>
        
        @if (devices().length === 0) {
          <div class="no-devices">
            <span>No devices found. Connect an emulator and refresh.</span>
          </div>
        } @else {
          <div class="device-grid">
            @for (device of devices(); track device.serial) {
              <label 
                class="device-checkbox" 
                [class.selected]="device.selected"
                [class.offline]="device.status !== 'online'"
                [class.running]="device.is_running"
              >
                <input 
                  type="checkbox" 
                  [checked]="device.selected" 
                  (change)="toggleDevice(device)"
                  [disabled]="device.status !== 'online'"
                />
                <div class="device-info">
                  <span class="device-serial">{{ device.serial }}</span>
                  <span class="device-status">
                    {{ device.status === 'online' ? '🟢' : '🔴' }}
                    @if (device.is_running) {
                      <span class="running-badge">▶️ Running</span>
                    }
                  </span>
                </div>
              </label>
            }
          </div>
          <div class="selected-count">
            {{ getSelectedCount() }} device(s) selected
          </div>
        }
      </div>
      
      <div class="main-layout">
        <!-- Folder Selection -->
          <div class="card folder-section">
            <h3>📂 Account Folder</h3>
            <div class="folder-input-group">
              <input 
                type="text" 
                [(ngModel)]="folderPath"
                placeholder="Enter path or click Browse to select folder..."
                class="folder-input"
              />
              <button 
                class="btn btn-secondary" 
                (click)="browseFolder()"
                [disabled]="isBrowsing()"
              >
                {{ isBrowsing() ? '⏳' : '📁' }} Browse
              </button>
              <button 
                class="btn btn-primary" 
                (click)="scanFolder()"
                [disabled]="isScanning()"
              >
                {{ isScanning() ? '⏳ Scanning...' : '🔍 Scan' }}
              </button>
            </div>
            <p class="hint-text">📁 Click "Browse" to select folder or paste path directly (e.g., C:\\Users\\YourName\\LineRangers\\accounts)</p>
          </div>


      <!-- Accounts List -->
      <div class="card accounts-section" *ngIf="status().accounts.length > 0">
        <div class="accounts-header">
          <h3>👥 Accounts Found ({{ status().total_accounts }})</h3>
          <div class="progress-info" *ngIf="status().state === 'running'">
            <span class="current-account">▶ {{ status().current_account }}</span>
            <span class="progress-text">{{ status().processed_count }}/{{ status().total_accounts }}</span>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="progress-bar-container" *ngIf="status().total_accounts > 0">
          <div 
            class="progress-bar-fill" 
            [style.width.%]="(status().processed_count / status().total_accounts) * 100"
          ></div>
        </div>
        
        <!-- Account List -->
        <div class="accounts-list">
          <div 
            *ngFor="let account of status().accounts; let i = index" 
            class="account-item"
            [class.processing]="status().current_account === account.filename"
            [class.success]="account.processed && account.success"
            [class.failed]="account.processed && !account.success"
          >
            <span class="account-index">{{ i + 1 }}</span>
            <span class="account-icon">
              {{ getAccountIcon(account) }}
            </span>
            <span class="account-name">{{ account.filename }}</span>
            <span class="account-status" *ngIf="account.processed">
              {{ account.success ? '✓' : '✗' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Settings -->
          <div class="card settings-section">
            <h3>⚙️ Settings</h3>
            
            <!-- Auto Claim Toggle -->
            <div class="toggle-section">
              <label class="toggle-label">
                <span class="toggle-text">🎁 Auto Claim Rewards</span>
                <div class="toggle-switch" [class.active]="settings.auto_claim_enabled" (click)="toggleAutoClaim()">
                  <div class="toggle-slider"></div>
                </div>
              </label>
              <p class="toggle-hint">Automatically close popups and claim daily rewards</p>
            </div>
            
            <div class="settings-grid">
              <div class="setting-item">
                <label>Delay after push (sec)</label>
                <input type="number" [(ngModel)]="settings.delay_after_push" min="1" max="30" />
              </div>
              <div class="setting-item">
                <label>Game load timeout (sec)</label>
                <input type="number" [(ngModel)]="settings.delay_for_game_load" min="10" max="120" />
              </div>
              <div class="setting-item">
                <label>Between accounts (sec)</label>
                <input type="number" [(ngModel)]="settings.delay_between_accounts" min="1" max="60" />
              </div>
            </div>
            <button class="btn btn-secondary" (click)="saveSettings()">💾 Save Settings</button>
          </div>

      <!-- Control Buttons -->
      <div class="control-section">
        <button 
          class="btn btn-success btn-large" 
          (click)="startOnSelectedDevices()"
          [disabled]="status().state === 'running' || status().accounts.length === 0 || getSelectedCount() === 0"
        >
          🚀 START ON {{ getSelectedCount() }} DEVICE(S)
        </button>
        <button 
          class="btn btn-danger btn-large" 
          (click)="stop()"
          [disabled]="status().state !== 'running'"
        >
          🛑 STOP
        </button>
      </div>

      <!-- Status/Logs -->
      <div class="card status-section">
        <h3>📋 Status</h3>
        <div class="status-info">
          <div class="status-item">
            <span class="label">State:</span>
            <span class="value state-badge" [class]="status().state">{{ status().state.toUpperCase() }}</span>
          </div>
          <div class="status-item">
            <span class="label">Message:</span>
            <span class="value">{{ status().message || 'Ready' }}</span>
          </div>
        </div>
        <div class="log-area">
          <div *ngFor="let log of logs()" class="log-line">{{ log }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .daily-login-page {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .main-layout {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Device Selection */
    .device-selection-section {
      margin-bottom: 0.5rem;
    }

    .device-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .device-header h3 {
      margin: 0;
    }

    .no-devices {
      text-align: center;
      color: #64748b;
      padding: 1rem;
    }

    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    .device-checkbox {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(0, 0, 0, 0.2);
      border: 2px solid rgba(100, 100, 255, 0.2);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .device-checkbox:hover:not(.offline) {
      border-color: rgba(0, 245, 255, 0.4);
    }

    .device-checkbox.selected {
      border-color: #00f5ff;
      background: rgba(0, 245, 255, 0.1);
    }

    .device-checkbox.offline {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .device-checkbox.running {
      border-color: #22c55e;
    }

    .device-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #00f5ff;
    }

    .device-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .device-serial {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #e2e8f0;
    }

    .device-status {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .running-badge {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
      padding: 0.15rem 0.5rem;
      border-radius: 8px;
      font-size: 0.65rem;
      font-weight: 600;
      margin-left: 0.25rem;
    }

    .selected-count {
      text-align: right;
      color: #00f5ff;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }

    .left-column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .right-column {
      position: sticky;
      top: 1rem;
      height: fit-content;
    }

    /* Screen Preview */
    .screen-preview-section {
      position: sticky;
      top: 1rem;
    }

    .screen-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .screen-header h3 {
      margin: 0;
    }

    .btn-small {
      padding: 0.4rem 0.75rem;
      font-size: 0.85rem;
    }

    .screen-container {
      aspect-ratio: 9/16;
      background: #0a0a0f;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .no-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      color: #64748b;
    }

    .no-screen-icon {
      font-size: 3rem;
      opacity: 0.5;
    }

    @media (max-width: 900px) {
      .main-layout {
        grid-template-columns: 1fr;
      }

      .right-column {
        position: static;
      }

      .screen-container {
        aspect-ratio: 16/9;
        max-height: 300px;
      }
    }

    .page-title {
      font-family: 'Orbitron', monospace;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #00f5ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .card {
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 12px;
      padding: 1.25rem;
    }

    .card h3 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      color: #94a3b8;
    }

    /* Folder Section */
    .folder-input-group {
      display: flex;
      gap: 0.5rem;
    }

    .folder-input {
      flex: 1;
      padding: 0.75rem 1rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      color: white;
      font-size: 0.9rem;
    }

    .folder-input:focus {
      outline: none;
      border-color: #00f5ff;
      box-shadow: 0 0 10px rgba(0, 245, 255, 0.2);
    }

    .hint-text {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.5rem;
    }

    /* Buttons */
    .btn {
      padding: 0.75rem 1.5rem;
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

    .btn-primary:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
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

    .btn-large {
      padding: 1rem 2rem;
      font-size: 1.1rem;
    }

    /* Accounts Section */
    .accounts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .progress-info {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .current-account {
      color: #00f5ff;
      font-weight: 600;
    }

    .progress-text {
      color: #94a3b8;
    }

    .progress-bar-container {
      height: 6px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 3px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f5ff, #7c3aed);
      transition: width 0.5s ease;
    }

    .accounts-list {
      max-height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .account-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      border: 1px solid transparent;
      transition: all 0.3s ease;
    }

    .account-item.processing {
      border-color: #00f5ff;
      background: rgba(0, 245, 255, 0.1);
    }

    .account-item.success {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }

    .account-item.failed {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .account-index {
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

    .account-icon {
      font-size: 1.25rem;
    }

    .account-name {
      flex: 1;
      font-size: 0.9rem;
    }

    .account-status {
      font-size: 1rem;
    }

    /* Settings */
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .setting-item label {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .setting-item input {
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 6px;
      color: white;
      text-align: center;
    }

    /* Control Section */
    .control-section {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    /* Status Section */
    .status-info {
      display: flex;
      gap: 2rem;
      margin-bottom: 1rem;
    }

    .status-item {
      display: flex;
      gap: 0.5rem;
    }

    .status-item .label {
      color: #64748b;
    }

    .state-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .state-badge.idle {
      background: rgba(100, 116, 139, 0.2);
      color: #94a3b8;
    }

    .state-badge.running {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }

    .state-badge.completed {
      background: rgba(0, 245, 255, 0.2);
      color: #00f5ff;
    }

    .state-badge.error {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .log-area {
      max-height: 150px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 0.75rem;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
    }

    .log-line {
      padding: 0.25rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .log-line:last-child {
      border-bottom: none;
    }

    @media (max-width: 768px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }

      .control-section {
        flex-direction: column;
      }
    }

    /* Toggle Switch */
    .toggle-section {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(0, 245, 255, 0.1);
    }

    .toggle-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .toggle-text {
      font-size: 1rem;
      color: #e2e8f0;
    }

    .toggle-hint {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.5rem;
      margin-bottom: 0;
    }

    .toggle-switch {
      width: 52px;
      height: 28px;
      background: rgba(100, 116, 139, 0.3);
      border-radius: 14px;
      position: relative;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .toggle-switch:hover {
      background: rgba(100, 116, 139, 0.5);
    }

    .toggle-switch.active {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .toggle-slider {
      width: 22px;
      height: 22px;
      background: white;
      border-radius: 50%;
      position: absolute;
      top: 3px;
      left: 3px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .toggle-switch.active .toggle-slider {
      left: 27px;
    }
  `]
})
export class DailyLoginComponent implements OnInit, OnDestroy {
  folderPath = '';
  isScanning = signal(false);
  isBrowsing = signal(false);
  isRefreshingScreen = signal(false);
  isLoadingDevices = signal(false);
  screenImage = signal<string>('');
  logs = signal<string[]>(['🚀 Daily Login ready']);
  devices = signal<DeviceInfo[]>([]);
  
  status = signal<DailyLoginStatus>({
    state: 'idle',
    folder_path: '',
    total_accounts: 0,
    processed_count: 0,
    current_account: '',
    message: '',
    auto_claim_enabled: true,
    accounts: []
  });
  
  settings = {
    delay_after_push: 2,
    delay_for_game_load: 60,
    delay_between_accounts: 5,
    auto_claim_enabled: true
  };
  
  private statusInterval: any;

  ngOnInit(): void {
    this.refreshDevices();
    this.refreshStatus();
    // Poll status every 2 seconds
    this.statusInterval = setInterval(() => this.refreshStatus(), 2000);
  }

  // ===== Device Management =====
  
  async refreshDevices(): Promise<void> {
    this.isLoadingDevices.set(true);
    try {
      const response = await fetch('/api/v1/devices');
      const data = await response.json();
      if (data.success) {
        // Keep selected state when refreshing
        const currentDevices = this.devices();
        const updatedDevices = data.devices.map((d: any) => ({
          ...d,
          selected: currentDevices.find(cd => cd.serial === d.serial)?.selected || false
        }));
        this.devices.set(updatedDevices);
      }
    } catch (error) {
      this.addLog(`❌ Error loading devices: ${error}`);
    } finally {
      this.isLoadingDevices.set(false);
    }
  }

  toggleDevice(device: DeviceInfo): void {
    const devices = this.devices();
    const updated = devices.map(d => 
      d.serial === device.serial ? { ...d, selected: !d.selected } : d
    );
    this.devices.set(updated);
  }

  getSelectedCount(): number {
    return this.devices().filter(d => d.selected).length;
  }

  getSelectedDevices(): DeviceInfo[] {
    return this.devices().filter(d => d.selected && d.status === 'online');
  }

  async startOnSelectedDevices(): Promise<void> {
    const selected = this.getSelectedDevices();
    if (selected.length === 0) {
      this.addLog('❌ No devices selected');
      return;
    }
    
    this.addLog(`🚀 Starting Daily Login on ${selected.length} device(s)...`);
    
    for (const device of selected) {
      try {
        // First scan folder for this device
        await fetch(`/api/v1/devices/${device.serial}/daily-login/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_path: this.folderPath })
        });
        
        // Then start
        const response = await fetch(`/api/v1/devices/${device.serial}/daily-login/start`, {
          method: 'POST'
        });
        const result = await response.json();
        
        this.addLog(result.success 
          ? `✅ Started on ${device.serial}` 
          : `❌ ${device.serial}: ${result.message}`
        );
      } catch (error) {
        this.addLog(`❌ Error on ${device.serial}: ${error}`);
      }
    }
    
    this.refreshDevices();
  }

  ngOnDestroy(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }

  async scanFolder(): Promise<void> {
    if (!this.folderPath.trim()) {
      this.addLog('❌ Please enter a folder path');
      return;
    }
    
    this.isScanning.set(true);
    this.addLog(`📂 Scanning folder: ${this.folderPath}`);
    
    try {
      const response = await fetch('/api/v1/daily-login/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: this.folderPath })
      });
      const result = await response.json();
      
      if (result.success) {
        this.addLog(`✅ Found ${result.total_accounts} account files`);
        this.refreshStatus();
      } else {
        this.addLog(`❌ ${result.message}`);
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    } finally {
      this.isScanning.set(false);
    }
  }

  async browseFolder(): Promise<void> {
    this.isBrowsing.set(true);
    this.addLog('📂 Opening folder picker...');
    
    try {
      const response = await fetch('/api/v1/browse-folder');
      const result = await response.json();
      
      if (result.success && result.folder_path) {
        this.folderPath = result.folder_path;
        this.addLog(`✅ Selected: ${result.folder_path}`);
        // Auto-scan after selecting folder
        await this.scanFolder();
      } else {
        this.addLog('ℹ️ No folder selected');
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    } finally {
      this.isBrowsing.set(false);
    }
  }

  async start(): Promise<void> {
    this.addLog('🚀 Starting Daily Login...');
    
    try {
      const response = await fetch('/api/v1/daily-login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      this.addLog(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  async stop(): Promise<void> {
    this.addLog('🛑 Stopping Daily Login...');
    
    try {
      const response = await fetch('/api/v1/daily-login/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      this.addLog(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  async saveSettings(): Promise<void> {
    try {
      const response = await fetch('/api/v1/daily-login/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.settings)
      });
      const result = await response.json();
      
      this.addLog(result.success ? '✅ Settings saved' : `❌ ${result.message}`);
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  async toggleAutoClaim(): Promise<void> {
    const newValue = !this.settings.auto_claim_enabled;
    this.settings.auto_claim_enabled = newValue;
    
    try {
      const response = await fetch(`/api/v1/daily-login/auto-claim/${newValue}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      this.addLog(newValue ? '🎁 Auto claim enabled' : '🚫 Auto claim disabled');
    } catch (error) {
      // Revert on error
      this.settings.auto_claim_enabled = !newValue;
      this.addLog(`❌ Error: ${error}`);
    }
  }

  private async refreshStatus(): Promise<void> {
    try {
      const response = await fetch('/api/v1/daily-login/status');
      const status = await response.json();
      this.status.set(status);
      
      // Auto-refresh screen when running
      if (status.state === 'running' && !this.screenInterval) {
        this.startScreenRefresh();
      } else if (status.state !== 'running' && this.screenInterval) {
        this.stopScreenRefresh();
      }
    } catch (error) {
      // Silent fail for polling
    }
  }

  async refreshScreen(): Promise<void> {
    this.isRefreshingScreen.set(true);
    try {
      const response = await fetch('/api/v1/daily-login/screenshot');
      const result = await response.json();
      if (result.success && result.image) {
        this.screenImage.set(result.image);
      }
    } catch (error) {
      // Silent fail
    } finally {
      this.isRefreshingScreen.set(false);
    }
  }

  private screenInterval: any = null;

  private startScreenRefresh(): void {
    if (this.screenInterval) return;
    this.refreshScreen(); // Initial refresh
    this.screenInterval = setInterval(() => this.refreshScreen(), 3000);
    this.addLog('📱 Screen auto-refresh started');
  }

  private stopScreenRefresh(): void {
    if (this.screenInterval) {
      clearInterval(this.screenInterval);
      this.screenInterval = null;
    }
  }

  getAccountIcon(account: AccountInfo): string {
    if (this.status().current_account === account.filename) return '⏳';
    if (account.processed && account.success) return '✅';
    if (account.processed && !account.success) return '❌';
    return '📄';
  }

  private addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logs = this.logs();
    this.logs.set([...logs.slice(-49), `[${timestamp}] ${message}`]);
  }
}

