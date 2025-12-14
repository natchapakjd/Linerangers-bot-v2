import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <div class="app-wrapper">
      <div class="background-globes"></div>
      <app-header class="sticky-header"></app-header>
      
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      <footer class="glass-footer">
        <div class="footer-content">
          <p>Langers Bot <span class="version">v2.0</span></p>
          <span class="separator">•</span>
          <p class="copyright">© 2025 NextGen Automation</p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }

    .app-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }

    .background-globes { /* Ambient background effects */
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: -1;
      /* Subtle moving aurora mesh */
      background: 
        radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 100% 0%, rgba(45, 212, 191, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, rgba(192, 132, 252, 0.05) 0%, transparent 50%);
      filter: blur(40px);
      pointer-events: none;
    }

    .main-content {
      flex: 1;
      width: 100%;
      max-width: 1600px;
      margin: 0 auto;
      padding: 2rem;
      animation: fadeIn 0.5s ease-out;
    }

    .glass-footer {
      margin-top: auto;
      padding: 1.5rem;
      text-align: center;
      border-top: 1px solid var(--glass-border);
      background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
    }

    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      color: var(--text-muted);
      font-size: 0.85rem;
      font-family: var(--font-body);
    }

    .version {
      color: var(--primary);
      font-weight: 600;
      font-family: var(--font-display);
    }

    .sticky-header {
      position: sticky;
      top: 0;
      z-index: 100;
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 1rem;
      }
    }
  `]
})
export class AppComponent {
  title = 'Line Rangers Bot';
}
