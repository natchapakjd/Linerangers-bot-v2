import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-screen-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="screen-panel">
      <div class="panel-header">
        <h2>📺 Emulator Screen</h2>
      </div>
      <div class="screen-container">
        @if (botService.screenImage()) {
          <img [src]="botService.screenImage()" class="screen-image" alt="Emulator Screen">
        } @else {
          <div class="screen-placeholder">
            <span>No Signal</span>
            <p>Start the bot to view emulator screen</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .screen-panel {
      background: #1a1a2e;
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 12px;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
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

    .screen-container {
      position: relative;
      aspect-ratio: 9 / 16;
      max-height: 600px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .screen-placeholder {
      text-align: center;
      color: #64748b;

      span {
        font-family: 'Orbitron', monospace;
        font-size: 1.5rem;
        display: block;
        margin-bottom: 0.5rem;
        animation: flicker 2s infinite;
      }
    }

    @keyframes flicker {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `]
})
export class ScreenPreviewComponent {
  botService = inject(BotService);
}
