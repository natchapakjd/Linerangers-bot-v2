import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="settings-page">
      <h2 class="page-title">⚙️ Settings</h2>
      
      <!-- Master Workflow Section -->
      <div class="card workflow-section">
        <div class="section-header">
          <h3>🔧 Master Workflow</h3>
          <span class="status-badge" [class.active]="masterWorkflow()">
            {{ masterWorkflow() ? '✅ Set' : '⚠️ Not Set' }}
          </span>
        </div>
        
        <p class="section-desc">
          กำหนด Master Workflow สำหรับใช้เป็น automation template หลัก
        </p>
        
        @if (masterWorkflow()) {
          <div class="master-info">
            <span class="master-icon">⭐</span>
            <span class="master-name">{{ masterWorkflow().name }}</span>
            <span class="master-steps">{{ masterWorkflow().steps?.length || 0 }} steps</span>
          </div>
        }
        
        <button class="btn btn-primary" (click)="goToWorkflowBuilder()">
          🔧 Open Workflow Builder
        </button>
      </div>
      
      <!-- Remote Access Section -->
      <div class="card remote-section">
        <div class="section-header">
          <h3>🌐 Remote Access</h3>
          <span class="status-badge" [class.active]="isConnected()">
            {{ isConnected() ? '🟢 Active' : '⚫ Inactive' }}
          </span>
        </div>
        
        <p class="section-desc">
          เปิด Remote Access เพื่อดู Dashboard จากมือถือหรือคอมเครื่องอื่น
        </p>
        
        @if (!isConnected()) {
          <button 
            class="btn btn-primary" 
            (click)="startTunnel()"
            [disabled]="isLoading()"
          >
            {{ isLoading() ? '⏳ Starting...' : '🚀 Start Remote Access' }}
          </button>
        } @else {
          <div class="remote-info">
            <div class="url-section">
              <label>Public URL:</label>
              <div class="url-box">
                <code>{{ publicUrl() }}</code>
                <button class="btn-copy" (click)="copyUrl()">📋 Copy</button>
              </div>
            </div>
            
            @if (qrCode()) {
              <div class="qr-section">
                <label>Scan with Mobile:</label>
                <img [src]="qrCode()" alt="QR Code" class="qr-image" />
              </div>
            }
            
            <button 
              class="btn btn-danger" 
              (click)="stopTunnel()"
              [disabled]="isLoading()"
            >
              🛑 Stop Remote Access
            </button>
          </div>
        }
        
        @if (message()) {
          <p class="message" [class.error]="isError()">{{ message() }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      padding: 1.5rem;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 1.5rem;
    }

    .card {
      background: white;
      border: 1px solid rgba(59, 130, 246, 0.15);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .section-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #1e3a8a;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      background: #f1f5f9;
      color: #64748b;
    }

    .status-badge.active {
      background: #dcfce7;
      color: #16a34a;
    }

    .section-desc {
      color: #64748b;
      margin-bottom: 1.5rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
    }

    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }

    /* Remote Info */
    .remote-info {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .url-section, .qr-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .url-section label, .qr-section label {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 600;
    }

    .url-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #f8fafc;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .url-box code {
      flex: 1;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      color: #3b82f6;
      font-size: 0.9rem;
      word-break: break-all;
    }

    .btn-copy {
      padding: 0.4rem 0.8rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-copy:hover {
      background: #1d4ed8;
    }

    .qr-image {
      width: 200px;
      height: 200px;
      border-radius: 10px;
      border: 2px solid rgba(59, 130, 246, 0.2);
    }

    .message {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 8px;
      background: #f0f9ff;
      color: #3b82f6;
      font-size: 0.9rem;
    }

    .message.error {
      background: #fef2f2;
      color: #ef4444;
    }

    /* Master Workflow */
    .workflow-section {
      margin-bottom: 1.5rem;
    }

    .master-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border-radius: 10px;
      margin-bottom: 1rem;
    }

    .master-icon {
      font-size: 1.5rem;
    }

    .master-name {
      font-weight: 600;
      color: #92400e;
      flex: 1;
    }

    .master-steps {
      background: rgba(0, 0, 0, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #78350f;
    }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  
  isConnected = signal(false);
  isLoading = signal(false);
  publicUrl = signal('');
  qrCode = signal('');
  message = signal('');
  isError = signal(false);
  masterWorkflow = signal<any>(null);
  
  private pollingInterval: any;

  ngOnInit(): void {
    this.checkStatus();
    this.loadMasterWorkflow();
    this.pollingInterval = setInterval(() => this.checkStatus(), 5000);
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  async checkStatus(): Promise<void> {
    try {
      const response = await fetch('/api/v1/remote/status');
      const data = await response.json();
      
      this.isConnected.set(data.is_running);
      this.publicUrl.set(data.public_url || '');
      this.qrCode.set(data.qr_code || '');
    } catch (error) {
      // Silent fail for polling
    }
  }

  async startTunnel(): Promise<void> {
    this.isLoading.set(true);
    this.message.set('');
    
    try {
      const response = await fetch('/api/v1/remote/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: 8000 })
      });
      const data = await response.json();
      
      if (data.success) {
        this.isConnected.set(true);
        this.publicUrl.set(data.public_url);
        this.message.set('✅ Remote access started!');
        this.isError.set(false);
        this.checkStatus(); // Get QR code
      } else {
        this.message.set(`❌ ${data.message}`);
        this.isError.set(true);
      }
    } catch (error) {
      this.message.set(`❌ Error: ${error}`);
      this.isError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async stopTunnel(): Promise<void> {
    this.isLoading.set(true);
    
    try {
      const response = await fetch('/api/v1/remote/stop', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        this.isConnected.set(false);
        this.publicUrl.set('');
        this.qrCode.set('');
        this.message.set('🔌 Remote access stopped');
        this.isError.set(false);
      }
    } catch (error) {
      this.message.set(`❌ Error: ${error}`);
      this.isError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  copyUrl(): void {
    navigator.clipboard.writeText(this.publicUrl())
      .then(() => {
        this.message.set('📋 URL copied to clipboard!');
        this.isError.set(false);
      })
      .catch(() => {
        this.message.set('❌ Failed to copy');
        this.isError.set(true);
      });
  }

  async loadMasterWorkflow(): Promise<void> {
    try {
      const response = await fetch('/api/v1/workflows/master');
      const data = await response.json();
      if (data.success && data.workflow) {
        this.masterWorkflow.set(data.workflow);
      }
    } catch (error) {
      // Silent fail
    }
  }

  goToWorkflowBuilder(): void {
    this.router.navigate(['/workflow-builder']);
  }
}
