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
    <header class="header-container glass-panel">
      <!-- Top Bar: Logo & User -->
      <div class="header-main">
        <div class="logo-area">
          <div class="logo-icon-wrap">
            <span class="logo-icon">💠</span>
            <div class="logo-glow"></div>
          </div>
          <div class="logo-text">
            <h1>LRG<span class="highlight">BOT</span></h1>
            <span class="logo-subtitle">AUTOMATION V2</span>
          </div>
        </div>

        <div class="header-actions">
          @if (authService.isLoggedIn()) {
            <div class="user-chip glass-button">
              <span class="avatar-circle">
                {{ authService.currentUser()?.username?.charAt(0) | uppercase }}
              </span>
              <span class="user-name">{{ authService.currentUser()?.username }}</span>
              <button class="logout-icon" (click)="logout()" title="Logout">⏻</button>
            </div>
          } @else {
            <button class="glass-button login-btn" (click)="goToLogin()">
              <span class="icon">🔐</span> LOGIN
            </button>
          }
        </div>
      </div>
      
      <!-- Navigation Bar -->
      <nav class="nav-container">
        <ul class="nav-list">
          @for (item of filteredMenuItems(); track item.id) {
            <li class="nav-item">
              <a 
                class="nav-link" 
                [class.active]="activeMenu === item.id"
                (click)="setActiveMenu(item.id)"
              >
                <span class="nav-icon">{{ item.icon }}</span>
                <span class="nav-label">{{ item.label }}</span>
                
                @if (item.badge) {
                  <span class="nav-badge">{{ item.badge }}</span>
                }
                <div class="hover-effect"></div>
              </a>
            </li>
          }
        </ul>
      </nav>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      margin-bottom: 2rem;
    }

    .header-container {
      padding: 0;
      overflow: visible;
      /* Gradient glass background */
      background: linear-gradient(180deg, rgba(8, 12, 22, 0.85) 0%, rgba(8, 12, 22, 0.6) 100%);
      border-bottom: 1px solid var(--glass-border);
      box-shadow: 0 4px 20px -5px rgba(0,0,0,0.3);
    }

    /* --- Top Bar --- */
    .header-main {
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo-icon-wrap {
      position: relative;
      width: 42px; 
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-icon {
      font-size: 2rem;
      position: relative;
      z-index: 2;
      /* Multi-color gradient icon drop shadow */
      filter: drop-shadow(0 0 8px rgba(0, 198, 255, 0.5));
    }

    .logo-glow {
      position: absolute;
      width: 100%; height: 100%;
      background: var(--primary);
      filter: blur(24px);
      opacity: 0.2;
      border-radius: 50%;
      animation: pulseGlow 4s infinite alternate;
    }

    .logo-text h1 {
      font-size: 1.6rem;
      line-height: 1;
      margin: 0;
      letter-spacing: 1px;
      background: linear-gradient(to right, #fff, var(--primary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-text .highlight {
      /* Keep standard hierarchy */
    }

    .logo-subtitle {
      font-family: var(--font-body);
      font-size: 0.7rem;
      letter-spacing: 4px;
      color: var(--text-muted);
      display: block;
      margin-top: 2px;
      opacity: 0.7;
    }

    /* --- User Actions --- */
    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.4rem 0.8rem 0.4rem 0.6rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--glass-border);
      border-radius: 30px;
      transition: all 0.3s;
    }
    
    .user-chip:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255,255,255,0.1);
    }

    .avatar-circle {
      width: 28px; height: 28px;
      background: var(--grad-primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
      box-shadow: 0 0 10px rgba(0, 198, 255, 0.3);
    }

    .user-name {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-main);
    }

    .logout-icon {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.1rem;
      padding: 4px;
      margin-left: 0.25rem;
      transition: color 0.2s;
      
      &:hover {
        color: var(--danger);
      }
    }

    /* --- Navigation --- */
    .nav-container {
      padding: 0 2rem;
      overflow-x: auto;
      background: rgba(0,0,0,0.2);
      backdrop-filter: blur(5px);
    }

    .nav-list {
      display: flex;
      gap: 2rem;
      list-style: none;
      min-width: max-content;
    }

    .nav-item {
      position: relative;
    }

    .nav-link {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 1rem 0;
      color: var(--text-muted);
      font-family: var(--font-body);
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.3s;
      border-bottom: 2px solid transparent;
    }

    .nav-link:hover {
      color: var(--text-main);
    }

    /* Active State: Underline + Glow */
    .nav-link.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    
    .nav-link.active .nav-icon {
      filter: drop-shadow(0 0 5px var(--primary));
    }

    .nav-badge {
      font-size: 0.6rem;
      padding: 1px 5px;
      background: var(--grad-secondary);
      border-radius: 4px;
      color: white;
      font-weight: 700;
      letter-spacing: 0.5px;
      box-shadow: 0 0 8px rgba(161, 140, 209, 0.4);
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
    { id: 'workflow-builder', label: 'Workflow', icon: '⚙️', route: '/workflow-builder', adminOnly: false },
    // Template Sets and Mode Config removed - now using direct mode assignment in Workflow Builder
    { id: 'admin-license', label: 'Admin', icon: '👑', route: '/admin/license', adminOnly: true },
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
