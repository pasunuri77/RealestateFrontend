import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FloorService } from '../../core/services/floor.service';
import { BuildingService } from '../../core/services/building.service';
import { Floor } from '../../models/floor.model';
import { Building } from '../../models/building.model';

@Component({
  selector: 'app-admin-floors',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './floors.html',
  styleUrl: './floors.scss'
})
export class AdminFloorsComponent implements OnInit {
  private floorService = inject(FloorService);
  private buildingService = inject(BuildingService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  floors: Floor[] = [];
  buildings: Building[] = [];
  isLoading = true;
  showForm = false;
  isEditMode = false;
  selectedFloorId: number | null = null;

  floorForm: FormGroup = this.fb.group({
    buildingId: ['', Validators.required],
    floorName: ['', Validators.required],
    floorNumber: ['', [Validators.required]],
    description: [''],
    units: ['', [Validators.required, Validators.min(1)]]
  });

  ngOnInit() {
    this.loadFloors();
    this.loadBuildings();
  }

  loadFloors() {
    this.isLoading = true;
    this.floorService.getFloors().subscribe({
      next: (data) => {
        this.floors = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadBuildings() {
    this.buildingService.getBuildings().subscribe({
      next: (data) => {
        this.buildings = data;
        if (data.length > 0) {
          this.floorForm.patchValue({ buildingId: data[0].id });
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
    this.floorForm.reset({
      buildingId: this.buildings.length > 0 ? this.buildings[0].id : '',
      floorNumber: 0,
      units: ''
    });
    this.showForm = true;
  }

  openEditForm(f: Floor) {
    this.isEditMode = true;
    this.selectedFloorId = f.id || null;
    this.floorForm.patchValue({
      buildingId: f.buildingId,
      floorName: f.floorName,
      floorNumber: f.floorNumber,
      description: f.description,
      units: f.units
    });
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  onSubmit() {
    if (this.floorForm.valid) {
      const payload = {
        ...this.floorForm.value,
        buildingId: Number(this.floorForm.value.buildingId),
        floorNumber: Number(this.floorForm.value.floorNumber),
        units: Number(this.floorForm.value.units)
      };

      if (this.isEditMode && this.selectedFloorId !== null) {
        this.floorService.updateFloor(this.selectedFloorId, payload).subscribe({
          next: () => {
            this.loadFloors();
            this.closeForm();
            this.cdr.detectChanges();
          },
          error: () => {
            this.cdr.detectChanges();
          }
        });
      } else {
        this.floorService.createFloor(payload).subscribe({
          next: () => {
            this.loadFloors();
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
    if (confirm('Delete this floor?')) {
      this.floorService.deleteFloor(id).subscribe({
        next: () => {
          this.loadFloors();
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }

  getFloorsByBuilding(buildingId: number): Floor[] {
    return this.floors.filter(f => f.buildingId === buildingId);
  }

  getUnassignedFloors(): Floor[] {
    const buildingIds = this.buildings.map(b => b.id);
    return this.floors.filter(f => !buildingIds.includes(f.buildingId));
  }
}
