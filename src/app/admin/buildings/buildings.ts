import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { BuildingService } from '../../core/services/building.service';
import { ProjectService } from '../../core/services/project.service';
import { Building } from '../../models/building.model';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-admin-buildings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GoogleMapsModule],
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

  // Google Maps state
  mapCenter: google.maps.LatLngLiteral = { lat: 17.3850, lng: 78.4867 };
  mapZoom = 12;
  markerPosition: google.maps.LatLngLiteral | null = null;
  mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  };

  // Autocomplete initialization using ViewChild setter
  @ViewChild('searchBox') set searchBox(element: ElementRef<HTMLInputElement> | undefined) {
    if (element) {
      this.initAutocomplete(element.nativeElement);
    }
  }

  buildingForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    name: ['', Validators.required],
    totalFloors: ['', [Validators.required, Validators.min(1)]],
    description: [''],
    address: ['', Validators.required],
    latitude: ['', Validators.required],
    longitude: ['', Validators.required]
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
      totalFloors: 1,
      address: '',
      latitude: '',
      longitude: ''
    });
    this.mapCenter = { lat: 17.3850, lng: 78.4867 };
    this.markerPosition = null;
    this.mapZoom = 12;
    this.showForm = true;
  }

  openEditForm(b: Building) {
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedBuildingId = b.id || null;
    this.buildingForm.patchValue({
      projectId: b.projectId,
      name: b.name,
      totalFloors: b.totalFloors,
      description: b.description,
      address: b.address || '',
      latitude: b.latitude || '',
      longitude: b.longitude || ''
    });

    if (b.latitude && b.longitude) {
      const coords = { lat: Number(b.latitude), lng: Number(b.longitude) };
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
    if (this.buildingForm.valid) {
      const payload = {
        ...this.buildingForm.value,
        projectId: Number(this.buildingForm.value.projectId),
        latitude: Number(this.buildingForm.value.latitude),
        longitude: Number(this.buildingForm.value.longitude)
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

  // Handle click on map to set/update marker location
  onMapClick(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      this.markerPosition = { lat, lng };
      this.buildingForm.patchValue({
        latitude: lat,
        longitude: lng
      });
      this.cdr.detectChanges();
    }
  }

  // Initialize Google Places Autocomplete search box
  initAutocomplete(input: HTMLInputElement) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Google Maps JavaScript API has not loaded yet.');
      return;
    }
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ['geometry', 'formatted_address']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || '';

        this.mapCenter = { lat, lng };
        this.markerPosition = { lat, lng };
        this.mapZoom = 15;

        this.buildingForm.patchValue({
          address: address,
          latitude: lat,
          longitude: lng
        });
        this.cdr.detectChanges();
      }
    });
  }
}
