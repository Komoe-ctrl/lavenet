import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

const DEFAULT_ERROR = 'Une erreur est survenue. Réessayez.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

@Component({
  selector: 'app-edit-profile-page',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './edit-profile-page.html',
  styleUrl: './edit-profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfilePage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly user = this.session.user;

  // Each section below is independent: its own fields, its own
  // submitting/error/success state, its own submit handler. They touch
  // different endpoints with different requirements (currentPassword for
  // phone/email/password, not for the info section) -- one shared form
  // would just mean conditionally requiring fields depending on which
  // button was clicked.

  protected readonly fullName = signal(this.user()?.fullName ?? '');
  protected readonly notifyEmail = signal(this.user()?.notifyEmail ?? true);
  protected readonly notifySms = signal(this.user()?.notifySms ?? true);
  protected readonly infoSubmitting = signal(false);
  protected readonly infoError = signal<string | null>(null);
  protected readonly infoSuccess = signal(false);

  protected readonly phoneCurrentPassword = signal('');
  protected readonly newPhone = signal('');
  protected readonly phoneSubmitting = signal(false);
  protected readonly phoneError = signal<string | null>(null);

  protected readonly emailCurrentPassword = signal('');
  protected readonly newEmail = signal('');
  protected readonly emailSubmitting = signal(false);
  protected readonly emailError = signal<string | null>(null);
  protected readonly emailSuccess = signal(false);

  protected readonly passwordCurrentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly passwordSubmitting = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSuccess = signal(false);

  protected async submitInfo(event: Event): Promise<void> {
    event.preventDefault();
    this.infoSubmitting.set(true);
    this.infoError.set(null);
    this.infoSuccess.set(false);
    try {
      await this.session.updateProfile({
        fullName: this.fullName().trim(),
        notifyEmail: this.notifyEmail(),
        notifySms: this.notifySms(),
      });
      this.infoSuccess.set(true);
    } catch (err) {
      this.infoError.set(extractErrorMessage(err));
    } finally {
      this.infoSubmitting.set(false);
    }
  }

  protected async submitPhone(event: Event): Promise<void> {
    event.preventDefault();
    this.phoneSubmitting.set(true);
    this.phoneError.set(null);
    try {
      const { demoOtpCode } = await this.session.changePhone(
        this.phoneCurrentPassword(),
        this.newPhone().trim(),
      );
      await this.router.navigate(['/otp-verify'], { state: { demoOtpCode } });
    } catch (err) {
      this.phoneError.set(extractErrorMessage(err));
    } finally {
      this.phoneSubmitting.set(false);
    }
  }

  protected async submitEmail(event: Event): Promise<void> {
    event.preventDefault();
    this.emailSubmitting.set(true);
    this.emailError.set(null);
    this.emailSuccess.set(false);
    try {
      await this.session.changeEmail(this.emailCurrentPassword(), this.newEmail().trim());
      this.emailCurrentPassword.set('');
      this.emailSuccess.set(true);
    } catch (err) {
      this.emailError.set(extractErrorMessage(err));
    } finally {
      this.emailSubmitting.set(false);
    }
  }

  protected async submitPassword(event: Event): Promise<void> {
    event.preventDefault();
    this.passwordSubmitting.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(false);
    try {
      await this.session.changePassword(this.passwordCurrentPassword(), this.newPassword());
      this.passwordCurrentPassword.set('');
      this.newPassword.set('');
      this.passwordSuccess.set(true);
    } catch (err) {
      this.passwordError.set(extractErrorMessage(err));
    } finally {
      this.passwordSubmitting.set(false);
    }
  }
}
