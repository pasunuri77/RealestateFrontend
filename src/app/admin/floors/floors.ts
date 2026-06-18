import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FloorService } from '../../core/services/floor.service';
import { BuildingService } from '../../core/services/building.service';
import { ProjectService } from '../../core/services/project.service';
import { Floor } from '../../models/floor.model';
import { Building } from '../../models/building.model';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-admin-floors',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './floors.html',
  styleUrl: './floors.scss'
})
export class AdminFloorsComponent implements OnInit {
  private floorService = inject(FloorService);
  private buildingService = inject(BuildingService);
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  floors: Floor[] = [];
  buildings: Building[] = [];
  projects: Project[] = [];
  isLoading = true;
  showForm = false;
  isEditMode = false;
  selectedFloorId: number | null = null;

  getSelectedBuildingFloors(): Floor[] {
    const bId = this.floorForm.get('buildingId')?.value;
    if (!bId) return [];
    return this.getFloorsByBuilding(Number(bId));
  }

  floorForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    buildingId: ['', Validators.required],
    floorName: ['', Validators.required],
    floorNumber: ['', [Validators.required]],
    description: [''],
    units: ['', [Validators.required, Validators.min(1)]]
  });

  ngOnInit() {
    this.loadFloors();
    this.loadBuildings();
    this.loadProjects();
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
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  getFilteredBuildings(): Building[] {
    const selectedProjectId = this.floorForm.get('projectId')?.value;
    if (!selectedProjectId) return [];
    return this.buildings.filter(b => b.projectId === Number(selectedProjectId));
  }

  onProjectChange() {
    const filtered = this.getFilteredBuildings();
    if (filtered.length > 0) {
      this.floorForm.patchValue({ buildingId: filtered[0].id });
    } else {
      this.floorForm.patchValue({ buildingId: '' });
    }
    this.cdr.detectChanges();
  }

  openAddForm() {
    this.isEditMode = false;
    const defaultProjectId = this.projects.length > 0 ? this.projects[0].id : '';
    const filteredBuildings = this.buildings.filter(b => b.projectId === defaultProjectId);
    const defaultBuildingId = filteredBuildings.length > 0 ? filteredBuildings[0].id : '';

    this.floorForm.reset({
      projectId: defaultProjectId,
      buildingId: defaultBuildingId,
      floorNumber: 0,
      units: ''
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditForm(f: Floor) {
    this.isEditMode = true;
    this.selectedFloorId = f.id || null;

    const building = this.buildings.find(b => b.id === f.buildingId);
    const projId = building ? building.projectId : '';

    this.floorForm.patchValue({
      projectId: projId,
      buildingId: f.buildingId,
      floorName: f.floorName,
      floorNumber: f.floorNumber,
      description: f.description,
      units: f.units
    });
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm() {
    this.showForm = false;
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (this.floorForm.valid) {
      const { projectId, ...formVals } = this.floorForm.value;
      const payload = {
        ...formVals,
        buildingId: Number(formVals.buildingId),
        floorNumber: Number(formVals.floorNumber),
        units: Number(formVals.units)
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

  getProjectName(projectId: number): string {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : `Project #${projectId}`;
  }
}
