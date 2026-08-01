import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../../../core/auth/session.store';
import { LoginPage } from './login-page';

type FakeSession = { login: (email: string, password: string) => Promise<void> };

// SiteHeader (rendered by LoginPage) reads isAuthenticated()/user() -- not
// under test here, so always "logged out" regardless of what the login
// call under test does.
function configureWith(session: FakeSession) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'compte', children: [] }]),
      {
        provide: SessionStore,
        useValue: { ...session, isAuthenticated: () => false, user: () => null },
      },
    ],
  });
}

describe('LoginPage', () => {
  it('shows the header, footer and both demo accounts with the shared password', () => {
    configureWith({ login: vi.fn() });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Mode démonstration');
    expect(text).toContain('client@lavenet.ci');
    expect(text).toContain('admin@lavenet.ci');
    expect(text).toContain('Demo1234!');
    expect(text).toContain('projet de démonstration');
  });

  it('fills the form when a demo account button is clicked', () => {
    configureWith({ login: vi.fn() });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.demo-panel__accounts button',
    );
    button.click();
    fixture.detectChanges();

    const emailInput: HTMLInputElement = fixture.nativeElement.querySelector('#login-email');
    const passwordInput: HTMLInputElement = fixture.nativeElement.querySelector('#login-password');
    expect(emailInput.value).toBe('client@lavenet.ci');
    expect(passwordInput.value).toBe('Demo1234!');
  });

  it('navigates to /compte on successful login', async () => {
    configureWith({ login: vi.fn(() => Promise.resolve()) });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/compte');
  });

  it('shows an error and does not navigate when login fails', async () => {
    configureWith({ login: vi.fn(() => Promise.reject(new Error('bad credentials'))) });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Identifiants invalides');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
