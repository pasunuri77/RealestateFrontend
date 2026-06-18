import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BuildingService } from '../../core/services/building.service';
import { ProjectService } from '../../core/services/project.service';
import { Building } from '../../models/building.model';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-admin-buildings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './buildings.html',
  styleUrl: './buildings.scss'
})
export class AdminBuildingsComponent implements OnInit {
  private buildingService = inject(BuildingService);
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  buildings: Building[] = [];
  projects: Project[] = [];
  isLoading = true;
  showForm = false;
  isEditMode = false;
  selectedBuildingId: number | null = null;
  errorMessage = '';

  buildingForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    name: ['', Validators.required],
    totalFloors: ['', [Validators.required, Validators.min(1)]],
    description: ['']
  });

  ngOnInit() {
    this.loadBuildings();
    this.loadProjects();
  }

  loadBuildings() {
    this.isLoading = true;
    this.buildingService.getBuildings().subscribe({
      next: (data) => {
        this.buildings = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        if (data.length > 0) {
          this.buildingForm.patchValue({ projectId: data[0].id });
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  openAddForm() {
    this.isEditMode = false;
    this.errorMessage = '';
    this.buildingForm.reset({
      projectId: this.projects.length > 0 ? this.projects[0].id : '',
      totalFloors: 1
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditForm(b: Building) {
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedBuildingId = b.id || null;
    this.buildingForm.patchValue({
      projectId: b.projectId,
      name: b.name,
      totalFloors: b.totalFloors,
      description: b.description
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm() {
    this.showForm = false;
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (this.buildingForm.valid) {
      const payload = {
        ...this.buildingForm.value,
        projectId: Number(this.buildingForm.value.projectId)
      };

      if (this.isEditMode && this.selectedBuildingId !== null) {
        this.buildingService.updateBuilding(this.selectedBuildingId, payload).subscribe({
          next: () => {
            this.loadBuildings();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = err.error?.message || 'Failed to update building block.';
            this.cdr.detectChanges();
          }
        });
      } else {
        this.buildingService.createBuilding(payload).subscribe({
          next: () => {
            this.loadBuildings();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = err.error?.message || 'Failed to create building block. Please check your inputs.';
            this.cdr.detectChanges();
          }
        });
      }
    }
  }

  onDelete(id: number) {
    if (confirm('Delete this building Block?')) {
      this.buildingService.deleteBuilding(id).subscribe({
        next: () => {
          this.loadBuildings();
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }

  getBuildingsByProject(projectId: number): Building[] {
    return this.buildings.filter(b => b.projectId === projectId);
  }

  getUnassignedBuildings(): Building[] {
    const projectIds = this.projects.map(p => p.id);
    return this.buildings.filter(b => !projectIds.includes(b.projectId));
  }

  getProjectName(projectId: number): string {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : `Project #${projectId}`;
  }
}
