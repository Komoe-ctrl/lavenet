import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

const DEFAULT_VERIFY_ERROR = 'Code invalide.';
const DEFAULT_RESEND_ERROR = "Impossible d'envoyer un nouveau code pour le moment.";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : fallback;
  }
  return fallback;
}

@Component({
  selector: 'app-otp-verify-page',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './otp-verify-page.html',
  styleUrl: './otp-verify-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpVerifyPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly code = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resending = signal(false);
  protected readonly resendNotice = signal<string | null>(null);

  // Set only right after registration -- must be read before any `await`
  // (same injection-context rule as authGuard). A page reload, or arriving
  // here any other way, simply shows no demo banner: the code was never
  // lost, it's just no longer available client-side.
  protected readonly demoOtpCode = signal<string | null>(
    (this.router.getCurrentNavigation()?.extras.state?.['demoOtpCode'] as string | undefined) ??
      null,
  );

  protected fillDemoCode(): void {
    const value = this.demoOtpCode();
    if (value) {
      this.code.set(value);
    }
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.session.verifyOtp(this.code());
      await this.router.navigateByUrl('/compte');
    } catch (err) {
      this.error.set(extractErrorMessage(err, DEFAULT_VERIFY_ERROR));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async resend(): Promise<void> {
    this.resending.set(true);
    this.error.set(null);
    this.resendNotice.set(null);
    try {
      const { demoOtpCode } = await this.session.resendOtp();
      this.demoOtpCode.set(demoOtpCode ?? null);
      this.resendNotice.set('Un nouveau code a été envoyé.');
    } catch (err) {
      this.error.set(extractErrorMessage(err, DEFAULT_RESEND_ERROR));
    } finally {
      this.resending.set(false);
    }
  }
}
