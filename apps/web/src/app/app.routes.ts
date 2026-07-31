import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./features/home/feature/home-page').then((m) => m.HomePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/feature/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'tarifs',
    loadComponent: () => import('./features/catalog/feature/tarifs-page').then((m) => m.TarifsPage),
  },
  {
    path: 'compte',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/feature/account-page').then((m) => m.AccountPage),
  },
];
