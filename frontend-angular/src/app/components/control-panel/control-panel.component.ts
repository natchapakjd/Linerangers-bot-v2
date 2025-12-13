import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="control-panel">
      <div class="panel-header">
        <h2>🎛️ Controls</h2>
      </div>

      <!-- Status Card -->
      <div class="status-card">
        <div class="status-row">
          <span class="label">State:</span>
          <span class="value" [style.color]="stateColor()">{{ status().state.toUpperCase() }}</span>
        </div>
        <div class="status-row">
          <span class="label">ADB:</span>
          <span class="value">{{ status().adb_connected ? 'Connected ✓' : 'Not Connected' }}</span>
        </div>
        <div class="status-row">
          <span class="label">Action:</span>
          <span class="value">{{ status().current_action }}</span>
        </div>
        <div class="status-row">
          <span class="label">Loops:</span>
          <span class="value">{{ status().loop_count }}</span>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="control-buttons">
        <button class="btn btn-start" [disabled]="isRunning()" (click)="start()">
          <span class="btn-icon">▶</span>
          <span>START</span>
        </button>
        <button class="btn btn-pause" [disabled]="!isRunning() && !isPaused()" (click)="togglePause()">
          <span class="btn-icon">{{ isPaused() ? '▶' : '⏸' }}</span>
          <span>{{ isPaused() ? 'RESUME' : 'PAUSE' }}</span>
        </button>
        <button class="btn btn-stop" [disabled]="isStopped()" (click)="stop()">
          <span class="btn-icon">⏹</span>
          <span>STOP</span>
        </button>
      </div>

      <!-- Logs -->
      <div class="logs-panel">
        <div class="logs-header">
          <h3>📋 Activity Log</h3>
          <button class="btn-clear" (click)="botService.clearLogs()">Clear</button>
        </div>
        <div class="logs-container">
          @for (log of logs(); track log) {
            <div class="log-entry">{{ log }}</div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .control-panel {
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 12px;
      overflow: hidden;
    }

    .panel-header {
      padding: 1rem 1.25rem;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid rgba(0, 245, 255, 0.2);

      h2 {
        font-family: 'Orbitron', monospace;
        font-size: 1rem;
        font-weight: 700;
        color: #00f5ff;
      }
    }

    .status-card {
      padding: 1.25rem;
      border-bottom: 1px solid rgba(0, 245, 255, 0.2);
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);

      &:last-child { border-bottom: none; }

      .label {
        color: #94a3b8;
        font-weight: 500;
      }

      .value {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        color: #00f5ff;
      }
    }

    .control-buttons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      padding: 1.25rem;
    }

    .btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 1rem;
      border: none;
      border-radius: 8px;
      font-family: 'Orbitron', monospace;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-icon { font-size: 1.5rem; }

      &:hover:not(:disabled) {
        transform: translateY(-2px);
      }
    }

    .btn-start {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);

      &:hover:not(:disabled) {
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
      }
    }

    .btn-pause {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);

      &:hover:not(:disabled) {
        box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
      }
    }

    .btn-stop {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);

      &:hover:not(:disabled) {
        box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
      }
    }

    .logs-panel {
      border-top: 1px solid rgba(0, 245, 255, 0.2);
    }

    .logs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.25rem;
      background: rgba(0, 0, 0, 0.3);

      h3 {
        font-family: 'Orbitron', monospace;
        font-size: 0.9rem;
        color: #00f5ff;
      }
    }

    .btn-clear {
      padding: 0.25rem 0.75rem;
      background: transparent;
      border: 1px solid #64748b;
      border-radius: 4px;
      color: #64748b;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #00f5ff;
        color: #00f5ff;
      }
    }

    .logs-container {
      height: 200px;
      overflow-y: auto;
      padding: 1rem 1.25rem;
      font-family: 'Consolas', monospace;
      font-size: 0.8rem;
      line-height: 1.6;
    }

    .log-entry {
      padding: 0.25rem 0;
      color: #94a3b8;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);

      &:last-child { border-bottom: none; }
    }
  `]
})
export class ControlPanelComponent {
  botService = inject(BotService);
  
  status = this.botService.status;
  logs = this.botService.logs;
  
  isRunning = computed(() => this.status().state === 'running');
  isPaused = computed(() => this.status().state === 'paused');
  isStopped = computed(() => this.status().state === 'stopped');
  
  stateColor = computed(() => {
    const colors: Record<string, string> = {
      'running': '#10b981',
      'paused': '#f59e0b',
      'stopped': '#ef4444',
      'error': '#ef4444'
    };
    return colors[this.status().state] || '#00f5ff';
  });

  async start() {
    await this.botService.start();
  }

  async stop() {
    await this.botService.stop();
  }

  async togglePause() {
    if (this.isPaused()) {
      await this.botService.resume();
    } else {
      await this.botService.pause();
    }
  }
}
