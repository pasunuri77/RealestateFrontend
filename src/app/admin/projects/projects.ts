import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { ProjectService } from '../../core/services/project.service';
import { BuildingService } from '../../core/services/building.service';
import { FloorService } from '../../core/services/floor.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { AuthService } from '../../core/services/auth.service';
import { Project } from '../../models/project.model';
import { Building } from '../../models/building.model';
import { Floor } from '../../models/floor.model';
import { ShopUnit } from '../../models/shop-unit.model';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss'
})
export class AdminProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private buildingService = inject(BuildingService);
  private floorService = inject(FloorService);
  private shopUnitService = inject(ShopUnitService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // Raw datasets
  projects: Project[] = [];
  buildings: Building[] = [];
  floors: Floor[] = [];
  units: ShopUnit[] = [];

  isLoading = true;
  showForm = false;
  isEditMode = false;
  errorMessage = '';

  // Which form type is active: 'PROJECT' | 'BUILDING' | 'FLOOR' | 'UNIT'
  activeFormType: 'PROJECT' | 'BUILDING' | 'FLOOR' | 'UNIT' | null = null;
  selectedId: number | null = null;

  // Expand / collapse states
  expandedProjects: { [id: number]: boolean } = {};
  expandedBuildings: { [id: number]: boolean } = {};
  expandedFloors: { [id: number]: boolean } = {};

  // Leaflet map state (Only used when activeFormType === 'PROJECT')
  private map!: L.Map;
  private marker: L.Marker | null = null;
  mapZoom = 12;

  // Autocomplete state variables (For Project Location)
  suggestions: any[] = [];
  showSuggestions = false;
  isLoadingSuggestions = false;
  noSuggestionsFound = false;
  activeSuggestionIndex = -1;
  searchQuery = '';
  private searchDebounceTimer: any;
  private abortController: AbortController | null = null;

  // Form Groups
  projectForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    location: ['', Validators.required],
    projectType: ['COMMERCIAL', Validators.required],
    status: ['ONGOING', Validators.required],
    startDate: ['', Validators.required],
    expectedCompletionDate: ['', Validators.required],
    latitude: ['', Validators.required],
    longitude: ['', Validators.required],
    ownerName: ['', Validators.required],
    ownerContact: ['', Validators.required]
  });

  buildingForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    name: ['', Validators.required],
    totalFloors: ['', [Validators.required, Validators.min(1)]],
    description: ['']
  });

  floorForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    buildingId: ['', Validators.required],
    floorName: ['', Validators.required],
    floorNumber: ['', [Validators.required]],
    description: [''],
    units: ['', [Validators.required, Validators.min(1)]]
  });

  unitForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    buildingId: ['', Validators.required],
    floorId: ['', Validators.required],
    unitNumber: ['', Validators.required],
    UnitType: ['OFFICE', Validators.required],
    areaSqft: ['', [Validators.required, Validators.min(1)]],
    availabilityType: ['LEASE', Validators.required],
    status: ['AVAILABLE', Validators.required],
    monthlyRent: [0],
    yearlyRent: [0],
    salePrice: [0],
    bookingAmount: [0],
    maintenanceCharges: [0]
  });

  ngOnInit() {
    this.loadHierarchy();

    // Auto-calculate yearly rent based on monthly rent input
    this.unitForm.get('monthlyRent')?.valueChanges.subscribe(val => {
      const monthly = Number(val || 0);
      this.unitForm.patchValue({
        yearlyRent: monthly * 12
      }, { emitEvent: false });
    });

    // Reset irrelevant fields when availability type changes
    this.unitForm.get('availabilityType')?.valueChanges.subscribe(val => {
      if (val === 'LEASE') {
        this.unitForm.patchValue({
          salePrice: 0,
          bookingAmount: 0
        });
      } else if (val === 'SALE') {
        this.unitForm.patchValue({
          monthlyRent: 0,
          yearlyRent: 0
        });
      }
      this.cdr.detectChanges();
    });

    // Cascading dropdown listeners inside unit form
    this.unitForm.get('projectId')?.valueChanges.subscribe(() => {
      this.onUnitProjectChange();
    });
    this.unitForm.get('buildingId')?.valueChanges.subscribe(() => {
      this.onUnitBuildingChange();
    });

    // Cascading dropdown listener inside floor form
    this.floorForm.get('projectId')?.valueChanges.subscribe(() => {
      this.onFloorProjectChange();
    });
  }

  loadHierarchy() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.buildingService.getBuildings().subscribe({
          next: (buildings) => {
            this.buildings = buildings;
            this.floorService.getFloors().subscribe({
              next: (floors) => {
                this.floors = floors;
                this.shopUnitService.getShopUnits().subscribe({
                  next: (units) => {
                    this.units = units;
                    this.isLoading = false;

                    // Expand first project by default
                    if (this.projects.length > 0 && Object.keys(this.expandedProjects).length === 0) {
                      this.expandedProjects[this.projects[0].id!] = true;
                    }
                    this.cdr.detectChanges();
                  },
                  error: () => { this.isLoading = false; this.cdr.detectChanges(); }
                });
              },
              error: () => { this.isLoading = false; this.cdr.detectChanges(); }
            });
          },
          error: () => { this.isLoading = false; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  // --- Expand / Collapse Actions ---
  toggleProject(projectId: number) {
    this.expandedProjects[projectId] = !this.expandedProjects[projectId];
    this.cdr.detectChanges();
  }

  toggleBuilding(buildingId: number) {
    this.expandedBuildings[buildingId] = !this.expandedBuildings[buildingId];
    this.cdr.detectChanges();
  }

  toggleFloor(floorId: number) {
    this.expandedFloors[floorId] = !this.expandedFloors[floorId];
    this.cdr.detectChanges();
  }

  // --- Accordion Hierarchy Data Getters ---
  getBuildingsForProject(projectId: number): Building[] {
    return this.buildings.filter(b => b.projectId === projectId);
  }

  getFloorsForBuilding(buildingId: number): Floor[] {
    return this.floors.filter(f => f.buildingId === buildingId);
  }

  getUnitsForFloor(floorId: number): ShopUnit[] {
    return this.units.filter(u => u.floorId === floorId);
  }

  // --- Hierarchical Stats Getters ---
  getFloorsCountForProject(projectId: number): number {
    const bIds = this.getBuildingsForProject(projectId).map(b => b.id);
    return this.floors.filter(f => bIds.includes(f.buildingId)).length;
  }

  getUnitsCountForProject(projectId: number): number {
    const bIds = this.getBuildingsForProject(projectId).map(b => b.id);
    return this.units.filter(u => bIds.includes(u.buildingId)).length;
  }

  getUnitsCountForBuilding(buildingId: number): number {
    return this.units.filter(u => u.buildingId === buildingId).length;
  }

  // --- Form presets and modal triggers ---
  openAddProject() {
    this.activeFormType = 'PROJECT';
    this.isEditMode = false;
    this.errorMessage = '';
    const currentUser = this.authService.currentUserSignal();
    const contactInfo = currentUser ? [
      currentUser.email,
      currentUser.phone
    ].filter(Boolean).join(', ') : '';

    this.projectForm.reset();
    this.projectForm.patchValue({
      projectType: 'COMMERCIAL',
      status: 'ONGOING',
      latitude: '',
      longitude: '',
      ownerName: currentUser ? currentUser.name : '',
      ownerContact: contactInfo
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

  getCompanyAddress(): string {
    return this.authService.currentUserSignal()?.companyAddress || '';
  }

  openEditProject(project: Project) {
    this.activeFormType = 'PROJECT';
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedId = project.id || null;
    this.projectForm.patchValue({
      name: project.name,
      description: project.description,
      location: project.location,
      projectType: project.projectType,
      status: project.status,
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      expectedCompletionDate: project.expectedCompletionDate ? project.expectedCompletionDate.split('T')[0] : '',
      latitude: project.latitude || '',
      longitude: project.longitude || '',
      ownerName: (project as any).ownerName || '',
      ownerContact: (project as any).ownerContact || ''
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

  openAddBuilding(projectId: number) {
    this.activeFormType = 'BUILDING';
    this.isEditMode = false;
    this.errorMessage = '';
    this.buildingForm.reset({
      projectId: projectId,
      totalFloors: 1
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditBuilding(building: Building) {
    this.activeFormType = 'BUILDING';
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedId = building.id || null;
    this.buildingForm.patchValue({
      projectId: building.projectId,
      name: building.name,
      totalFloors: building.totalFloors,
      description: building.description
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openAddFloor(projectId: number, buildingId: number) {
    this.activeFormType = 'FLOOR';
    this.isEditMode = false;
    this.errorMessage = '';
    this.floorForm.reset({
      projectId: projectId,
      buildingId: buildingId,
      floorNumber: 0,
      units: 1
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditFloor(floor: Floor) {
    this.activeFormType = 'FLOOR';
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedId = floor.id || null;

    const building = this.buildings.find(b => b.id === floor.buildingId);
    const projectId = building ? building.projectId : '';

    this.floorForm.patchValue({
      projectId: projectId,
      buildingId: floor.buildingId,
      floorName: floor.floorName,
      floorNumber: floor.floorNumber,
      description: floor.description,
      units: floor.units
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openAddUnit(projectId: number, buildingId: number, floorId: number) {
    this.activeFormType = 'UNIT';
    this.isEditMode = false;
    this.errorMessage = '';
    this.unitForm.reset({
      projectId: projectId,
      buildingId: buildingId,
      floorId: floorId,
      UnitType: 'OFFICE',
      availabilityType: 'LEASE',
      status: 'AVAILABLE',
      monthlyRent: 0,
      yearlyRent: 0,
      salePrice: 0,
      bookingAmount: 0,
      maintenanceCharges: 0
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditUnit(unit: ShopUnit) {
    this.activeFormType = 'UNIT';
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedId = unit.shopOrUnitId || null;
    this.unitForm.patchValue({
      projectId: unit.projectId,
      buildingId: unit.buildingId,
      floorId: unit.floorId,
      unitNumber: unit.unitNumber,
      UnitType: unit.unitType,
      areaSqft: unit.areaSqft,
      availabilityType: unit.availabilityType,
      status: unit.status,
      monthlyRent: unit.monthlyRent,
      yearlyRent: unit.yearlyRent,
      salePrice: unit.salePrice,
      bookingAmount: unit.bookingAmount,
      maintenanceCharges: unit.maintenanceCharges
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm() {
    this.showForm = false;
    this.activeFormType = null;
    this.selectedId = null;
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

  // --- Cascading Dropdown Handlers ---
  onFloorProjectChange() {
    const selectedProj = this.floorForm.get('projectId')?.value;
    if (!selectedProj) return;
    const filteredB = this.buildings.filter(b => b.projectId === Number(selectedProj));
    const currentB = this.floorForm.get('buildingId')?.value;
    if (filteredB.length > 0 && !filteredB.some(b => b.id === Number(currentB))) {
      this.floorForm.patchValue({ buildingId: filteredB[0].id });
    }
  }

  onUnitProjectChange() {
    const selectedProj = this.unitForm.get('projectId')?.value;
    if (!selectedProj) return;
    const filteredB = this.buildings.filter(b => b.projectId === Number(selectedProj));
    const currentB = this.unitForm.get('buildingId')?.value;
    if (filteredB.length > 0 && !filteredB.some(b => b.id === Number(currentB))) {
      this.unitForm.patchValue({ buildingId: filteredB[0].id });
    }
  }

  onUnitBuildingChange() {
    const selectedB = this.unitForm.get('buildingId')?.value;
    if (!selectedB) return;
    const filteredF = this.floors.filter(f => f.buildingId === Number(selectedB));
    const currentF = this.unitForm.get('floorId')?.value;
    if (filteredF.length > 0 && !filteredF.some(f => f.id === Number(currentF))) {
      this.unitForm.patchValue({ floorId: filteredF[0].id });
    }
  }

  getFilteredBuildingsForFloorForm(): Building[] {
    const pId = this.floorForm.get('projectId')?.value;
    return pId ? this.buildings.filter(b => b.projectId === Number(pId)) : [];
  }

  getFilteredBuildingsForUnitForm(): Building[] {
    const pId = this.unitForm.get('projectId')?.value;
    return pId ? this.buildings.filter(b => b.projectId === Number(pId)) : [];
  }

  getFilteredFloorsForUnitForm(): Floor[] {
    const bId = this.unitForm.get('buildingId')?.value;
    return bId ? this.floors.filter(f => f.buildingId === Number(bId)) : [];
  }

  // --- Form submission dispatcher ---
  onSubmit() {
    this.errorMessage = '';

    if (this.activeFormType === 'PROJECT') {
      if (this.projectForm.invalid) {
        this.projectForm.markAllAsTouched();
        this.errorMessage = 'Please fill out all required fields (Name, Location, Dates, and Coordinates).';
        this.cdr.detectChanges();
        return;
      }
      const currentUser = this.authService.currentUserSignal();
      const contactVal = this.projectForm.value.ownerContact;
      const finalContact = !this.isEditMode && currentUser?.companyAddress
        ? `${contactVal}\nAddress: ${currentUser.companyAddress}`
        : contactVal;

      const payload = {
        ...this.projectForm.value,
        ownerContact: finalContact,
        latitude: Number(this.projectForm.value.latitude),
        longitude: Number(this.projectForm.value.longitude)
      };
      if (this.isEditMode && this.selectedId !== null) {
        this.projectService.updateProject(this.selectedId, payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to update project.'; this.cdr.detectChanges(); }
        });
      } else {
        this.projectService.createProject(payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to create project.'; this.cdr.detectChanges(); }
        });
      }
    } else if (this.activeFormType === 'BUILDING') {
      if (this.buildingForm.invalid) {
        this.buildingForm.markAllAsTouched();
        this.errorMessage = 'Please fill out all required fields.';
        this.cdr.detectChanges();
        return;
      }
      const payload = {
        ...this.buildingForm.value,
        projectId: Number(this.buildingForm.value.projectId)
      };
      if (this.isEditMode && this.selectedId !== null) {
        this.buildingService.updateBuilding(this.selectedId, payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to update building block.'; this.cdr.detectChanges(); }
        });
      } else {
        this.buildingService.createBuilding(payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to create building block.'; this.cdr.detectChanges(); }
        });
      }
    } else if (this.activeFormType === 'FLOOR') {
      if (this.floorForm.invalid) {
        this.floorForm.markAllAsTouched();
        this.errorMessage = 'Please fill out all required fields.';
        this.cdr.detectChanges();
        return;
      }
      const { projectId, ...formVals } = this.floorForm.value;
      const payload = {
        ...formVals,
        buildingId: Number(formVals.buildingId),
        floorNumber: Number(formVals.floorNumber),
        units: Number(formVals.units)
      };
      if (this.isEditMode && this.selectedId !== null) {
        this.floorService.updateFloor(this.selectedId, payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to update floor.'; this.cdr.detectChanges(); }
        });
      } else {
        this.floorService.createFloor(payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to create floor.'; this.cdr.detectChanges(); }
        });
      }
    } else if (this.activeFormType === 'UNIT') {
      if (this.unitForm.invalid) {
        this.unitForm.markAllAsTouched();
        this.errorMessage = 'Please fill out all required fields.';
        this.cdr.detectChanges();
        return;
      }
      const { UnitType, ...formVals } = this.unitForm.value;
      const payload = {
        ...formVals,
        unitType: UnitType,
        projectId: Number(formVals.projectId),
        buildingId: Number(formVals.buildingId),
        floorId: Number(formVals.floorId),
        areaSqft: Number(formVals.areaSqft),
        monthlyRent: Number(formVals.monthlyRent || 0),
        yearlyRent: Number(formVals.yearlyRent || 0),
        salePrice: Number(formVals.salePrice || 0),
        bookingAmount: Number(formVals.bookingAmount || 0),
        maintenanceCharges: Number(formVals.maintenanceCharges || 0)
      };
      if (this.isEditMode && this.selectedId !== null) {
        this.shopUnitService.updateShopUnit(this.selectedId, payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to update unit.'; this.cdr.detectChanges(); }
        });
      } else {
        this.shopUnitService.createShopUnit(payload).subscribe({
          next: () => { this.loadHierarchy(); this.closeForm(); },
          error: (err) => { this.errorMessage = err.error?.message || 'Failed to create unit.'; this.cdr.detectChanges(); }
        });
      }
    }
  }

  // --- Deletion Handlers ---
  onDeleteProject(id: number) {
    if (confirm('Are you sure you want to delete this project and all its associated buildings, floors, and units?')) {
      this.projectService.deleteProject(id).subscribe({
        next: () => this.loadHierarchy(),
        error: (err) => alert(err.error?.message || 'Failed to delete project.')
      });
    }
  }

  onDeleteBuilding(id: number) {
    if (confirm('Are you sure you want to delete this building and all its floors and units?')) {
      this.buildingService.deleteBuilding(id).subscribe({
        next: () => this.loadHierarchy(),
        error: (err) => alert(err.error?.message || 'Failed to delete building.')
      });
    }
  }

  onDeleteFloor(id: number) {
    if (confirm('Are you sure you want to delete this floor and all its units?')) {
      this.floorService.deleteFloor(id).subscribe({
        next: () => this.loadHierarchy(),
        error: (err) => alert(err.error?.message || 'Failed to delete floor.')
      });
    }
  }

  onDeleteUnit(id: number) {
    if (confirm('Are you sure you want to delete this unit?')) {
      this.shopUnitService.deleteShopUnit(id).subscribe({
        next: () => this.loadHierarchy(),
        error: (err) => alert(err.error?.message || 'Failed to delete unit.')
      });
    }
  }

  // --- Leaflet Map Integration (For Projects) ---
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

      const defaultIcon = L.divIcon({
        html: `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#123047" width="28" height="28">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `,
        className: 'custom-leaflet-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
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

  // --- Photon Geocoder Autocomplete (For Projects) ---
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

    const url = this.buildAddressSearchUrl(query, 6, true);

    fetch(url, { signal: this.abortController.signal })
      .then(res => res.json())
      .then(data => {
        this.processFeatures(data, query, true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("Photon Geocoder Error:", err);
          this.fallbackSearch(query);
        }
      });
  }

  private fallbackSearch(query: string) {
    const fallbackUrl = this.buildAddressSearchUrl(query, 6, false);
    fetch(fallbackUrl)
      .then(res => res.json())
      .then(data => {
        this.processFeatures(data, query, false);
      })
      .catch(err => {
        console.error("Photon Fallback Geocoder Error:", err);
        this.isLoadingSuggestions = false;
        this.suggestions = [];
        this.noSuggestionsFound = true;
        this.cdr.detectChanges();
      });
  }

  private processFeatures(data: any, query: string, isFirstAttempt: boolean) {
    this.isLoadingSuggestions = false;
    if (data && data.features && data.features.length > 0) {
      let mapped = data.features.map((f: any) => this.mapAddressSuggestion(f));
      mapped = this.sortSuggestions(mapped, query);
      this.suggestions = mapped;
      this.noSuggestionsFound = this.suggestions.length === 0;
    } else {
      if (isFirstAttempt) {
        this.fallbackSearch(query);
      } else {
        this.suggestions = [];
        this.noSuggestionsFound = true;
      }
    }
    this.cdr.detectChanges();
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
    const fullLocationName = item.fullAddress || item.name;
    this.searchQuery = fullLocationName;
    this.showSuggestions = false;
    this.suggestions = [];
    this.activeSuggestionIndex = -1;

    this.projectForm.patchValue({
      location: fullLocationName,
      latitude: item.lat,
      longitude: item.lng
    });

    if (this.map) {
      this.map.setView([item.lat, item.lng], 15);

      const defaultIcon = L.divIcon({
        html: `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#123047" width="28" height="28">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `,
        className: 'custom-leaflet-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
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
    return item.details || [item.city, item.state, item.country].filter(Boolean).join(', ');
  }

  private buildAddressSearchUrl(query: string, limit: number, useBias: boolean = true): string {
    const exactAddressPrompt = this.buildExactAddressPrompt(query);
    const params = new URLSearchParams({
      q: exactAddressPrompt,
      limit: String(limit),
      countrycode: 'in'
    });

    if (useBias) {
      params.append('lat', '17.3850');
      params.append('lon', '78.4867');
      params.append('location_bias_scale', '0.1');
    }

    return `https://photon.komoot.io/api/?${params.toString()}`;
  }

  private buildExactAddressPrompt(query: string): string {
    let cleanQuery = query.trim().replace(/\s+/g, ' ');
    
    // Normalize abbreviations
    cleanQuery = cleanQuery.replace(/\bap\b/i, 'Andhra Pradesh');
    cleanQuery = cleanQuery.replace(/\bts\b/i, 'Telangana');

    if (!/\bindia\b/i.test(cleanQuery)) {
      cleanQuery = `${cleanQuery}, India`;
    }

    return cleanQuery;
  }

  private sortSuggestions(items: any[], query: string): any[] {
    const lowerQuery = query.toLowerCase();
    let targetState = '';
    if (lowerQuery.includes('andhra') || lowerQuery.includes('ap')) {
      targetState = 'andhra pradesh';
    } else if (lowerQuery.includes('telangana') || lowerQuery.includes('ts')) {
      targetState = 'telangana';
    }

    return items.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aAddress = (a.fullAddress || '').toLowerCase();
      const bAddress = (b.fullAddress || '').toLowerCase();
      const aCity = (a.city || '').toLowerCase();
      const bCity = (b.city || '').toLowerCase();
      const aState = (a.state || '').toLowerCase();
      const bState = (b.state || '').toLowerCase();

      if (targetState) {
        const aMatchesState = aState.includes(targetState) || aAddress.includes(targetState);
        const bMatchesState = bState.includes(targetState) || bAddress.includes(targetState);
        if (aMatchesState && !bMatchesState) return -1;
        if (!aMatchesState && bMatchesState) return 1;
      }

      const aCityExact = aCity && lowerQuery.includes(aCity);
      const bCityExact = bCity && lowerQuery.includes(bCity);
      if (aCityExact && !bCityExact) return -1;
      if (!aCityExact && bCityExact) return 1;

      const aExact = aName === lowerQuery;
      const bExact = bName === lowerQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aName.startsWith(lowerQuery);
      const bStarts = bName.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });
  }

  private mapAddressSuggestion(feature: any) {
    const props = feature.properties || {};
    const primary = [props.housenumber, props.street || props.name].filter(Boolean).join(' ');
    const fallbackName = props.name || props.street || props.city || this.searchQuery;
    const name = primary || fallbackName;
    const detailsParts = [
      props.locality,
      props.city || props.district,
      props.state,
      props.postcode,
      props.country
    ].filter(Boolean);
    const uniqueDetails = detailsParts.filter((value, index, self) => self.indexOf(value) === index);
    const fullAddressParts = [name, ...uniqueDetails];

    return {
      name,
      fullAddress: fullAddressParts.filter(Boolean).join(', '),
      details: uniqueDetails.join(', '),
      city: props.city || props.locality || props.district || '',
      state: props.state || '',
      country: props.country || '',
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0]
    };
  }

  redirectToDesignatedPage(type: string) {
    if (type === 'LEASE') {
      this.router.navigate(['/admin/lease-requests']);
    } else if (type === 'SALE') {
      this.router.navigate(['/admin/purchase-requests']);
    }
  }
}
