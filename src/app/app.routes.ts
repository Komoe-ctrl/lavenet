import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'client/home', pathMatch: 'full' },

  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    canActivate: [guestGuard],
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },

  {
    path: 'client',
    loadComponent: () => import('./features/client/client-layout/client-layout.component').then(m => m.ClientLayoutComponent),
    children: [
      { path: 'home', loadComponent: () => import('./features/client/home/home.component').then(m => m.HomeComponent) },
      { path: 'catalog', loadComponent: () => import('./features/client/catalog/catalog.component').then(m => m.CatalogComponent) },
      { path: 'cart', loadComponent: () => import('./features/client/cart/cart.component').then(m => m.CartComponent), canActivate: [authGuard] },
      { path: 'checkout', loadComponent: () => import('./features/client/checkout/checkout.component').then(m => m.CheckoutComponent), canActivate: [authGuard] },
      { path: 'orders', loadComponent: () => import('./features/client/orders/orders.component').then(m => m.OrdersComponent), canActivate: [authGuard] },
      { path: 'orders/:id', loadComponent: () => import('./features/client/order-detail/order-detail.component').then(m => m.OrderDetailComponent), canActivate: [authGuard] },
      { path: 'profile', loadComponent: () => import('./features/client/profile/profile.component').then(m => m.ProfileComponent), canActivate: [authGuard] },
      { path: 'loyalty', loadComponent: () => import('./features/client/loyalty/loyalty.component').then(m => m.LoyaltyComponent), canActivate: [authGuard] },
      { path: 'support', loadComponent: () => import('./features/client/support/support.component').then(m => m.SupportComponent), canActivate: [authGuard] },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },

  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'orders', loadComponent: () => import('./features/admin/orders/orders.component').then(m => m.AdminOrdersComponent) },
      { path: 'orders/:id', loadComponent: () => import('./features/admin/order-detail/order-detail.component').then(m => m.AdminOrderDetailComponent) },
      { path: 'customers', loadComponent: () => import('./features/admin/customers/customers.component').then(m => m.CustomersComponent) },
      { path: 'services', loadComponent: () => import('./features/admin/services/services.component').then(m => m.AdminServicesComponent) },
      { path: 'promotions', loadComponent: () => import('./features/admin/promotions/promotions.component').then(m => m.AdminPromotionsComponent) },
      { path: 'reports', loadComponent: () => import('./features/admin/reports/reports.component').then(m => m.ReportsComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: 'client/home' }
];
