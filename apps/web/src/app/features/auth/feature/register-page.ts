import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CI_PHONE_FORMAT_HINT } from '@lavenet/shared-schemas';
import { SessionStore } from '../../../core/auth/session.store';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

const DEFAULT_ERROR = 'Impossible de créer le compte. Vérifiez vos informations.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

@Component({
  selector: 'app-register-page',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly phoneFormatHint = CI_PHONE_FORMAT_HINT;

  protected readonly fullName = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitting.set(true);
    this.error.set(null);
    try {
      const { demoOtpCode } = await this.session.register({
        fullName: this.fullName().trim(),
        phone: this.phone().trim(),
        email: this.email().trim() || undefined,
        password: this.password(),
      });
      await this.router.navigate(['/otp-verify'], { state: { demoOtpCode } });
    } catch (err) {
      this.error.set(extractErrorMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }
}
