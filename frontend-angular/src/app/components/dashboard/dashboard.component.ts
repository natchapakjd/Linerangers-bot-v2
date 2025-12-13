import { Component, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface DeviceScreenshot {
  serial: string;
  status: string;
  task: string;
  is_running: boolean;
  screen_size?: string;
  success: boolean;
  image: string | null;
  message?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <h2>📺 Device Overview</h2>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="refreshScreenshots()">
            🔄 Refresh
          </button>
          <span class="device-count">{{ devices().length }} devices</span>
        </div>
      </div>

      @if (isLoading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading devices...</p>
        </div>
      } @else if (devices().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">📱</span>
          <h3>No Devices Found</h3>
          <p>Connect an emulator or device via ADB to get started</p>
          <button class="btn btn-primary" (click)="refreshScreenshots()">
            🔍 Scan for Devices
          </button>
        </div>
      } @else {
        <div class="device-grid">
          @for (device of devices(); track device.serial) {
            <div class="device-card" [class.offline]="device.status !== 'online'" [class.running]="device.is_running">
              <div class="device-header">
                <span class="device-serial">{{ device.serial }}</span>
                <span class="device-status" [class]="device.status">
                  {{ device.status === 'online' ? '🟢' : '🔴' }} {{ device.status }}
                </span>
              </div>
              
              <div class="screen-container">
                @if (device.success && device.image) {
                  <img [src]="device.image" class="screen-image" alt="Device Screen" />
                } @else {
                  <div class="screen-placeholder">
                    <span>📵</span>
                    <p>{{ device.message || 'No signal' }}</p>
                  </div>
                }
                
                @if (device.is_running) {
                  <div class="running-overlay">
                    <div class="pulse-ring"></div>
                    <span class="task-badge">{{ getTaskLabel(device.task) }}</span>
                  </div>
                }
              </div>
              
              <div class="device-footer">
                @if (device.is_running) {
                  <span class="status-running">▶️ {{ getTaskLabel(device.task) }}</span>
                } @else if (device.task !== 'none') {
                  <span class="status-assigned">⏸️ {{ getTaskLabel(device.task) }} (paused)</span>
                } @else {
                  <span class="status-idle">💤 Idle</span>
                }
                
                <div class="device-actions">
                  <button class="btn-icon" (click)="goToDailyLogin(device.serial)" title="Daily Login">
                    📅
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 1rem;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .dashboard-header h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .device-count {
      color: #64748b;
      font-size: 0.9rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
    }

    .btn-secondary {
      background: white;
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    /* Grid Layout */
    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    /* Device Card */
    .device-card {
      background: white;
      border: 1px solid rgba(59, 130, 246, 0.15);
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }

    .device-card:hover {
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.15);
      transform: translateY(-2px);
    }

    .device-card.running {
      border-color: rgba(34, 197, 94, 0.5);
      box-shadow: 0 4px 20px rgba(34, 197, 94, 0.15);
    }

    .device-card.offline {
      opacity: 0.6;
    }

    /* Device Header */
    .device-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .device-serial {
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      font-size: 0.85rem;
      color: white;
    }

    .device-status {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    /* Screen Container */
    .screen-container {
      position: relative;
      aspect-ratio: 9 / 16;
      max-height: 400px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .screen-placeholder {
      text-align: center;
      color: #64748b;
    }

    .screen-placeholder span {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    .screen-placeholder p {
      font-size: 0.8rem;
    }

    /* Running Overlay */
    .running-overlay {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .pulse-ring {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
      70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }

    .task-badge {
      background: rgba(34, 197, 94, 0.9);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 5px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    /* Device Footer */
    .device-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #f8fafc;
      border-top: 1px solid rgba(59, 130, 246, 0.1);
    }

    .status-running {
      color: #22c55e;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .status-assigned {
      color: #f59e0b;
      font-size: 0.85rem;
    }

    .status-idle {
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .device-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-icon {
      background: rgba(59, 130, 246, 0.1);
      border: none;
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-icon:hover {
      background: rgba(59, 130, 246, 0.2);
    }

    /* Empty & Loading States */
    .empty-state, .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      text-align: center;
      background: white;
      border-radius: 16px;
      border: 1px solid rgba(59, 130, 246, 0.15);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: #1e3a8a;
    }

    .empty-state p {
      color: #64748b;
      margin-bottom: 1.5rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  
  devices = signal<DeviceScreenshot[]>([]);
  isLoading = signal(false);
  
  private refreshInterval: any;

  ngOnInit(): void {
    this.refreshScreenshots();
    // Auto-refresh every 5 seconds
    this.refreshInterval = setInterval(() => this.refreshScreenshots(), 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async refreshScreenshots(): Promise<void> {
    if (this.isLoading()) return;
    
    this.isLoading.set(true);
    
    try {
      const response = await fetch('/api/v1/devices/screenshots/all');
      const data = await response.json();
      
      if (data.success) {
        this.devices.set(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch screenshots:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  getTaskLabel(task: string): string {
    const labels: Record<string, string> = {
      'none': 'Idle',
      'daily_login': 'Daily Login',
      're_id': 'Re-ID'
    };
    return labels[task] || task;
  }

  goToDailyLogin(serial: string): void {
    this.router.navigate(['/daily-login'], { queryParams: { device: serial } });
  }
}
