import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

// Session restoration is lazy, triggered from here rather than eagerly at
// app bootstrap: public pages (accueil, login) must never make an API call
// just because the app loaded — /compte is the only route that actually
// needs to know who's logged in.
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);

  if (session.status() === 'idle') {
    await session.restore();
  }

  return session.isAuthenticated() || inject(Router).createUrlTree(['/login']);
};
