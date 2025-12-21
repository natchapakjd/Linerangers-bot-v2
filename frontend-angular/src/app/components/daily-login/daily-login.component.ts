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
  running_on_device?: string;  // Shows which device is processing this account
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

interface DevicePreview {
  serial: string;
  status: string;
  image: string | null;
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
            [class.processing]="account.running_on_device"
            [class.success]="account.processed && account.success"
            [class.failed]="account.processed && !account.success"
          >
            <span class="account-index">{{ i + 1 }}</span>
            <span class="account-icon">
              {{ getAccountIcon(account) }}
            </span>
            <span class="account-name">{{ account.filename }}</span>
            <!-- Show device serial if running -->
            <span class="device-badge" *ngIf="account.running_on_device">
              📱 {{ account.running_on_device }}
            </span>
            <span class="account-status" *ngIf="account.processed">
              {{ account.success ? '✓' : '✗' }}
            </span>
            <button 
              class="btn-bugged" 
              (click)="markAsBugged(account)" 
              title="Mark as bugged & delete"
              [disabled]="status().state === 'running'"
            >
              🗑️
            </button>
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
            
            <!-- Move to Done Toggle -->
            <div class="toggle-section">
              <label class="toggle-label">
                <span class="toggle-text">📁 Move to Done Folder</span>
                <div class="toggle-switch" [class.active]="settings.move_on_complete" (click)="toggleMoveOnComplete()">
                  <div class="toggle-slider"></div>
                </div>
              </label>
              <p class="toggle-hint">Move processed files to done folder after completion</p>
              
              <!-- Done Folder Path (shown when move is enabled) -->
              <div class="done-folder-input" *ngIf="settings.move_on_complete">
                <div class="folder-input-group">
                  <input 
                    type="text" 
                    [(ngModel)]="settings.done_folder"
                    placeholder="Leave empty for auto (done subfolder)"
                    class="folder-input"
                  />
                  <button 
                    class="btn btn-secondary btn-small" 
                    (click)="browseDoneFolder()"
                    [disabled]="isBrowsingDone()"
                  >
                    {{ isBrowsingDone() ? '⏳' : '📁' }} Browse
                  </button>
                </div>
                <p class="folder-hint">{{ settings.done_folder ? settings.done_folder : 'Auto: creates "done" subfolder in source folder' }}</p>
              </div>
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

      <!-- Find Duplicates Tool -->
      <div class="card duplicates-section">
        <h3>🔍 Find Duplicates Tool</h3>
        <p class="hint-text">เปรียบเทียบไฟล์ XML ระหว่าง 2 folders - ถ้าพบไฟล์ซ้ำใน Folder B จะลบออก</p>
        
        <div class="duplicates-form">
          <div class="folder-row">
            <label>📂 Folder A (Master - ไม่ลบ)</label>
            <div class="folder-input-group">
              <input 
                type="text" 
                [(ngModel)]="duplicateFolderA"
                placeholder="Folder A path..."
                class="folder-input"
              />
              <button 
                class="btn btn-secondary btn-small" 
                (click)="browseDuplicateFolderA()"
                [disabled]="isBrowsingDupA()"
              >
                {{ isBrowsingDupA() ? '⏳' : '📁' }}
              </button>
            </div>
          </div>
          
          <div class="folder-row">
            <label>📂 Folder B (จะลบไฟล์ซ้ำ)</label>
            <div class="folder-input-group">
              <input 
                type="text" 
                [(ngModel)]="duplicateFolderB"
                placeholder="Folder B path..."
                class="folder-input"
              />
              <button 
                class="btn btn-secondary btn-small" 
                (click)="browseDuplicateFolderB()"
                [disabled]="isBrowsingDupB()"
              >
                {{ isBrowsingDupB() ? '⏳' : '📁' }}
              </button>
            </div>
          </div>
          
          <div class="duplicates-actions">
            <button 
              class="btn btn-primary" 
              (click)="findDuplicates(true)"
              [disabled]="isFindingDuplicates() || !duplicateFolderA || !duplicateFolderB"
            >
              {{ isFindingDuplicates() ? '⏳ Checking...' : '🔍 Preview (Dry Run)' }}
            </button>
            <button 
              class="btn btn-danger" 
              (click)="findDuplicates(false)"
              [disabled]="isFindingDuplicates() || !duplicateFolderA || !duplicateFolderB"
            >
              🗑️ Find & Delete
            </button>
          </div>
        </div>
        
        <!-- Duplicates Result -->
        <div class="duplicates-result" *ngIf="duplicatesResult">
          <div class="result-summary" [class.success]="duplicatesResult.success" [class.error]="!duplicatesResult.success">
            <span>{{ duplicatesResult.message }}</span>
          </div>
          
          <div class="result-stats" *ngIf="duplicatesResult.success">
            <span>📂 A: {{ duplicatesResult.folder_a_count }} files</span>
            <span>📂 B: {{ duplicatesResult.folder_b_count }} files</span>
            <span>🔄 Duplicates: {{ duplicatesResult.duplicates_found }}</span>
            <span>🗑️ {{ duplicatesResult.dry_run ? 'Would remove' : 'Removed' }}: {{ duplicatesResult.removed_count }}</span>
          </div>
          
          <!-- Duplicate Files List -->
          <div class="duplicates-list" *ngIf="duplicatesResult.duplicates?.length > 0">
            <div class="duplicate-item" *ngFor="let dup of duplicatesResult.duplicates">
              <span class="dup-file-b">{{ dup.file_b_name }}</span>
              <span class="dup-arrow">==</span>
              <span class="dup-file-a">{{ dup.matches_with_name }}</span>
            </div>
          </div>
          
          <!-- Errors -->
          <div class="duplicates-errors" *ngIf="duplicatesResult.errors?.length > 0">
            <div class="error-item" *ngFor="let err of duplicatesResult.errors">⚠️ {{ err }}</div>
          </div>
        </div>
      </div>

      <!-- Export Account Tool -->
      <div class="card export-section">
        <h3>📤 Export Account Tool</h3>
        <p class="hint-text">ดึงไฟล์ account XML จาก device ที่เลือก และบันทึกเป็นไฟล์ใหม่</p>
        
        <!-- Device Preview Grid -->
        <div class="device-preview-header">
          <span>📱 Preview All Devices</span>
          <button 
            class="btn btn-secondary btn-small" 
            (click)="refreshAllDeviceScreenshots()"
            [disabled]="isRefreshingScreenshots()"
          >
            {{ isRefreshingScreenshots() ? '⏳ Loading...' : '🔄 Refresh All' }}
          </button>
        </div>
        
        <div class="device-preview-grid">
          @for (preview of devicePreviews(); track preview.serial) {
            <div 
              class="device-preview-card"
              [class.selected]="exportDeviceSerial === preview.serial"
              [class.offline]="preview.status !== 'online'"
              (click)="selectDeviceForExport(preview.serial)"
            >
              <div class="preview-header">
                <span class="device-name">{{ preview.serial }}</span>
                <span class="status-dot" [class.online]="preview.status === 'online'"></span>
              </div>
              <div class="preview-screen">
                @if (preview.image) {
                  <img [src]="preview.image" alt="Device screenshot" />
                } @else if (preview.status !== 'online') {
                  <div class="no-preview">🔴 Offline</div>
                } @else {
                  <div class="no-preview">📸 Click Refresh</div>
                }
              </div>
              @if (exportDeviceSerial === preview.serial) {
                <div class="selected-badge">✓ Selected</div>
              }
            </div>
          }
        </div>
        
        <div class="export-form">
          <!-- Selected Device Info -->
          <div class="folder-row" *ngIf="exportDeviceSerial">
            <label>📱 Selected Device</label>
            <div class="selected-device-info">
              <span>{{ exportDeviceSerial }}</span>
              <button class="btn-clear" (click)="exportDeviceSerial = ''">✕</button>
            </div>
          </div>
          
          <!-- Save Folder -->
          <div class="folder-row">
            <label>📂 Save to Folder</label>
            <div class="folder-input-group">
              <input 
                type="text" 
                [(ngModel)]="exportSaveFolder"
                placeholder="Select folder to save..."
                class="folder-input"
              />
              <button 
                class="btn btn-secondary btn-small" 
                (click)="browseExportFolder()"
                [disabled]="isBrowsingExport()"
              >
                {{ isBrowsingExport() ? '⏳' : '📁' }}
              </button>
            </div>
          </div>
          
          <!-- Filename -->
          <div class="folder-row">
            <label>📝 Filename</label>
            <div class="filename-input-group">
              <input 
                type="text" 
                [(ngModel)]="exportFilename"
                placeholder="Enter filename (e.g., my_account)"
                class="folder-input"
              />
              <span class="file-extension">.xml</span>
            </div>
          </div>
          
          <!-- Export Button -->
          <div class="export-actions">
            <button 
              class="btn btn-success" 
              (click)="exportAccount()"
              [disabled]="isExporting() || !exportDeviceSerial || !exportSaveFolder || !exportFilename"
            >
              {{ isExporting() ? '⏳ Exporting...' : '💾 Export Account' }}
            </button>
          </div>
        </div>
        
        <!-- Export Result -->
        <div class="export-result" *ngIf="exportResult">
          <div class="result-summary" [class.success]="exportResult.success" [class.error]="!exportResult.success">
            <span>{{ exportResult.message }}</span>
          </div>
          <div class="export-path" *ngIf="exportResult.success && exportResult.filepath">
            <span>📁 Saved to: {{ exportResult.filepath }}</span>
          </div>
        </div>
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
          class="btn btn-primary btn-large" 
          (click)="resumeOnSelectedDevices()"
          [disabled]="status().state === 'running' || status().processed_count === 0 || getSelectedCount() === 0"
        >
          ▶️ RESUME
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

    .btn-bugged {
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
      opacity: 0.6;
    }

    .btn-bugged:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      opacity: 1;
    }

    .btn-bugged:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .device-badge {
      background: rgba(139, 92, 246, 0.2);
      border: 1px solid rgba(139, 92, 246, 0.4);
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
      font-size: 0.7rem;
      color: #a78bfa;
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
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

    .done-folder-input {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .done-folder-input .folder-input-group {
      display: flex;
      gap: 0.5rem;
    }

    .done-folder-input .folder-input {
      flex: 1;
      font-size: 0.85rem;
    }

    .folder-hint {
      font-size: 0.7rem;
      color: #64748b;
      margin-top: 0.5rem;
      margin-bottom: 0;
      font-style: italic;
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

    /* Find Duplicates Section */
    .duplicates-section {
      margin-top: 1rem;
    }

    .duplicates-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .folder-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .folder-row label {
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .duplicates-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .duplicates-result {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .result-summary {
      padding: 0.75rem;
      border-radius: 6px;
      font-weight: 500;
      margin-bottom: 0.75rem;
    }

    .result-summary.success {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
    }

    .result-summary.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }

    .result-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 0.75rem;
    }

    .duplicates-list {
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .duplicate-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .dup-file-b {
      color: #ef4444;
      font-family: 'JetBrains Mono', monospace;
    }

    .dup-arrow {
      color: #64748b;
    }

    .dup-file-a {
      color: #10b981;
      font-family: 'JetBrains Mono', monospace;
    }

    .duplicates-errors {
      margin-top: 0.75rem;
    }

    .error-item {
      padding: 0.5rem;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 4px;
      font-size: 0.8rem;
      color: #ef4444;
      margin-bottom: 0.25rem;
    }

    /* Export Account Section */
    .export-section {
      margin-top: 1rem;
    }

    .export-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .device-select {
      width: 100%;
      padding: 0.75rem 1rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      color: white;
      font-size: 0.9rem;
      cursor: pointer;
    }

    .device-select:focus {
      outline: none;
      border-color: #00f5ff;
      box-shadow: 0 0 10px rgba(0, 245, 255, 0.2);
    }

    .device-select option {
      background: #1a1a2e;
      color: white;
    }

    .filename-input-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filename-input-group .folder-input {
      flex: 1;
    }

    .file-extension {
      color: #00f5ff;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
    }

    .export-actions {
      margin-top: 0.5rem;
    }

    .export-result {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .export-path {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
      word-break: break-all;
    }

    /* Device Preview Grid */
    .device-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(0, 245, 255, 0.1);
    }

    .device-preview-header span {
      font-size: 0.9rem;
      color: #94a3b8;
    }

    .device-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .device-preview-card {
      background: rgba(0, 0, 0, 0.3);
      border: 2px solid rgba(100, 100, 255, 0.2);
      border-radius: 10px;
      padding: 0.75rem;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .device-preview-card:hover:not(.offline) {
      border-color: rgba(0, 245, 255, 0.4);
      transform: translateY(-2px);
    }

    .device-preview-card.selected {
      border-color: #00f5ff;
      background: rgba(0, 245, 255, 0.1);
      box-shadow: 0 0 15px rgba(0, 245, 255, 0.2);
    }

    .device-preview-card.offline {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .device-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: #e2e8f0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      flex-shrink: 0;
    }

    .status-dot.online {
      background: #22c55e;
    }

    .preview-screen {
      aspect-ratio: 9/16;
      background: #0a0a0f;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-screen img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .no-preview {
      color: #64748b;
      font-size: 0.75rem;
      text-align: center;
    }

    .selected-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #00f5ff;
      color: #0a0a0f;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .selected-device-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(0, 245, 255, 0.1);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      color: #00f5ff;
      font-family: 'JetBrains Mono', monospace;
    }

    .selected-device-info span {
      flex: 1;
    }

    .btn-clear {
      background: transparent;
      border: none;
      color: #ef4444;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .btn-clear:hover {
      background: rgba(239, 68, 68, 0.2);
    }
  `]
})
export class DailyLoginComponent implements OnInit, OnDestroy {
  folderPath = '';
  isScanning = signal(false);
  isBrowsing = signal(false);
  isBrowsingDone = signal(false);
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
    auto_claim_enabled: true,
    move_on_complete: true,
    done_folder: ''
  };
  
  private statusInterval: any;
  
  // Find Duplicates properties
  duplicateFolderA = '';
  duplicateFolderB = '';
  isBrowsingDupA = signal(false);
  isBrowsingDupB = signal(false);
  isFindingDuplicates = signal(false);
  duplicatesResult: any = null;

  // Export Account properties
  exportDeviceSerial = '';
  exportSaveFolder = '';
  exportFilename = '';
  isBrowsingExport = signal(false);
  isExporting = signal(false);
  exportResult: any = null;

  // Device Preview properties
  devicePreviews = signal<DevicePreview[]>([]);
  isRefreshingScreenshots = signal(false);
  
  private readonly STORAGE_KEY = 'daily_login_state';
  
  ngOnInit(): void {
    this.loadStateFromStorage(); // Load saved state first
    this.refreshDevices();
    this.refreshStatus();
    this.refreshAllDeviceScreenshots(); // Load device previews on init
    // Poll status every 2 seconds
    this.statusInterval = setInterval(() => this.refreshStatus(), 2000);
  }

  // ===== State Persistence =====
  
  private loadStateFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        
        // Restore folder paths
        this.folderPath = state.folderPath || '';
        this.duplicateFolderA = state.duplicateFolderA || '';
        this.duplicateFolderB = state.duplicateFolderB || '';
        this.exportSaveFolder = state.exportSaveFolder || '';
        this.exportDeviceSerial = state.exportDeviceSerial || '';
        
        // Restore settings
        if (state.settings) {
          this.settings = {
            ...this.settings,
            ...state.settings
          };
        }
        
        console.log('✅ State loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading state from localStorage:', error);
    }
  }
  
  private saveStateToStorage(): void {
    try {
      const state = {
        folderPath: this.folderPath,
        duplicateFolderA: this.duplicateFolderA,
        duplicateFolderB: this.duplicateFolderB,
        exportSaveFolder: this.exportSaveFolder,
        exportDeviceSerial: this.exportDeviceSerial,
        settings: this.settings
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state to localStorage:', error);
    }
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
    
    if (!this.folderPath) {
      this.addLog('❌ No folder path set. Scan folder first.');
      return;
    }
    
    this.addLog(`🚀 Starting Multi-Device Parallel Processing...`);
    this.addLog(`📂 Folder: ${this.folderPath}`);
    this.addLog(`📱 Devices: ${selected.map(d => d.serial).join(', ')}`);
    
    try {
      // Step 1: Scan folder into shared queue
      this.addLog('📂 Loading accounts into shared queue...');
      const scanResponse = await fetch('/api/v1/multi-device/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: this.folderPath })
      });
      const scanResult = await scanResponse.json();
      
      if (!scanResult.success) {
        this.addLog(`❌ Failed to load accounts: ${scanResult.message}`);
        return;
      }
      
      this.addLog(`✅ Loaded ${scanResult.total_accounts} accounts into shared queue`);
      
      // Step 2: Start multi-device processing
      const startResponse = await fetch('/api/v1/multi-device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_serials: selected.map(d => d.serial),
          mode_name: 'daily-login'
        })
      });
      const startResult = await startResponse.json();
      
      if (startResult.success) {
        this.addLog(`✅ ${startResult.message}`);
        this.addLog(`⏳ ${selected.length} devices now processing ${scanResult.total_accounts} accounts in parallel!`);
        
        // Start polling for multi-device status
        this.startMultiDeviceStatusPolling();
      } else {
        this.addLog(`❌ ${startResult.message}`);
      }
      
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
    
    this.refreshDevices();
  }
  
  async resumeOnSelectedDevices(): Promise<void> {
    const selected = this.getSelectedDevices();
    if (selected.length === 0) {
      this.addLog('❌ No devices selected');
      return;
    }
    
    this.addLog(`▶️ Resuming on ${selected.length} device(s)...`);
    
    try {
      const resumeResponse = await fetch('/api/v1/multi-device/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_serials: selected.map(d => d.serial),
          mode_name: 'daily-login'
        })
      });
      const resumeResult = await resumeResponse.json();
      
      if (resumeResult.success) {
        this.addLog(`✅ ${resumeResult.message}`);
        this.startMultiDeviceStatusPolling();
      } else {
        this.addLog(`❌ ${resumeResult.message}`);
      }
      
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
    
    this.refreshDevices();
  }
  
  private multiDeviceStatusInterval: any = null;
  
  startMultiDeviceStatusPolling(): void {
    if (this.multiDeviceStatusInterval) {
      clearInterval(this.multiDeviceStatusInterval);
    }
    
    this.multiDeviceStatusInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/v1/multi-device/status');
        const status = await response.json();
        
        // Update status from multi-device status
        this.status.update(s => ({
          ...s,
          state: status.state,
          total_accounts: status.total_accounts,
          processed_count: status.processed_count,
          message: `${status.processed_count}/${status.total_accounts} accounts processed`,
          accounts: status.accounts || []
        }));
        
        // Log device progress
        if (status.devices && status.devices.length > 0) {
          for (const device of status.devices) {
            if (device.is_running && device.current_account) {
              // Device is working on an account
            }
          }
        }
        
        // Stop polling when completed or idle
        if (status.state === 'completed' || status.state === 'idle') {
          this.addLog(`🏁 Multi-device processing ${status.state}!`);
          this.addLog(`📊 Total: ${status.processed_count}/${status.total_accounts}`);
          
          // Log per-device stats
          for (const device of status.devices || []) {
            this.addLog(`📱 ${device.serial}: ${device.success_count} success, ${device.error_count} errors`);
          }
          
          this.stopMultiDeviceStatusPolling();
          this.refreshDevices();
        }
      } catch (error) {
        console.error('Error polling multi-device status:', error);
      }
    }, 2000); // Poll every 2 seconds
  }
  
  stopMultiDeviceStatusPolling(): void {
    if (this.multiDeviceStatusInterval) {
      clearInterval(this.multiDeviceStatusInterval);
      this.multiDeviceStatusInterval = null;
    }
  }

  ngOnDestroy(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    this.stopMultiDeviceStatusPolling();
  }

  async scanFolder(): Promise<void> {
    if (!this.folderPath.trim()) {
      this.addLog('❌ Please enter a folder path');
      return;
    }
    
    this.isScanning.set(true);
    this.addLog(`📂 Scanning folder: ${this.folderPath}`);
    
    try {
      // Use multi-device scan to populate shared queue
      const response = await fetch('/api/v1/multi-device/scan', {
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
    this.addLog('🛑 Stopping all devices...');
    
    try {
      // Stop multi-device processing
      const multiResponse = await fetch('/api/v1/multi-device/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const multiResult = await multiResponse.json();
      
      this.addLog(multiResult.success ? `✅ ${multiResult.message}` : `⚠️ Multi-device: ${multiResult.message}`);
      
      // Also stop single-device (legacy) if running
      const response = await fetch('/api/v1/daily-login/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Stop polling
      this.stopMultiDeviceStatusPolling();
      
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
    
    this.refreshDevices();
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

  async toggleMoveOnComplete(): Promise<void> {
    const newValue = !this.settings.move_on_complete;
    this.settings.move_on_complete = newValue;
    
    try {
      const response = await fetch('/api/v1/multi-device/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          move_on_complete: newValue,
          done_folder: this.settings.done_folder 
        })
      });
      const result = await response.json();
      
      this.addLog(newValue ? '📁 Move to done folder enabled' : '📁 Move to done folder disabled');
    } catch (error) {
      // Revert on error
      this.settings.move_on_complete = !newValue;
      this.addLog(`❌ Error: ${error}`);
    }
  }

  async browseDoneFolder(): Promise<void> {
    this.isBrowsingDone.set(true);
    this.addLog('📂 Opening folder picker for done folder...');
    
    try {
      const response = await fetch('/api/v1/browse-folder');
      const result = await response.json();
      
      if (result.success && result.folder_path) {
        this.settings.done_folder = result.folder_path;
        this.addLog(`✅ Done folder: ${result.folder_path}`);
        
        // Save the setting immediately
        await this.saveDoneFolderSetting();
      } else {
        this.addLog('ℹ️ No folder selected');
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    } finally {
      this.isBrowsingDone.set(false);
    }
  }

  private async saveDoneFolderSetting(): Promise<void> {
    try {
      const response = await fetch('/api/v1/multi-device/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          move_on_complete: this.settings.move_on_complete,
          done_folder: this.settings.done_folder 
        })
      });
      const result = await response.json();
      this.addLog(`✅ ${result.message}`);
    } catch (error) {
      this.addLog(`❌ Error saving: ${error}`);
    }
  }

  async markAsBugged(account: AccountInfo): Promise<void> {
    // Confirmation dialog
    if (!confirm(`⚠️ Are you sure you want to delete "${account.filename}"?\n\nThis action cannot be undone!`)) {
      return;
    }
    
    this.addLog(`🗑️ Deleting bugged file: ${account.filename}...`);
    
    try {
      const response = await fetch(`/api/v1/multi-device/account/${encodeURIComponent(account.filename)}/mark-bugged`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.success) {
        this.addLog(`✅ Deleted: ${account.filename}`);
        // Refresh status to update the list
        this.refreshStatus();
      } else {
        this.addLog(`❌ ${result.message}`);
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error}`);
    }
  }

  private async refreshStatus(): Promise<void> {
    try {
      // Use multi-device status for accurate state
      const response = await fetch('/api/v1/multi-device/status');
      const multiStatus = await response.json();
      
      // Update status from multi-device endpoint
      this.status.update(s => ({
        ...s,
        state: multiStatus.state,
        folder_path: multiStatus.folder_path || s.folder_path,
        total_accounts: multiStatus.total_accounts,
        processed_count: multiStatus.processed_count,
        message: multiStatus.total_accounts > 0 
          ? `${multiStatus.processed_count}/${multiStatus.total_accounts} accounts processed`
          : s.message,
        accounts: multiStatus.accounts || s.accounts
      }));
      
      // Sync move_on_complete setting
      if (multiStatus.move_on_complete !== undefined) {
        this.settings.move_on_complete = multiStatus.move_on_complete;
      }
      // Sync done_folder (server returns "auto (...)" for empty)
      if (multiStatus.done_folder !== undefined && !multiStatus.done_folder.startsWith('auto')) {
        this.settings.done_folder = multiStatus.done_folder;
      }
      
      // Auto-refresh screen when running
      if (multiStatus.state === 'running' && !this.screenInterval) {
        this.startScreenRefresh();
      } else if (multiStatus.state !== 'running' && this.screenInterval) {
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

  // ===== Find Duplicates Methods =====

  async browseDuplicateFolderA(): Promise<void> {
    this.isBrowsingDupA.set(true);
    try {
      const response = await fetch('/api/v1/browse-folder');
      const data = await response.json();
      if (data.success && data.folder_path) {
        this.duplicateFolderA = data.folder_path;
        this.addLog(`📂 Folder A selected: ${data.folder_path}`);
        this.saveStateToStorage();
      }
    } catch (error) {
      console.error('Error browsing folder A:', error);
    } finally {
      this.isBrowsingDupA.set(false);
    }
  }

  async browseDuplicateFolderB(): Promise<void> {
    this.isBrowsingDupB.set(true);
    try {
      const response = await fetch('/api/v1/browse-folder');
      const data = await response.json();
      if (data.success && data.folder_path) {
        this.duplicateFolderB = data.folder_path;
        this.addLog(`📂 Folder B selected: ${data.folder_path}`);
        this.saveStateToStorage();
      }
    } catch (error) {
      console.error('Error browsing folder B:', error);
    } finally {
      this.isBrowsingDupB.set(false);
    }
  }

  async findDuplicates(dryRun: boolean): Promise<void> {
    if (!this.duplicateFolderA || !this.duplicateFolderB) {
      this.addLog('⚠️ Please select both Folder A and Folder B');
      return;
    }

    this.isFindingDuplicates.set(true);
    this.duplicatesResult = null;
    this.addLog(`🔍 ${dryRun ? 'Previewing' : 'Finding and deleting'} duplicates...`);

    try {
      const response = await fetch('/api/v1/daily-login/find-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_a: this.duplicateFolderA,
          folder_b: this.duplicateFolderB,
          dry_run: dryRun
        })
      });

      const result = await response.json();
      this.duplicatesResult = result;

      if (result.success) {
        if (dryRun) {
          this.addLog(`🔍 Preview: found ${result.duplicates_found} duplicates, ${result.removed_count} would be removed`);
        } else {
          this.addLog(`✅ Removed ${result.removed_count} duplicate files from Folder B`);
        }
      } else {
        this.addLog(`❌ Error: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error finding duplicates:', error);
      this.addLog(`❌ Error: ${error}`);
      this.duplicatesResult = {
        success: false,
        message: `Error: ${error}`,
        errors: [`${error}`]
      };
    } finally {
      this.isFindingDuplicates.set(false);
    }
  }

  // ===== Export Account Methods =====

  async browseExportFolder(): Promise<void> {
    this.isBrowsingExport.set(true);
    try {
      const response = await fetch('/api/v1/browse-folder');
      const data = await response.json();
      if (data.success && data.folder_path) {
        this.exportSaveFolder = data.folder_path;
        this.addLog(`📂 Export folder selected: ${data.folder_path}`);
        this.saveStateToStorage();
      }
    } catch (error) {
      console.error('Error browsing export folder:', error);
    } finally {
      this.isBrowsingExport.set(false);
    }
  }

  async exportAccount(): Promise<void> {
    if (!this.exportDeviceSerial || !this.exportSaveFolder || !this.exportFilename) {
      this.addLog('⚠️ Please fill in all fields');
      return;
    }

    this.isExporting.set(true);
    this.exportResult = null;
    this.addLog(`📤 Exporting account from ${this.exportDeviceSerial}...`);

    try {
      const response = await fetch('/api/v1/daily-login/export-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          save_folder: this.exportSaveFolder,
          filename: this.exportFilename,
          device_serial: this.exportDeviceSerial
        })
      });

      const result = await response.json();
      this.exportResult = result;

      if (result.success) {
        this.addLog(`✅ ${result.message}`);
        // Clear filename for next export
        this.exportFilename = '';
      } else {
        this.addLog(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error exporting account:', error);
      this.addLog(`❌ Error: ${error}`);
      this.exportResult = {
        success: false,
        message: `Error: ${error}`
      };
    } finally {
      this.isExporting.set(false);
    }
  }

  // ===== Device Preview Methods =====

  selectDeviceForExport(serial: string): void {
    const previews = this.devicePreviews();
    const device = previews.find(p => p.serial === serial);
    if (device && device.status === 'online') {
      this.exportDeviceSerial = serial;
      this.addLog(`📱 Selected device: ${serial}`);
      this.saveStateToStorage();
    }
  }

  async refreshAllDeviceScreenshots(): Promise<void> {
    this.isRefreshingScreenshots.set(true);
    this.addLog('📸 Refreshing all device screenshots...');

    try {
      const response = await fetch('/api/v1/devices/screenshots/all');
      const data = await response.json();

      if (data.success) {
        const previews: DevicePreview[] = data.devices.map((d: any) => ({
          serial: d.serial,
          status: d.status,
          image: d.success ? d.image : null
        }));
        this.devicePreviews.set(previews);
        this.addLog(`✅ Loaded ${previews.length} device screenshots`);
      }
    } catch (error) {
      console.error('Error refreshing screenshots:', error);
      this.addLog(`❌ Error loading screenshots: ${error}`);
    } finally {
      this.isRefreshingScreenshots.set(false);
    }
  }
}

