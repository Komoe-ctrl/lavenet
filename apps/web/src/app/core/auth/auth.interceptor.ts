import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RefreshCoordinator } from './refresh-coordinator';
import { SessionStore } from './session.store';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh'];

function withBearer(req: Parameters<HttpInterceptorFn>[0], token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

// Attaches the in-memory access token to every API call, and — per
// CLAUDE.md §5 ("refresh silencieux par interceptor") — on a 401 from a
// non-auth endpoint, attempts exactly one silent refresh (via
// RefreshCoordinator, which queues concurrent 401s onto the same refresh)
// and retries the original request. If the refresh itself fails, the
// session is cleared instead of retrying forever.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const session = inject(SessionStore);
  const refreshCoordinator = inject(RefreshCoordinator);
  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));
  const token = session.accessToken();
  const initialReq = token && !isAuthEndpoint ? withBearer(req, token) : req;

  return next(initialReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthEndpoint) {
        return throwError(() => err);
      }

      return refreshCoordinator.refresh().pipe(
        switchMap((newToken) => next(withBearer(req, newToken))),
        catchError((refreshErr: unknown) => {
          session.clear();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
