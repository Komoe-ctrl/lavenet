import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

const DEFAULT_ERROR = "Impossible d'envoyer le code pour le moment. Réessayez plus tard.";

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

@Component({
  selector: 'app-forgot-password-page',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly identifier = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitting.set(true);
    this.error.set(null);
    try {
      const identifier = this.identifier().trim();
      const { demoOtpCode } = await this.session.requestPasswordReset(identifier);
      await this.router.navigate(['/reinitialiser-mot-de-passe'], {
        state: { identifier, demoOtpCode },
      });
    } catch (err) {
      this.error.set(extractErrorMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }
}
