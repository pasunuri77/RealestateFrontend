import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { LeaseService } from '../../core/services/lease.service';
import { PurchaseService } from '../../core/services/purchase.service';
import { ShopUnit } from '../../models/shop-unit.model';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-public-unit-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './unit-detail.html',
  styleUrl: './unit-detail.scss'
})
export class PublicUnitDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private shopUnitService = inject(ShopUnitService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private leaseService = inject(LeaseService);
  private purchaseService = inject(PurchaseService);
  private cdr = inject(ChangeDetectorRef);

  unit: ShopUnit | null = null;
  projectName: string = 'Real Estate Project';
  isLoading = true;
  alreadyApplied = false;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.loadUnitDetails(id);
      }
    });
  }

  loadUnitDetails(id: number) {
    this.isLoading = true;
    this.shopUnitService.getShopUnitById(id).subscribe({
      next: (data) => {
        this.unit = data;
        this.loadProjectName(data.projectId);
        this.checkExistingRequests(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadProjectName(projectId: number) {
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.projectName = proj.name;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  checkExistingRequests(unitId: number) {
    const currentUser = this.authService.currentUserSignal();
    if (!currentUser) {
      this.alreadyApplied = false;
      return;
    }
    const userEmail = currentUser.email;

    this.leaseService.getLeaseRequests().subscribe({
      next: (leases) => {
        const hasLease = leases.some(
          l => l.unitId === unitId && l.email?.toLowerCase() === userEmail.toLowerCase()
        );
        if (hasLease) {
          this.alreadyApplied = true;
          this.cdr.detectChanges();
        }
      }
    });

    this.purchaseService.getPurchaseRequests().subscribe({
      next: (purchases) => {
        const hasPurchase = purchases.some(
          p => p.unitId === unitId && p.email?.toLowerCase() === userEmail.toLowerCase()
        );
        if (hasPurchase) {
          this.alreadyApplied = true;
          this.cdr.detectChanges();
        }
      }
    });
  }
}
