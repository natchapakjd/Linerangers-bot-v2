import { Injectable, signal, computed } from '@angular/core';

interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
  is_admin: boolean;
}

interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private TOKEN_KEY = 'lrg_bot_token';
  private USER_KEY = 'lrg_bot_user';
  
  private _token = signal<string | null>(null);
  private _user = signal<User | null>(null);
  
  // Computed signals for reactive state
  isLoggedIn = computed(() => !!this._token());
  isAdmin = computed(() => this._user()?.is_admin ?? false);
  currentUser = computed(() => this._user());
  
  constructor() {
    // Load from localStorage on init
    this.loadFromStorage();
  }
  
  private loadFromStorage(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);
    
    if (token) {
      this._token.set(token);
    }
    if (userStr) {
      try {
        this._user.set(JSON.parse(userStr));
      } catch {
        console.error('Failed to parse stored user');
      }
    }
  }
  
  private saveToStorage(token: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this._token.set(token);
    this._user.set(user);
  }
  
  private clearStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }
  
  getToken(): string | null {
    return this._token();
  }
  
  getAuthHeaders(): Record<string, string> {
    const token = this._token();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }
  
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data: AuthResponse = await response.json();
      
      if (data.success && data.token && data.user) {
        this.saveToStorage(data.token, data.user);
      }
      
      return data;
    } catch (error) {
      return { success: false, message: `Error: ${error}` };
    }
  }
  
  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email })
      });
      
      const data: AuthResponse = await response.json();
      
      if (data.success && data.token && data.user) {
        this.saveToStorage(data.token, data.user);
      }
      
      return data;
    } catch (error) {
      return { success: false, message: `Error: ${error}` };
    }
  }
  
  logout(): void {
    this.clearStorage();
  }
  
  async checkAuth(): Promise<boolean> {
    const token = this._token();
    if (!token) return false;
    
    try {
      const response = await fetch('/api/v1/auth/me', {
        headers: this.getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this._user.set(data.user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
          return true;
        }
      }
      
      // Token invalid, clear it
      this.clearStorage();
      return false;
    } catch {
      return false;
    }
  }
}
