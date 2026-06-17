import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShopUnit } from '../../models/shop-unit.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ShopUnitService {
  private readonly apiUrl = `${environment.apiUrl}/shopunits`;

  constructor(private http: HttpClient) {}

  getShopUnits(): Observable<ShopUnit[]> {
    return this.http.get<ShopUnit[]>(this.apiUrl);
  }

  getShopUnitById(id: number): Observable<ShopUnit> {
    return this.http.get<ShopUnit>(`${this.apiUrl}/${id}`);
  }

  getShopUnitsByProject(projectId: number): Observable<ShopUnit[]> {
    return this.http.get<ShopUnit[]>(`${this.apiUrl}/project/${projectId}`);
  }

  createShopUnit(unit: ShopUnit): Observable<ShopUnit> {
    return this.http.post<ShopUnit>(this.apiUrl, unit);
  }

  updateShopUnit(id: number, unit: ShopUnit): Observable<ShopUnit> {
    return this.http.put<ShopUnit>(`${this.apiUrl}/${id}`, unit);
  }

  deleteShopUnit(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
