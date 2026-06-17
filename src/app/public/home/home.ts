import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GoogleMapsModule, GoogleMap, MapInfoWindow, MapMarker } from '@angular/google-maps';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { BuildingService } from '../../core/services/building.service';
import { Project } from '../../models/project.model';
import { ShopUnit } from '../../models/shop-unit.model';
import { Building } from '../../models/building.model';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, GoogleMapsModule],
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

  @ViewChild(GoogleMap) mapComponent!: GoogleMap;

  projects: Project[] = [];
  units: ShopUnit[] = [];
  
  isLoadingProjects = true;
  isLoadingUnits = true;

  // Map search state
  isSearchingNearby = false;
  nearbyProjects: Project[] = [];
  filteredProjects: Project[] = [];
  selectedProject: Project | null = null;
  highlightedProjectId: number | null = null;
  
  // Google Maps options
  mapCenter: google.maps.LatLngLiteral = { lat: 17.3850, lng: 78.4867 }; // Default Hyderabad center
  mapZoom = 12;
  mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

  // Filter States
  filterProjectType = 'ALL';
  filterUnitType = 'ALL';
  filterPriceRange = 'ALL';
  filterAvailability = 'ALL';
  filterRadius = 10; // 10 km default

  // Info Window project binding
  activeInfoWindowProject: Project | null = null;

  // Autocomplete initialization using ViewChild setter
  @ViewChild('searchBox') set searchBox(element: ElementRef<HTMLInputElement> | undefined) {
    if (element) {
      this.initAutocomplete(element.nativeElement);
    }
  }

  ngOnInit() {
    this.loadAllBuildingsAndUnits();
    this.loadFeaturedProjects();
    this.loadFeaturedUnits();
    this.fetchNearby(this.mapCenter.lat, this.mapCenter.lng);
  }

  loadFeaturedProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.allProjects = data || [];
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
        this.units = data.slice(0, 4); // Desktop shows 4 per row
        this.isLoadingUnits = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingUnits = false;
        this.cdr.detectChanges();
      }
    });
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
        this.cdr.detectChanges();
      }
    });
  }

  // Getters for aggregated stats
  get completedProjectsCount(): number {
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'COMPLETED').length || 24; // fallback to user spec if empty
  }

  get ongoingProjectsCount(): number {
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'ONGOING').length || 12; // fallback to user spec if empty
  }

  get totalBuildingsCount(): number {
    return this.allBuildings.length || 8;
  }

  get availableUnitsCount(): number {
    return this.allUnits.length || 45;
  }

  getBuildingCountForProject(projectId: number): number {
    return this.allBuildings.filter(b => b.projectId === projectId).length;
  }

  getUnitCountForProject(projectId: number): number {
    return this.allUnits.filter(u => u.projectId === projectId).length;
  }

  // Fetch nearby projects from the API
  fetchNearby(lat: number, lng: number) {
    this.isSearchingNearby = true;
    this.cdr.detectChanges();
    this.fallbackToLocalDistanceSearch(lat, lng);
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

  geocodeProjectLocation(project: Project): Promise<Project> {
    return new Promise((resolve) => {
      if (project.latitude && project.longitude) {
        resolve(project);
        return;
      }
      if (!project.location || typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
        resolve(project);
        return;
      }

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: project.location }, (results, status) => {
        if (status === 'OK' && results && results[0] && results[0].geometry) {
          const loc = results[0].geometry.location;
          project.latitude = loc.lat();
          project.longitude = loc.lng();
        }
        resolve(project);
      });
    });
  }

  fallbackToLocalDistanceSearch(lat: number, lng: number) {
    this.projectService.getProjects().subscribe({
      next: (allProjects) => {
        const promises = allProjects.map(p => this.geocodeProjectLocation(p));

        Promise.all(promises).then((geocodedProjects) => {
          const projectsWithDistance = geocodedProjects.map(p => {
            const project = this.calculateLocalDistance(p, lat, lng);
            
            if (project.availableUnits === undefined) {
              project.availableUnits = 12;
              project.availableShops = 4;
              project.availableOffices = 8;
              project.availableFlats = 0;
            }
            if (project.startingPrice === undefined) {
              project.startingPrice = 4500000;
            }
            
            return project;
          });

          this.nearbyProjects = projectsWithDistance
            .filter(p => p.distance !== undefined)
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));

          this.applyFilters();
          this.isSearchingNearby = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.nearbyProjects = [];
        this.applyFilters();
        this.isSearchingNearby = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {
    this.filteredProjects = this.nearbyProjects.filter(project => {
      // 1. Project Type Filter
      if (this.filterProjectType !== 'ALL') {
        const type = (project.projectType || '').toUpperCase();
        if (type !== this.filterProjectType) return false;
      }

      // 2. Unit Type Filter
      if (this.filterUnitType !== 'ALL') {
        const type = (project.projectType || '').toUpperCase();
        if (this.filterUnitType === 'SHOP' && type === 'RESIDENTIAL') return false;
        if (this.filterUnitType === 'FLAT' && type === 'COMMERCIAL') return false;
      }

      // 3. Price Filter
      if (this.filterPriceRange !== 'ALL') {
        const startPrice = project.startingPrice || 1500000;
        if (this.filterPriceRange === 'UNDER_10L' && startPrice >= 1000000) return false;
        if (this.filterPriceRange === '10L_50L' && (startPrice < 1000000 || startPrice > 5000000)) return false;
        if (this.filterPriceRange === '50L_1C' && (startPrice < 5000000 || startPrice > 10000000)) return false;
        if (this.filterPriceRange === 'ABOVE_1C' && startPrice <= 10000000) return false;
      }

      // 4. Availability/Status Filter
      if (this.filterAvailability !== 'ALL') {
        const status = (project.status || '').toUpperCase();
        if (status !== this.filterAvailability) return false;
      }

      // 5. Distance check (limit to 50 km)
      if (project.distance !== undefined && project.distance > this.filterRadius) {
        return false;
      }

      return true;
    });
    this.cdr.detectChanges();
  }

  resetFilters() {
    this.filterProjectType = 'ALL';
    this.filterUnitType = 'ALL';
    this.filterPriceRange = 'ALL';
    this.filterAvailability = 'ALL';
    this.filterRadius = 10;
    this.applyFilters();
  }

  // Handle map moves/zoom
  onMapDragend() {
    this.updateSearchFromMap();
  }

  onZoomChanged() {
    this.updateSearchFromMap();
  }

  updateSearchFromMap() {
    if (this.mapComponent) {
      const center = this.mapComponent.getCenter();
      if (center) {
        this.mapCenter = { lat: center.lat(), lng: center.lng() };
        this.fetchNearby(this.mapCenter.lat, this.mapCenter.lng);
      }
    }
  }

  // Clicking result card highlights marker
  onCardClick(project: Project) {
    this.highlightedProjectId = project.id || null;
    if (project.latitude && project.longitude) {
      this.mapCenter = { lat: Number(project.latitude), lng: Number(project.longitude) };
      this.mapZoom = 15;
    }
    this.selectedProject = project;
    this.activeInfoWindowProject = project;
    this.cdr.detectChanges();
  }

  // Clicking marker scroll to card
  onMarkerClick(marker: MapMarker, project: Project) {
    this.highlightedProjectId = project.id || null;
    this.selectedProject = project;
    
    // Scroll to the card
    setTimeout(() => {
      const cardElement = document.getElementById(`project-card-${project.id}`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
    this.cdr.detectChanges();
  }

  // Autocomplete Location setup
  initAutocomplete(input: HTMLInputElement) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
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
        this.mapCenter = { lat, lng };
        this.mapZoom = 14;
        this.fetchNearby(lat, lng);
        this.cdr.detectChanges();

        // Scroll to map search section below hero
        setTimeout(() => {
          const mapSection = document.getElementById('map-search-section');
          if (mapSection) {
            mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const address = input.value;
        if (!address) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address }, (results, status) => {
          if (status === 'OK' && results && results[0] && results[0].geometry) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            this.mapCenter = { lat, lng };
            this.mapZoom = 14;
            this.fetchNearby(lat, lng);
            this.cdr.detectChanges();

            setTimeout(() => {
              const mapSection = document.getElementById('map-search-section');
              if (mapSection) {
                mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 300);
          }
        });
      }
    });
  }

  // Get status color based marker options
  getMarkerOptions(project: Project): google.maps.MarkerOptions {
    const isSel = this.highlightedProjectId === project.id;
    return {
      icon: isSel ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    };
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
