import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PurchaseService } from '../../core/services/purchase.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { AuthService } from '../../core/services/auth.service';
import { ShopUnit } from '../../models/shop-unit.model';

@Component({
  selector: 'app-public-purchase-form',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './purchase-form.html',
  styleUrl: './purchase-form.scss'
})
export class PublicPurchaseFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private purchaseService = inject(PurchaseService);
  private shopUnitService = inject(ShopUnitService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  unitId!: number;
  unit: ShopUnit | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  purchaseForm: FormGroup = this.fb.group({
    customerName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern('[0-9]{10}')]],
    budget: ['', [Validators.required, Validators.min(1000)]],
    message: ['']
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.unitId = Number(params.get('id'));
      if (this.unitId) {
        this.loadUnitDetails(this.unitId);
      }
    });

    // Auto-fill from active user session
    const currentUser = this.authService.currentUserSignal();
    if (currentUser) {
      this.purchaseForm.patchValue({
        customerName: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || ''
      });
    }
  }

  loadUnitDetails(id: number) {
    this.shopUnitService.getShopUnitById(id).subscribe({
      next: (data) => {
        this.unit = data;
        if (data && data.salePrice) {
          this.purchaseForm.patchValue({ budget: data.salePrice });
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.purchaseForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit() {
    if (this.purchaseForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const payload = {
        ...this.purchaseForm.value,
        unitId: this.unitId
      };

      this.purchaseService.submitPurchaseRequest(payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Your request has been successfully submitted! Redirecting...';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.router.navigate(['/units', this.unitId]);
          }, 2000);
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Failed to submit request. Make sure you are logged in.';
          this.cdr.detectChanges();
        }
      });
    }
  }
}
