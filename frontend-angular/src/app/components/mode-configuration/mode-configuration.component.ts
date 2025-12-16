import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

interface Workflow {
  id: number;
  name: string;
  description: string;
  mode_name?: string;
  month_year?: string;
  is_master: boolean;
  steps: any[];
}

interface ModeConfig {
  mode_name: string;
  label: string;
  description: string;
  icon: string;
  workflow_id?: number;
  workflow_name?: string;
}

@Component({
  selector: 'app-mode-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mode-configuration.component.html',
  styleUrls: ['./mode-configuration.component.scss']
})
export class ModeConfigurationComponent implements OnInit {
  // All available workflows
  workflows = signal<Workflow[]>([]);
  
  // Mode configurations
  modes: ModeConfig[] = [
    { mode_name: 'daily-login', label: 'Daily Login', description: 'สแกนไฟล์ XML → รันเกม → Claim rewards → ปิดเกม', icon: '📅' },
    { mode_name: 'stage-farm', label: 'Stage Farm', description: 'ฟาร์มด่านอัตโนมัติ', icon: '⚔️' },
    { mode_name: 'gai-ruby', label: 'Gai Ruby', description: 'เก็บรูบี้อัตโนมัติ', icon: '💎' },
    { mode_name: 'event', label: 'Event', description: 'กิจกรรมพิเศษ', icon: '🎉' },
    { mode_name: 'custom', label: 'Custom', description: 'กำหนดเอง', icon: '🔧' }
  ];
  
  // Current month/year
  currentMonthYear = this.getCurrentMonthYear();
  
  // Loading state
  isLoading = signal(false);

  ngOnInit() {
    this.loadWorkflows();
    this.loadModeConfigurations();
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
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
  }

  async loadWorkflows(): Promise<void> {
    try {
      const response = await fetch('/api/v1/workflows');
      const result = await response.json();
      
      if (result.success) {
        this.workflows.set(result.workflows);
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }

  async loadModeConfigurations(): Promise<void> {
    this.isLoading.set(true);
    
    try {
      // Load workflow for each mode
      for (const mode of this.modes) {
        const response = await fetch(`/api/v1/workflows/mode/${mode.mode_name}?month_year=${this.currentMonthYear}`);
        const result = await response.json();
        
        if (result.success && result.workflow) {
          mode.workflow_id = result.workflow.id;
          mode.workflow_name = result.workflow.name;
        } else {
          mode.workflow_id = undefined;
          mode.workflow_name = undefined;
        }
      }
    } catch (error) {
      console.error('Failed to load mode configurations:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async assignWorkflowToMode(mode: ModeConfig, workflowId: number | undefined): Promise<void> {
    if (!workflowId) {
      // Clear the assignment by setting mode_name to null on the workflow
      if (mode.workflow_id) {
        await this.updateWorkflowMode(mode.workflow_id, null, null);
      }
      mode.workflow_id = undefined;
      mode.workflow_name = undefined;
      return;
    }
    
    try {
      // Update the selected workflow to have this mode_name and month_year
      const response = await fetch(`/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode_name: mode.mode_name,
          month_year: this.currentMonthYear
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const workflow = this.workflows().find(w => w.id === workflowId);
        mode.workflow_id = workflowId;
        mode.workflow_name = workflow?.name || 'Unknown';
        
        await Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          text: `กำหนด ${workflow?.name} ให้กับโหมด ${mode.label}`,
          timer: 2000,
          showConfirmButton: false
        });
        
        // Reload to ensure consistency
        await this.loadWorkflows();
      } else {
        throw new Error(result.message || 'Failed to assign workflow');
      }
    } catch (error) {
      console.error('Failed to assign workflow:', error);
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถบันทึกการตั้งค่าได้'
      });
    }
  }

  private async updateWorkflowMode(workflowId: number, modeName: string | null, monthYear: string | null): Promise<void> {
    await fetch(`/api/v1/workflows/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode_name: modeName,
        month_year: monthYear
      })
    });
  }

  getWorkflowsForSelection(): Workflow[] {
    // Return all workflows
    return this.workflows();
  }

  getStepsSummary(workflow: Workflow | undefined): string {
    if (!workflow || !workflow.steps) return '';
    const stepCount = workflow.steps.length;
    return `${stepCount} step${stepCount !== 1 ? 's' : ''}`;
  }

  async onMonthChange(): Promise<void> {
    await this.loadModeConfigurations();
  }

  getWorkflowById(id: number | undefined): Workflow | undefined {
    if (!id) return undefined;
    return this.workflows().find(w => w.id === id);
  }
}
