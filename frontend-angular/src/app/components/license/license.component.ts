import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface LicenseStatus {
  success: boolean;
  message: string;
  license?: {
    license_key: string;
    customer_name: string;
    duration_days: number;
    hardware_id: string | null;
    activated_at: string | null;
    is_active: boolean;
    is_activated: boolean;
    is_expired: boolean;
    days_remaining: number;
  };
  hardware_id?: string;
  days_remaining?: number;
}

@Component({
  selector: 'app-license',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="license-page">
      <div class="license-card">
        <div class="card-header">
          <span class="icon">🔑</span>
          <h2>License Activation</h2>
        </div>

        <div class="hardware-info">
          <span class="label">Hardware ID:</span>
          <code>{{ hardwareId() || 'Loading...' }}</code>
        </div>

        <!-- License Input -->
        <div class="input-section">
          <label for="licenseKey">License Key</label>
          <input
            type="text"
            id="licenseKey"
            [(ngModel)]="licenseKey"
            placeholder="LRG-XXXX-XXXX-XXXX"
            [disabled]="isLoading()"
            (keyup.enter)="activateLicense()"
          />
          <button 
            class="btn btn-primary"
            (click)="activateLicense()"
            [disabled]="!licenseKey.trim() || isLoading()"
          >
            {{ isLoading() ? '⏳ Activating...' : '✨ Activate License' }}
          </button>
        </div>

        <!-- Status Display -->
        @if (status()) {
          <div class="status-box" [class.success]="status()!.success" [class.error]="!status()!.success">
            <div class="status-icon">{{ status()!.success ? '✅' : '❌' }}</div>
            <div class="status-content">
              <p class="status-message">{{ status()!.message }}</p>
              @if (status()!.license) {
                <div class="license-details">
                  <div class="detail">
                    <span class="label">Customer:</span>
                    <span>{{ status()!.license!.customer_name }}</span>
                  </div>
                  <div class="detail">
                    <span class="label">Status:</span>
                    <span [class.active]="status()!.license!.is_active && !status()!.license!.is_expired"
                          [class.expired]="status()!.license!.is_expired">
                      {{ status()!.license!.is_expired ? '⏰ Expired' : 
                         status()!.license!.is_active ? '✅ Active' : '🚫 Revoked' }}
                    </span>
                  </div>
                  @if (status()!.days_remaining !== null) {
                    <div class="detail days-remaining" [class.low]="(status()!.days_remaining ?? 0) <= 1">
                      <span class="label">Days Remaining:</span>
                      <span class="days">{{ status()!.days_remaining }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Check Status Button -->
        <button 
          class="btn btn-secondary"
          (click)="checkStatus()"
          [disabled]="!licenseKey.trim() || isLoading()"
        >
          🔍 Check Status
        </button>
      </div>
    </div>
  `,
  styles: [`
    .license-page {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 2rem;
      min-height: calc(100vh - 200px);
    }

    .license-card {
      background: linear-gradient(135deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 40, 0.95));
      border: 1px solid rgba(100, 100, 255, 0.2);
      border-radius: 20px;
      padding: 2.5rem;
      width: 100%;
      max-width: 500px;
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

    .hardware-info {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .hardware-info .label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.85rem;
    }

    .hardware-info code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(100, 100, 255, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 5px;
      font-size: 0.85rem;
      color: #00f5ff;
    }

    .input-section {
      margin-bottom: 1.5rem;
    }

    .input-section label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9rem;
    }

    .input-section input {
      width: 100%;
      padding: 1rem;
      border: 2px solid rgba(100, 100, 255, 0.3);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: white;
      font-size: 1.1rem;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1rem;
      transition: all 0.3s;
    }

    .input-section input:focus {
      outline: none;
      border-color: #00f5ff;
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
    }

    .input-section input::placeholder {
      color: rgba(255, 255, 255, 0.3);
      text-transform: none;
    }

    .btn {
      width: 100%;
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

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      margin-top: 1rem;
    }

    .btn-secondary:not(:disabled):hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .status-box {
      display: flex;
      gap: 1rem;
      padding: 1.5rem;
      border-radius: 10px;
      margin-bottom: 1rem;
    }

    .status-box.success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .status-box.error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .status-icon {
      font-size: 1.5rem;
    }

    .status-content {
      flex: 1;
    }

    .status-message {
      font-weight: 600;
      margin: 0 0 0.5rem 0;
    }

    .license-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .detail {
      display: flex;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

    .detail .label {
      color: rgba(255, 255, 255, 0.6);
    }

    .detail .active {
      color: #22c55e;
    }

    .detail .expired {
      color: #ef4444;
    }

    .days-remaining .days {
      font-size: 1.5rem;
      font-weight: 700;
      color: #00f5ff;
    }

    .days-remaining.low .days {
      color: #f59e0b;
    }
  `]
})
export class LicenseComponent {
  licenseKey = '';
  status = signal<LicenseStatus | null>(null);
  isLoading = signal(false);
  hardwareId = signal<string | null>(null);

  constructor() {
    this.loadHardwareId();
  }

  async loadHardwareId(): Promise<void> {
    try {
      const response = await fetch('/api/v1/license/hardware-id');
      const data = await response.json();
      this.hardwareId.set(data.hardware_id_short);
    } catch (error) {
      console.error('Failed to load hardware ID:', error);
    }
  }

  async activateLicense(): Promise<void> {
    if (!this.licenseKey.trim()) return;

    this.isLoading.set(true);
    this.status.set(null);

    try {
      const response = await fetch('/api/v1/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: this.licenseKey.trim().toUpperCase() })
      });
      const data: LicenseStatus = await response.json();
      this.status.set(data);
    } catch (error) {
      this.status.set({
        success: false,
        message: `Error: ${error}`
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  async checkStatus(): Promise<void> {
    if (!this.licenseKey.trim()) return;

    this.isLoading.set(true);

    try {
      const response = await fetch(
        `/api/v1/license/status?license_key=${encodeURIComponent(this.licenseKey.trim().toUpperCase())}`
      );
      const data: LicenseStatus = await response.json();
      this.status.set(data);
    } catch (error) {
      this.status.set({
        success: false,
        message: `Error: ${error}`
      });
    } finally {
      this.isLoading.set(false);
    }
  }
}
