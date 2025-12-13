import { Component, inject } from '@angular/core';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="header">
      <div class="logo">
        <span class="logo-icon">🎮</span>
        <h1>LINE RANGERS BOT</h1>
      </div>
      <div class="connection-status" [class.connected]="botService.isConnected()">
        <span class="status-dot"></span>
        <span class="status-text">{{ botService.isConnected() ? 'Connected' : 'Disconnected' }}</span>
      </div>
    </header>
  `,
  styles: [`
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 12px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      font-size: 2rem;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .logo h1 {
      font-family: 'Orbitron', monospace;
      font-size: 1.5rem;
      font-weight: 900;
      background: linear-gradient(135deg, #00f5ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 2px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 20px;
      font-size: 0.875rem;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 10px #ef4444;
      transition: all 0.3s ease;
    }

    .connection-status.connected .status-dot {
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
  `]
})
export class HeaderComponent {
  botService = inject(BotService);
}
