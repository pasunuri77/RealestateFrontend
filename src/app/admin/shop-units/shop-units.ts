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
    unitType: ['OFFICE', Validators.required],
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
    this.unitForm.reset({
      projectId: this.projects.length > 0 ? this.projects[0].id : '',
      buildingId: this.buildings.length > 0 ? this.buildings[0].id : '',
      floorId: this.floors.length > 0 ? this.floors[0].id : '',
      unitType: 'OFFICE',
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
      unitType: u.unitType,
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
      const payload = {
        ...this.unitForm.value,
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

  getUnitsByBuilding(buildingId: number): ShopUnit[] {
    return this.units.filter(u => u.buildingId === buildingId);
  }

  getUnassignedUnits(): ShopUnit[] {
    const buildingIds = this.buildings.map(b => b.id);
    return this.units.filter(u => !buildingIds.includes(u.buildingId));
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
