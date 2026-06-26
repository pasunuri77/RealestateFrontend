import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaseService } from '../../core/services/lease.service';
import { ProjectService } from '../../core/services/project.service';
import { ShopUnitService } from '../../core/services/shop-unit.service';
import { LeaseRequest } from '../../models/lease-request.model';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-lease-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lease-requests.html',
  styleUrl: './lease-requests.scss'
})
export class AdminLeaseRequestsComponent implements OnInit {
  private leaseService = inject(LeaseService);
  private projectService = inject(ProjectService);
  private shopUnitService = inject(ShopUnitService);
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);

  leases: LeaseRequest[] = [];
  projects: any[] = [];
  units: any[] = [];
  isLoading = true;

  ngOnInit() {
    this.loadLeases();
  }

  loadLeases() {
    this.isLoading = true;
    forkJoin({
      leases: this.leaseService.getLeaseRequests(),
      units: this.shopUnitService.getShopUnits(),
      projects: this.projectService.getProjects()
    }).subscribe({
      next: ({ leases, units, projects }) => {
        this.projects = projects;
        this.units = units;

        if (!this.authService.isAdmin()) {
          const userEmail = this.authService.currentUserSignal()?.email;
          this.leases = leases.filter(lease => lease.email === userEmail);
        } else {
          this.leases = leases;
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

  onApprove(id: number) {
    this.leaseService.approveLease(id).subscribe({
      next: () => {
        this.loadLeases();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  onReject(id: number) {
    this.leaseService.rejectLease(id).subscribe({
      next: () => {
        this.loadLeases();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  onChangeStatus(id: number, status: string) {
    this.leaseService.updateLeaseStatus(id, status).subscribe({
      next: () => {
        this.loadLeases();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  selectedLease: LeaseRequest | null = null;

  openModal(lease: LeaseRequest) {
    this.selectedLease = lease;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.selectedLease = null;
    this.cdr.detectChanges();
  }

  onDelete(id: number) {
    if (confirm('Delete this lease request entry?')) {
      this.leaseService.deleteLeaseRequest(id).subscribe({
        next: () => {
          this.loadLeases();
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }
}
