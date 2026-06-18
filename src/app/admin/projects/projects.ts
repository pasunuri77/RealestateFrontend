import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as L from 'leaflet';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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

  // Leaflet map state
  private map!: L.Map;
  private marker: L.Marker | null = null;
  mapZoom = 12;

  // Autocomplete state variables
  suggestions: any[] = [];
  showSuggestions = false;
  isLoadingSuggestions = false;
  noSuggestionsFound = false;
  activeSuggestionIndex = -1;
  searchQuery = '';
  private searchDebounceTimer: any;
  private abortController: AbortController | null = null;

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
    this.cdr.detectChanges();
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

  initAdminMap(lat: number, lng: number) {
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }

    setTimeout(() => {
      const mapEl = document.getElementById('admin-map');
      if (!mapEl) return;

      this.map = L.map('admin-map', {
        zoomControl: true,
        attributionControl: true
      }).setView([lat, lng], this.mapZoom);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);

      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41]
      });

      if (lat && lng) {
        this.marker = L.marker([lat, lng], { icon: defaultIcon }).addTo(this.map);
      }

      this.map.on('click', (event: L.LeafletMouseEvent) => {
        const newLat = event.latlng.lat;
        const newLng = event.latlng.lng;

        if (this.marker) {
          this.marker.setLatLng([newLat, newLng]);
        } else {
          this.marker = L.marker([newLat, newLng], { icon: defaultIcon }).addTo(this.map);
        }

        this.projectForm.patchValue({
          latitude: newLat,
          longitude: newLng
        });
        this.cdr.detectChanges();
      });
    }, 100);
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
    this.marker = null;
    this.mapZoom = 12;
    this.searchQuery = '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.activeSuggestionIndex = -1;
    this.showForm = true;
    this.cdr.detectChanges();
    this.initAdminMap(17.3850, 78.4867);
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

    const lat = project.latitude ? Number(project.latitude) : 17.3850;
    const lng = project.longitude ? Number(project.longitude) : 78.4867;
    this.mapZoom = project.latitude && project.longitude ? 15 : 12;

    this.searchQuery = project.location || '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.activeSuggestionIndex = -1;

    this.showForm = true;
    this.cdr.detectChanges();
    this.initAdminMap(lat, lng);
  }

  closeForm() {
    this.showForm = false;
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }
    this.marker = null;
    this.searchQuery = '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.activeSuggestionIndex = -1;
    this.cdr.detectChanges();
  }

  // Autocomplete recommendation methods
  onSearchInput(event: any) {
    const val = event.target.value;
    this.searchQuery = val;
    this.activeSuggestionIndex = -1;

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    if (!val || val.trim().length < 3) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.noSuggestionsFound = false;
      this.isLoadingSuggestions = false;
      this.cdr.detectChanges();
      return;
    }

    this.showSuggestions = true;
    this.isLoadingSuggestions = true;
    this.noSuggestionsFound = false;
    this.cdr.detectChanges();

    this.searchDebounceTimer = setTimeout(() => {
      this.fetchSuggestions(val.trim());
    }, 300);
  }

  fetchSuggestions(query: string) {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=17.3850&lon=78.4867&limit=6`;

    fetch(url, { signal: this.abortController.signal })
      .then(res => res.json())
      .then(data => {
        this.isLoadingSuggestions = false;
        if (data && data.features && data.features.length > 0) {
          this.suggestions = data.features.map((f: any) => ({
            name: f.properties.name || f.properties.street || '',
            city: f.properties.city || f.properties.locality || f.properties.district || '',
            state: f.properties.state || '',
            country: f.properties.country || '',
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0]
          }));
          this.noSuggestionsFound = this.suggestions.length === 0;
        } else {
          this.suggestions = [];
          this.noSuggestionsFound = true;
        }
        this.cdr.detectChanges();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("Photon Geocoder Error:", err);
          this.isLoadingSuggestions = false;
          this.suggestions = [];
          this.noSuggestionsFound = true;
          this.cdr.detectChanges();
        }
      });
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (!this.showSuggestions) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex = (this.activeSuggestionIndex + 1) % this.suggestions.length;
      this.cdr.detectChanges();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex = (this.activeSuggestionIndex - 1 + this.suggestions.length) % this.suggestions.length;
      this.cdr.detectChanges();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.showSuggestions = false;
      this.cdr.detectChanges();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeSuggestionIndex >= 0 && this.activeSuggestionIndex < this.suggestions.length) {
        this.selectSuggestion(this.suggestions[this.activeSuggestionIndex]);
      } else if (this.suggestions.length > 0) {
        this.selectSuggestion(this.suggestions[0]);
      }
      this.cdr.detectChanges();
    }
  }

  selectSuggestion(item: any) {
    const fullLocationName = [item.name, item.city].filter(Boolean).join(', ');
    this.searchQuery = fullLocationName;
    this.showSuggestions = false;
    this.suggestions = [];
    this.activeSuggestionIndex = -1;

    // Update form controls
    this.projectForm.patchValue({
      location: fullLocationName,
      latitude: item.lat,
      longitude: item.lng
    });

    if (this.map) {
      this.map.setView([item.lat, item.lng], 15);
      
      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41]
      });

      if (this.marker) {
        this.marker.setLatLng([item.lat, item.lng]);
      } else {
        this.marker = L.marker([item.lat, item.lng], { icon: defaultIcon }).addTo(this.map);
      }
    }
    this.cdr.detectChanges();
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSuggestions = false;
      this.cdr.detectChanges();
    }, 200);
  }

  formatDetails(item: any): string {
    return [item.city, item.state, item.country].filter(Boolean).join(', ');
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
}
