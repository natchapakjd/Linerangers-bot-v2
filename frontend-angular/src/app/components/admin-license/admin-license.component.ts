import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface LicenseInfo {
  id: number;
  license_key: string;
  customer_name: string;
  duration_days: number;
  hardware_id: string | null;
  activated_at: string | null;
  created_at: string;
  is_active: boolean;
  is_activated: boolean;
  is_expired: boolean;
  days_remaining: number;
}

@Component({
  selector: 'app-admin-license',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <h2>🔐 License Management</h2>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          ➕ Create New License
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ licenses().length }}</div>
          <div class="stat-label">Total Licenses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ activeLicenses() }}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ expiredLicenses() }}</div>
          <div class="stat-label">Expired</div>
        </div>
      </div>

      <!-- Licenses Table -->
      <div class="table-container">
        <table class="licenses-table">
          <thead>
            <tr>
              <th>License Key</th>
              <th>Customer</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Days Left</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (license of licenses(); track license.id) {
              <tr [class.inactive]="!license.is_active" [class.expired]="license.is_expired">
                <td>
                  <code class="license-key">{{ license.license_key }}</code>
                  <button class="copy-btn" (click)="copyToClipboard(license.license_key)" title="Copy">
                    📋
                  </button>
                </td>
                <td>{{ license.customer_name }}</td>
                <td>{{ license.duration_days }} days</td>
                <td>
                  <span class="status-badge" [class]="getStatusClass(license)">
                    {{ getStatusText(license) }}
                  </span>
                </td>
                <td>
                  @if (license.is_activated && !license.is_expired) {
                    <span class="days-badge" [class.low]="license.days_remaining <= 1">
                      {{ license.days_remaining }}
                    </span>
                  } @else {
                    -
                  }
                </td>
                <td class="actions">
                  @if (license.is_activated) {
                    <button 
                      class="btn-icon" 
                      (click)="resetHardware(license.license_key)"
                      title="Reset Hardware Binding"
                    >
                      🔄
                    </button>
                  }
                  @if (license.is_active) {
                    <button 
                      class="btn-icon danger" 
                      (click)="revokeLicense(license.license_key)"
                      title="Revoke License"
                    >
                      🚫
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty-state">
                  No licenses found. Create one to get started!
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Create Modal -->
      @if (showCreateModal) {
        <div class="modal-overlay" (click)="showCreateModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Create New License</h3>
              <button class="close-btn" (click)="showCreateModal = false">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Customer Name</label>
                <input 
                  type="text" 
                  [(ngModel)]="newLicense.customer_name"
                  placeholder="Enter customer name"
                />
              </div>
              <div class="form-group">
                <label>Duration (days)</label>
                <select [(ngModel)]="newLicense.duration_days">
                  <option [value]="1">1 Day</option>
                  <option [value]="3">3 Days</option>
                  <option [value]="7">7 Days (1 Week)</option>
                  <option [value]="30">30 Days (1 Month)</option>
                  <option [value]="90">90 Days (3 Months)</option>
                  <option [value]="365">365 Days (1 Year)</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="showCreateModal = false">Cancel</button>
              <button 
                class="btn btn-primary" 
                (click)="createLicense()"
                [disabled]="!newLicense.customer_name.trim() || isCreating()"
              >
                {{ isCreating() ? 'Creating...' : 'Create License' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Result Modal -->
      @if (createdLicense()) {
        <div class="modal-overlay" (click)="createdLicense.set(null)">
          <div class="modal success-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>✅ License Created!</h3>
              <button class="close-btn" (click)="createdLicense.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <p>Share this license key with the customer:</p>
              <div class="license-display">
                <code>{{ createdLicense()?.license_key }}</code>
                <button class="copy-btn large" (click)="copyToClipboard(createdLicense()!.license_key)">
                  📋 Copy
                </button>
              </div>
              <div class="license-info">
                <p><strong>Customer:</strong> {{ createdLicense()?.customer_name }}</p>
                <p><strong>Duration:</strong> {{ createdLicense()?.duration_days }} days</p>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-page {
      padding: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .page-header h2 {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #00f5ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: linear-gradient(135deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 40, 0.95));
      border: 1px solid rgba(100, 100, 255, 0.2);
      border-radius: 15px;
      padding: 1.5rem;
      text-align: center;
    }

    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #00f5ff;
    }

    .stat-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }

    .table-container {
      background: linear-gradient(135deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 40, 0.95));
      border: 1px solid rgba(100, 100, 255, 0.2);
      border-radius: 15px;
      overflow: hidden;
    }

    .licenses-table {
      width: 100%;
      border-collapse: collapse;
    }

    .licenses-table th,
    .licenses-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .licenses-table th {
      background: rgba(0, 0, 0, 0.3);
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
    }

    .licenses-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .licenses-table tr.inactive {
      opacity: 0.5;
    }

    .licenses-table tr.expired:not(.inactive) {
      background: rgba(239, 68, 68, 0.05);
    }

    .license-key {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(100, 100, 255, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 5px;
      font-size: 0.85rem;
      color: #00f5ff;
    }

    .copy-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      margin-left: 0.5rem;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .copy-btn:hover {
      opacity: 1;
    }

    .copy-btn.large {
      background: rgba(100, 100, 255, 0.2);
      padding: 0.5rem 1rem;
      border-radius: 5px;
      font-size: 0.9rem;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .status-badge.pending {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .status-badge.active {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .status-badge.expired {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .status-badge.revoked {
      background: rgba(107, 114, 128, 0.2);
      color: #6b7280;
    }

    .days-badge {
      background: rgba(0, 245, 255, 0.2);
      color: #00f5ff;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-weight: 700;
    }

    .days-badge.low {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-icon {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      padding: 0.5rem;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .btn-icon.danger:hover {
      background: rgba(239, 68, 68, 0.3);
    }

    .empty-state {
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      padding: 3rem !important;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 10px;
      font-size: 0.95rem;
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
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal {
      background: linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 40, 0.98));
      border: 1px solid rgba(100, 100, 255, 0.3);
      border-radius: 20px;
      width: 100%;
      max-width: 450px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.2rem;
    }

    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      opacity: 0.6;
    }

    .close-btn:hover {
      opacity: 1;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.8);
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid rgba(100, 100, 255, 0.3);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: white;
      font-size: 1rem;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #00f5ff;
    }

    .license-display {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(0, 0, 0, 0.3);
      padding: 1rem;
      border-radius: 10px;
      margin: 1rem 0;
    }

    .license-display code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.2rem;
      color: #00f5ff;
      flex: 1;
    }

    .license-info {
      color: rgba(255, 255, 255, 0.7);
    }

    .license-info p {
      margin: 0.5rem 0;
    }

    .success-modal {
      border-color: rgba(34, 197, 94, 0.3);
    }
  `]
})
export class AdminLicenseComponent implements OnInit {
  licenses = signal<LicenseInfo[]>([]);
  isCreating = signal(false);
  createdLicense = signal<LicenseInfo | null>(null);
  showCreateModal = false;
  
  newLicense = {
    customer_name: '',
    duration_days: 3
  };

  ngOnInit(): void {
    this.loadLicenses();
  }

  activeLicenses(): number {
    return this.licenses().filter(l => l.is_active && !l.is_expired).length;
  }

  expiredLicenses(): number {
    return this.licenses().filter(l => l.is_expired).length;
  }

  async loadLicenses(): Promise<void> {
    try {
      const response = await fetch('/api/v1/admin/license/list');
      const data = await response.json();
      this.licenses.set(data.licenses || []);
    } catch (error) {
      console.error('Failed to load licenses:', error);
    }
  }

  async createLicense(): Promise<void> {
    if (!this.newLicense.customer_name.trim()) return;

    this.isCreating.set(true);

    try {
      const response = await fetch('/api/v1/admin/license/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.newLicense)
      });
      const data = await response.json();
      
      if (data.success) {
        this.createdLicense.set(data.license);
        this.showCreateModal = false;
        this.newLicense = { customer_name: '', duration_days: 3 };
        this.loadLicenses();
      }
    } catch (error) {
      console.error('Failed to create license:', error);
    } finally {
      this.isCreating.set(false);
    }
  }

  async revokeLicense(licenseKey: string): Promise<void> {
    if (!confirm('Are you sure you want to revoke this license?')) return;

    try {
      await fetch(`/api/v1/admin/license/${licenseKey}`, { method: 'DELETE' });
      this.loadLicenses();
    } catch (error) {
      console.error('Failed to revoke license:', error);
    }
  }

  async resetHardware(licenseKey: string): Promise<void> {
    if (!confirm('Reset hardware binding? The customer will need to re-activate on their new device.')) return;

    try {
      await fetch(`/api/v1/admin/license/${licenseKey}/reset-hardware`, { method: 'POST' });
      this.loadLicenses();
    } catch (error) {
      console.error('Failed to reset hardware:', error);
    }
  }

  getStatusClass(license: LicenseInfo): string {
    if (!license.is_active) return 'revoked';
    if (license.is_expired) return 'expired';
    if (license.is_activated) return 'active';
    return 'pending';
  }

  getStatusText(license: LicenseInfo): string {
    if (!license.is_active) return '🚫 Revoked';
    if (license.is_expired) return '⏰ Expired';
    if (license.is_activated) return '✅ Active';
    return '⏳ Pending';
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }
}
