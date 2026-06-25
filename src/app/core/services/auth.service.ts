import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../../models/user.model';
import { environment } from '../../../environments/environment';

export interface VerifyEmailRequest {
  email: string;
  pin: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/user`;
  
  // Reactive signals for auth state
  currentUserSignal = signal<{ token: string; role: 'ADMIN' | 'USER'; email: string; name: string; phone?: string; id?: number } | null>(null);
  
  isLoggedIn = computed(() => this.currentUserSignal() !== null);
  isAdmin = computed(() => this.currentUserSignal()?.role === 'ADMIN');
  isUser = computed(() => this.currentUserSignal()?.role === 'USER');

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  register(user: User): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  verifyEmail(request: VerifyEmailRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/verify-email`, request, { responseType: 'text' });
  }

  login(credentials: { email: string; password?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        // Assume API returns { token, role, email, firstName, lastName, phone, id }
        if (response && response.token) {
          const userSession = {
            token: response.token,
            role: response.role as 'ADMIN' | 'USER',
            email: response.email,
            name: `${response.firstName || ''} ${response.lastName || ''}`.trim() || response.email,
            phone: response.phone,
            id: response.id
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
        this.currentUserSignal.set({ token, role, email, name: email, phone: '', id: 0 });
      }
    }
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getRole(): string | null {
    return localStorage.getItem('auth_role');
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/forgot-password`, request, { responseType: 'text' });
  }

  resetPassword(request: ResetPasswordRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/reset-password`, request, { responseType: 'text' });
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  updateUser(id: number, request: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, request);
  }

  sendEmailChangeOtp(userId: number, newEmail: string): Observable<string> {
    return this.http.post(`${this.apiUrl}/send-email-change-otp`, null, {
      params: { userId: userId.toString(), newEmail: newEmail },
      responseType: 'text'
    });
  }

  confirmEmailChange(userId: number, newEmail: string, pin: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/confirm-email-change`, null, {
      params: { userId: userId.toString(), newEmail: newEmail, pin: pin }
    });
  }

  // --- Profile Management APIs (/api/profile) ---
  private readonly profileApiUrl = `${environment.apiUrl}/profile`;

  getProfile(): Observable<User> {
    return this.http.get<User>(this.profileApiUrl);
  }

  updateProfile(request: any): Observable<User> {
    return this.http.put<User>(this.profileApiUrl, request);
  }

  requestEmailChangeOtp(newEmail: string): Observable<string> {
    return this.http.post(`${this.profileApiUrl}/change-email/request-otp`, null, {
      params: { newEmail },
      responseType: 'text'
    });
  }

  verifyEmailChangeOtp(pin: string): Observable<User> {
    return this.http.post<User>(`${this.profileApiUrl}/change-email/verify-otp`, null, {
      params: { pin }
    });
  }

  requestPasswordChangeOtp(): Observable<string> {
    return this.http.post(`${this.profileApiUrl}/change-password/request-otp`, null, {
      responseType: 'text'
    });
  }

  verifyPasswordChangeOtp(pin: string): Observable<string> {
    return this.http.post(`${this.profileApiUrl}/change-password/verify-otp`, null, {
      params: { pin },
      responseType: 'text'
    });
  }

  updatePassword(pin: string, newPassword: string, confirmNewPassword: string): Observable<string> {
    return this.http.post(`${this.profileApiUrl}/change-password/update`, null, {
      params: { pin, newPassword, confirmNewPassword },
      responseType: 'text'
    });
  }
}

