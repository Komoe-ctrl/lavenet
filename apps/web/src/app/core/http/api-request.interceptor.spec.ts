import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { apiRequestInterceptor } from './api-request.interceptor';

function makeRequest(path: string): HttpRequest<unknown> {
  return new HttpRequest('GET', `${environment.apiBaseUrl}${path}`);
}

function invoke(req: HttpRequest<unknown>) {
  const next: HttpHandlerFn = vi.fn(() => of(new HttpResponse({ status: 200 })));
  TestBed.runInInjectionContext(() => apiRequestInterceptor(req, next));
  return next as unknown as { mock: { calls: [HttpRequest<unknown>, unknown][] } };
}

describe('apiRequestInterceptor', () => {
  it('passes requests to other origins straight through, untouched', () => {
    const req = new HttpRequest('GET', 'http://other-host/x');
    const next: HttpHandlerFn = vi.fn(() => of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => apiRequestInterceptor(req, next));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(req);
  });

  // The regression this guards: withCredentials used to be set on every API
  // call, which silently disabled Angular's HTTP transfer cache for all of
  // them (it refuses to cache/replay any request carrying credentials).
  it.each(['/catalog', '/auth/me', '/services'])(
    'does not send credentials for %s, so the transfer cache can serve it',
    (path) => {
      const next = invoke(makeRequest(path));
      const sent = next.mock.calls[0][0] as HttpRequest<unknown>;

      expect(sent.withCredentials).toBe(false);
    },
  );

  it.each(['/auth/login', '/auth/refresh', '/auth/logout'])(
    'sends credentials for %s, which reads or sets the refresh cookie',
    (path) => {
      const next = invoke(makeRequest(path));
      const sent = next.mock.calls[0][0] as HttpRequest<unknown>;

      expect(sent.withCredentials).toBe(true);
    },
  );

  it('still adds X-Requested-With regardless of whether credentials are sent', () => {
    const next = invoke(makeRequest('/catalog'));
    const sent = next.mock.calls[0][0] as HttpRequest<unknown>;

    expect(sent.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
  });
});
