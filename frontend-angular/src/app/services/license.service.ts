import { Injectable, signal, computed } from '@angular/core';

interface LicenseCheckResponse {
  has_valid_license: boolean;
  hardware_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class LicenseService {
  private LICENSE_KEY = 'lrg_bot_license_key';
  private CACHE_KEY = 'lrg_bot_license_cache';
  private CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  
  private _hasValidLicense = signal<boolean | null>(null);
  private _isChecking = signal(false);
  
  // Computed signals for reactive state
  hasValidLicense = computed(() => this._hasValidLicense());
  isChecking = computed(() => this._isChecking());
  
  constructor() {
    // Check cache first, then verify with API if needed
    this.initFromCache();
  }
  
  /**
   * Initialize from cache if still valid
   */
  private initFromCache(): void {
    const cached = this.getCachedLicense();
    if (cached !== null) {
      this._hasValidLicense.set(cached);
    } else {
      // Cache expired or not found, check with API
      this.checkLicense();
    }
  }
  
  /**
   * Get cached license status if not expired
   */
  private getCachedLicense(): boolean | null {
    try {
      const cacheStr = localStorage.getItem(this.CACHE_KEY);
      if (!cacheStr) return null;
      
      const cache = JSON.parse(cacheStr);
      const now = Date.now();
      
      if (now - cache.timestamp < this.CACHE_DURATION_MS) {
        return cache.hasValidLicense;
      }
      return null; // Cache expired
    } catch {
      return null;
    }
  }
  
  /**
   * Save license status to cache
   */
  private setCachedLicense(hasValidLicense: boolean): void {
    const cache = {
      hasValidLicense,
      timestamp: Date.now()
    };
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
  }
  
  /**
   * Clear the license cache
   */
  clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
  }
  
  /**
   * Get stored license key from localStorage
   */
  getStoredLicenseKey(): string | null {
    return localStorage.getItem(this.LICENSE_KEY);
  }
  
  /**
   * Save license key to localStorage
   */
  saveLicenseKey(key: string): void {
    localStorage.setItem(this.LICENSE_KEY, key);
  }
  
  /**
   * Clear stored license key
   */
  clearLicenseKey(): void {
    localStorage.removeItem(this.LICENSE_KEY);
    this.clearCache();
    this._hasValidLicense.set(false);
  }
  
  /**
   * Check if this device has a valid license (with caching)
   */
  async checkLicense(forceRefresh = false): Promise<boolean> {
    // Return cached value if not forcing refresh
    if (!forceRefresh) {
      const cached = this.getCachedLicense();
      if (cached !== null) {
        this._hasValidLicense.set(cached);
        return cached;
      }
    }
    
    this._isChecking.set(true);
    
    try {
      const response = await fetch('/api/v1/license/check');
      const data: LicenseCheckResponse = await response.json();
      
      this._hasValidLicense.set(data.has_valid_license);
      this.setCachedLicense(data.has_valid_license);
      
      return data.has_valid_license;
    } catch (error) {
      console.error('Failed to check license:', error);
      this._hasValidLicense.set(false);
      return false;
    } finally {
      this._isChecking.set(false);
    }
  }
  
  /**
   * Mark license as valid (called after successful activation)
   */
  setLicenseValid(licenseKey: string): void {
    this.saveLicenseKey(licenseKey);
    this._hasValidLicense.set(true);
    this.setCachedLicense(true);
  }
}
