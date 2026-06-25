import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  resetForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  showNewPassword = false;
  showConfirmPassword = false;

  ngOnInit() {
    // Get query param email
    const emailParam = this.route.snapshot.queryParamMap.get('email') || '';

    this.resetForm = this.fb.group({
      email: [{ value: emailParam, disabled: true }, [Validators.required, Validators.email]],
      otp: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]],
      newPassword: ['', [
        Validators.required,
        Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$')
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const newPass = control.get('newPassword')?.value;
    const confirmPass = control.get('confirmPassword')?.value;
    return newPass === confirmPass ? null : { 'mismatch': true };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.resetForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  isMismatchInvalid(): boolean {
    const confirmControl = this.resetForm.get('confirmPassword');
    return !!(
      this.resetForm.hasError('mismatch') && 
      confirmControl && 
      (confirmControl.dirty || confirmControl.touched)
    );
  }

  getPasswordStrength(): 'Weak' | 'Medium' | 'Strong' | '' {
    const password = this.resetForm?.get('newPassword')?.value || '';
    if (!password) return '';
    if (password.length < 8) return 'Weak';

    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&#]/.test(password)) score++;

    if (score <= 2) {
      return 'Weak';
    } else if (score === 3) {
      return 'Medium';
    } else if (score >= 4) {
      return 'Strong';
    }
    return 'Weak';
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit() {
    if (this.resetForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      // getRawValue extracts disabled controls (email) as well
      const rawForm = this.resetForm.getRawValue();
      const payload = {
        email: rawForm.email,
        otp: rawForm.otp,
        newPassword: rawForm.newPassword
      };

      this.authService.resetPassword(payload).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successMessage = res || 'Password reset successful';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 1500);
        },
        error: (err) => {
          this.isLoading = false;
          if (typeof err.error === 'string') {
            this.errorMessage = err.error;
          } else {
            this.errorMessage = err.error?.message || 'Password reset failed. Please check inputs.';
          }
          this.cdr.detectChanges();
        }
      });
    } else {
      this.resetForm.markAllAsTouched();
    }
  }
}
