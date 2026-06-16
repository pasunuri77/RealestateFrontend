import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { Project } from '../../models/project.model';
import { ShopUnit } from '../../models/shop-unit.model';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class PublicHomeComponent implements OnInit {
  private projectService = inject(ProjectService);
  private shopUnitService = inject(ShopUnitService);
  private cdr = inject(ChangeDetectorRef);

  projects: Project[] = [];
  units: ShopUnit[] = [];

  isLoadingProjects = true;
  isLoadingUnits = true;

  ngOnInit() {
    this.loadFeaturedProjects();
    this.loadFeaturedUnits();
  }

  loadFeaturedProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        // Limit to 3 projects for the home page
        this.projects = data.slice(0, 3);
        this.isLoadingProjects = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingProjects = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadFeaturedUnits() {
    this.shopUnitService.getShopUnits().subscribe({
      next: (data) => {
        // Limit to 3 units for the home page
        this.units = data.slice(0, 3);
        this.isLoadingUnits = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingUnits = false;
        this.cdr.detectChanges();
      }
    });
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
