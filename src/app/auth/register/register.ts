import { Component, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  registerForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern('[0-9]{10}')]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['USER', [Validators.required]]
  });

  verificationForm: FormGroup = this.fb.group({
    pin: ['', [Validators.required, Validators.pattern('[0-9]{6}')]]
  });

  step: 1 | 2 = 1;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  
  timerCount = 120; // 2 minutes
  timerInterval: any;

  ngOnDestroy() {
    this.stopTimer();
  }

  isFieldInvalid(form: 'register' | 'verify', field: string): boolean {
    const activeForm = form === 'register' ? this.registerForm : this.verificationForm;
    const control = activeForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  startTimer() {
    this.timerCount = 120;
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.timerCount > 0) {
        this.timerCount--;
        this.cdr.detectChanges();
      } else {
        this.stopTimer();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  onRegisterSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';
      
      this.authService.register(this.registerForm.value).subscribe({
        next: () => {
          this.isLoading = false;
          this.step = 2;
          this.startTimer();
          this.successMessage = 'Registration successful! Verification code sent to your email.';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Registration failed. Try using a different email.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  onVerifySubmit() {
    if (this.verificationForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const email = this.registerForm.get('email')?.value;
      const pin = this.verificationForm.get('pin')?.value;

      this.authService.verifyEmail(email, pin).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Email verified successfully! Redirecting to login...';
          this.stopTimer();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 2000);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Invalid or expired verification PIN.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  resendPin() {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.startTimer();
        this.successMessage = 'A new verification PIN has been sent to your email.';
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Failed to resend PIN. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
