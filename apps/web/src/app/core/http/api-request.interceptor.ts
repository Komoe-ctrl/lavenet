import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Only these routes ever read or set the httpOnly refresh cookie
// (apps/api/src/auth/auth.controller.ts's own comment: "the cookie is only
// ever read by refresh/logout" -- login additionally needs it to *store*
// the cookie the response sets). Every other route, including public ones
// like /catalog, has no use for it.
const CREDENTIALED_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

// Requests to our own API need two things the generated client's
// RequestBuilder doesn't set (it has no option for either):
// - withCredentials, so the browser sends/stores the httpOnly refresh
//   cookie across the web/api origins (CLAUDE.md §5) -- but only for the
//   endpoints above. Setting it unconditionally used to seem "harmless",
//   but Angular's HttpClient transfer cache (enabled by default via
//   provideClientHydration) refuses to write or replay ANY request carrying
//   withCredentials, by design (it won't risk serving one user's cached
//   response to another). That silently broke the zero-refetch-after-
//   hydration invariant for every API call, not just catalog.
// - X-Requested-With, the CSRF mitigation AuthController requires on the
//   cookie-authenticated refresh/logout routes (see its comment for why).
//   Harmless to add to every call, so still applied unconditionally.
export const apiRequestInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }
  const needsCredentials = CREDENTIALED_ENDPOINTS.some((path) => req.url.includes(path));
  return next(
    req.clone({
      withCredentials: needsCredentials,
      setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    }),
  );
};
