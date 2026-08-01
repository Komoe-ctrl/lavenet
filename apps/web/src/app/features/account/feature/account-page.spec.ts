import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthUserDtoOutput } from '../../../core/api-client/models/auth-user-dto-output';
import { SessionStore } from '../../../core/auth/session.store';
import { AccountPage } from './account-page';

const SAMPLE_USER: AuthUserDtoOutput = {
  id: 'u1',
  email: 'client@lavenet.ci',
  phone: '+2250700000002',
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
      { provide: SessionStore, useValue: session },
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
    expect(text).toContain('client@lavenet.ci');
    expect(text).toContain('CLIENT');
    expect(text).toContain('Bientôt disponible');
    expect(text).toContain('Commandes');
    expect(text).toContain('Suivi');
    expect(text).toContain('Paiement');
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
