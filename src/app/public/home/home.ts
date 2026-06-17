import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { BuildingService } from '../../core/services/building.service';
import { Project } from '../../models/project.model';
import { ShopUnit } from '../../models/shop-unit.model';
import { Building } from '../../models/building.model';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class PublicHomeComponent implements OnInit, AfterViewInit {
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

  // Map search state
  isSearchingNearby = false;
  nearbyProjects: Project[] = [];
  filteredProjects: Project[] = [];
  selectedProject: Project | null = null;
  highlightedProjectId: number | null = null;
  isProgrammaticMove = false; // Flag to prevent triggering search location filters on programmatic map pans/zooms

  // Leaflet map options
  map!: L.Map;
  markersGroup!: L.FeatureGroup;
  mapZoom = 12;
  isInitialLoad = true;
  hasSearchedLocation = false; // Filter by 50km radius only when location is searched

  // Filter States
  filterLocation = 'ALL';
  filterProjectType = 'ALL';
  filterUnitType = 'ALL';
  filterPriceRange = 'ALL';
  filterAvailability = 'ALL';
  uniqueLocations: string[] = []; // Loaded dynamically

  // Autocomplete state variables
  suggestions: any[] = [];
  showSuggestions = false;
  isLoadingSuggestions = false;
  noSuggestionsFound = false;
  activeSuggestionIndex = -1;
  searchQuery = '';
  private searchDebounceTimer: any;
  private abortController: AbortController | null = null;

  @ViewChild('searchBox') set searchBox(element: ElementRef<HTMLInputElement> | undefined) {
    if (element) {
      // Input reference available if needed
    }
  }

  ngOnInit() {
    this.loadAllBuildingsAndUnits();
    this.loadFeaturedProjects();
    this.loadFeaturedUnits();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    this.isProgrammaticMove = true;
    this.map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([17.3850, 78.4867], this.mapZoom);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.markersGroup = L.featureGroup().addTo(this.map);

    // Trigger initial search
    this.fetchNearby(17.3850, 78.4867);
    setTimeout(() => {
      this.isProgrammaticMove = false;
    }, 1000);
  }

  loadFeaturedProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.allProjects = data || [];
        this.projects = data.slice(0, 3);
        
        // Dynamically extract unique locations from projects
        this.uniqueLocations = Array.from(new Set(
          this.allProjects.map(p => p.location).filter(Boolean)
        )).sort();

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
    if (this.isLoadingProjects) return 24;
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'COMPLETED').length;
  }

  get ongoingProjectsCount(): number {
    if (this.isLoadingProjects) return 12;
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'ONGOING').length;
  }

  get totalBuildingsCount(): number {
    return this.allBuildings.length || 8;
  }

  get availableUnitsCount(): number {
    return this.allUnits.length || 45;
  }

  get upcomingProjectsCount(): number {
    if (this.isLoadingProjects) return 8;
    return this.allProjects.filter(p => (p.status || '').toUpperCase() === 'UPCOMING').length;
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
      if (!project.location) {
        resolve(project);
        return;
      }

      fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(project.location)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            project.latitude = parseFloat(data[0].lat);
            project.longitude = parseFloat(data[0].lon);
          }
          resolve(project);
        })
        .catch(() => {
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

          this.nearbyProjects = projectsWithDistance;

          // Populate unique locations dynamically
          this.uniqueLocations = Array.from(new Set(
            allProjects.map(p => p.location).filter(Boolean)
          )).sort();

          this.applyFilters();

          if (this.isInitialLoad) {
            this.isInitialLoad = false;
            setTimeout(() => {
              this.fitMapToBounds();
            }, 200);
          }

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
    // If Project Type is Residential, reset Unit Type filter to ALL
    if (this.filterProjectType === 'RESIDENTIAL') {
      this.filterUnitType = 'ALL';
    }

    this.filteredProjects = this.nearbyProjects.filter(project => {
      // Must have valid coordinates to render in map results list and map
      const lat = project.latitude ? Number(project.latitude) : null;
      const lng = project.longitude ? Number(project.longitude) : null;
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        return false;
      }

      // 1. Location Filter (internally kept if active)
      if (this.filterLocation !== 'ALL') {
        const loc = (project.location || '').toLowerCase();
        if (!loc.includes(this.filterLocation.toLowerCase())) return false;
      }

      // 2. Project Type Filter
      if (this.filterProjectType !== 'ALL') {
        const type = (project.projectType || '').toUpperCase();
        if (type !== this.filterProjectType) return false;
      }

      // 3. Unit Type Filter (Only active if project is not residential)
      if (this.filterProjectType !== 'RESIDENTIAL' && this.filterUnitType !== 'ALL') {
        const type = (project.projectType || '').toUpperCase();
        if (this.filterUnitType === 'SHOP' && type === 'RESIDENTIAL') return false;
        if (this.filterUnitType === 'FLAT' && type === 'COMMERCIAL') return false;
      }

      // 4. Price Filter
      if (this.filterPriceRange !== 'ALL') {
        const startPrice = project.startingPrice || 1500000;
        if (this.filterPriceRange === 'UNDER_10L' && startPrice >= 1000000) return false;
        if (this.filterPriceRange === '10L_50L' && (startPrice < 1000000 || startPrice > 5000000)) return false;
        if (this.filterPriceRange === '50L_1C' && (startPrice < 5000000 || startPrice > 10000000)) return false;
        if (this.filterPriceRange === 'ABOVE_1C' && startPrice <= 10000000) return false;
      }

      // 5. Availability/Status Filter
      if (this.filterAvailability !== 'ALL') {
        const status = (project.status || '').toUpperCase();
        if (status !== this.filterAvailability) return false;
      }

      // 6. Proximity filter (Only if location has been searched, within 50 km default)
      if (this.hasSearchedLocation && project.distance !== undefined && project.distance > 50) {
        return false;
      }

      return true;
    });

    this.updateMarkers();
    this.cdr.detectChanges();
  }

  fitMapToBounds() {
    if (this.map && this.markersGroup) {
      const layers = this.markersGroup.getLayers();
      if (layers.length > 0) {
        const bounds = this.markersGroup.getBounds();
        this.isProgrammaticMove = true;
        this.map.fitBounds(bounds, { padding: [50, 50] });
        setTimeout(() => {
          this.isProgrammaticMove = false;
        }, 500);
      }
    }
  }

  resetFilters() {
    this.filterLocation = 'ALL';
    this.filterProjectType = 'ALL';
    this.filterUnitType = 'ALL';
    this.filterPriceRange = 'ALL';
    this.filterAvailability = 'ALL';
    this.hasSearchedLocation = false;
    this.searchQuery = '';
    this.applyFilters();
    setTimeout(() => {
      this.fitMapToBounds();
    }, 200);
  }

  updateMarkers() {
    if (!this.map || !this.markersGroup) return;

    this.markersGroup.clearLayers();

    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const activeIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    this.filteredProjects.forEach(project => {
      const lat = project.latitude ? Number(project.latitude) : null;
      const lng = project.longitude ? Number(project.longitude) : null;

      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        const isSel = this.highlightedProjectId === project.id;
        const marker = L.marker([lat, lng], {
          icon: isSel ? activeIcon : defaultIcon
        });

        const popupContent = `
          <div style="font-family: var(--font-body); padding: 5px; min-width: 150px;">
            <strong style="font-size: 0.9rem; color: var(--color-text-dark);">${project.name}</strong><br/>
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">${project.projectType}</span><br/>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-accent);">From ₹${(project.startingPrice || 4500000).toLocaleString()}</span><br/>
            <a href="/projects/${project.id}" style="display: inline-block; margin-top: 5px; padding: 3px 8px; background: #123047; color: #fff; text-decoration: none; font-size: 0.7rem; border-radius: 4px; font-weight: bold;">View Details</a>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          this.onMarkerClick(project);
        });

        this.markersGroup.addLayer(marker);
      }
    });
  }

  onCardClick(project: Project) {
    this.highlightedProjectId = project.id || null;
    if (project.latitude && project.longitude) {
      const lat = Number(project.latitude);
      const lng = Number(project.longitude);
      this.isProgrammaticMove = true;
      this.map.setView([lat, lng], 15);
      setTimeout(() => {
        this.isProgrammaticMove = false;
      }, 500);
    }
    this.selectedProject = project;
    this.updateMarkers();
    this.cdr.detectChanges();
  }

  onMarkerClick(project: Project) {
    this.highlightedProjectId = project.id || null;
    this.selectedProject = project;
    this.updateMarkers();

    setTimeout(() => {
      const cardElement = document.getElementById(`project-card-${project.id}`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
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
    this.searchQuery = item.name;
    this.showSuggestions = false;
    this.suggestions = [];
    this.hasSearchedLocation = true; // Apply 50km radius limit on searched coordinates

    if (this.map) {
      this.isProgrammaticMove = true;
      this.map.setView([item.lat, item.lng], 14);
      setTimeout(() => {
        this.isProgrammaticMove = false;
      }, 500);
      this.fetchNearby(item.lat, item.lng);
    }
    this.cdr.detectChanges();

    setTimeout(() => {
      const mapSection = document.getElementById('map-search-section');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
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

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
