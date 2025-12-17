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
  
  private _hasValidLicense = signal<boolean | null>(null);
  private _isChecking = signal(false);
  
  // Computed signals for reactive state
  hasValidLicense = computed(() => this._hasValidLicense());
  isChecking = computed(() => this._isChecking());
  
  constructor() {
    // Check license on init
    this.checkLicense();
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
    this._hasValidLicense.set(false);
  }
  
  /**
   * Check if this device has a valid license
   */
  async checkLicense(): Promise<boolean> {
    this._isChecking.set(true);
    
    try {
      const response = await fetch('/api/v1/license/check');
      const data: LicenseCheckResponse = await response.json();
      this._hasValidLicense.set(data.has_valid_license);
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
  }
}
