import { TestBed } from '@angular/core/testing';
import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { coldStartInterceptor } from './cold-start.interceptor';
import { ColdStartService } from './cold-start.service';

// The interceptor matches requests against `environment.apiBaseUrl` directly
// (not the injected ApiConfiguration) — request URLs here must use that
// same base or the interceptor's early-return path swallows them silently,
// as it should for any request that isn't ours.
function makeRequest(path: string): HttpRequest<unknown> {
  return new HttpRequest('GET', `${environment.apiBaseUrl}${path}`);
}

describe('coldStartInterceptor', () => {
  let coldStart: ColdStartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    coldStart = TestBed.inject(ColdStartService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes requests to other origins straight through, untouched', () => {
    const req = new HttpRequest('GET', 'http://other-host/x');
    const next: HttpHandlerFn = vi.fn(() => of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => coldStartInterceptor(req, next));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(req);
  });

  it('never shows the banner for a request that resolves promptly', async () => {
    const req = makeRequest('/api/ping');
    const next: HttpHandlerFn = () => of(new HttpResponse({ status: 200 }));

    await new Promise<void>((resolve) => {
      TestBed.runInInjectionContext(() => coldStartInterceptor(req, next)).subscribe({
        complete: resolve,
      });
    });

    expect(coldStart.showBanner()).toBe(false);
  });

  it('marks the request timed out after 60s, then retries the exact same request on demand', async () => {
    vi.useFakeTimers();
    const req = makeRequest('/api/ping');
    const hang = new Subject<never>(); // never emits — simulates a hung request
    const receivedRequests: HttpRequest<unknown>[] = [];
    const next: HttpHandlerFn = (r) => {
      receivedRequests.push(r);
      return receivedRequests.length === 1 ? hang : of(new HttpResponse({ status: 200 }));
    };

    const events: unknown[] = [];
    const sub = TestBed.runInInjectionContext(() => coldStartInterceptor(req, next)).subscribe({
      next: (e) => events.push(e),
    });

    expect(coldStart.isTimedOut()).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(coldStart.isTimedOut()).toBe(true);
    expect(receivedRequests).toHaveLength(1);

    coldStart.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(receivedRequests).toHaveLength(2);
    expect(receivedRequests[1]).toBe(req); // retried the same request instance
    expect(events).toHaveLength(1);

    sub.unsubscribe();
  });

  it('shows the banner (slow, not timed out) once a request is pending past 3s', async () => {
    vi.useFakeTimers();
    const req = makeRequest('/api/ping');
    const hang = new Subject<never>();
    const next: HttpHandlerFn = () => hang;

    const sub = TestBed.runInInjectionContext(() => coldStartInterceptor(req, next)).subscribe();

    expect(coldStart.showBanner()).toBe(false);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(coldStart.showBanner()).toBe(true);
    expect(coldStart.isTimedOut()).toBe(false);

    sub.unsubscribe();
  });
});
