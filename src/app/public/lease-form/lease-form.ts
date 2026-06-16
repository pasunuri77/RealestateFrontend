import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LeaseService } from '../../core/services/lease.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { ShopUnit } from '../../models/shop-unit.model';

@Component({
  selector: 'app-public-lease-form',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './lease-form.html',
  styleUrl: './lease-form.scss'
})
export class PublicLeaseFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private leaseService = inject(LeaseService);
  private shopUnitService = inject(ShopUnitService);
  private cdr = inject(ChangeDetectorRef);

  unitId!: number;
  unit: ShopUnit | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  leaseForm: FormGroup = this.fb.group({
    customerName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern('[0-9]{10}')]],
    businessType: ['', [Validators.required]],
    leaseType: ['12 Months', [Validators.required]],
    preferredStartDate: ['', [Validators.required]],
    message: ['']
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.unitId = Number(params.get('id'));
      if (this.unitId) {
        this.loadUnitDetails(this.unitId);
      }
    });
  }

  loadUnitDetails(id: number) {
    this.shopUnitService.getShopUnitById(id).subscribe({
      next: (data) => {
        this.unit = data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.leaseForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit() {
    if (this.leaseForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';
      
      const payload = {
        ...this.leaseForm.value,
        unitId: this.unitId,
        status: 'PENDING'
      };

      this.leaseService.submitLeaseRequest(payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Your application was submitted successfully! Redirecting...';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.router.navigate(['/units', this.unitId]);
          }, 2000);
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Failed to submit application. Make sure you are logged in.';
          this.cdr.detectChanges();
        }
      });
    }
  }
}
