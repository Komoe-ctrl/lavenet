import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout">
      <nav class="admin-sidebar">
        <div class="sidebar-header">
          <a routerLink="/client/home" class="sidebar-logo">
            <span>👕</span> BlancoPro
          </a>
          <span class="admin-tag">Admin</span>
        </div>

        <div class="sidebar-nav">
          <div class="nav-section">
            <span class="nav-label">PRINCIPAL</span>
            <a routerLink="/admin/dashboard" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📊</span> Tableau de bord
            </a>
            <a routerLink="/admin/orders" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📦</span> Commandes
            </a>
            <a routerLink="/admin/customers" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">👥</span> Clients
            </a>
          </div>
          <div class="nav-section">
            <span class="nav-label">GESTION</span>
            <a routerLink="/admin/services" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">🧺</span> Services
            </a>
            <a routerLink="/admin/promotions" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">🎁</span> Promotions
            </a>
            <a routerLink="/admin/reports" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📈</span> Rapports
            </a>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar-sm">{{ auth.profile()?.full_name?.charAt(0)?.toUpperCase() }}</div>
            <div>
              <strong>{{ auth.profile()?.full_name }}</strong>
              <span>{{ auth.profile()?.role }}</span>
            </div>
          </div>
          <a routerLink="/client/home" class="nav-item">🏠 Site client</a>
          <button class="nav-item danger" (click)="auth.signOut()">🚪 Déconnexion</button>
        </div>
      </nav>

      <main class="admin-main">
        <div class="admin-topbar">
          <div class="topbar-left">
            <h1 class="page-title"></h1>
          </div>
          <div class="topbar-right">
            <span class="admin-date">{{ today }}</span>
          </div>
        </div>
        <div class="admin-content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .admin-layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }

    .admin-sidebar {
      background: var(--neutral-900); color: white; display: flex; flex-direction: column;
      position: sticky; top: 0; height: 100vh; overflow-y: auto;
    }

    .sidebar-header {
      padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
      .sidebar-logo { display: flex; align-items: center; gap: 8px; font-family: 'Poppins', sans-serif; font-weight: 800; font-size: 1.1rem; color: white; span { font-size: 1.3rem; } }
      .admin-tag { background: var(--primary-600); color: white; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-top: 6px; }
    }

    .sidebar-nav { flex: 1; padding: 12px 0; }
    .nav-section { margin-bottom: 20px; .nav-label { font-size: 0.65rem; font-weight: 700; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; padding: 8px 20px 4px; display: block; } }
    .nav-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 20px;
      font-size: 0.875rem; color: var(--neutral-400); transition: all 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left;
      .nav-icon { font-size: 1rem; width: 20px; }
      &:hover { color: white; background: rgba(255,255,255,0.05); }
      &.active { color: white; background: rgba(255,255,255,0.1); border-right: 3px solid var(--primary-500); }
      &.danger { color: #f87171; &:hover { background: rgba(239,68,68,0.1); color: #fca5a5; } }
    }

    .sidebar-footer {
      padding: 16px; border-top: 1px solid rgba(255,255,255,0.08);
      .user-info { display: flex; align-items: center; gap: 10px; padding: 8px; margin-bottom: 8px; border-radius: var(--radius-md); background: rgba(255,255,255,0.05);
        .user-avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-600); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
        strong { display: block; font-size: 0.85rem; color: white; }
        span { font-size: 0.75rem; color: var(--neutral-500); text-transform: capitalize; }
      }
    }

    .admin-main { background: var(--neutral-50); overflow-y: auto; }
    .admin-topbar { background: white; border-bottom: 1px solid var(--neutral-200); padding: 0 28px; height: 56px; display: flex; align-items: center; justify-content: space-between; .topbar-right { font-size: 0.85rem; color: var(--neutral-500); } }
    .admin-content { padding: 28px; }

    @media (max-width: 1024px) {
      .admin-layout { grid-template-columns: 200px 1fr; }
    }
  `]
})
export class AdminLayoutComponent {
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  constructor(public auth: AuthService) {}
}
