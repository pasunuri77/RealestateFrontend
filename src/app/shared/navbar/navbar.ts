import { Component, inject, ChangeDetectorRef } from '@angular/core';
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

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.cdr.detectChanges();
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    this.cdr.detectChanges();
  }

  onLogout() {
    this.closeMobileMenu();
    this.authService.logout();
    this.router.navigate(['/auth/login']);
    this.cdr.detectChanges();
  }
}
