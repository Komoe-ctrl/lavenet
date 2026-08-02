import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../../../core/auth/session.store';
import { ForgotPasswordPage } from './forgot-password-page';

type FakeSession = {
  requestPasswordReset: (identifier: string) => Promise<{ demoOtpCode?: string }>;
};

// SiteHeader (rendered by ForgotPasswordPage) reads isAuthenticated()/user()
// -- not under test here, always "logged out".
function configureWith(session: FakeSession) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'reinitialiser-mot-de-passe', children: [] }]),
      {
        provide: SessionStore,
        useValue: { ...session, isAuthenticated: () => false, user: () => null },
      },
    ],
  });
}

function setIdentifier(
  fixture: { nativeElement: { querySelector: (selector: string) => HTMLInputElement } },
  value: string,
): void {
  const input = fixture.nativeElement.querySelector('#forgot-password-identifier');
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ForgotPasswordPage', () => {
  it('shows the header, footer and the form', () => {
    configureWith({ requestPasswordReset: vi.fn() });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Mot de passe oublié');
  });

  it('requests a reset and navigates carrying the identifier and demo code', async () => {
    const requestPasswordReset = vi.fn(() => Promise.resolve({ demoOtpCode: '123456' }));
    configureWith({ requestPasswordReset });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    setIdentifier(fixture, 'admin@lavenet.ci');
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(requestPasswordReset).toHaveBeenCalledWith('admin@lavenet.ci');
    expect(navigateSpy).toHaveBeenCalledWith(['/reinitialiser-mot-de-passe'], {
      state: { identifier: 'admin@lavenet.ci', demoOtpCode: '123456' },
    });
  });

  it('shows the API error message and does not navigate on failure', async () => {
    const requestPasswordReset = vi.fn(() =>
      Promise.reject(
        new HttpErrorResponse({ status: 429, error: { message: 'Veuillez patienter.' } }),
      ),
    );
    configureWith({ requestPasswordReset });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    setIdentifier(fixture, 'admin@lavenet.ci');
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Veuillez patienter.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
