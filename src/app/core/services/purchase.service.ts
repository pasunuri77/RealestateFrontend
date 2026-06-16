import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PurchaseRequest } from '../../models/purchase-request.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private readonly apiUrl = 'http://localhost:8080/api/purchaserequests';

  constructor(private http: HttpClient) {}

  submitPurchaseRequest(request: PurchaseRequest): Observable<PurchaseRequest> {
    return this.http.post<PurchaseRequest>(this.apiUrl, request);
  }

  getPurchaseRequests(): Observable<PurchaseRequest[]> {
    return this.http.get<PurchaseRequest[]>(this.apiUrl);
  }

  getPurchaseRequestById(id: number): Observable<PurchaseRequest> {
    return this.http.get<PurchaseRequest>(`${this.apiUrl}/${id}`);
  }

  deletePurchaseRequest(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
