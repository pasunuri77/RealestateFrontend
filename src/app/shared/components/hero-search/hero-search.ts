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
    { label: 'Commercial & Residential', icon: 'domain', type: 'MIXED_USE', filterType: 'projectType', value: 'MIXED_USE' },
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

    if (!val || val.trim().length === 0) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.noSuggestionsFound = false;
      this.isLoadingSuggestions = false;
      this.searchSelected.emit({ lat: 17.3850, lng: 78.4867, query: '' });
      this.cdr.detectChanges();
      return;
    }

    if (val.trim().length < 3) {
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

    const url = this.buildAddressSearchUrl(query, 6, true);

    fetch(url, { signal: this.abortController.signal })
      .then(res => res.json())
      .then(data => {
        this.processFeatures(data, query, true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("Photon Geocoder Error:", err);
          this.fallbackSearch(query);
        }
      });
  }

  private fallbackSearch(query: string) {
    const fallbackUrl = this.buildAddressSearchUrl(query, 6, false);
    fetch(fallbackUrl)
      .then(res => res.json())
      .then(data => {
        this.processFeatures(data, query, false);
      })
      .catch(err => {
        console.error("Photon Fallback Geocoder Error:", err);
        this.isLoadingSuggestions = false;
        this.suggestions = [];
        this.noSuggestionsFound = true;
        this.cdr.detectChanges();
      });
  }

  private processFeatures(data: any, query: string, isFirstAttempt: boolean) {
    this.isLoadingSuggestions = false;
    if (data && data.features && data.features.length > 0) {
      let mapped = data.features.map((f: any) => this.mapAddressSuggestion(f));
      mapped = this.sortSuggestions(mapped, query);
      this.suggestions = mapped;
      this.noSuggestionsFound = this.suggestions.length === 0;
    } else {
      if (isFirstAttempt) {
        this.fallbackSearch(query);
      } else {
        this.suggestions = [];
        this.noSuggestionsFound = true;
      }
    }
    this.cdr.detectChanges();
  }

  triggerSearch() {
    if (!this.searchQuery || this.searchQuery.trim().length < 3) return;
    this.showSuggestions = false;

    const url = this.buildAddressSearchUrl(this.searchQuery.trim(), 1, true);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.features && data.features.length > 0) {
          const item = this.mapAddressSuggestion(data.features[0]);
          this.searchSelected.emit({
            lat: item.lat,
            lng: item.lng,
            query: item.fullAddress || item.name
          });
        } else {
          const fallbackUrl = this.buildAddressSearchUrl(this.searchQuery.trim(), 1, false);
          fetch(fallbackUrl)
            .then(res => res.json())
            .then(fallbackData => {
              if (fallbackData && fallbackData.features && fallbackData.features.length > 0) {
                const item = this.mapAddressSuggestion(fallbackData.features[0]);
                this.searchSelected.emit({
                  lat: item.lat,
                  lng: item.lng,
                  query: item.fullAddress || item.name
                });
              }
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
    this.searchQuery = item.fullAddress || item.name;
    this.showSuggestions = false;
    this.suggestions = [];
    this.searchSelected.emit({ lat: item.lat, lng: item.lng, query: this.searchQuery });
    this.cdr.detectChanges();
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSuggestions = false;
      this.cdr.detectChanges();
    }, 200);
  }

  formatDetails(item: any): string {
    return item.details || [item.city, item.state, item.country].filter(Boolean).join(', ');
  }

  private buildAddressSearchUrl(query: string, limit: number, useBias: boolean = true): string {
    const exactAddressPrompt = this.buildExactAddressPrompt(query);
    const params = new URLSearchParams({
      q: exactAddressPrompt,
      limit: String(limit),
      countrycode: 'in'
    });

    if (useBias) {
      params.append('lat', '17.3850');
      params.append('lon', '78.4867');
      params.append('location_bias_scale', '0.1');
    }

    return `https://photon.komoot.io/api/?${params.toString()}`;
  }

  private buildExactAddressPrompt(query: string): string {
    let cleanQuery = query.trim().replace(/\s+/g, ' ');
    
    // Normalize abbreviations
    cleanQuery = cleanQuery.replace(/\bap\b/i, 'Andhra Pradesh');
    cleanQuery = cleanQuery.replace(/\bts\b/i, 'Telangana');

    if (!/\bindia\b/i.test(cleanQuery)) {
      cleanQuery = `${cleanQuery}, India`;
    }

    return cleanQuery;
  }

  private sortSuggestions(items: any[], query: string): any[] {
    const lowerQuery = query.toLowerCase();
    let targetState = '';
    if (lowerQuery.includes('andhra') || lowerQuery.includes('ap')) {
      targetState = 'andhra pradesh';
    } else if (lowerQuery.includes('telangana') || lowerQuery.includes('ts')) {
      targetState = 'telangana';
    }

    return items.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aAddress = (a.fullAddress || '').toLowerCase();
      const bAddress = (b.fullAddress || '').toLowerCase();
      const aCity = (a.city || '').toLowerCase();
      const bCity = (b.city || '').toLowerCase();
      const aState = (a.state || '').toLowerCase();
      const bState = (b.state || '').toLowerCase();

      if (targetState) {
        const aMatchesState = aState.includes(targetState) || aAddress.includes(targetState);
        const bMatchesState = bState.includes(targetState) || bAddress.includes(targetState);
        if (aMatchesState && !bMatchesState) return -1;
        if (!aMatchesState && bMatchesState) return 1;
      }

      const aCityExact = aCity && lowerQuery.includes(aCity);
      const bCityExact = bCity && lowerQuery.includes(bCity);
      if (aCityExact && !bCityExact) return -1;
      if (!aCityExact && bCityExact) return 1;

      const aExact = aName === lowerQuery;
      const bExact = bName === lowerQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aName.startsWith(lowerQuery);
      const bStarts = bName.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });
  }

  private mapAddressSuggestion(feature: any) {
    const props = feature.properties || {};
    const primary = [props.housenumber, props.street || props.name].filter(Boolean).join(' ');
    const fallbackName = props.name || props.street || props.city || this.searchQuery;
    const name = primary || fallbackName;
    const detailsParts = [
      props.locality,
      props.city || props.district,
      props.state,
      props.postcode,
      props.country
    ].filter(Boolean);
    const uniqueDetails = detailsParts.filter((value, index, self) => self.indexOf(value) === index);
    const fullAddressParts = [name, ...uniqueDetails];

    return {
      name,
      fullAddress: fullAddressParts.filter(Boolean).join(', '),
      details: uniqueDetails.join(', '),
      city: props.city || props.locality || props.district || '',
      state: props.state || '',
      country: props.country || '',
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0]
    };
  }
}
