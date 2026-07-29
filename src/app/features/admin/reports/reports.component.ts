import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-reports',
  imports: [DecimalPipe],
  template: `
    <div class="reports animate-fade-in">
      <div class="page-header">
        <div>
          <h1>Rapports & Statistiques</h1>
          <p>Analyse de performance de BlancoPro</p>
        </div>
        <button class="btn btn-outline btn-sm" (click)="exportReport()">📥 Exporter le rapport</button>
      </div>

      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else {
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card blue">
            <div class="kpi-icon">📦</div>
            <div class="kpi-value">{{ stats().total_orders }}</div>
            <div class="kpi-label">Total commandes</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value">{{ formatAmount(stats().total_revenue) }}</div>
            <div class="kpi-label">Revenu total (FCFA)</div>
          </div>
          <div class="kpi-card orange">
            <div class="kpi-icon">📅</div>
            <div class="kpi-value">{{ formatAmount(stats().monthly_revenue) }}</div>
            <div class="kpi-label">Revenu ce mois</div>
          </div>
          <div class="kpi-card teal">
            <div class="kpi-icon">👥</div>
            <div class="kpi-value">{{ stats().total_clients }}</div>
            <div class="kpi-label">Clients actifs</div>
          </div>
        </div>

        <!-- Order status breakdown -->
        <div class="reports-grid">
          <div class="card">
            <div class="card-header"><h3>Répartition par statut</h3></div>
            <div class="card-body">
              <div class="status-bars">
                @for (item of statusBreakdown(); track item.status) {
                  <div class="status-bar-item">
                    <div class="status-bar-label">
                      <span class="badge badge-{{ item.status }}">{{ item.label }}</span>
                      <span class="count">{{ item.count }}</span>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill bar-{{ item.status }}" [style.width.%]="item.pct"></div>
                    </div>
                    <span class="pct">{{ item.pct.toFixed(0) }}%</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Méthodes de paiement</h3></div>
            <div class="card-body">
              <div class="payment-breakdown">
                @for (item of paymentBreakdown(); track item.method) {
                  <div class="payment-row">
                    <span class="payment-icon">{{ item.icon }}</span>
                    <div class="payment-info">
                      <span>{{ item.label }}</span>
                      <div class="payment-bar">
                        <div class="payment-fill" [style.width.%]="item.pct"></div>
                      </div>
                    </div>
                    <span class="payment-count">{{ item.count }} ({{ item.pct.toFixed(0) }}%)</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Summary table -->
        <div class="card mt-6">
          <div class="card-header"><h3>Résumé mensuel</h3></div>
          <div class="table-container">
            <table>
              <thead>
                <tr><th>Métrique</th><th>Valeur</th><th>Détail</th></tr>
              </thead>
              <tbody>
                <tr><td>Commandes totales</td><td><strong>{{ stats().total_orders }}</strong></td><td>Toutes commandes confondues</td></tr>
                <tr><td>Commandes livrées</td><td><strong>{{ stats().delivered_orders }}</strong></td><td>Taux de livraison: {{ deliveryRate() }}%</td></tr>
                <tr><td>Commandes en attente</td><td><strong>{{ stats().pending_orders }}</strong></td><td>À traiter</td></tr>
                <tr><td>Revenu mensuel</td><td><strong>{{ stats().monthly_revenue | number }} FCFA</strong></td><td>Ce mois-ci</td></tr>
                <tr><td>Revenu total</td><td><strong>{{ stats().total_revenue | number }} FCFA</strong></td><td>Depuis le début</td></tr>
                <tr><td>Clients actifs</td><td><strong>{{ stats().total_clients }}</strong></td><td>Comptes enregistrés</td></tr>
                <tr><td>Panier moyen</td><td><strong>{{ averageOrder() | number }} FCFA</strong></td><td>Par commande livrée</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card {
      border-radius: var(--radius-lg); padding: 24px; color: white;
      &.blue { background: linear-gradient(135deg, #1d4ed8, #2563eb); }
      &.green { background: linear-gradient(135deg, #15803d, #16a34a); }
      &.orange { background: linear-gradient(135deg, #ea580c, #f97316); }
      &.teal { background: linear-gradient(135deg, #0e7490, #0891b2); }
      .kpi-icon { font-size: 2rem; margin-bottom: 12px; }
      .kpi-value { font-family: 'Poppins', sans-serif; font-size: 1.75rem; font-weight: 800; line-height: 1; margin-bottom: 6px; }
      .kpi-label { font-size: 0.85rem; opacity: 0.85; }
    }

    .reports-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }

    .status-bars { display: flex; flex-direction: column; gap: 14px; }
    .status-bar-item { display: flex; align-items: center; gap: 10px;
      .status-bar-label { display: flex; align-items: center; justify-content: space-between; min-width: 160px; .count { font-weight: 600; font-size: 0.9rem; } }
      .bar-track { flex: 1; height: 8px; background: var(--neutral-100); border-radius: var(--radius-full); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: var(--radius-full); transition: width 0.5s ease; }
      .bar-pending { background: #f59e0b; }
      .bar-confirmed, .bar-picked_up { background: #3b82f6; }
      .bar-processing, .bar-ready { background: #f97316; }
      .bar-out_for_delivery { background: #06b6d4; }
      .bar-delivered { background: #22c55e; }
      .bar-cancelled { background: #ef4444; }
      .pct { min-width: 36px; font-size: 0.8rem; color: var(--neutral-500); text-align: right; }
    }

    .payment-breakdown { display: flex; flex-direction: column; gap: 16px; }
    .payment-row { display: flex; align-items: center; gap: 12px;
      .payment-icon { font-size: 1.5rem; }
      .payment-info { flex: 1; span { font-size: 0.875rem; display: block; margin-bottom: 4px; } }
      .payment-bar { height: 6px; background: var(--neutral-100); border-radius: var(--radius-full); .payment-fill { height: 100%; background: var(--primary-500); border-radius: var(--radius-full); } }
      .payment-count { font-size: 0.8rem; color: var(--neutral-500); white-space: nowrap; }
    }

    .mt-6 { margin-top: 24px; }

    @media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } .reports-grid { grid-template-columns: 1fr; } }
  `]
})
export class ReportsComponent implements OnInit {
  stats = signal({
    total_orders: 0, pending_orders: 0, processing_orders: 0, delivered_orders: 0,
    total_revenue: 0, monthly_revenue: 0, total_clients: 0, new_clients_this_month: 0
  });
  allOrders = signal<any[]>([]);
  loading = signal(true);

  constructor(private orderService: OrderService) {}

  async ngOnInit() {
    try {
      const [stats, orders] = await Promise.all([
        this.orderService.getDashboardStats(),
        this.orderService.getAllOrders()
      ]);
      this.stats.set(stats);
      this.allOrders.set(orders);
    } finally {
      this.loading.set(false);
    }
  }

  statusBreakdown() {
    const statusList = ['pending', 'confirmed', 'picked_up', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
    const labels: Record<string, string> = {
      pending: 'En attente', confirmed: 'Confirmée', picked_up: 'Collectée',
      processing: 'En traitement', ready: 'Prête', out_for_delivery: 'En livraison',
      delivered: 'Livrée', cancelled: 'Annulée'
    };
    const total = this.allOrders().length || 1;
    return statusList.map(s => ({
      status: s,
      label: labels[s],
      count: this.allOrders().filter(o => o.status === s).length,
      pct: (this.allOrders().filter(o => o.status === s).length / total) * 100
    })).filter(x => x.count > 0);
  }

  paymentBreakdown() {
    const methods = [
      { method: 'mobile_money', label: 'Mobile Money', icon: '📱' },
      { method: 'card', label: 'Carte bancaire', icon: '💳' },
      { method: 'cash', label: 'Espèces', icon: '💵' }
    ];
    const total = this.allOrders().length || 1;
    return methods.map(m => ({
      ...m,
      count: this.allOrders().filter(o => o.payment_method === m.method).length,
      pct: (this.allOrders().filter(o => o.payment_method === m.method).length / total) * 100
    }));
  }

  deliveryRate(): string {
    const total = this.stats().total_orders;
    if (!total) return '0';
    return ((this.stats().delivered_orders / total) * 100).toFixed(0);
  }

  averageOrder(): number {
    const delivered = this.allOrders().filter(o => o.status === 'delivered');
    if (!delivered.length) return 0;
    return delivered.reduce((s, o) => s + Number(o.total_amount), 0) / delivered.length;
  }

  formatAmount(amount: number): string {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
    return amount.toString();
  }

  exportReport() {
    const lines = [
      'Rapport BlancoPro',
      `Date: ${new Date().toLocaleDateString('fr-FR')}`,
      '',
      `Total commandes: ${this.stats().total_orders}`,
      `Commandes livrées: ${this.stats().delivered_orders}`,
      `Revenu total: ${this.stats().total_revenue} FCFA`,
      `Revenu mensuel: ${this.stats().monthly_revenue} FCFA`,
      `Clients: ${this.stats().total_clients}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rapport-${new Date().toISOString().split('T')[0]}.txt`; a.click();
    URL.revokeObjectURL(url);
  }
}
