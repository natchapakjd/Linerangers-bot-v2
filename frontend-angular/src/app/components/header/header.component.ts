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
      background: linear-gradient(180deg, #1a1a2e 0%, #12121a 100%);
      border: 1px solid rgba(0, 245, 255, 0.2);
      border-radius: 16px;
      overflow: hidden;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(0, 245, 255, 0.1);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      font-size: 2rem;
      animation: pulse 2s infinite;
      filter: drop-shadow(0 0 10px rgba(0, 245, 255, 0.5));
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
      background: rgba(0, 0, 0, 0.3);
      border-radius: 20px;
      font-size: 0.875rem;
    }

    .user-icon {
      font-size: 1.1rem;
    }

    .username {
      color: #00f5ff;
      font-weight: 600;
    }

    .admin-badge {
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      color: white;
      font-size: 0.65rem;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-weight: 700;
    }

    .auth-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .auth-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .auth-btn.login-btn {
      background: linear-gradient(135deg, #7c3aed, #00f5ff);
      border: none;
    }

    .auth-btn.login-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 5px 20px rgba(124, 58, 237, 0.4);
    }

    /* === NAVBAR === */
    .navbar {
      padding: 0.5rem 1rem;
      background: rgba(0, 0, 0, 0.2);
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
      color: #94a3b8;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid transparent;
      position: relative;
      overflow: hidden;
    }

    .nav-link::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(124, 58, 237, 0.1));
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .nav-link:hover {
      color: #ffffff;
      border-color: rgba(0, 245, 255, 0.3);
    }

    .nav-link:hover::before {
      opacity: 1;
    }

    .nav-link.active {
      background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(124, 58, 237, 0.2));
      color: #00f5ff;
      border-color: rgba(0, 245, 255, 0.5);
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
    }

    .nav-link.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #00f5ff, transparent);
    }

    .nav-icon {
      font-size: 1.2rem;
      z-index: 1;
    }

    .nav-text {
      z-index: 1;
    }

    .nav-badge {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: white;
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-weight: 700;
      z-index: 1;
      animation: badgePulse 2s infinite;
    }

    @keyframes badgePulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    /* Scrollbar for nav */
    .nav-menu::-webkit-scrollbar {
      height: 4px;
    }

    .nav-menu::-webkit-scrollbar-track {
      background: transparent;
    }

    .nav-menu::-webkit-scrollbar-thumb {
      background: rgba(0, 245, 255, 0.3);
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
    { id: 'devices', label: 'Devices', icon: '📱', badge: 'NEW', route: '/devices', adminOnly: false },
    { id: 'daily-login', label: 'Daily Login', icon: '📅', badge: 'AUTO', route: '/daily-login', adminOnly: false },
    { id: 're-id', label: 'Re-ID', icon: '🔄', route: '/re-id', adminOnly: false },
    { id: 'gacha', label: 'Gacha Pull', icon: '🎰', badge: 'NEW', route: '/gacha', adminOnly: false },
    { id: 'pvp', label: 'PVP Battle', icon: '⚔️', route: '/pvp', adminOnly: false },
    { id: 'guild', label: 'Guild Raid', icon: '🏰', route: '/guild', adminOnly: false },
    { id: 'farm', label: 'Auto Farm', icon: '🌾', route: '/farm', adminOnly: false },
    { id: 'admin-license', label: 'Admin', icon: '🔐', route: '/admin/license', adminOnly: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', route: '/settings', adminOnly: false }
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
