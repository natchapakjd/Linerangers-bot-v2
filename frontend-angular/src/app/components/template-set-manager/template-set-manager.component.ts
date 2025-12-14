import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface TemplateSet {
  id: number;
  name: string;
  description: string;
  category: string;
  workflow_count: number;
  created_at: string;
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  is_master: boolean;
}

@Component({
  selector: 'app-template-set-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-set-manager.component.html',
  styleUrls: ['./template-set-manager.component.scss']
})
export class TemplateSetManagerComponent implements OnInit {
  templateSets: TemplateSet[] = [];
  workflows: Workflow[] = [];
  selectedSet: TemplateSet | null = null;
  selectedSetWorkflows: Workflow[] = [];
  
  // Form data
  showCreateForm = false;
  newSet = {
    name: '',
    description: '',
    category: 'daily-login'
  };
  
  categories = [
    { value: 'daily-login', label: 'Daily Login' },
    { value: 'stage-farm', label: 'Stage Farm' },
    { value: 'pvp', label: 'PVP' },
    { value: 'gacha', label: 'Gacha' },
    { value: 'event', label: 'Event' },
    { value: 'other', label: 'Other' }
  ];
  
  filterCategory: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTemplateSets();
    this.loadWorkflows();
  }

  loadTemplateSets() {
    const url = this.filterCategory 
      ? `/api/v1/template-sets?category=${this.filterCategory}`
      : '/api/v1/template-sets';
    
    this.http.get<any>(url).subscribe({
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

  loadWorkflows() {
    this.http.get<any>('/api/v1/workflows').subscribe({
      next: (response) => {
        if (response.success) {
          this.workflows = response.workflows;
        }
      },
      error: (error) => {
        console.error('Failed to load workflows:', error);
      }
    });
  }

  selectTemplateSet(set: TemplateSet) {
    this.selectedSet = set;
    this.loadSetWorkflows(set.id);
  }

  loadSetWorkflows(setId: number) {
    this.http.get<any>(`/api/v1/template-sets/${setId}/workflows`).subscribe({
      next: (response) => {
        if (response.success) {
          this.selectedSetWorkflows = response.workflows;
        }
      },
      error: (error) => {
        console.error('Failed to load set workflows:', error);
      }
    });
  }

  createTemplateSet() {
    if (!this.newSet.name || !this.newSet.category) {
      alert('Please fill in required fields');
      return;
    }

    this.http.post<any>('/api/v1/template-sets', this.newSet).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadTemplateSets();
          this.resetForm();
          this.showCreateForm = false;
          alert('Template set created successfully!');
        }
      },
      error: (error) => {
        console.error('Failed to create template set:', error);
        alert('Failed to create template set');
      }
    });
  }

  deleteTemplateSet(setId: number) {
    if (confirm('Are you sure you want to delete this template set?')) {
      this.http.delete<any>(`/api/v1/template-sets/${setId}`).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadTemplateSets();
            if (this.selectedSet?.id === setId) {
              this.selectedSet = null;
              this.selectedSetWorkflows = [];
            }
            alert('Template set deleted successfully!');
          }
        },
        error: (error) => {
          console.error('Failed to delete template set:', error);
          alert('Failed to delete template set');
        }
      });
    }
  }

  addWorkflowToSet(workflowId: number) {
    if (!this.selectedSet) return;

    this.http.post<any>(
      `/api/v1/template-sets/${this.selectedSet.id}/workflows/${workflowId}`,
      {}
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadSetWorkflows(this.selectedSet!.id);
          this.loadTemplateSets(); // Refresh count
          alert('Workflow added to set!');
        }
      },
      error: (error) => {
        console.error('Failed to add workflow:', error);
        alert('Failed to add workflow to set');
      }
    });
  }

  removeWorkflowFromSet(workflowId: number) {
    if (!this.selectedSet) return;

    this.http.delete<any>(
      `/api/v1/template-sets/${this.selectedSet.id}/workflows/${workflowId}`
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadSetWorkflows(this.selectedSet!.id);
          this.loadTemplateSets(); // Refresh count
          alert('Workflow removed from set!');
        }
      },
      error: (error) => {
        console.error('Failed to remove workflow:', error);
        alert('Failed to remove workflow from set');
      }
    });
  }

  isWorkflowInSet(workflowId: number): boolean {
    return this.selectedSetWorkflows.some(w => w.id === workflowId);
  }

  resetForm() {
    this.newSet = {
      name: '',
      description: '',
      category: 'daily-login'
    };
  }

  onCategoryFilterChange() {
    this.loadTemplateSets();
  }
}
