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
    <div class="dashboard container">
      <!-- Dashboard Header -->
      <div class="dashboard-header animate-fade-in">
        <div class="title-group">
          <h2>DEVICE <span class="text-gradient">COMMAND CENTER</span></h2>
          <p class="subtitle">Real-time monitoring and control system</p>
        </div>
        
        <div class="header-actions">
          <div class="stat-pill glass-panel">
            <span class="active-dot"></span>
            <span class="stat-value">{{ devices().length }}</span>
            <span class="stat-label">Online</span>
          </div>

          <button class="glass-button refresh-btn" (click)="refreshScreenshots()" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()">🔄</span> 
            {{ isLoading() ? 'SCANNING...' : 'REFRESH SYSTEM' }}
          </button>
        </div>
      </div>

      <!-- Loading State -->
      @if (isLoading() && devices().length === 0) {
        <div class="state-container glass-panel animate-fade-in">
          <div class="scanner-line"></div>
          <p>SCANNING NETWORK FOR DEVICES...</p>
        </div>
      } 
      
      <!-- Empty State -->
      @else if (devices().length === 0) {
        <div class="state-container empty-state glass-panel animate-fade-in">
          <div class="icon-ring">
            <span class="empty-icon">📡</span>
          </div>
          <h3>NO SIGNALS DETECTED</h3>
          <p>Verify ADB connections or initialize emulator instances.</p>
          <button class="glass-button primary-glow" (click)="refreshScreenshots()">
            INITIALIZE SCAN
          </button>
        </div>
      } 
      
      <!-- Device Grid -->
      @else {
        <div class="device-grid">
          @for (device of devices(); track device.serial) {
            <div 
              class="device-card glass-panel" 
              [class.active-run]="device.is_running"
              [class.offline]="device.status !== 'online'"
            >
              <!-- Card Header -->
              <div class="card-header">
                <span class="serial-code">{{ device.serial }}</span>
                <span class="status-badge" [class]="device.status">
                  <span class="status-dot"></span>
                  {{ device.status | uppercase }}
                </span>
              </div>

              <!-- Screen Preview -->
              <div class="screen-frame">
                @if (device.success && device.image) {
                  <img [src]="device.image" class="device-screen" alt="Screen" />
                } @else {
                  <div class="screen-offline">
                    <span class="offline-icon">📶</span>
                    <span>NO SIGNAL</span>
                  </div>
                }
                
                <!-- Overlays -->
                @if (device.is_running) {
                  <div class="active-overlay">
                    <div class="processing-bar">
                      <div class="bar-fill"></div>
                    </div>
                    <span class="task-tag">{{ getTaskLabel(device.task) | uppercase }}</span>
                  </div>
                }
                <div class="scanlines"></div>
                <div class="glare"></div>
              </div>

              <!-- Card Actions -->
              <div class="card-footer">
                <div class="status-info">
                  @if (device.is_running) {
                    <span class="info-active">▶ EXECUTING TASK</span>
                  } @else {
                    <span class="info-idle">💤 SYSTEM IDLE</span>
                  }
                </div>
                
                <div class="action-buttons">
                  <button class="icon-btn" (click)="goToDailyLogin(device.serial)" title="Schedule Login">
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
      padding-top: 2rem;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 1.5rem;
    }

    .title-group h2 {
      font-size: 2.2rem;
      margin-bottom: 0px;
      letter-spacing: 1px;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
      letter-spacing: 0.5px;
      margin-top: 0.25rem;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-pill);
      background: rgba(56, 189, 248, 0.05); /* Blue tint */
      border: 1px solid rgba(56, 189, 248, 0.15);
    }

    .active-dot {
      width: 8px; height: 8px;
      background: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--success);
      animation: pulseGreen 2s infinite;
    }

    .stat-value {
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--text-main);
      font-size: 1.1rem;
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }

    .refresh-btn {
      min-width: 170px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.6rem;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    /* --- States --- */
    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5rem 2rem;
      text-align: center;
      position: relative;
      overflow: hidden;
      min-height: 400px;
    }

    .scanner-line {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 2px;
      background: var(--primary);
      box-shadow: 0 0 15px var(--primary);
      animation: scanDown 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.7;
    }

    .icon-ring {
      width: 90px; height: 90px;
      border: 1px solid var(--glass-border);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 2rem;
      background: rgba(255, 255, 255, 0.02);
      box-shadow: 0 0 30px rgba(0,0,0,0.2);
    }

    .empty-icon {
      font-size: 3rem;
      opacity: 0.3;
      filter: grayscale(1);
    }

    /* --- Grid --- */
    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 2rem;
      animation: fadeIn 0.4s ease-out;
    }

    /* --- Device Card --- */
    .device-card {
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .device-card:hover {
      transform: translateY(-6px);
      border-color: rgba(56, 189, 248, 0.3);
      box-shadow: 0 12px 40px -10px rgba(0, 0, 0, 0.5);
    }

    .device-card.active-run {
      border-color: rgba(52, 211, 153, 0.3);
      box-shadow: 0 0 20px rgba(52, 211, 153, 0.05);
    }

    .card-header {
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid var(--glass-border);
    }

    .serial-code {
      font-family: 'Consolas', monospace;
      color: var(--text-main);
      font-size: 0.9rem;
      letter-spacing: 0.5px;
      opacity: 0.9;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.3rem 0.7rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255,255,255,0.05);
    }

    .status-badge.online {
      background: rgba(52, 211, 153, 0.1);
      border-color: rgba(52, 211, 153, 0.2);
      color: var(--success);
    }

    .status-badge.offline {
      background: rgba(251, 113, 133, 0.1);
      border-color: rgba(251, 113, 133, 0.2);
      color: var(--danger);
    }

    .status-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    
    .status-badge.online .status-dot {
      box-shadow: 0 0 6px currentColor;
    }

    /* Screen Frame */
    .screen-frame {
      position: relative;
      aspect-ratio: 16 / 9; /* Landscape */
      background: #000;
      margin: 1.25rem;
      border-radius: var(--radius-xs);
      overflow: hidden;
      border: 1px solid #1e293b;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
    }

    .device-screen {
      width: 100%; height: 100%;
      object-fit: contain;
      filter: contrast(1.1) brightness(1.1);
      opacity: 0.9;
    }

    /* Scanlines and Glare removed for clean view */

    .screen-offline {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      gap: 0.75rem;
    }

    .offline-icon {
      font-size: 2.5rem;
      opacity: 0.3;
    }

    /* Active Overlay */
    .active-overlay {
      position: absolute;
      top: 12px; right: 12px; left: 12px;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }

    .task-tag {
      background: rgba(0,0,0,0.8);
      color: var(--success);
      border: 1px solid var(--success);
      font-weight: 700;
      font-size: 0.65rem;
      padding: 3px 8px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }

    .processing-bar {
      width: 100%;
      height: 2px;
      background: rgba(255,255,255,0.1);
      overflow: hidden;
      border-radius: 2px;
    }

    .bar-fill {
      width: 30%;
      height: 100%;
      background: var(--success);
      box-shadow: 0 0 10px var(--success);
      animation: barLoad 1.5s infinite ease-in-out;
    }

    /* Card Footer */
    .card-footer {
      padding: 1rem 1.25rem;
      background: rgba(0,0,0,0.2);
      border-top: 1px solid var(--glass-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }

    .info-active {
      color: var(--success);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      display: flex; 
      align-items: center; 
      gap: 0.5rem;
    }

    .info-idle {
      color: var(--text-muted);
      font-size: 0.75rem;
    }

    .icon-btn {
      background: transparent;
      border: 1px solid var(--glass-border);
      color: var(--text-muted);
      width: 36px; height: 36px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(255,255,255,0.05);
        color: var(--text-main);
        border-color: rgba(255,255,255,0.1);
      }
    }

    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes scanDown { 0% { top: 0; opacity: 1; } 100% { top: 100%; opacity: 0; } }
    @keyframes barLoad { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
    @keyframes pulseGreen { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); } 70% { box-shadow: 0 0 0 6px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
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
