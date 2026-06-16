import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { LeaseService } from '../../core/services/lease.service';
import { PurchaseService } from '../../core/services/purchase.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class AdminDashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private shopUnitService = inject(ShopUnitService);
  private leaseService = inject(LeaseService);
  private purchaseService = inject(PurchaseService);
  private cdr = inject(ChangeDetectorRef);

  projectCount = 0;
  unitCount = 0;
  pendingLeasesCount = 0;
  purchaseRequestsCount = 0;
  isLoading = true;

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    forkJoin({
      projects: this.projectService.getProjects(),
      units: this.shopUnitService.getShopUnits(),
      leases: this.leaseService.getLeaseRequests(),
      purchases: this.purchaseService.getPurchaseRequests()
    }).subscribe({
      next: (res) => {
        this.projectCount = res.projects.length;
        this.unitCount = res.units.length;
        this.pendingLeasesCount = res.leases.filter(l => l.status === 'PENDING').length;
        this.purchaseRequestsCount = res.purchases.length;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
