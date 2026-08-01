import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../../../core/auth/session.store';
import { RegisterPage } from './register-page';

type FakeSession = {
  register: (input: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
  }) => Promise<{ demoOtpCode?: string }>;
};

// SiteHeader (rendered by RegisterPage) reads isAuthenticated()/user() --
// not under test here, so always "logged out" regardless of what the
// register call under test does.
function configureWith(session: FakeSession) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'otp-verify', children: [] }]),
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
  set('#register-full-name', 'Aya Kouassi');
  set('#register-phone', '+2250700000009');
  set('#register-password', 'Demo1234!');
}

describe('RegisterPage', () => {
  it('shows the header, footer and the form', () => {
    configureWith({ register: vi.fn() });
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Créer un compte');
    expect(fixture.nativeElement.querySelector('#register-phone')).not.toBeNull();
  });

  it('registers and navigates to /otp-verify carrying the demo OTP code', async () => {
    const register = vi.fn(() => Promise.resolve({ demoOtpCode: '123456' }));
    configureWith({ register });
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fillForm(fixture);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(register).toHaveBeenCalledWith({
      fullName: 'Aya Kouassi',
      phone: '+2250700000009',
      email: undefined,
      password: 'Demo1234!',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/otp-verify'], {
      state: { demoOtpCode: '123456' },
    });
  });

  it('shows the API error message and does not navigate when registration fails', async () => {
    const register = vi.fn(() =>
      Promise.reject(
        new HttpErrorResponse({ status: 400, error: { message: 'Ce numéro est déjà utilisé.' } }),
      ),
    );
    configureWith({ register });
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fillForm(fixture);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Ce numéro est déjà utilisé.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
