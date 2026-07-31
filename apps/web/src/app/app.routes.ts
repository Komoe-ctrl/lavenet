import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  // No public homepage yet (accueil/tarifs/à propos are separate,
  // not-yet-built feature work) — redirect so '/' isn't a dead 404 on the
  // static host in the meantime.
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/feature/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'compte',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/feature/account-page').then((m) => m.AccountPage),
  },
];
