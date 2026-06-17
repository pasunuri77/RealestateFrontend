import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaseService } from '../../core/services/lease.service';
import { LeaseRequest } from '../../models/lease-request.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-lease-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lease-requests.html',
  styleUrl: './lease-requests.scss'
})
export class AdminLeaseRequestsComponent implements OnInit {
  private leaseService = inject(LeaseService);
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);

  leases: LeaseRequest[] = [];
  isLoading = true;

  ngOnInit() {
    this.loadLeases();
  }

  loadLeases() {
    this.isLoading = true;
    this.leaseService.getLeaseRequests().subscribe({
      next: (data) => {
        this.leases = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
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
