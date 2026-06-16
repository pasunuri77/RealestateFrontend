import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Building } from '../../models/building.model';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {
  private readonly apiUrl = 'http://localhost:8080/api/buildings';

  constructor(private http: HttpClient) {}

  getBuildings(): Observable<Building[]> {
    return this.http.get<Building[]>(this.apiUrl);
  }

  getBuildingById(id: number): Observable<Building> {
    return this.http.get<Building>(`${this.apiUrl}/${id}`);
  }

  getBuildingsByProject(projectId: number): Observable<Building[]> {
    return this.http.get<Building[]>(`${this.apiUrl}/project/${projectId}`);
  }

  createBuilding(building: Building): Observable<Building> {
    return this.http.post<Building>(this.apiUrl, building);
  }

  updateBuilding(id: number, building: Building): Observable<Building> {
    return this.http.put<Building>(`${this.apiUrl}/${id}`, building);
  }

  deleteBuilding(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
