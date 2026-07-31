import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';

@Component({
  selector: 'app-account-page',
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly user = this.session.user;

  protected async logout(): Promise<void> {
    await this.session.logout();
    await this.router.navigateByUrl('/login');
  }
}
