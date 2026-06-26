import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  profileForm!: FormGroup;
  emailChangeForm!: FormGroup;
  passwordChangeForm!: FormGroup;

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  showNewPassword = false;
  showConfirmPassword = false;

  // Modal control states
  showEmailChangeFlow = false;
  emailChangeStep: 'REQUEST' | 'VERIFY' = 'REQUEST';
  emailChangeError = '';
  emailChangeSuccess = '';
  emailChangeLoading = false;
  pendingNewEmail = '';

  showPasswordChangeFlow = false;
  passwordChangeStep: 'REQUEST' | 'VERIFY' | 'UPDATE' = 'REQUEST';
  passwordChangeError = '';
  passwordChangeSuccess = '';
  passwordChangeLoading = false;
  verifiedPin = '';

  ngOnInit() {
    const session = this.authService.currentUserSignal();
    if (!session) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // 1. Initialize forms
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern('[0-9]{10}')]],
      email: [{ value: '', disabled: true }],
      companyAddress: ['']
    });

    this.emailChangeForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
      pin: ['', [Validators.required, Validators.pattern('[0-9]{6}')]]
    });

    this.passwordChangeForm = this.fb.group({
      pin: ['', [Validators.required, Validators.pattern('[0-9]{6}')]],
      newPassword: ['', [
        Validators.required,
        Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$')
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.loadProfile();
  }

  getInitials(): string {
    const session = this.authService.currentUserSignal();
    if (!session || !session.name) return 'U';
    const parts = session.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }

  getFullName(): string {
    const session = this.authService.currentUserSignal();
    return session?.name || 'RealEstate User';
  }

  getEmail(): string {
    const session = this.authService.currentUserSignal();
    return session?.email || '';
  }

  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const newPass = control.get('newPassword')?.value;
    const confirmPass = control.get('confirmPassword')?.value;
    return newPass === confirmPass ? null : { 'mismatch': true };
  }

  loadProfile() {
    this.isLoading = true;
    this.authService.getProfile().subscribe({
      next: (user) => {
        this.isLoading = false;
        this.profileForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
          companyAddress: user.companyAddress || ''
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load user profile.';
        this.cdr.detectChanges();
      }
    });
  }

  isFieldInvalid(form: 'profile' | 'email' | 'password', field: string): boolean {
    let activeForm: FormGroup;
    if (form === 'profile') activeForm = this.profileForm;
    else if (form === 'email') activeForm = this.emailChangeForm;
    else activeForm = this.passwordChangeForm;

    const control = activeForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  isMismatchInvalid(): boolean {
    const confirmControl = this.passwordChangeForm.get('confirmPassword');
    return !!(
      this.passwordChangeForm.hasError('mismatch') &&
      confirmControl &&
      (confirmControl.dirty || confirmControl.touched)
    );
  }

  getPasswordStrength(): 'Weak' | 'Medium' | 'Strong' | '' {
    const password = this.passwordChangeForm?.get('newPassword')?.value || '';
    if (!password) return '';
    if (password.length < 8) return 'Weak';

    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&#]/.test(password)) score++;

    if (score <= 2) return 'Weak';
    if (score === 3) return 'Medium';
    return 'Strong';
  }

  onSubmitProfile() {
    if (this.profileForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const requestBody = {
        firstName: this.profileForm.value.firstName,
        lastName: this.profileForm.value.lastName,
        phone: this.profileForm.value.phone,
        companyAddress: this.profileForm.value.companyAddress
      };

      this.authService.updateProfile(requestBody).subscribe({
        next: (user) => {
          this.isLoading = false;
          this.successMessage = 'Profile updated successfully!';
          
          // Sync with global auth session state
          const session = this.authService.currentUserSignal();
          if (session) {
            const updatedSession = {
              ...session,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              phone: user.phone,
              companyAddress: user.companyAddress
            };
            localStorage.setItem('auth_user', JSON.stringify(updatedSession));
            this.authService.currentUserSignal.set(updatedSession);
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Failed to update profile details.';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.profileForm.markAllAsTouched();
    }
  }

  // --- Email Change Flow Functions ---

  openEmailChange() {
    this.showEmailChangeFlow = true;
    this.emailChangeStep = 'REQUEST';
    this.emailChangeError = '';
    this.emailChangeSuccess = '';
    this.emailChangeForm.reset();
  }

  closeEmailChange() {
    this.showEmailChangeFlow = false;
    this.cdr.detectChanges();
  }

  sendEmailChangeOtp() {
    const newEmailControl = this.emailChangeForm.get('newEmail');
    if (newEmailControl && newEmailControl.valid) {
      this.emailChangeLoading = true;
      this.emailChangeError = '';
      this.emailChangeSuccess = '';
      this.pendingNewEmail = newEmailControl.value;

      this.authService.requestEmailChangeOtp(this.pendingNewEmail).subscribe({
        next: (res) => {
          this.emailChangeLoading = false;
          this.emailChangeSuccess = 'OTP sent successfully to your new email.';
          this.emailChangeStep = 'VERIFY';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.emailChangeLoading = false;
          this.emailChangeError = err.error?.message || err.error || 'Failed to send OTP. Email may be already in use.';
          this.cdr.detectChanges();
        }
      });
    } else {
      newEmailControl?.markAsTouched();
    }
  }

  confirmEmailChange() {
    const pinControl = this.emailChangeForm.get('pin');
    if (pinControl && pinControl.valid) {
      this.emailChangeLoading = true;
      this.emailChangeError = '';
      this.emailChangeSuccess = '';

      this.authService.verifyEmailChangeOtp(pinControl.value).subscribe({
        next: (user) => {
          this.emailChangeLoading = false;
          this.emailChangeSuccess = 'Email updated successfully!';
          this.profileForm.patchValue({ email: user.email });

          // Sync frontend session
          const session = this.authService.currentUserSignal();
          if (session) {
            const updatedSession = {
              ...session,
              email: user.email
            };
            localStorage.setItem('auth_email', user.email);
            localStorage.setItem('auth_user', JSON.stringify(updatedSession));
            this.authService.currentUserSignal.set(updatedSession);
          }

          this.cdr.detectChanges();
          setTimeout(() => {
            this.closeEmailChange();
          }, 1500);
        },
        error: (err) => {
          this.emailChangeLoading = false;
          this.emailChangeError = err.error?.message || err.error || 'Invalid or expired OTP pin.';
          this.cdr.detectChanges();
        }
      });
    } else {
      pinControl?.markAsTouched();
    }
  }

  // --- Password Change Flow Functions ---

  openPasswordChange() {
    this.showPasswordChangeFlow = true;
    this.passwordChangeStep = 'REQUEST';
    this.passwordChangeError = '';
    this.passwordChangeSuccess = '';
    this.passwordChangeForm.reset();
  }

  closePasswordChange() {
    this.showPasswordChangeFlow = false;
    this.cdr.detectChanges();
  }

  sendPasswordChangeOtp() {
    this.passwordChangeLoading = true;
    this.passwordChangeError = '';
    this.passwordChangeSuccess = '';

    this.authService.requestPasswordChangeOtp().subscribe({
      next: (res) => {
        this.passwordChangeLoading = false;
        this.passwordChangeSuccess = 'OTP code sent to your current verified email.';
        this.passwordChangeStep = 'VERIFY';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.passwordChangeLoading = false;
        this.passwordChangeError = err.error?.message || err.error || 'Failed to send OTP code.';
        this.cdr.detectChanges();
      }
    });
  }

  verifyPasswordChangeOtp() {
    const pinControl = this.passwordChangeForm.get('pin');
    if (pinControl && pinControl.valid) {
      this.passwordChangeLoading = true;
      this.passwordChangeError = '';
      this.passwordChangeSuccess = '';
      this.verifiedPin = pinControl.value;

      this.authService.verifyPasswordChangeOtp(this.verifiedPin).subscribe({
        next: (res) => {
          this.passwordChangeLoading = false;
          this.passwordChangeSuccess = 'OTP Verified! Please enter your new password below.';
          this.passwordChangeStep = 'UPDATE';
          // Pre-populate pin to maintain validator validity
          this.passwordChangeForm.patchValue({ pin: this.verifiedPin });
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.passwordChangeLoading = false;
          this.passwordChangeError = err.error?.message || err.error || 'Invalid or expired OTP code.';
          this.cdr.detectChanges();
        }
      });
    } else {
      pinControl?.markAsTouched();
    }
  }

  onSubmitPasswordUpdate() {
    if (this.passwordChangeForm.valid) {
      this.passwordChangeLoading = true;
      this.passwordChangeError = '';
      this.passwordChangeSuccess = '';

      const newPass = this.passwordChangeForm.value.newPassword;
      const confirmPass = this.passwordChangeForm.value.confirmPassword;

      this.authService.updatePassword(this.verifiedPin, newPass, confirmPass).subscribe({
        next: (res) => {
          this.passwordChangeLoading = false;
          this.passwordChangeSuccess = 'Password changed successfully!';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.closePasswordChange();
          }, 1500);
        },
        error: (err) => {
          this.passwordChangeLoading = false;
          this.passwordChangeError = err.error?.message || err.error || 'Failed to update password. Session might have expired.';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.passwordChangeForm.markAllAsTouched();
    }
  }
}
