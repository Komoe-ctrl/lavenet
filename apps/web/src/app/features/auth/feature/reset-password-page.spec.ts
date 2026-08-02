import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../../../core/auth/session.store';
import { ResetPasswordPage } from './reset-password-page';

type FakeSession = {
  confirmPasswordReset: (identifier: string, code: string, newPassword: string) => Promise<void>;
};

// SiteHeader (rendered by ResetPasswordPage) reads isAuthenticated()/user()
// -- not under test here, always "logged out" (a user resetting a password
// isn't authenticated yet).
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

function fillForm(fixture: {
  nativeElement: { querySelector: (selector: string) => HTMLInputElement };
}): void {
  const set = (selector: string, value: string) => {
    const input = fixture.nativeElement.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  set('#reset-password-identifier', 'admin@lavenet.ci');
  set('#reset-password-code', '123456');
  set('#reset-password-new-password', 'NewPass123!');
}

describe('ResetPasswordPage', () => {
  it('shows the header, footer, no demo banner and a blank identifier without navigation state', () => {
    configureWith({ confirmPasswordReset: vi.fn() });
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Réinitialiser le mot de passe');
    expect(text).not.toContain('Mode démonstration');
    expect(fixture.nativeElement.querySelector('#reset-password-identifier').value).toBe('');
  });

  it('confirms the reset and navigates to /compte on success', async () => {
    const confirmPasswordReset = vi.fn(() => Promise.resolve());
    configureWith({ confirmPasswordReset });
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    fillForm(fixture);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(confirmPasswordReset).toHaveBeenCalledWith('admin@lavenet.ci', '123456', 'NewPass123!');
    expect(navigateSpy).toHaveBeenCalledWith('/compte');
  });

  it('shows the API error message and does not navigate when the code is wrong', async () => {
    const confirmPasswordReset = vi.fn(() =>
      Promise.reject(new HttpErrorResponse({ status: 400, error: { message: 'Code invalide.' } })),
    );
    configureWith({ confirmPasswordReset });
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    fillForm(fixture);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Code invalide.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
