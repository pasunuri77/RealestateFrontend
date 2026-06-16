import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchaseService } from '../../core/services/purchase.service';
import { PurchaseRequest } from '../../models/purchase-request.model';

@Component({
  selector: 'app-admin-purchase-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-requests.html',
  styleUrl: './purchase-requests.scss'
})
export class AdminPurchaseRequestsComponent implements OnInit {
  private purchaseService = inject(PurchaseService);
  private cdr = inject(ChangeDetectorRef);

  purchases: PurchaseRequest[] = [];
  isLoading = true;

  ngOnInit() {
    this.loadPurchases();
  }

  loadPurchases() {
    this.isLoading = true;
    this.purchaseService.getPurchaseRequests().subscribe({
      next: (data) => {
        this.purchases = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
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
