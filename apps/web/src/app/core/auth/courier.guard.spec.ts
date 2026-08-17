import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { courierGuard } from './courier.guard';
import { SessionStore } from './session.store';

type FakeSession = {
  status: () => string;
  isAuthenticated: () => boolean;
  user: () => { role: string } | null;
  restore: () => Promise<void>;
};

function configureWith(sessionStoreMock: FakeSession): void {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: SessionStore, useValue: sessionStoreMock },
    ],
  });
}

function runGuard() {
  return TestBed.runInInjectionContext(() => courierGuard({} as never, {} as never));
}

describe('courierGuard', () => {
  it('allows an already-known COURIER through without restoring', async () => {
    const restore = vi.fn();
    configureWith({
      status: () => 'authenticated',
      isAuthenticated: () => true,
      user: () => ({ role: 'COURIER' }),
      restore,
    });

    expect(await runGuard()).toBe(true);
    expect(restore).not.toHaveBeenCalled();
  });

  it('redirects an authenticated ADMIN to / -- this surface is COURIER-only', async () => {
    configureWith({
      status: () => 'authenticated',
      isAuthenticated: () => true,
      user: () => ({ role: 'ADMIN' }),
      restore: vi.fn(),
    });

    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('redirects an authenticated CLIENT to / -- not /login, they just lack access', async () => {
    configureWith({
      status: () => 'authenticated',
      isAuthenticated: () => true,
      user: () => ({ role: 'CLIENT' }),
      restore: vi.fn(),
    });

    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('redirects to /login without restoring when already known unauthenticated', async () => {
    const restore = vi.fn();
    configureWith({
      status: () => 'unauthenticated',
      isAuthenticated: () => false,
      user: () => null,
      restore,
    });

    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
    expect(restore).not.toHaveBeenCalled();
  });

  it('restores exactly once when idle, then allows access if the restore authenticates a courier', async () => {
    let authenticated = false;
    const restore = vi.fn(async () => {
      authenticated = true;
    });
    configureWith({
      status: () => 'idle',
      isAuthenticated: () => authenticated,
      user: () => ({ role: 'COURIER' }),
      restore,
    });

    expect(await runGuard()).toBe(true);
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
