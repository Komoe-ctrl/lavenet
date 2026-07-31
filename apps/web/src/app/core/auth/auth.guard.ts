import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

// Safe to check synchronously: the app-wide initializer (app.config.ts)
// awaits SessionStore.restore() before bootstrap completes, so status is
// already settled to 'authenticated' or 'unauthenticated' by the time any
// guard runs in the browser.
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.isAuthenticated() || inject(Router).createUrlTree(['/login']);
};
