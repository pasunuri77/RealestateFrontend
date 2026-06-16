import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { BuildingService } from '../../core/services/building.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { Project } from '../../models/project.model';
import { Building } from '../../models/building.model';
import { ShopUnit } from '../../models/shop-unit.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss'
})
export class PublicProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private buildingService = inject(BuildingService);
  private shopUnitService = inject(ShopUnitService);
  private cdr = inject(ChangeDetectorRef);

  project: Project | null = null;
  buildings: Building[] = [];
  units: ShopUnit[] = [];
  isLoading = true;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.loadProjectDetails(id);
      }
    });
  }

  loadProjectDetails(id: number) {
    this.isLoading = true;
    this.projectService.getProjectById(id).subscribe({
      next: (proj) => {
        this.project = proj;
        this.loadBuildingsAndUnits(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadBuildingsAndUnits(projectId: number) {
    this.buildingService.getBuildingsByProject(projectId).subscribe({
      next: (bList) => {
        this.buildings = bList;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });

    this.shopUnitService.getShopUnitsByProject(projectId).subscribe({
      next: (uList) => {
        this.units = uList;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
