import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { SessionStore } from './session.store';

type FakeSession = {
  status: () => string;
  isAuthenticated: () => boolean;
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
  return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
}

describe('authGuard', () => {
  it('allows access without restoring when already known authenticated', async () => {
    const restore = vi.fn();
    configureWith({ status: () => 'authenticated', isAuthenticated: () => true, restore });

    expect(await runGuard()).toBe(true);
    expect(restore).not.toHaveBeenCalled();
  });

  it('redirects to /login without restoring when already known unauthenticated', async () => {
    const restore = vi.fn();
    configureWith({ status: () => 'unauthenticated', isAuthenticated: () => false, restore });

    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(restore).not.toHaveBeenCalled();
  });

  it('restores exactly once when idle, then allows access if the restore authenticates', async () => {
    let authenticated = false;
    const restore = vi.fn(async () => {
      authenticated = true;
    });
    configureWith({ status: () => 'idle', isAuthenticated: () => authenticated, restore });

    expect(await runGuard()).toBe(true);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('restores when idle, then redirects to /login if the restore does not authenticate', async () => {
    const restore = vi.fn(() => Promise.resolve());
    configureWith({ status: () => 'idle', isAuthenticated: () => false, restore });

    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
