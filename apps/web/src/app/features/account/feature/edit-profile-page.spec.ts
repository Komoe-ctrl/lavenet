import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthUserDtoOutput } from '../../../core/api-client/models/auth-user-dto-output';
import { SessionStore } from '../../../core/auth/session.store';
import { EditProfilePage } from './edit-profile-page';

const SAMPLE_USER: AuthUserDtoOutput = {
  id: 'u1',
  fullName: 'Client Démo',
  email: 'client@lavenet.ci',
  phone: '+2250700000002',
  phoneVerified: true,
  notifyEmail: true,
  notifySms: false,
  role: 'CLIENT',
};

type FakeSession = {
  updateProfile: (input: unknown) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changePhone: (currentPassword: string, newPhone: string) => Promise<{ demoOtpCode?: string }>;
  changeEmail: (currentPassword: string, newEmail: string) => Promise<void>;
};

// SiteHeader (rendered by EditProfilePage) reads isAuthenticated()/user() --
// a user editing their profile is always logged in already.
function configureWith(session: FakeSession) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'otp-verify', children: [] }]),
      {
        provide: SessionStore,
        useValue: { ...session, isAuthenticated: () => true, user: signal(SAMPLE_USER) },
      },
    ],
  });
}

function setValue(
  fixture: { nativeElement: { querySelector: (selector: string) => HTMLInputElement } },
  selector: string,
  value: string,
): void {
  const input = fixture.nativeElement.querySelector(selector);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submitForm(
  fixture: { nativeElement: { querySelectorAll: (selector: string) => NodeListOf<Element> } },
  index: number,
): void {
  const form = fixture.nativeElement.querySelectorAll('form')[index] as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('EditProfilePage', () => {
  it('shows the header, footer and pre-fills the info section from the current user', () => {
    configureWith({
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      changePhone: vi.fn(),
      changeEmail: vi.fn(),
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Modifier le profil');
    expect(fixture.nativeElement.querySelector('#edit-full-name').value).toBe('Client Démo');
    expect(fixture.nativeElement.querySelectorAll('.checkbox-field input')[1].checked).toBe(false);
  });

  it('saves the info section', async () => {
    const updateProfile = vi.fn(() => Promise.resolve());
    configureWith({
      updateProfile,
      changePassword: vi.fn(),
      changePhone: vi.fn(),
      changeEmail: vi.fn(),
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();

    setValue(fixture, '#edit-full-name', 'Nouveau Nom');
    fixture.detectChanges();
    submitForm(fixture, 0);
    await fixture.whenStable();

    expect(updateProfile).toHaveBeenCalledWith({
      fullName: 'Nouveau Nom',
      notifyEmail: true,
      notifySms: false,
    });
    expect(fixture.nativeElement.textContent).toContain('Informations mises à jour.');
  });

  it('changes the phone and navigates to /otp-verify with the demo code', async () => {
    const changePhone = vi.fn(() => Promise.resolve({ demoOtpCode: '123456' }));
    configureWith({
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      changePhone,
      changeEmail: vi.fn(),
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    setValue(fixture, '#edit-phone-current-password', 'Demo1234!');
    setValue(fixture, '#edit-new-phone', '+2250700000009');
    fixture.detectChanges();
    submitForm(fixture, 1);
    await fixture.whenStable();

    expect(changePhone).toHaveBeenCalledWith('Demo1234!', '+2250700000009');
    expect(navigateSpy).toHaveBeenCalledWith(['/otp-verify'], {
      state: { demoOtpCode: '123456' },
    });
  });

  it('shows the API error and does not navigate when the phone change is rejected', async () => {
    const changePhone = vi.fn(() =>
      Promise.reject(
        new HttpErrorResponse({
          status: 401,
          error: { message: 'Mot de passe actuel incorrect.' },
        }),
      ),
    );
    configureWith({
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      changePhone,
      changeEmail: vi.fn(),
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    setValue(fixture, '#edit-phone-current-password', 'wrong');
    setValue(fixture, '#edit-new-phone', '+2250700000009');
    fixture.detectChanges();
    submitForm(fixture, 1);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Mot de passe actuel incorrect.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('changes the email', async () => {
    const changeEmail = vi.fn(() => Promise.resolve());
    configureWith({
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      changePhone: vi.fn(),
      changeEmail,
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();

    setValue(fixture, '#edit-email-current-password', 'Demo1234!');
    setValue(fixture, '#edit-new-email', 'new@lavenet.ci');
    fixture.detectChanges();
    submitForm(fixture, 2);
    await fixture.whenStable();

    expect(changeEmail).toHaveBeenCalledWith('Demo1234!', 'new@lavenet.ci');
    expect(fixture.nativeElement.textContent).toContain('Email mis à jour.');
  });

  it('changes the password and shows the session-revocation notice', async () => {
    const changePassword = vi.fn(() => Promise.resolve());
    configureWith({
      updateProfile: vi.fn(),
      changePassword,
      changePhone: vi.fn(),
      changeEmail: vi.fn(),
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();

    setValue(fixture, '#edit-current-password', 'Demo1234!');
    setValue(fixture, '#edit-new-password', 'BrandNew1234!');
    fixture.detectChanges();
    submitForm(fixture, 3);
    await fixture.whenStable();

    expect(changePassword).toHaveBeenCalledWith('Demo1234!', 'BrandNew1234!');
    expect(fixture.nativeElement.textContent).toContain('autres sessions ont été déconnectées');
  });
});
