import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-screen-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="screen-panel glass-panel">
      <div class="panel-header">
        <h2>📺 Emulator Screen</h2>
      </div>
      <div class="screen-container">
        @if (botService.screenImage()) {
          <img [src]="botService.screenImage()" class="screen-image" alt="Emulator Screen" draggable="false" (dragstart)="$event.preventDefault()">
        } @else {
          <div class="screen-placeholder">
            <span>No Signal</span>
            <p>Start the bot to view emulator screen</p>
          </div>
        }
        <div class="scanlines"></div>
      </div>
    </section>
  `,
  styles: [`
    .screen-panel {
      /* Uses global glass-panel style via class in template, but here for overrides */
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--glass-border);

      h2 {
        font-family: var(--font-display);
        font-size: 1rem;
        font-weight: 700;
        color: var(--primary);
        letter-spacing: 1px;
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
    
    .scanlines {
      position: absolute; inset: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%);
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 10;
    }

    .screen-placeholder {
      text-align: center;
      color: var(--text-muted);

      span {
        font-family: var(--font-display);
        font-size: 1.5rem;
        display: block;
        margin-bottom: 0.5rem;
        color: var(--danger);
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
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: auto;
      filter: contrast(1.1) brightness(1.1);
    }
  `]
})
export class ScreenPreviewComponent {
  botService = inject(BotService);
}
