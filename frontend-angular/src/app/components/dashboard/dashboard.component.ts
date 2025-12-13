import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotService } from '../../services/bot.service';
import { ScreenPreviewComponent } from '../screen-preview/screen-preview.component';
import { ControlPanelComponent } from '../control-panel/control-panel.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ScreenPreviewComponent, ControlPanelComponent],
  template: `
    <main class="main-content">
      <app-screen-preview></app-screen-preview>
      <app-control-panel></app-control-panel>
    </main>
  `,
  styles: [`
    .main-content {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 1.5rem;
      flex: 1;
      margin-top: 1rem;
    }

    @media (max-width: 1024px) {
      .main-content {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent {
  botService = inject(BotService);
}
