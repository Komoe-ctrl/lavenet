import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Requests to our own API need two things the generated client's
// RequestBuilder doesn't set (it has no option for either):
// - withCredentials, so the browser sends/stores the httpOnly refresh
//   cookie across the web/api origins (CLAUDE.md §5).
// - X-Requested-With, the CSRF mitigation AuthController requires on the
//   cookie-authenticated refresh/logout routes (see its comment for why).
// Harmless to add to every API call, so applied here rather than per-route.
export const apiRequestInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }
  return next(
    req.clone({
      withCredentials: true,
      setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    }),
  );
};
