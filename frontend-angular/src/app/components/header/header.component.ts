import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BotService } from '../../services/bot.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="header">
      <div class="header-top">
        <div class="logo">
          <span class="logo-icon">🎮</span>
          <h1>LINE RANGERS BOT</h1>
        </div>
        <div class="auth-section">
          @if (authService.isLoggedIn()) {
            <span class="user-info">
              <span class="user-icon">👤</span>
              <span class="username">{{ authService.currentUser()?.username }}</span>
              @if (authService.isAdmin()) {
                <span class="admin-badge">ADMIN</span>
              }
            </span>
            <button class="auth-btn" (click)="logout()">🚪 Logout</button>
          } @else {
            <button class="auth-btn login-btn" (click)="goToLogin()">🔐 Login</button>
          }
        </div>
      </div>
      
      <nav class="navbar">
        <ul class="nav-menu">
          <li class="nav-item" *ngFor="let item of filteredMenuItems()">
            <a 
              class="nav-link" 
              [class.active]="activeMenu === item.id"
              (click)="setActiveMenu(item.id)"
            >
              <span class="nav-icon">{{ item.icon }}</span>
              <span class="nav-text">{{ item.label }}</span>
              <span class="nav-badge" *ngIf="item.badge">{{ item.badge }}</span>
            </a>
          </li>
        </ul>
      </nav>
    </header>
  `,
  styles: [`
    .header {
      background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.1);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(59, 130, 246, 0.1);
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      font-size: 2rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .logo h1 {
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      color: white;
      letter-spacing: 1px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .auth-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      font-size: 0.875rem;
      color: white;
    }

    .user-icon {
      font-size: 1.1rem;
    }

    .username {
      color: white;
      font-weight: 600;
    }

    .admin-badge {
      background: #fbbf24;
      color: #1e3a8a;
      font-size: 0.65rem;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-weight: 700;
    }

    .auth-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .auth-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .auth-btn.login-btn {
      background: white;
      color: #3b82f6;
      border: none;
    }

    .auth-btn.login-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    /* === NAVBAR === */
    .navbar {
      padding: 0.75rem 1rem;
      background: #f8fafc;
    }

    .nav-menu {
      display: flex;
      gap: 0.5rem;
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-x: auto;
    }

    .nav-item {
      flex-shrink: 0;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 12px;
      background: transparent;
      color: #64748b;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid transparent;
      position: relative;
    }

    .nav-link:hover {
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.2);
    }

    .nav-link.active {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    }

    .nav-icon {
      font-size: 1.2rem;
    }

    .nav-text {
      font-size: 0.9rem;
    }

    .nav-badge {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      font-size: 0.65rem;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-weight: 700;
    }

    /* Scrollbar for nav */
    .nav-menu::-webkit-scrollbar {
      height: 4px;
    }

    .nav-menu::-webkit-scrollbar-track {
      background: transparent;
    }

    .nav-menu::-webkit-scrollbar-thumb {
      background: rgba(59, 130, 246, 0.3);
      border-radius: 2px;
      border-radius: 2px;
    }
  `]
})
export class HeaderComponent {
  private router = inject(Router);
  botService = inject(BotService);
  authService = inject(AuthService);
  
  activeMenu = 'dashboard';
  
  menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', route: '/', adminOnly: false },
    { id: 'license', label: 'License', icon: '🔑', route: '/license', adminOnly: false },
    { id: 'devices', label: 'Devices', icon: '📱', route: '/devices', adminOnly: false },
    { id: 'daily-login', label: 'Daily Login', icon: '📅', badge: 'AUTO', route: '/daily-login', adminOnly: false },
    { id: 'gai-ruby', label: 'Gai-Ruby', icon: '💎', badge: 'NEW', route: '/gai-ruby', adminOnly: false },
    { id: 're-id', label: 'Re-ID', icon: '🔄', route: '/re-id', adminOnly: false },
    // { id: 'guild', label: 'Guild Raid', icon: '🏰', route: '/guild', adminOnly: false },
    { id: 'farm', label: 'Auto Farm', icon: '🌾', route: '/farm', adminOnly: false },
    { id: 'admin-license', label: 'Admin', icon: '⚙️', route: '/admin/license', adminOnly: true },
    { id: 'settings', label: 'Settings', icon: '🔧', route: '/settings', adminOnly: false }
  ];
  
  // Filter menu items based on user role
  filteredMenuItems = computed(() => {
    return this.menuItems.filter(item => {
      if (item.adminOnly && !this.authService.isAdmin()) {
        return false;
      }
      return true;
    });
  });
  
  setActiveMenu(id: string) {
    this.activeMenu = id;
    const item = this.menuItems.find(m => m.id === id);
    if (item?.route) {
      this.router.navigate([item.route]);
    }
  }
  
  goToLogin() {
    this.router.navigate(['/login']);
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
