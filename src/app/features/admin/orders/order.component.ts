import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models';

@Component({
  selector: 'app-admin-orders',
  imports: [RouterLink, FormsModule, DecimalPipe],
  template: `
    <div class="admin-orders animate-fade-in">
      <div class="page-header">
        <div>
          <h1>Gestion des commandes</h1>
          <p>{{ orders().length }} commande(s) au total</p>
        </div>
        <button class="btn btn-outline btn-sm" (click)="exportCSV()">📥 Exporter CSV</button>
      </div>

      <div class="filters-bar">
        <input type="search" [(ngModel)]="search" placeholder="Rechercher par numéro, client..." class="search-input">
        <select [(ngModel)]="statusFilter" class="filter-select">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="picked_up">Collectée</option>
          <option value="processing">En traitement</option>
          <option value="ready">Prête</option>
          <option value="out_for_delivery">En livraison</option>
          <option value="delivered">Livrée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>

      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else {
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>N° Commande</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th>Livraison</th>
                <th>Montant</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (order of filteredOrders(); track order.id) {
                <tr>
                  <td><strong>{{ order.order_number }}</strong></td>
                  <td>{{ order['profile']?.['full_name'] ?? 'N/A' }}</td>
                  <td>
                    <select class="status-select" [value]="order.status" (change)="updateStatus(order, $any($event.target).value)">
                      <option value="pending">En attente</option>
                      <option value="confirmed">Confirmée</option>
                      <option value="picked_up">Collectée</option>
                      <option value="processing">En traitement</option>
                      <option value="ready">Prête</option>
                      <option value="out_for_delivery">En livraison</option>
                      <option value="delivered">Livrée</option>
                      <option value="cancelled">Annulée</option>
                    </select>
                  </td>
                  <td>
                    <span class="badge" [class.badge-success]="order.payment_status === 'paid'" [class.badge-warning]="order.payment_status !== 'paid'">
                      {{ order.payment_status === 'paid' ? 'Payé' : 'En attente' }}
                    </span>
                  </td>
                  <td>{{ order.delivery_type === 'delivery' ? '🚗' : '🏪' }}</td>
                  <td><strong>{{ order.total_amount | number }} FCFA</strong></td>
                  <td>{{ formatDate(order.created_at) }}</td>
                  <td>
                    <a [routerLink]="['/admin/orders', order.id]" class="btn btn-ghost btn-sm">Détails</a>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div><h3>Aucune commande</h3></div></td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .filters-bar { display: flex; gap: 12px; margin-bottom: 20px; }
    .search-input { flex: 1; padding: 10px 14px; border: 1.5px solid var(--neutral-200); border-radius: var(--radius-md); font-size: 0.9rem; &:focus { border-color: var(--primary-500); outline: none; } }
    .filter-select { padding: 10px 14px; border: 1.5px solid var(--neutral-200); border-radius: var(--radius-md); font-size: 0.9rem; background: white; color: var(--neutral-700); cursor: pointer; }
    .status-select { padding: 4px 8px; border: 1px solid var(--neutral-200); border-radius: var(--radius-sm); font-size: 0.8rem; background: white; cursor: pointer; }
  `]
})
export class AdminOrdersComponent implements OnInit {
  orders = signal<Order[]>([]);
  loading = signal(true);
  search = '';
  statusFilter = '';

  constructor(private orderService: OrderService) {}

  async ngOnInit() {
    try {
      this.orders.set(await this.orderService.getAllOrders());
    } finally {
      this.loading.set(false);
    }
  }

  filteredOrders(): Order[] {
    return this.orders().filter(o => {
      const matchSearch = !this.search ||
        o.order_number.toLowerCase().includes(this.search.toLowerCase()) ||
        (o as any)['profile']?.full_name?.toLowerCase().includes(this.search.toLowerCase());
      const matchStatus = !this.statusFilter || o.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  async updateStatus(order: Order, newStatus: string) {
    await this.orderService.updateOrderStatus(order.id, newStatus);
    this.orders.update(orders => orders.map(o => o.id === order.id ? { ...o, status: newStatus as any } : o));
  }

  exportCSV() {
    const rows = [
      ['Numéro', 'Client', 'Statut', 'Montant', 'Date'].join(','),
      ...this.filteredOrders().map(o => [
        o.order_number,
        (o as any)['profile']?.full_name ?? 'N/A',
        o.status,
        o.total_amount,
        new Date(o.created_at).toLocaleDateString('fr-FR')
      ].join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commandes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
