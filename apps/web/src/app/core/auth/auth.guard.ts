import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

// Session restoration is lazy, triggered from here rather than eagerly at
// app bootstrap: public pages (accueil, login) must never make an API call
// just because the app loaded — /compte is the only route that actually
// needs to know who's logged in.
export const authGuard: CanActivateFn = async () => {
  // Both injected before the first `await`: `inject()` only works
  // synchronously within the router's injection context — calling it after
  // an await throws NG0203, not just in a test harness, in real navigation
  // too.
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.status() === 'idle') {
    await session.restore();
  }

  return session.isAuthenticated() || router.createUrlTree(['/login']);
};
