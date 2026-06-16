import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss'
})
export class AdminProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  projects: Project[] = [];
  isLoading = true;
  showForm = false;
  isEditMode = false;
  selectedProjectId: number | null = null;

  projectForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    location: ['', Validators.required],
    projectType: ['COMMERCIAL', Validators.required],
    status: ['ONGOING', Validators.required],
    startDate: ['', Validators.required],
    expectedCompletionDate: ['', Validators.required]
  });

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.isLoading = true;
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openAddForm() {
    this.isEditMode = false;
    this.projectForm.reset({
      projectType: 'COMMERCIAL',
      status: 'ONGOING'
    });
    this.showForm = true;
  }

  openEditForm(project: Project) {
    this.isEditMode = true;
    this.selectedProjectId = project.id || null;
    this.projectForm.patchValue({
      name: project.name,
      description: project.description,
      location: project.location,
      projectType: project.projectType,
      status: project.status,
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      expectedCompletionDate: project.expectedCompletionDate ? project.expectedCompletionDate.split('T')[0] : ''
    });
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  onSubmit() {
    if (this.projectForm.valid) {
      if (this.isEditMode && this.selectedProjectId !== null) {
        this.projectService.updateProject(this.selectedProjectId, this.projectForm.value).subscribe({
          next: () => {
            this.loadProjects();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: () => {
            this.cdr.detectChanges();
          }
        });
      } else {
        this.projectService.createProject(this.projectForm.value).subscribe({
          next: () => {
            this.loadProjects();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: () => {
            this.cdr.detectChanges();
          }
        });
      }
    }
  }

  onDelete(id: number) {
    if (confirm('Are you sure you want to delete this project and all its associations?')) {
      this.projectService.deleteProject(id).subscribe({
        next: () => {
          this.loadProjects();
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }
}
