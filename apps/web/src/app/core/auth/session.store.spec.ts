import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideApiConfiguration } from '../api-client/api-configuration';
import { SessionStore } from './session.store';

// Bare origin, no `/api` suffix — the generated client's PATH constants
// already include the global prefix (see environment.ts for why).
const API_ORIGIN = 'http://test-api';

describe('SessionStore', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideApiConfiguration(API_ORIGIN),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('marks the session authenticated after a successful login', async () => {
    const store = TestBed.inject(SessionStore);

    const loginPromise = store.login('admin@lavenet.ci', 'Demo1234!');
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ identifier: 'admin@lavenet.ci', password: 'Demo1234!' });
    req.flush({
      accessToken: 'token-123',
      user: { id: 'usr_1', email: 'admin@lavenet.ci', phone: '+2250700000001', role: 'ADMIN' },
    });
    await loginPromise;

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('token-123');
    expect(store.user()?.role).toBe('ADMIN');
  });

  it('stays unauthenticated and rethrows on invalid credentials', async () => {
    const store = TestBed.inject(SessionStore);

    const loginPromise = store.login('admin@lavenet.ci', 'wrong-password');
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/login`);
    req.flush({ message: 'Identifiants invalides.' }, { status: 401, statusText: 'Unauthorized' });

    await expect(loginPromise).rejects.toBeTruthy();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
  });

  it('registers, logs the user in immediately, and surfaces the demo OTP code', async () => {
    const store = TestBed.inject(SessionStore);

    const registerPromise = store.register({
      fullName: 'Aya Kouassi',
      phone: '+2250700000009',
      password: 'Demo1234!',
    });
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush({
      accessToken: 'token-789',
      user: {
        id: 'usr_2',
        fullName: 'Aya Kouassi',
        email: null,
        phone: '+2250700000009',
        phoneVerified: false,
        role: 'CLIENT',
      },
      demoOtpCode: '123456',
    });

    const result = await registerPromise;

    expect(result.demoOtpCode).toBe('123456');
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.phoneVerified).toBe(false);
  });

  it('verifyOtp updates the user in place', async () => {
    const store = TestBed.inject(SessionStore);

    const verifyPromise = store.verifyOtp('123456');
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/otp/verify`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({
      user: {
        id: 'usr_2',
        fullName: 'Aya Kouassi',
        email: null,
        phone: '+2250700000009',
        phoneVerified: true,
        role: 'CLIENT',
      },
    });
    await verifyPromise;

    expect(store.user()?.phoneVerified).toBe(true);
  });

  it('resendOtp returns a fresh demo code without touching the session', async () => {
    const store = TestBed.inject(SessionStore);

    const resendPromise = store.resendOtp();
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/otp/resend`);
    expect(req.request.method).toBe('POST');
    req.flush({ demoOtpCode: '654321' });

    const result = await resendPromise;
    expect(result.demoOtpCode).toBe('654321');
  });

  it('requestPasswordReset returns a demo code without touching the session', async () => {
    const store = TestBed.inject(SessionStore);

    const requestPromise = store.requestPasswordReset('admin@lavenet.ci');
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/password-reset/request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ identifier: 'admin@lavenet.ci' });
    req.flush({ demoOtpCode: '654321' });

    const result = await requestPromise;
    expect(result.demoOtpCode).toBe('654321');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('confirmPasswordReset logs the user in on success', async () => {
    const store = TestBed.inject(SessionStore);

    const confirmPromise = store.confirmPasswordReset('admin@lavenet.ci', '123456', 'NewPass123!');
    const req = httpMock.expectOne(`${API_ORIGIN}/api/auth/password-reset/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      identifier: 'admin@lavenet.ci',
      code: '123456',
      newPassword: 'NewPass123!',
    });
    req.flush({
      accessToken: 'token-999',
      user: { id: 'usr_1', email: 'admin@lavenet.ci', phone: '+2250700000001', role: 'ADMIN' },
    });

    await confirmPromise;
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('token-999');
  });

  it('confirmPasswordReset stays unauthenticated and rethrows on an invalid code', async () => {
    const store = TestBed.inject(SessionStore);

    const confirmPromise = store.confirmPasswordReset('admin@lavenet.ci', '000000', 'NewPass123!');
    httpMock
      .expectOne(`${API_ORIGIN}/api/auth/password-reset/confirm`)
      .flush({ message: 'Code invalide.' }, { status: 400, statusText: 'Bad Request' });

    await expect(confirmPromise).rejects.toBeTruthy();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('restores an authenticated session from the refresh cookie', async () => {
    const store = TestBed.inject(SessionStore);

    const restorePromise = store.restore();
    httpMock.expectOne(`${API_ORIGIN}/api/auth/refresh`).flush({ accessToken: 'token-456' });
    // restore() awaits the refresh call (through a few chained promises —
    // the generated client, Api.invoke, then restore() itself) before
    // firing /me. A single microtask tick isn't enough to drain that whole
    // chain; a macrotask boundary reliably is.
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpMock
      .expectOne(`${API_ORIGIN}/api/auth/me`)
      .flush({ id: 'usr_1', email: 'client@lavenet.ci', phone: '+2250700000002', role: 'CLIENT' });
    await restorePromise;

    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.email).toBe('client@lavenet.ci');
  });

  it('restores to unauthenticated when there is no valid refresh cookie', async () => {
    const store = TestBed.inject(SessionStore);

    const restorePromise = store.restore();
    httpMock
      .expectOne(`${API_ORIGIN}/api/auth/refresh`)
      .flush({ message: 'Session expirée.' }, { status: 401, statusText: 'Unauthorized' });
    await restorePromise;

    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('clears the session on logout even if the request fails', async () => {
    const store = TestBed.inject(SessionStore);

    const loginPromise = store.login('admin@lavenet.ci', 'Demo1234!');
    httpMock.expectOne(`${API_ORIGIN}/api/auth/login`).flush({
      accessToken: 'token-123',
      user: { id: 'usr_1', email: 'admin@lavenet.ci', phone: '+2250700000001', role: 'ADMIN' },
    });
    await loginPromise;

    const logoutPromise = store.logout();
    httpMock
      .expectOne(`${API_ORIGIN}/api/auth/logout`)
      .flush(null, { status: 500, statusText: 'Internal Server Error' });

    await expect(logoutPromise).rejects.toBeTruthy();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });
});
