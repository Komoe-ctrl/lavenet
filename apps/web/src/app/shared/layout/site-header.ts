import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { siteConfig } from '../config/site-config';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  // Reads whatever SessionStore already knows -- never calls restore()
  // itself. On /, /tarifs (prerendered, no guard ever runs) status stays
  // 'idle' and this correctly shows "Se connecter", with zero API calls.
  // On /compte, authGuard has already restored the session before this
  // renders, so isAuthenticated() is accurate there. See CLAUDE.md's
  // "restauration de session paresseuse" rule.
  private readonly session = inject(SessionStore);
  protected readonly isAuthenticated = this.session.isAuthenticated;
  protected readonly user = this.session.user;
  protected readonly config = siteConfig;
}
