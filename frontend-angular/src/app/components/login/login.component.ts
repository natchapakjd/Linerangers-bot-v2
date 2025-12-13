import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="card-header">
          <span class="icon">{{ isRegisterMode ? '📝' : '🔐' }}</span>
          <h2>{{ isRegisterMode ? 'Create Account' : 'Login' }}</h2>
        </div>

        <form (ngSubmit)="submit()" class="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              [(ngModel)]="username"
              name="username"
              placeholder="Enter username"
              [disabled]="isLoading()"
              required
            />
          </div>

          @if (isRegisterMode) {
            <div class="form-group">
              <label for="email">Email (optional)</label>
              <input
                type="email"
                id="email"
                [(ngModel)]="email"
                name="email"
                placeholder="Enter email"
                [disabled]="isLoading()"
              />
            </div>
          }

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter password"
              [disabled]="isLoading()"
              required
            />
          </div>

          @if (errorMessage()) {
            <div class="error-box">
              ❌ {{ errorMessage() }}
            </div>
          }

          <button type="submit" class="btn btn-primary" [disabled]="isLoading()">
            {{ isLoading() ? '⏳ Loading...' : (isRegisterMode ? '📝 Create Account' : '🔓 Login') }}
          </button>
        </form>

        <div class="toggle-mode">
          <span>{{ isRegisterMode ? 'Already have an account?' : "Don't have an account?" }}</span>
          <a (click)="toggleMode()">
            {{ isRegisterMode ? 'Login' : 'Register' }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 200px);
      padding: 2rem;
    }

    .login-card {
      background: linear-gradient(135deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 40, 0.95));
      border: 1px solid rgba(100, 100, 255, 0.2);
      border-radius: 20px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .card-header .icon {
      font-size: 2.5rem;
    }

    .card-header h2 {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #00f5ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9rem;
    }

    .form-group input {
      padding: 0.875rem;
      border: 2px solid rgba(100, 100, 255, 0.3);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: white;
      font-size: 1rem;
      transition: all 0.3s;
    }

    .form-group input:focus {
      outline: none;
      border-color: #00f5ff;
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
    }

    .form-group input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .error-box {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 10px;
      padding: 1rem;
      color: #fca5a5;
      font-size: 0.9rem;
    }

    .btn {
      padding: 1rem;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, #7c3aed, #00f5ff);
      color: white;
    }

    .btn-primary:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);
    }

    .toggle-mode {
      margin-top: 1.5rem;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }

    .toggle-mode a {
      color: #00f5ff;
      cursor: pointer;
      margin-left: 0.5rem;
      font-weight: 600;
    }

    .toggle-mode a:hover {
      text-decoration: underline;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  email = '';
  isRegisterMode = false;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // If already logged in, redirect
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.errorMessage.set(null);
  }

  async submit(): Promise<void> {
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage.set('Please enter username and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const result = this.isRegisterMode
        ? await this.authService.register(this.username, this.password, this.email || undefined)
        : await this.authService.login(this.username, this.password);

      if (result.success) {
        this.router.navigate(['/']);
      } else {
        this.errorMessage.set(result.message);
      }
    } catch (error) {
      this.errorMessage.set(`Error: ${error}`);
    } finally {
      this.isLoading.set(false);
    }
  }
}
