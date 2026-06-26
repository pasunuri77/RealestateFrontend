import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchaseService } from '../../core/services/purchase.service';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { PurchaseRequest } from '../../models/purchase-request.model';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-purchase-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-requests.html',
  styleUrl: './purchase-requests.scss'
})
export class AdminPurchaseRequestsComponent implements OnInit {
  private purchaseService = inject(PurchaseService);
  private projectService = inject(ProjectService);
  private shopUnitService = inject(ShopUnitService);
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);

  purchases: PurchaseRequest[] = [];
  projects: any[] = [];
  units: any[] = [];
  isLoading = true;

  ngOnInit() {
    this.loadPurchases();
  }

  loadPurchases() {
    this.isLoading = true;
    forkJoin({
      purchases: this.purchaseService.getPurchaseRequests(),
      units: this.shopUnitService.getShopUnits(),
      projects: this.projectService.getProjects()
    }).subscribe({
      next: ({ purchases, units, projects }) => {
        this.projects = projects;
        this.units = units;

        if (!this.authService.isAdmin()) {
          const userEmail = this.authService.currentUserSignal()?.email;
          this.purchases = purchases.filter(purchase => purchase.email === userEmail);
        } else {
          this.purchases = purchases;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getProjectName(unitId: number): string {
    const unit = this.units.find(u => u.shopOrUnitId === unitId);
    if (!unit) return 'N/A';
    const project = this.projects.find(p => p.id === unit.projectId);
    return project ? (project.name || project.projectName || 'N/A') : 'N/A';
  }

  getUnitNumber(unitId: number): string {
    const unit = this.units.find(u => u.shopOrUnitId === unitId);
    return unit ? unit.unitNumber : unitId.toString();
  }

  onChangeStatus(id: number, status: string) {
    this.purchaseService.updatePurchaseStatus(id, status).subscribe({
      next: () => {
        this.loadPurchases();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  selectedPurchase: PurchaseRequest | null = null;

  openModal(purchase: PurchaseRequest) {
    this.selectedPurchase = purchase;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.selectedPurchase = null;
    this.cdr.detectChanges();
  }

  onDelete(id: number) {
    if (confirm('Delete this purchase request registry entry?')) {
      this.purchaseService.deletePurchaseRequest(id).subscribe({
        next: () => {
          this.loadPurchases();
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }
}
