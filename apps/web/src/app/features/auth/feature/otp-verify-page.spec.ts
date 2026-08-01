import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../../../core/auth/session.store';
import { OtpVerifyPage } from './otp-verify-page';

type FakeSession = {
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<{ demoOtpCode?: string }>;
};

// SiteHeader (rendered by OtpVerifyPage) reads isAuthenticated()/user() --
// a verifying user is always logged in already (registration/login runs
// first), so this fake reports authenticated regardless of the OTP outcome
// under test.
function configureWith(session: FakeSession) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'compte', children: [] }]),
      {
        provide: SessionStore,
        useValue: { ...session, isAuthenticated: () => true, user: () => null },
      },
    ],
  });
}

function setCode(
  fixture: {
    nativeElement: { querySelector: (selector: string) => HTMLInputElement };
  },
  value: string,
): void {
  const input = fixture.nativeElement.querySelector('#otp-code');
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('OtpVerifyPage', () => {
  it('shows the header, footer and no demo banner when arriving without navigation state', () => {
    configureWith({ verifyOtp: vi.fn(), resendOtp: vi.fn() });
    const fixture = TestBed.createComponent(OtpVerifyPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Vérifiez votre téléphone');
    expect(text).not.toContain('Mode démonstration');
  });

  it('verifies the code and navigates to /compte on success', async () => {
    const verifyOtp = vi.fn(() => Promise.resolve());
    configureWith({ verifyOtp, resendOtp: vi.fn() });
    const fixture = TestBed.createComponent(OtpVerifyPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    setCode(fixture, '123456');
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(verifyOtp).toHaveBeenCalledWith('123456');
    expect(navigateSpy).toHaveBeenCalledWith('/compte');
  });

  it('shows the API error message and does not navigate when the code is wrong', async () => {
    const verifyOtp = vi.fn(() =>
      Promise.reject(new HttpErrorResponse({ status: 400, error: { message: 'Code invalide.' } })),
    );
    configureWith({ verifyOtp, resendOtp: vi.fn() });
    const fixture = TestBed.createComponent(OtpVerifyPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    setCode(fixture, '000000');
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Code invalide.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('resend shows a fresh demo code and a confirmation notice', async () => {
    const resendOtp = vi.fn(() => Promise.resolve({ demoOtpCode: '654321' }));
    configureWith({ verifyOtp: vi.fn(), resendOtp });
    const fixture = TestBed.createComponent(OtpVerifyPage);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.secondary-action');
    button.click();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mode démonstration');
    expect(text).toContain('654321');
    expect(text).toContain('Un nouveau code a été envoyé.');
  });

  it('shows the cooldown error message when resend is rejected', async () => {
    const resendOtp = vi.fn(() =>
      Promise.reject(
        new HttpErrorResponse({
          status: 429,
          error: { message: 'Veuillez patienter avant de redemander un code.' },
        }),
      ),
    );
    configureWith({ verifyOtp: vi.fn(), resendOtp });
    const fixture = TestBed.createComponent(OtpVerifyPage);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.secondary-action');
    button.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Veuillez patienter avant de redemander un code.',
    );
  });
});
