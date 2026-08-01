import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideClientHydration } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { apiRequestInterceptor } from './api-request.interceptor';

// This is the invariant lot 2's review caught broken: a prerendered page
// (/, /tarifs) must not re-fetch its data once the client hydrates. That
// invariant lives entirely in the interaction between our interceptors and
// Angular's own HTTP transfer cache (enabled by default through
// provideClientHydration) -- it can't be verified by mocking CatalogService
// the way the page specs do, since that would bypass the exact mechanism
// under test. So, unusually for this codebase, this test drives the real
// HttpClient + real transfer cache instead of stubbing them.
//
// `ngServerMode` is the private, unexported flag Angular's own transfer-
// cache interceptor reads to decide whether to *write* a response into
// TransferState (see @angular/common/http's transferCacheInterceptorFn:
// the store only happens `if (ngServerMode)`). Real SSR sets it via
// @angular/platform-server before bootstrapping. Toggling it here for the
// "server" half of this test is the only way to exercise the real write
// path without reimplementing Angular's internal cache-key algorithm by
// hand.
declare global {
  var ngServerMode: boolean | undefined;
}

describe('HTTP transfer cache (catalog request)', () => {
  afterEach(() => {
    globalThis.ngServerMode = undefined;
  });

  it('serves a prerendered GET /catalog from TransferState with zero network calls on the client', async () => {
    const url = `${environment.apiBaseUrl}/api/catalog`;
    const body = { categories: [] };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiRequestInterceptor])),
        provideHttpClientTesting(),
        provideClientHydration(),
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    // "Server": the same request the prerender step makes gets written to
    // TransferState, exactly as it would during `ng build`'s SSG pass.
    globalThis.ngServerMode = true;
    let serverResult: unknown;
    http.get(url).subscribe((res) => (serverResult = res));
    httpMock.expectOne(url).flush(body);
    expect(serverResult).toEqual(body);

    // "Client": hydration replays the exact same request. If this reaches
    // the network, the fix regressed -- httpMock.expectNone throws.
    globalThis.ngServerMode = false;
    let clientResult: unknown;
    http.get(url).subscribe((res) => (clientResult = res));

    httpMock.expectNone(url);
    expect(clientResult).toEqual(body);
  });
});
