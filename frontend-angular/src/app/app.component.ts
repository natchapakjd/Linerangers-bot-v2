import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <div class="app-container">
      <app-header></app-header>
      <router-outlet></router-outlet>
      <footer class="footer">
        <p>Line Rangers Bot v1.0.0 | Made with ❤️ for automation</p>
      </footer>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem;
    }

    .footer {
      text-align: center;
      padding: 1rem;
      color: #64748b;
      font-size: 0.8rem;
      margin-top: 1rem;
    }
  `]
})
export class AppComponent {
  title = 'Line Rangers Bot';
}
