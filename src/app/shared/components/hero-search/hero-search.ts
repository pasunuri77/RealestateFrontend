import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-hero-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hero-search.html',
  styleUrl: './hero-search.scss'
})
export class HeroSearchComponent {
  private cdr = inject(ChangeDetectorRef);

  @Input() searchQuery = '';
  @Output() searchSelected = new EventEmitter<{ lat: number; lng: number; query: string }>();
  @Output() categorySelected = new EventEmitter<{ filterType: string; value: string }>();

  // Autocomplete state variables
  suggestions: any[] = [];
  showSuggestions = false;
  isLoadingSuggestions = false;
  noSuggestionsFound = false;
  activeSuggestionIndex = -1;
  private searchDebounceTimer: any;
  private abortController: AbortController | null = null;

  activeTab = 'ALL';

  categories = [
    { label: 'All', icon: 'business', type: 'ALL', filterType: 'RESET', value: 'ALL' },
    { label: 'Commercial', icon: 'storefront', type: 'COMMERCIAL', filterType: 'projectType', value: 'COMMERCIAL' },
    { label: 'Residential', icon: 'home', type: 'RESIDENTIAL', filterType: 'projectType', value: 'RESIDENTIAL' },
    { label: 'Mixed Use', icon: 'domain', type: 'MIXED', filterType: 'projectType', value: 'MIXED' },
    { label: 'Offices', icon: 'work', type: 'OFFICE', filterType: 'unitType', value: 'OFFICE' },
    { label: 'Shops', icon: 'shopping_bag', type: 'SHOP', filterType: 'unitType', value: 'SHOP' }
  ];

  selectCategory(cat: any) {
    this.activeTab = cat.type;
    this.categorySelected.emit({ filterType: cat.filterType, value: cat.value });
  }

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

  triggerSearch() {
    if (!this.searchQuery || this.searchQuery.trim().length < 3) return;
    this.showSuggestions = false;

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(this.searchQuery.trim())}&limit=1`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.features && data.features.length > 0) {
          const f = data.features[0];
          const name = f.properties.name || f.properties.city || this.searchQuery;
          this.searchSelected.emit({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            query: name
          });
        }
      })
      .catch(err => {
        console.error("Manual Search Geocoder Error:", err);
      });
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showSuggestions && this.activeSuggestionIndex >= 0 && this.activeSuggestionIndex < this.suggestions.length) {
        this.selectSuggestion(this.suggestions[this.activeSuggestionIndex]);
      } else if (this.showSuggestions && this.suggestions.length > 0) {
        this.selectSuggestion(this.suggestions[0]);
      } else {
        this.triggerSearch();
      }
      this.cdr.detectChanges();
      return;
    }

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
    }
  }

  selectSuggestion(item: any) {
    this.searchQuery = item.name;
    this.showSuggestions = false;
    this.suggestions = [];
    this.searchSelected.emit({ lat: item.lat, lng: item.lng, query: item.name });
    this.cdr.detectChanges();
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
}
