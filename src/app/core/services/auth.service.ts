import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:8080/api/user';
  
  // Reactive signals for auth state
  currentUserSignal = signal<{ token: string; role: 'ADMIN' | 'USER'; email: string; name: string } | null>(null);
  
  isLoggedIn = computed(() => this.currentUserSignal() !== null);
  isAdmin = computed(() => this.currentUserSignal()?.role === 'ADMIN');
  isUser = computed(() => this.currentUserSignal()?.role === 'USER');

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  register(user: User): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  verifyEmail(email: string, pin: string): Observable<string> {
    return this.http.post(`${this.apiUrl}/verify-email`, { email, pin }, { responseType: 'text' });
  }

  login(credentials: { email: string; password?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        // Assume API returns { token, role, email, firstName, lastName }
        if (response && response.token) {
          const userSession = {
            token: response.token,
            role: response.role as 'ADMIN' | 'USER',
            email: response.email,
            name: `${response.firstName || ''} ${response.lastName || ''}`.trim() || response.email
          };
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('auth_role', response.role);
          localStorage.setItem('auth_email', response.email);
          localStorage.setItem('auth_user', JSON.stringify(userSession));
          this.currentUserSignal.set(userSession);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_user');
    this.currentUserSignal.set(null);
  }

  private loadSession(): void {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('auth_role') as 'ADMIN' | 'USER';
    const email = localStorage.getItem('auth_email');
    const userString = localStorage.getItem('auth_user');

    if (token && role && email && userString) {
      try {
        const parsed = JSON.parse(userString);
        this.currentUserSignal.set(parsed);
      } catch (e) {
        this.currentUserSignal.set({ token, role, email, name: email });
      }
    }
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getRole(): string | null {
    return localStorage.getItem('auth_role');
  }
}
