import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Floor } from '../../models/floor.model';

@Injectable({
  providedIn: 'root'
})
export class FloorService {
  private readonly apiUrl = 'http://localhost:8080/api/floors';

  constructor(private http: HttpClient) {}

  getFloors(): Observable<Floor[]> {
    return this.http.get<Floor[]>(this.apiUrl);
  }

  getFloorById(id: number): Observable<Floor> {
    return this.http.get<Floor>(`${this.apiUrl}/${id}`);
  }

  getFloorsByBuilding(buildingId: number): Observable<Floor[]> {
    return this.http.get<Floor[]>(`${this.apiUrl}/building/${buildingId}`);
  }

  createFloor(floor: Floor): Observable<Floor> {
    return this.http.post<Floor>(this.apiUrl, floor);
  }

  updateFloor(id: number, floor: Floor): Observable<Floor> {
    return this.http.put<Floor>(`${this.apiUrl}/${id}`, floor);
  }

  deleteFloor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
