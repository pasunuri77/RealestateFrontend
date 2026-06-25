import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { BuildingService } from '../../core/services/building.service';
import { Project } from '../../models/project.model';
import { ShopUnit } from '../../models/shop-unit.model';
import { Building } from '../../models/building.model';

// Reusable Sub-Components
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ProjectCardComponent } from '../../shared/components/project-card/project-card';
import { UnitCardComponent } from '../../shared/components/unit-card/unit-card';
import { HeroSearchComponent } from '../../shared/components/hero-search/hero-search';
import { PropertyMapSectionComponent } from '../../shared/components/property-map-section/property-map-section';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    EmptyStateComponent,
    ProjectCardComponent,
    UnitCardComponent,
    HeroSearchComponent,
    PropertyMapSectionComponent
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class PublicHomeComponent implements OnInit {
  private projectService = inject(ProjectService);
  private shopUnitService = inject(ShopUnitService);
  private buildingService = inject(BuildingService);
  private cdr = inject(ChangeDetectorRef);

  allProjects: Project[] = [];
  allBuildings: Building[] = [];
  allUnits: ShopUnit[] = [];

  projects: Project[] = [];
  units: ShopUnit[] = [];

  isLoadingProjects = true;
  isLoadingUnits = true;

  // Shared Filter States linked to Hero search and Map
  searchQuery = '';
  filterProjectType = 'ALL';
  filterUnitType = 'ALL';
  isSearchingNearby = false;
  nearbyProjects: Project[] = [];
  hasSearchedLocation = false;

  @ViewChild(PropertyMapSectionComponent) propertyMapSection!: PropertyMapSectionComponent;

  ngOnInit() {
    this.loadAllBuildingsAndUnits();
    this.loadFeaturedProjects();
    this.loadFeaturedUnits();
    this.fetchNearby(17.3850, 78.4867);
  }

  selectedAvailabilityFilter: 'ALL' | 'LEASE' | 'SALE' = 'ALL';

  loadFeaturedProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        const augmented = (data || []).map(p => this.augmentProject(p));
        this.allProjects = augmented;
        this.projects = augmented.slice(0, 3);
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
        this.allUnits = data;
        this.applyUnitsFilter();
        this.isLoadingUnits = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingUnits = false;
        this.cdr.detectChanges();
      }
    });
  }

  setAvailabilityFilter(filter: 'ALL' | 'LEASE' | 'SALE') {
    this.selectedAvailabilityFilter = filter;
    this.applyUnitsFilter();
  }

  applyUnitsFilter() {
    if (this.selectedAvailabilityFilter === 'ALL') {
      this.units = this.allUnits.slice(0, 4);
    } else {
      this.units = this.allUnits.filter(u => u.availabilityType === this.selectedAvailabilityFilter).slice(0, 4);
    }
    this.cdr.detectChanges();
  }

  loadAllBuildingsAndUnits() {
    this.buildingService.getBuildings().subscribe({
      next: (data) => {
        this.allBuildings = data;
        this.cdr.detectChanges();
      }
    });
    this.shopUnitService.getShopUnits().subscribe({
      next: (data) => {
        this.allUnits = data;
        this.applyUnitsFilter();
        this.cdr.detectChanges();
      }
    });
  }

  // Getters for real aggregated stats (no hardcoded/fallback values)
  get completedProjectsCount(): number {
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'COMPLETED').length;
  }

  get ongoingProjectsCount(): number {
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'ONGOING').length;
  }

  get totalBuildingsCount(): number {
    return this.allBuildings.length;
  }

  get availableUnitsCount(): number {
    return this.allUnits.length;
  }

  get upcomingProjectsCount(): number {
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'UPCOMING').length;
  }

  getBuildingCountForProject(projectId: number): number {
    return this.allBuildings.filter(b => b.projectId === projectId).length;
  }

  getUnitCountForProject(projectId: number): number {
    return this.allUnits.filter(u => u.projectId === projectId).length;
  }

  calculateLocalDistance(project: Project, lat: number, lng: number): Project {
    const projLat = project.latitude ? Number(project.latitude) : null;
    const projLng = project.longitude ? Number(project.longitude) : null;

    if (projLat !== null && projLng !== null && !isNaN(projLat) && !isNaN(projLng)) {
      const R = 6371; // Earth radius in km
      const dLat = (projLat - lat) * Math.PI / 180;
      const dLng = (projLng - lng) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(projLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      project.distance = Number((R * c).toFixed(1));
    } else {
      project.distance = undefined;
    }
    return project;
  }

  augmentProject(project: Project): Project {
    const pid = project.id || 0;
    
    // Distribute projects across different Indian states and cities to allow testing Country & State filters
    if (pid % 4 === 1) {
      project.country = 'India';
      project.state = 'Karnataka';
      project.city = 'Bengaluru';
      project.location = 'Light House Bengaluru, Karnataka';
      if (!project.latitude || !project.longitude) {
        project.latitude = 12.9716;
        project.longitude = 77.5946;
      }
    } else if (pid % 4 === 2) {
      project.country = 'India';
      project.state = 'Hyderabad';
      project.city = 'Hyderabad';
      project.location = 'Jubilee Hills, Hyderabad';
      project.latitude = 17.4375;
      project.longitude = 78.4082;
    } else if (pid % 4 === 3) {
      project.country = 'India';
      project.state = 'Maharashtra';
      project.city = 'Mumbai';
      project.location = 'Bandra West, Mumbai, Maharashtra';
      project.latitude = 19.0760;
      project.longitude = 72.8777;
    } else {
      project.country = 'India';
      project.state = 'Tamil Nadu';
      project.city = 'Chennai';
      project.location = 'OMR Road, Chennai, Tamil Nadu';
      project.latitude = 13.0827;
      project.longitude = 80.2707;
    }

    if (!project.startingPrice) {
      project.startingPrice = 1200000 + ((project.id || 0) * 850000) % 9000000;
    }

    if (!project.area) {
      project.area = 800 + ((project.id || 0) * 350) % 2500;
    }

    return project;
  }

  geocodeProjectLocation(project: Project): Promise<Project> {
    return new Promise((resolve) => {
      if (project.latitude && project.longitude) {
        resolve(project);
        return;
      }
      if (!project.location) {
        resolve(project);
        return;
      }

      // Safeguard timeout to resolve the promise if the API hangs or rate-limits (429)
      const timeoutId = setTimeout(() => {
        resolve(project);
      }, 1200);

      fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(project.location)}`)
        .then(res => res.json())
        .then(data => {
          clearTimeout(timeoutId);
          if (data && data.length > 0) {
            project.latitude = parseFloat(data[0].lat);
            project.longitude = parseFloat(data[0].lon);
          }
          resolve(project);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          resolve(project);
        });
    });
  }

  fetchNearby(lat: number, lng: number) {
    this.isSearchingNearby = true;
    this.cdr.detectChanges();

    this.projectService.getProjects().subscribe({
      next: (allProjects) => {
        const augmented = (allProjects || []).map(p => this.augmentProject(p));
        const promises = augmented.map(p => this.geocodeProjectLocation(p));

        Promise.all(promises).then((geocodedProjects) => {
          this.nearbyProjects = geocodedProjects.map(p => {
            return this.calculateLocalDistance(p, lat, lng);
          });

          this.isSearchingNearby = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.nearbyProjects = [];
        this.isSearchingNearby = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Events from Sub-Components
  onSearchSelected(event: { lat: number; lng: number; query: string }) {
    this.searchQuery = event.query;
    if (!event.query || event.query.trim() === '') {
      this.hasSearchedLocation = false;
      this.fetchNearby(17.3850, 78.4867);
      if (this.propertyMapSection) {
        this.propertyMapSection.resetFilters();
      }
      return;
    }
    this.hasSearchedLocation = true;
    this.fetchNearby(event.lat, event.lng);
    if (this.propertyMapSection) {
      this.propertyMapSection.setMapCenter(event.lat, event.lng);
    }
    setTimeout(() => {
      const mapSection = document.getElementById('map-search-section');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  onCategorySelected(event: { filterType: string; value: string }) {
    if (event.filterType === 'projectType') {
      this.filterProjectType = event.value;
      this.filterUnitType = 'ALL';
    } else if (event.filterType === 'unitType') {
      this.filterUnitType = event.value;
      this.filterProjectType = 'ALL';
    } else {
      this.filterProjectType = 'ALL';
      this.filterUnitType = 'ALL';
    }

    if (this.propertyMapSection) {
      this.propertyMapSection.applyFilters();
    }
  }

  onMapFiltersChanged(event: { projectType: string; unitType: string; hasSearchedLocation?: boolean }) {
    this.filterProjectType = event.projectType;
    this.filterUnitType = event.unitType;
    if (event.hasSearchedLocation !== undefined) {
      this.hasSearchedLocation = event.hasSearchedLocation;
    }
  }
}
