import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  isFieldInvalid(field: string): boolean {
    const control = this.forgotForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit() {
    if (this.forgotForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';
      const email = this.forgotForm.value.email;

      this.authService.forgotPassword({ email }).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successMessage = res || 'Password reset OTP sent successfully';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.router.navigate(['/reset-password'], { queryParams: { email } });
          }, 1500);
        },
        error: (err) => {
          this.isLoading = false;
          // Check if response contains message inside JSON or raw text
          if (typeof err.error === 'string') {
            this.errorMessage = err.error;
          } else {
            this.errorMessage = err.error?.message || 'Failed to send OTP. Please try again.';
          }
          this.cdr.detectChanges();
        }
      });
    } else {
      this.forgotForm.markAllAsTouched();
    }
  }
}
