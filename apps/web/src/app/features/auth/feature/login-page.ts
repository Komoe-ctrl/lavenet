import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

interface DemoAccount {
  label: string;
  email: string;
}

// Real seeded accounts (prisma/seed.ts) -- same password for both. This
// project's demo credentials are meant to be public (portfolio use), so
// showing them here is intentional, not a leak.
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Client', email: 'client@lavenet.ci' },
  { label: 'Admin', email: 'admin@lavenet.ci' },
];

@Component({
  selector: 'app-login-page',
  imports: [SiteHeader, SiteFooter],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly demoPassword = DEMO_PASSWORD;

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fillDemo(account: DemoAccount): void {
    this.email.set(account.email);
    this.password.set(DEMO_PASSWORD);
    this.error.set(null);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.session.login(this.email(), this.password());
      await this.router.navigateByUrl('/compte');
    } catch {
      this.error.set('Identifiants invalides.');
    } finally {
      this.submitting.set(false);
    }
  }
}
