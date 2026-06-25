import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Project } from '../../../models/project.model';

@Component({
  selector: 'app-property-map-section',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './property-map-section.html',
  styleUrl: './property-map-section.scss'
})
export class PropertyMapSectionComponent implements OnInit, AfterViewInit, OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() projects: Project[] = [];
  @Input() isSearching = false;
  @Input() filterProjectType = 'ALL';
  @Input() filterUnitType = 'ALL';
  @Input() hasSearchedLocation = false;

  @Output() filterChanged = new EventEmitter<any>();

  filteredProjects: Project[] = [];
  selectedProject: Project | null = null;
  highlightedProjectId: number | null = null;

  // Leaflet map options
  map!: L.Map;
  markersGroup!: L.FeatureGroup;
  mapZoom = 12;
  isProgrammaticMove = false;

  // Filter States
  filterPriceRange = 'ALL';
  filterAvailability = 'ALL';

  // Advanced Advanced Filter States
  isFilterAllModalOpen = false;
  
  filterCountry = 'ALL';
  filterState = 'ALL';
  filterCity = '';
  filterMinPrice: number | null = null;
  filterMaxPrice: number | null = null;
  filterDistance: number | null = null;
  filterMinArea: number | null = null;
  filterMaxArea: number | null = null;
  filterStartDate = '';
  filterEndDate = '';

  // Staged Advanced Filters (in Modal)
  tempCountry = 'ALL';
  tempState = 'ALL';
  tempCity = '';
  tempProjectType = 'ALL';
  tempUnitType = 'ALL';
  tempMinPrice: number | null = null;
  tempMaxPrice: number | null = null;
  tempDistance: number | null = null;
  tempMinArea: number | null = null;
  tempMaxArea: number | null = null;
  tempStartDate = '';
  tempEndDate = '';

  // Country & Dependent States
  countries = [
    { name: 'India', states: ['Andhra Pradesh', 'Hyderabad', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi', 'Gujarat', 'Kerala', 'Uttar Pradesh', 'West Bengal'] },
    { name: 'United States', states: ['California', 'New York', 'Texas', 'Florida'] },
    { name: 'United Arab Emirates', states: ['Dubai', 'Abu Dhabi', 'Sharjah'] }
  ];
  availableStates: string[] = [];

  ngOnInit() {
    this.applyFilters();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projects'] || changes['filterProjectType'] || changes['filterUnitType']) {
      this.applyFilters();
      if (this.map) {
        setTimeout(() => {
          this.map.invalidateSize();
          this.fitMapToBounds();
          this.cdr.detectChanges();
        }, 150);
      }
    }
  }

  initMap() {
    const mapEl = document.getElementById('finder-map');
    if (!mapEl) return;

    this.isProgrammaticMove = true;
    this.map = L.map('finder-map', {
      zoomControl: true,
      attributionControl: true
    }).setView([17.3850, 78.4867], this.mapZoom);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.markersGroup = L.featureGroup().addTo(this.map);
    this.updateMarkers();

    setTimeout(() => {
      this.isProgrammaticMove = false;
      this.fitMapToBounds();
    }, 1000);
  }

  applyFilters() {
    if (this.filterProjectType === 'RESIDENTIAL') {
      this.filterUnitType = 'ALL';
    }

    this.filteredProjects = this.projects.filter(project => {
      const lat = project.latitude ? Number(project.latitude) : null;
      const lng = project.longitude ? Number(project.longitude) : null;
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        return false;
      }

      // 1. Project Type Filter
      if (this.filterProjectType !== 'ALL') {
        const type = (project.projectType || '').toUpperCase();
        if (type !== this.filterProjectType) return false;
      }

      // 2. Unit Type Filter
      if (this.filterProjectType !== 'RESIDENTIAL' && this.filterUnitType !== 'ALL') {
        const type = (project.projectType || '').toUpperCase();
        if (this.filterUnitType === 'SHOP' && type === 'RESIDENTIAL') return false;
        if (this.filterUnitType === 'FLAT' && type === 'COMMERCIAL') return false;
      }

      // 3. Price Filter (basic + custom inputs)
      if (this.filterPriceRange !== 'ALL' && this.filterPriceRange !== 'CUSTOM') {
        const startPrice = project.startingPrice || 1500000;
        if (this.filterPriceRange === 'UNDER_10L' && startPrice >= 1000000) return false;
        if (this.filterPriceRange === '10L_50L' && (startPrice < 1000000 || startPrice > 5000000)) return false;
        if (this.filterPriceRange === '50L_1C' && (startPrice < 5000000 || startPrice > 10000000)) return false;
        if (this.filterPriceRange === 'ABOVE_1C' && startPrice <= 10000000) return false;
      } else if (this.filterPriceRange === 'CUSTOM' || this.filterMinPrice !== null || this.filterMaxPrice !== null) {
        const startPrice = project.startingPrice || 1500000;
        if (this.filterMinPrice !== null && startPrice < this.filterMinPrice) return false;
        if (this.filterMaxPrice !== null && startPrice > this.filterMaxPrice) return false;
      }

      // 4. Availability/Status Filter
      if (this.filterAvailability !== 'ALL') {
        const status = (project.status || '').toUpperCase();
        if (status !== this.filterAvailability) return false;
      }

      // 5. Proximity filter
      const distLimit = this.filterDistance !== null ? this.filterDistance : (this.hasSearchedLocation ? 50 : null);
      if (distLimit !== null && project.distance !== undefined && project.distance > distLimit) {
        return false;
      }

      // 6. Country Filter
      if (this.filterCountry !== 'ALL') {
        if ((project.country || '').toUpperCase() !== this.filterCountry.toUpperCase()) return false;
      }

      // 7. State Filter
      if (this.filterState !== 'ALL') {
        const pState = (project.state || '').toUpperCase();
        const fState = this.filterState.toUpperCase();
        if (pState !== fState && !(fState === 'HYDERABAD' && pState === 'TELANGANA') && !(fState === 'TELANGANA' && pState === 'HYDERABAD')) {
          return false;
        }
      }

      // 8. City/Area Search
      if (this.filterCity && this.filterCity.trim() !== '') {
        const query = this.filterCity.toLowerCase();
        const cityMatch = (project.city || '').toLowerCase().includes(query);
        const locMatch = (project.location || '').toLowerCase().includes(query);
        if (!cityMatch && !locMatch) return false;
      }

      // 9. Area Range Filter (Min & Max sq ft)
      if (this.filterMinArea !== null || this.filterMaxArea !== null) {
        const area = project.area || 1000;
        if (this.filterMinArea !== null && area < this.filterMinArea) return false;
        if (this.filterMaxArea !== null && area > this.filterMaxArea) return false;
      }

      // 10. Start Date & End Date Filters
      if (this.filterStartDate) {
        const projStart = new Date(project.startDate);
        const filterStart = new Date(this.filterStartDate);
        if (projStart < filterStart) return false;
      }
      if (this.filterEndDate) {
        const projEnd = new Date(project.completedDate || project.expectedCompletionDate || project.startDate);
        const filterEnd = new Date(this.filterEndDate);
        if (projEnd > filterEnd) return false;
      }

      return true;
    });

    this.updateMarkers();
    this.cdr.detectChanges();
  }

  updateMarkers() {
    if (!this.map || !this.markersGroup) return;

    this.markersGroup.clearLayers();

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

    const activeIcon = L.divIcon({
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D9A441" width="34" height="34">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      `,
      className: 'custom-leaflet-marker-active',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
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
    this.filterProjectType = 'ALL';
    this.filterUnitType = 'ALL';
    this.filterPriceRange = 'ALL';
    this.filterAvailability = 'ALL';
    this.hasSearchedLocation = false;

    // Reset advanced filters
    this.filterCountry = 'ALL';
    this.filterState = 'ALL';
    this.filterCity = '';
    this.filterMinPrice = null;
    this.filterMaxPrice = null;
    this.filterDistance = null;
    this.filterMinArea = null;
    this.filterMaxArea = null;
    this.filterStartDate = '';
    this.filterEndDate = '';

    // Synchronize staged modal filters
    this.tempCountry = 'ALL';
    this.tempState = 'ALL';
    this.availableStates = [];
    this.tempCity = '';
    this.tempProjectType = 'ALL';
    this.tempUnitType = 'ALL';
    this.tempMinPrice = null;
    this.tempMaxPrice = null;
    this.tempDistance = null;
    this.tempMinArea = null;
    this.tempMaxArea = null;
    this.tempStartDate = '';
    this.tempEndDate = '';

    this.filterChanged.emit({ projectType: 'ALL', unitType: 'ALL', hasSearchedLocation: false });
    this.applyFilters();
    setTimeout(() => {
      this.fitMapToBounds();
    }, 200);
  }

  // Modal Handlers
  openFilterAllModal() {
    this.tempCountry = this.filterCountry;
    this.onCountryChange(this.tempCountry);
    this.tempState = this.filterState;
    this.tempCity = this.filterCity;
    this.tempProjectType = this.filterProjectType;
    this.tempUnitType = this.filterUnitType;
    this.tempMinPrice = this.filterMinPrice;
    this.tempMaxPrice = this.filterMaxPrice;
    this.tempDistance = this.filterDistance;
    this.tempMinArea = this.filterMinArea;
    this.tempMaxArea = this.filterMaxArea;
    this.tempStartDate = this.filterStartDate;
    this.tempEndDate = this.filterEndDate;
    
    this.isFilterAllModalOpen = true;
    this.cdr.detectChanges();
  }

  closeFilterAllModal() {
    this.isFilterAllModalOpen = false;
    this.cdr.detectChanges();
  }

  onCountryChange(countryName: string) {
    const country = this.countries.find(c => c.name === countryName);
    this.availableStates = country ? country.states : [];
    if (!this.availableStates.includes(this.tempState)) {
      this.tempState = 'ALL';
    }
  }

  applyStagedFilters() {
    this.filterCountry = this.tempCountry;
    this.filterState = this.tempState;
    this.filterCity = this.tempCity;
    this.filterProjectType = this.tempProjectType;
    this.filterUnitType = this.tempUnitType;
    this.filterMinPrice = this.tempMinPrice;
    this.filterMaxPrice = this.tempMaxPrice;
    this.filterDistance = this.tempDistance;
    this.filterMinArea = this.tempMinArea;
    this.filterMaxArea = this.tempMaxArea;
    this.filterStartDate = this.tempStartDate;
    this.filterEndDate = this.tempEndDate;

    if (this.filterMinPrice !== null || this.filterMaxPrice !== null) {
      this.filterPriceRange = 'CUSTOM';
    } else {
      this.filterPriceRange = 'ALL';
    }

    this.applyFilters();
    this.closeFilterAllModal();
    setTimeout(() => {
      this.fitMapToBounds();
    }, 200);
  }

  clearAllFilters() {
    this.tempCountry = 'ALL';
    this.tempState = 'ALL';
    this.availableStates = [];
    this.tempCity = '';
    this.tempProjectType = 'ALL';
    this.tempUnitType = 'ALL';
    this.tempMinPrice = null;
    this.tempMaxPrice = null;
    this.tempDistance = null;
    this.tempMinArea = null;
    this.tempMaxArea = null;
    this.tempStartDate = '';
    this.tempEndDate = '';

    this.applyStagedFilters();
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
      const cardElement = document.getElementById(`finder-card-${project.id}`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
    this.cdr.detectChanges();
  }

  // Allow external calls to update center
  setMapCenter(lat: number, lng: number) {
    if (this.map) {
      this.isProgrammaticMove = true;
      this.map.setView([lat, lng], 14);
      setTimeout(() => {
        this.isProgrammaticMove = false;
      }, 500);
    }
  }
}
