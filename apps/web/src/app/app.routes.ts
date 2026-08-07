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
    path: 'register',
    loadComponent: () =>
      import('./features/auth/feature/register-page').then((m) => m.RegisterPage),
  },
  {
    path: 'otp-verify',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/feature/otp-verify-page').then((m) => m.OtpVerifyPage),
  },
  {
    path: 'mot-de-passe-oublie',
    loadComponent: () =>
      import('./features/auth/feature/forgot-password-page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reinitialiser-mot-de-passe',
    loadComponent: () =>
      import('./features/auth/feature/reset-password-page').then((m) => m.ResetPasswordPage),
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
  {
    path: 'compte/modifier',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/feature/edit-profile-page').then((m) => m.EditProfilePage),
  },
  {
    path: 'compte/adresses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/feature/addresses-page').then((m) => m.AddressesPage),
  },
  {
    path: 'panier',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cart/feature/cart-page').then((m) => m.CartPage),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/feature/not-found-page').then((m) => m.NotFoundPage),
  },
];
