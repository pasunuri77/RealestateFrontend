import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeaseRequest } from '../../models/lease-request.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LeaseService {
  private readonly apiUrl = `${environment.apiUrl}/leases`;

  constructor(private http: HttpClient) {}

  submitLeaseRequest(request: LeaseRequest): Observable<LeaseRequest> {
    return this.http.post<LeaseRequest>(this.apiUrl, request);
  }

  getLeaseRequests(): Observable<LeaseRequest[]> {
    return this.http.get<LeaseRequest[]>(this.apiUrl);
  }

  getLeaseRequestById(id: number): Observable<LeaseRequest> {
    return this.http.get<LeaseRequest>(`${this.apiUrl}/${id}`);
  }

  getLeaseRequestsByStatus(status: string): Observable<LeaseRequest[]> {
    return this.http.get<LeaseRequest[]>(`${this.apiUrl}/status/${status}`);
  }

  approveLease(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/approve`, {});
  }

  rejectLease(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/reject`, {});
  }

  updateLeaseStatus(id: number, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/status/${status}`, {});
  }

  deleteLeaseRequest(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
