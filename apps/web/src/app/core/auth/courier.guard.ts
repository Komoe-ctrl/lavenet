import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

// F-LIV-03. Same lazy-restore shape as adminGuard -- unauthenticated
// visitors go to /login same as any other private route. A visitor who
// *is* authenticated but not a COURIER goes to / instead: they aren't
// logged out, they're just not authorized for this section.
export const courierGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.status() === 'idle') {
    await session.restore();
  }

  if (!session.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const role = session.user()?.role;
  return role === 'COURIER' || router.createUrlTree(['/']);
};
