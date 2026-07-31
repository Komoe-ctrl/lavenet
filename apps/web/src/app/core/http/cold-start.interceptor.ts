import { HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  Observable,
  TimeoutError,
  catchError,
  finalize,
  switchMap,
  take,
  throwError,
  timeout,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ColdStartService } from './cold-start.service';

// Render's free tier spins the API down after ~15min idle; the first
// request after that can take up to ~1 minute. Per CLAUDE.md, this is
// handled by UX, not infrastructure: never a frozen screen — an explicit
// "démarrage du serveur" state after SLOW_THRESHOLD_MS, and a "réessayer"
// button after TIMEOUT_MS instead of failing silently.
const SLOW_THRESHOLD_MS = 3_000;
const TIMEOUT_MS = 60_000;

function attempt(
  req: HttpRequest<unknown>,
  next: Parameters<HttpInterceptorFn>[1],
  coldStart: ColdStartService,
): Observable<HttpEvent<unknown>> {
  return next(req).pipe(
    timeout(TIMEOUT_MS),
    catchError((err: unknown) => {
      if (!(err instanceof TimeoutError)) {
        return throwError(() => err);
      }
      coldStart.requestTimedOut();
      // Wait for the banner's "réessayer" click, then resend the exact same
      // request — not just any error, only a timeout ever waits here.
      return coldStart.retry$.pipe(
        take(1),
        switchMap(() => attempt(req, next, coldStart)),
      );
    }),
  );
}

export const coldStartInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const coldStart = inject(ColdStartService);
  coldStart.requestStarted();
  const slowTimer = setTimeout(() => coldStart.requestSlow(), SLOW_THRESHOLD_MS);

  return attempt(req, next, coldStart).pipe(
    finalize(() => {
      clearTimeout(slowTimer);
      coldStart.requestSettled();
    }),
  );
};
