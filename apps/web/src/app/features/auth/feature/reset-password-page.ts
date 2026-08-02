import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

const DEFAULT_ERROR = 'Code invalide.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

@Component({
  selector: 'app-reset-password-page',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  // Carried from forgot-password-page's navigation state when available
  // (same injection-context timing rule as otp-verify-page's demoOtpCode:
  // read before any `await`). A direct visit or a page reload simply
  // leaves both blank -- the identifier field below is then just a normal,
  // editable input instead of a pre-filled one.
  private readonly navState = this.router.getCurrentNavigation()?.extras.state;

  protected readonly identifier = signal((this.navState?.['identifier'] as string) ?? '');
  protected readonly code = signal('');
  protected readonly newPassword = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly demoOtpCode = signal<string | null>(
    (this.navState?.['demoOtpCode'] as string | undefined) ?? null,
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
      await this.session.confirmPasswordReset(
        this.identifier().trim(),
        this.code(),
        this.newPassword(),
      );
      await this.router.navigateByUrl('/compte');
    } catch (err) {
      this.error.set(extractErrorMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }
}
