import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface TemplateSet {
  id: number;
  name: string;
  category: string;
  description: string;
}

interface ModeConfiguration {
  id: number;
  mode_name: string;
  month_year: string;
  template_set_id: number;
  template_set_name: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

@Component({
  selector: 'app-mode-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mode-configuration.component.html',
  styleUrls: ['./mode-configuration.component.scss']
})
export class ModeConfigurationComponent implements OnInit {
  configurations: ModeConfiguration[] = [];
  templateSets: TemplateSet[] = [];
  
  showCreateForm = false;
  newConfig = {
    mode_name: 'daily-login',
    month_year: this.getCurrentMonthYear(),
    template_set_id: 0,
    is_active: true,
    priority: 0
  };
  
  modes = [
    { value: 'daily-login', label: 'Daily Login' },
    { value: 'stage-farm', label: 'Stage Farm' },
    { value: 'pvp', label: 'PVP Battle' },
    { value: 'gacha', label: 'Gacha Pull' },
    { value: 'event', label: 'Event' },
    { value: 'custom', label: 'Custom' }
  ];
  
  filterMode: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadConfigurations();
    this.loadTemplateSets();
  }

  getCurrentMonthYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  getMonthOptions(): string[] {
    const options: string[] = [];
    const now = new Date();
    
    // Generate 6 months: 3 past, current, 2 future
    for (let i = -3; i <= 2; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      options.push(`${year}-${month}`);
    }
    
    return options;
  }

  formatMonthYear(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  loadConfigurations() {
    const url = this.filterMode 
      ? `/api/v1/mode-configs?mode_name=${this.filterMode}`
      : '/api/v1/mode-configs';
    
    this.http.get<any>(url).subscribe({
      next: (response) => {
        if (response.success) {
          this.configurations = response.configurations;
        }
      },
      error: (error) => {
        console.error('Failed to load configurations:', error);
      }
    });
  }

  loadTemplateSets() {
    this.http.get<any>('/api/v1/template-sets').subscribe({
      next: (response) => {
        if (response.success) {
          this.templateSets = response.template_sets;
        }
      },
      error: (error) => {
        console.error('Failed to load template sets:', error);
      }
    });
  }

  createConfiguration() {
    if (!this.newConfig.template_set_id || !this.newConfig.mode_name || !this.newConfig.month_year) {
      alert('Please fill in all required fields');
      return;
    }

    this.http.post<any>('/api/v1/mode-configs', this.newConfig).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadConfigurations();
          this.resetForm();
          this.showCreateForm = false;
          alert('Configuration created successfully!');
        }
      },
      error: (error) => {
        console.error('Failed to create configuration:', error);
        alert('Failed to create configuration');
      }
    });
  }

  toggleActive(config: ModeConfiguration) {
    const updateData = {
      is_active: !config.is_active
    };

    this.http.put<any>(`/api/v1/mode-configs/${config.id}`, updateData).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadConfigurations();
        }
      },
      error: (error) => {
        console.error('Failed to update configuration:', error);
        alert('Failed to update configuration');
      }
    });
  }

  deleteConfiguration(configId: number) {
    if (confirm('Are you sure you want to delete this configuration?')) {
      this.http.delete<any>(`/api/v1/mode-configs/${configId}`).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadConfigurations();
            alert('Configuration deleted successfully!');
          }
        },
        error: (error) => {
          console.error('Failed to delete configuration:', error);
          alert('Failed to delete configuration');
        }
      });
    }
  }

  resetForm() {
    this.newConfig = {
      mode_name: 'daily-login',
      month_year: this.getCurrentMonthYear(),
      template_set_id: 0,
      is_active: true,
      priority: 0
    };
  }

  onFilterChange() {
    this.loadConfigurations();
  }

  getTemplateSetName(setId: number): string {
    const set = this.templateSets.find(s => s.id === setId);
    return set ? set.name : 'Unknown';
  }
}
