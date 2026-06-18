import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { ProjectService } from '../../core/services/project.service';
import { BuildingService } from '../../core/services/building.service';
import { FloorService } from '../../core/services/floor.service';
import { ShopUnit } from '../../models/shop-unit.model';
import { Project } from '../../models/project.model';
import { Building } from '../../models/building.model';
import { Floor } from '../../models/floor.model';

@Component({
  selector: 'app-admin-shop-units',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './shop-units.html',
  styleUrl: './shop-units.scss'
})
export class AdminShopUnitsComponent implements OnInit {
  private shopUnitService = inject(ShopUnitService);
  private projectService = inject(ProjectService);
  private buildingService = inject(BuildingService);
  private floorService = inject(FloorService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  units: ShopUnit[] = [];
  projects: Project[] = [];
  buildings: Building[] = [];
  floors: Floor[] = [];

  isLoading = true;
  showForm = false;
  isEditMode = false;
  selectedUnitId: number | null = null;
  errorMessage = '';

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
    this.loadShopUnits();
    this.loadMetadata();
    
    // Auto-calculate yearly rent based on monthly rent input
    this.unitForm.get('monthlyRent')?.valueChanges.subscribe(val => {
      const monthly = Number(val || 0);
      this.unitForm.patchValue({
        yearlyRent: monthly * 12
      }, { emitEvent: false });
    });

    // Reset irrelevant fields when availability class changes
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

    this.cdr.detectChanges();
  }

  loadShopUnits() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.shopUnitService.getShopUnits().subscribe({
      next: (data) => {
        this.units = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMetadata() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        if (data.length > 0) this.unitForm.patchValue({ projectId: data[0].id });
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
    this.buildingService.getBuildings().subscribe({
      next: (data) => {
        this.buildings = data;
        if (data.length > 0) this.unitForm.patchValue({ buildingId: data[0].id });
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
    this.floorService.getFloors().subscribe({
      next: (data) => {
        this.floors = data;
        if (data.length > 0) this.unitForm.patchValue({ floorId: data[0].id });
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
    const defaultProjectId = this.projects.length > 0 ? this.projects[0].id : '';
    
    // Find buildings belonging to default project
    const defaultProjectBuildings = this.buildings.filter(b => b.projectId === defaultProjectId);
    const defaultBuildingId = defaultProjectBuildings.length > 0 ? defaultProjectBuildings[0].id : '';
    
    // Find floors belonging to default building
    const defaultBuildingFloors = this.floors.filter(f => f.buildingId === defaultBuildingId);
    const defaultFloorId = defaultBuildingFloors.length > 0 ? defaultBuildingFloors[0].id : '';

    this.unitForm.reset({
      projectId: defaultProjectId,
      buildingId: defaultBuildingId,
      floorId: defaultFloorId,
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

  openEditForm(u: ShopUnit) {
    this.isEditMode = true;
    this.errorMessage = '';
    this.selectedUnitId = u.shopOrUnitId || null;
    this.unitForm.patchValue({
      projectId: u.projectId,
      buildingId: u.buildingId,
      floorId: u.floorId,
      unitNumber: u.unitNumber,
      UnitType: u.unitType,
      areaSqft: u.areaSqft,
      availabilityType: u.availabilityType,
      status: u.status,
      monthlyRent: u.monthlyRent,
      yearlyRent: u.yearlyRent,
      salePrice: u.salePrice,
      bookingAmount: u.bookingAmount,
      maintenanceCharges: u.maintenanceCharges
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm() {
    this.showForm = false;
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (this.unitForm.valid) {
      const { UnitType, ...formVals } = this.unitForm.value;
      const payload = {
        ...formVals,
        unitType: UnitType,
        projectId: Number(this.unitForm.value.projectId),
        buildingId: Number(this.unitForm.value.buildingId),
        floorId: Number(this.unitForm.value.floorId),
        areaSqft: Number(this.unitForm.value.areaSqft),
        monthlyRent: Number(this.unitForm.value.monthlyRent || 0),
        yearlyRent: Number(this.unitForm.value.yearlyRent || 0),
        salePrice: Number(this.unitForm.value.salePrice || 0),
        bookingAmount: Number(this.unitForm.value.bookingAmount || 0),
        maintenanceCharges: Number(this.unitForm.value.maintenanceCharges || 0)
      };

      if (this.isEditMode && this.selectedUnitId !== null) {
        this.shopUnitService.updateShopUnit(this.selectedUnitId, payload).subscribe({
          next: () => {
            this.loadShopUnits();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = err.error?.message || 'Failed to update shop unit.';
            this.cdr.detectChanges();
          }
        });
      } else {
        this.shopUnitService.createShopUnit(payload).subscribe({
          next: () => {
            this.loadShopUnits();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = err.error?.message || 'Failed to create shop unit. Please check your inputs.';
            this.cdr.detectChanges();
          }
        });
      }
    }
  }

  onDelete(id: number) {
    if (confirm('Delete this shop unit specifications?')) {
      this.shopUnitService.deleteShopUnit(id).subscribe({
        next: () => {
          this.loadShopUnits();
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }

  getUnitsByFloor(floorId: number): ShopUnit[] {
    return this.units.filter(u => u.floorId === floorId);
  }

  getUnassignedUnits(): ShopUnit[] {
    const floorIds = this.floors.map(f => f.id);
    return this.units.filter(u => !floorIds.includes(u.floorId));
  }

  getProjectBuildingFloorName(floor: Floor): string {
    const building = this.buildings.find(b => b.id === floor.buildingId);
    const buildingName = building ? building.name : `Building #${floor.buildingId}`;
    const projectId = building ? building.projectId : 0;
    const project = this.projects.find(p => p.id === projectId);
    const projectName = project ? project.name : `Project #${projectId}`;
    return `${projectName} - ${buildingName} - ${floor.floorName}`;
  }

  getFilteredBuildings(): Building[] {
    const selectedProjectId = this.unitForm.get('projectId')?.value;
    if (!selectedProjectId) {
      return [];
    }
    const pId = Number(selectedProjectId);
    return this.buildings.filter(b => b.projectId === pId);
  }

  onProjectChange() {
    const filteredBuildings = this.getFilteredBuildings();
    if (filteredBuildings.length > 0) {
      this.unitForm.patchValue({ buildingId: filteredBuildings[0].id });
      this.onBuildingChange();
    } else {
      this.unitForm.patchValue({ buildingId: '', floorId: '' });
    }
    this.cdr.detectChanges();
  }

  getFilteredFloors(): Floor[] {
    const selectedBuildingId = this.unitForm.get('buildingId')?.value;
    if (!selectedBuildingId) {
      return [];
    }
    const bId = Number(selectedBuildingId);
    return this.floors.filter(f => f.buildingId === bId);
  }

  onBuildingChange() {
    const filtered = this.getFilteredFloors();
    if (filtered.length > 0) {
      this.unitForm.patchValue({ floorId: filtered[0].id });
    } else {
      this.unitForm.patchValue({ floorId: '' });
    }
    this.cdr.detectChanges();
  }
}
