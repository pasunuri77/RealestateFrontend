import { Component, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent {
  authService = inject(AuthService);
  router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  isMobileMenuOpen = false;
  isDropdownOpen = false;

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.cdr.detectChanges();
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    this.cdr.detectChanges();
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    this.cdr.detectChanges();
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.cdr.detectChanges();
  }

  getFirstName(): string {
    const fullName = this.authService.currentUserSignal()?.name || '';
    return fullName.split(' ')[0] || 'User';
  }

  onLogout() {
    this.closeMobileMenu();
    this.closeDropdown();
    this.authService.logout();
    this.router.navigate(['/auth/login']);
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown-container')) {
      this.isDropdownOpen = false;
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    this.isDropdownOpen = false;
    this.cdr.detectChanges();
  }
}
