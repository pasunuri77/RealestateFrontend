import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GoogleMapsModule],
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
  errorMessage = '';

  // Google Maps state
  mapCenter: google.maps.LatLngLiteral = { lat: 17.3850, lng: 78.4867 };
  mapZoom = 12;
  markerPosition: google.maps.LatLngLiteral | null = null;
  mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  };

  projectForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    location: ['', Validators.required],
    projectType: ['COMMERCIAL', Validators.required],
    status: ['ONGOING', Validators.required],
    startDate: ['', Validators.required],
    expectedCompletionDate: ['', Validators.required],
    latitude: ['', Validators.required],
    longitude: ['', Validators.required]
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
    this.errorMessage = '';
    this.projectForm.reset({
      projectType: 'COMMERCIAL',
      status: 'ONGOING',
      latitude: '',
      longitude: ''
    });
    this.mapCenter = { lat: 17.3850, lng: 78.4867 };
    this.markerPosition = null;
    this.mapZoom = 12;
    this.showForm = true;
  }

  openEditForm(project: Project) {
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedProjectId = project.id || null;
    this.projectForm.patchValue({
      name: project.name,
      description: project.description,
      location: project.location,
      projectType: project.projectType,
      status: project.status,
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      expectedCompletionDate: project.expectedCompletionDate ? project.expectedCompletionDate.split('T')[0] : '',
      latitude: project.latitude || '',
      longitude: project.longitude || ''
    });

    if (project.latitude && project.longitude) {
      const coords = { lat: Number(project.latitude), lng: Number(project.longitude) };
      this.mapCenter = coords;
      this.markerPosition = coords;
      this.mapZoom = 15;
    } else {
      this.mapCenter = { lat: 17.3850, lng: 78.4867 };
      this.markerPosition = null;
      this.mapZoom = 12;
    }
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  onSubmit() {
    if (this.projectForm.valid) {
      const payload = {
        ...this.projectForm.value,
        latitude: Number(this.projectForm.value.latitude),
        longitude: Number(this.projectForm.value.longitude)
      };

      if (this.isEditMode && this.selectedProjectId !== null) {
        this.projectService.updateProject(this.selectedProjectId, payload).subscribe({
          next: () => {
            this.loadProjects();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            this.errorMessage = err.error?.message || 'Failed to update project.';
            this.cdr.detectChanges();
          }
        });
      } else {
        this.projectService.createProject(payload).subscribe({
          next: () => {
            this.loadProjects();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            this.errorMessage = err.error?.message || 'Failed to create project.';
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

  onMapClick(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      this.markerPosition = { lat, lng };
      this.projectForm.patchValue({
        latitude: lat,
        longitude: lng
      });
      this.cdr.detectChanges();
    }
  }
}
