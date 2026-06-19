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

  ngOnInit() {
    this.applyFilters();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projects'] || changes['filterProjectType'] || changes['filterUnitType']) {
      this.applyFilters();
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

      // 5. Proximity filter (Only if location has been searched, within 50 km default)
      if (this.hasSearchedLocation && project.distance !== undefined && project.distance > 50) {
        return false;
      }

      return true;
    });

    this.updateMarkers();
    this.cdr.detectChanges();
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
    this.filterChanged.emit({ projectType: 'ALL', unitType: 'ALL', hasSearchedLocation: false });
    this.applyFilters();
    setTimeout(() => {
      this.fitMapToBounds();
    }, 200);
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
