import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthUserDtoOutput } from '../../../core/api-client/models/auth-user-dto-output';
import { SessionStore } from '../../../core/auth/session.store';
import { AccountPage } from './account-page';

const SAMPLE_USER: AuthUserDtoOutput = {
  id: 'u1',
  fullName: 'Client Démo',
  email: 'client@lavenet.ci',
  phone: '+2250700000002',
  phoneVerified: true,
  role: 'CLIENT',
};

function configureWith(session: {
  user: () => AuthUserDtoOutput | null;
  logout: () => Promise<void>;
}) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'login', children: [] }]),
      {
        // SiteHeader (rendered by AccountPage) reads isAuthenticated() too --
        // derived from the same fake `user` so the header and the profile
        // section never disagree in a test.
        provide: SessionStore,
        useValue: { ...session, isAuthenticated: () => session.user() !== null },
      },
    ],
  });
}

describe('AccountPage', () => {
  it('shows a loading state while the profile is not yet known', () => {
    configureWith({ user: signal(null), logout: vi.fn() });
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chargement du profil');
  });

  it('shows the header, footer, profile and the not-yet-built roadmap', () => {
    configureWith({ user: signal(SAMPLE_USER), logout: vi.fn() });
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Client Démo');
    expect(text).toContain('client@lavenet.ci');
    expect(text).toContain('CLIENT');
    expect(text).toContain('Bientôt disponible');
    expect(text).toContain('Commandes');
    expect(text).toContain('Suivi');
    expect(text).toContain('Paiement');
    // Already verified in SAMPLE_USER -- no nudge to go verify.
    expect(text).not.toContain('non vérifié');
  });

  it('nudges an unverified phone toward /otp-verify', () => {
    configureWith({ user: signal({ ...SAMPLE_USER, phoneVerified: false }), logout: vi.fn() });
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('non vérifié');
    expect(text).toContain("n'est pas encore vérifié");
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.verify-notice a');
    expect(link.getAttribute('href')).toBe('/otp-verify');
  });

  it('shows the account email in the header instead of a login link', () => {
    configureWith({ user: signal(SAMPLE_USER), logout: vi.fn() });
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Se connecter');
    expect(fixture.nativeElement.querySelector('.account-link')).not.toBeNull();
  });

  it('logs out and navigates to /login', async () => {
    const logout = vi.fn(() => Promise.resolve());
    configureWith({ user: signal(SAMPLE_USER), logout });
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.logout');
    button.click();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
