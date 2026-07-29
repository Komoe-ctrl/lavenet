import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { DashboardStats, Order } from '../../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="dashboard animate-fade-in">
      <div class="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d'ensemble de l'activité BlancoPro</p>
        </div>
        <button class="btn btn-outline btn-sm" (click)="refresh()">🔄 Actualiser</button>
      </div>

      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else {
        <!-- Stats grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:#dbeafe;">📦</div>
            <div class="stat-value">{{ stats()?.total_orders ?? 0 }}</div>
            <div class="stat-label">Total commandes</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fef3c7;">⏳</div>
            <div class="stat-value" style="color:#92400e">{{ stats()?.pending_orders ?? 0 }}</div>
            <div class="stat-label">En attente</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#cffafe;">🔄</div>
            <div class="stat-value" style="color:#164e63">{{ stats()?.processing_orders ?? 0 }}</div>
            <div class="stat-label">En cours</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#dcfce7;">✅</div>
            <div class="stat-value" style="color:#166534">{{ stats()?.delivered_orders ?? 0 }}</div>
            <div class="stat-label">Livrées</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#d1fae5;">💰</div>
            <div class="stat-value">{{ formatCurrency(stats()?.monthly_revenue ?? 0) }}</div>
            <div class="stat-label">Revenu ce mois</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#ede9fe;">💎</div>
            <div class="stat-value">{{ formatCurrency(stats()?.total_revenue ?? 0) }}</div>
            <div class="stat-label">Revenu total</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fee2e2;">👥</div>
            <div class="stat-value">{{ stats()?.total_clients ?? 0 }}</div>
            <div class="stat-label">Clients actifs</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fce7f3;">📊</div>
            <div class="stat-value">{{ conversionRate() }}%</div>
            <div class="stat-label">Taux de livraison</div>
          </div>
        </div>

        <!-- Recent orders -->
        <div class="dashboard-sections">
          <div class="card">
            <div class="card-header">
              <h3>Commandes récentes</h3>
              <a routerLink="/admin/orders" class="btn btn-ghost btn-sm">Voir tout →</a>
            </div>
            @if (recentOrders().length === 0) {
              <div class="empty-state"><div class="empty-icon">📦</div><h3>Aucune commande</h3></div>
            } @else {
              <div class="table-container">
                <table>
                  <thead>
                    <tr><th>Commande</th><th>Client</th><th>Statut</th><th>Montant</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (order of recentOrders().slice(0, 8); track order.id) {
                      <tr>
                        <td><strong>{{ order.order_number }}</strong></td>
                        <td>{{ order['profile']?.['full_name'] ?? 'N/A' }}</td>
                        <td><span class="badge badge-{{ order.status }}">{{ statusLabels[order.status] }}</span></td>
                        <td><strong>{{ order.total_amount | number }} FCFA</strong></td>
                        <td>{{ formatDate(order.created_at) }}</td>
                        <td><a [routerLink]="['/admin/orders', order.id]" class="btn btn-ghost btn-sm">→</a></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <div class="side-panels">
            <!-- Pending actions -->
            <div class="card">
              <div class="card-header"><h3>Actions requises</h3></div>
              <div class="card-body">
                <div class="action-item" [class.highlight]="(stats()?.pending_orders ?? 0) > 0">
                  <span class="action-icon">⏳</span>
                  <div>
                    <strong>{{ stats()?.pending_orders ?? 0 }} commande(s) en attente</strong>
                    <p>À confirmer</p>
                  </div>
                  <a routerLink="/admin/orders" class="btn btn-primary btn-sm">Voir</a>
                </div>
                <div class="action-item">
                  <span class="action-icon">🚗</span>
                  <div>
                    <strong>{{ stats()?.processing_orders ?? 0 }} en cours</strong>
                    <p>En traitement ou livraison</p>
                  </div>
                  <a routerLink="/admin/orders" class="btn btn-ghost btn-sm">Voir</a>
                </div>
              </div>
            </div>

            <!-- Quick links -->
            <div class="card">
              <div class="card-header"><h3>Accès rapide</h3></div>
              <div class="card-body quick-links">
                <a routerLink="/admin/customers" class="quick-link">👥 Gérer les clients</a>
                <a routerLink="/admin/services" class="quick-link">🧺 Gérer les services</a>
                <a routerLink="/admin/promotions" class="quick-link">🎁 Créer une promo</a>
                <a routerLink="/admin/reports" class="quick-link">📈 Voir les rapports</a>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .dashboard-sections { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
    .side-panels { display: flex; flex-direction: column; gap: 16px; }

    .action-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--neutral-100); &:last-child { border-bottom: none; }
      &.highlight { background: #fffbeb; margin: -12px; padding: 12px; border-radius: var(--radius-md); border: 1px solid #fde68a; }
      .action-icon { font-size: 1.5rem; }
      div { flex: 1; strong { font-size: 0.9rem; display: block; } p { font-size: 0.78rem; color: var(--neutral-500); } }
    }

    .quick-links { display: flex; flex-direction: column; gap: 6px; }
    .quick-link { display: block; padding: 10px 12px; border-radius: var(--radius-md); font-size: 0.875rem; color: var(--neutral-700); transition: background 0.15s; &:hover { background: var(--neutral-100); } }

    @media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }
    @media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .dashboard-sections { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent implements OnInit {
  stats = signal<DashboardStats | null>(null);
  recentOrders = signal<Order[]>([]);
  loading = signal(true);

  statusLabels: Record<string, string> = {
    pending: 'En attente', confirmed: 'Confirmée', picked_up: 'Collectée',
    processing: 'En traitement', ready: 'Prête', out_for_delivery: 'En livraison',
    delivered: 'Livrée', cancelled: 'Annulée'
  };

  constructor(private orderService: OrderService) {}

  async ngOnInit() { await this.loadData(); }

  async refresh() {
    this.loading.set(true);
    await this.loadData();
  }

  private async loadData() {
    try {
      const [stats, orders] = await Promise.all([
        this.orderService.getDashboardStats(),
        this.orderService.getAllOrders()
      ]);
      this.stats.set(stats);
      this.recentOrders.set(orders);
    } finally {
      this.loading.set(false);
    }
  }

  conversionRate(): string {
    const total = this.stats()?.total_orders ?? 0;
    const delivered = this.stats()?.delivered_orders ?? 0;
    if (!total) return '0';
    return ((delivered / total) * 100).toFixed(0);
  }

  formatCurrency(amount: number): string {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
    return amount.toString();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
}
