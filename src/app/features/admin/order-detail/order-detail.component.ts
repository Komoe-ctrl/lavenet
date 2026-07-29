import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderStatusHistory } from '../../../core/models';

@Component({
  selector: 'app-admin-order-detail',
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="admin-order-detail animate-fade-in">
      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else if (!order()) {
        <div class="empty-state"><h3>Commande introuvable</h3><a routerLink="/admin/orders" class="btn btn-primary">Retour</a></div>
      } @else {
        <div class="page-header">
          <div>
            <a routerLink="/admin/orders" class="back-link">← Commandes</a>
            <h1>{{ order()!.order_number }}</h1>
            <p>{{ order()!['profile']?.['full_name'] }} — {{ formatDate(order()!.created_at) }}</p>
          </div>
          <div class="header-actions">
            <span class="badge badge-{{ order()!.status }} badge-lg">{{ statusLabels[order()!.status] }}</span>
            <div class="status-actions">
              @for (next of getNextStatuses(order()!.status); track next) {
                <button class="btn btn-primary btn-sm" (click)="changeStatus(next)">
                  {{ statusActions[next] }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <div class="left-col">
            <!-- Customer info -->
            <div class="card">
              <div class="card-header"><h3>👤 Client</h3></div>
              <div class="card-body info-list">
                <div class="info-row"><span>Nom</span><strong>{{ order()!['profile']?.['full_name'] }}</strong></div>
                <div class="info-row"><span>Téléphone</span><span>{{ order()!['profile']?.['phone'] || 'N/A' }}</span></div>
                <div class="info-row"><span>Livraison</span><span>{{ order()!.delivery_type === 'delivery' ? 'Domicile' : 'Agence' }}</span></div>
                @if (order()!.pickup_address) {
                  <div class="info-row"><span>Adresse collecte</span><span>{{ order()!.pickup_address }}</span></div>
                }
                @if (order()!.delivery_address) {
                  <div class="info-row"><span>Adresse livraison</span><span>{{ order()!.delivery_address }}</span></div>
                }
                @if (order()!.notes) {
                  <div class="info-row"><span>Notes</span><span>{{ order()!.notes }}</span></div>
                }
              </div>
            </div>

            <!-- Items -->
            <div class="card">
              <div class="card-header"><h3>👕 Articles</h3></div>
              <div class="card-body">
                @for (item of order()!.items; track item.id) {
                  <div class="item-row">
                    <div>
                      <strong>{{ item.article_name }}</strong>
                      <span class="badge badge-info">{{ item.service?.name }}</span>
                      @if (item.special_instructions) { <p class="text-sm text-muted">{{ item.special_instructions }}</p> }
                    </div>
                    <div class="item-right">
                      <span>× {{ item.quantity }}</span>
                      <strong>{{ (item.unit_price * item.quantity) | number }} FCFA</strong>
                    </div>
                  </div>
                }
                <div class="items-total">
                  <span>Total</span>
                  <strong>{{ order()!.total_amount | number }} FCFA</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="right-col">
            <!-- Status timeline -->
            <div class="card">
              <div class="card-header"><h3>📊 Historique</h3></div>
              <div class="card-body">
                <div class="status-timeline">
                  @for (entry of history(); track entry.id) {
                    <div class="timeline-item active">
                      <div class="dot"></div>
                      <div class="timeline-content">
                        <h4>{{ statusLabels[entry.status] }}</h4>
                        <p>{{ formatDate(entry.created_at) }}</p>
                        @if (entry.note) { <p>{{ entry.note }}</p> }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Payment -->
            <div class="card">
              <div class="card-header"><h3>💳 Paiement</h3></div>
              <div class="card-body info-list">
                <div class="info-row"><span>Méthode</span><span>{{ paymentLabels[order()!.payment_method] }}</span></div>
                <div class="info-row"><span>Statut</span>
                  <span [class.text-success]="order()!.payment_status === 'paid'">
                    {{ order()!.payment_status === 'paid' ? '✅ Payé' : '⏳ En attente' }}
                  </span>
                </div>
                <div class="info-row total"><span>Montant</span><strong>{{ order()!.total_amount | number }} FCFA</strong></div>
              </div>
            </div>

            <!-- OTP code (admin visibility) -->
            <div class="card otp-admin">
              <div class="card-header"><h3>🔐 Code OTP</h3></div>
              <div class="card-body">
                <p class="text-sm text-muted">Code à communiquer au client lors de la livraison:</p>
                <div class="otp-display">{{ order()!.otp_code }}</div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .back-link { font-size: 0.875rem; color: var(--primary-600); display: block; margin-bottom: 8px; &:hover { text-decoration: underline; } }
    .header-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .status-actions { display: flex; gap: 8px; }
    .badge-lg { font-size: 0.875rem; padding: 6px 14px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
    .left-col, .right-col { display: flex; flex-direction: column; gap: 16px; }

    .info-list { display: flex; flex-direction: column; gap: 10px; }
    .info-row { display: flex; justify-content: space-between; gap: 16px; font-size: 0.875rem; span:first-child { color: var(--neutral-500); flex-shrink: 0; } &.total { font-weight: 700; border-top: 1px solid var(--neutral-200); padding-top: 10px; margin-top: 4px; } }
    .text-success { color: var(--secondary-600); font-weight: 600; }

    .item-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--neutral-100); &:last-child { border-bottom: none; } strong { display: block; font-size: 0.9rem; margin-bottom: 4px; } }
    .item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; span { font-size: 0.8rem; color: var(--neutral-500); } }
    .items-total { display: flex; justify-content: space-between; padding-top: 12px; font-size: 1rem; border-top: 2px solid var(--neutral-200); }

    .otp-admin { .otp-display { font-size: 2rem; font-weight: 800; letter-spacing: 0.3em; color: var(--primary-700); background: var(--primary-50); padding: 12px; border-radius: var(--radius-md); text-align: center; margin-top: 8px; font-family: monospace; } }

    @media (max-width: 1024px) { .detail-grid { grid-template-columns: 1fr; } }
  `]
})
export class AdminOrderDetailComponent implements OnInit {
  order = signal<Order | null>(null);
  history = signal<OrderStatusHistory[]>([]);
  loading = signal(true);

  statusLabels: Record<string, string> = {
    pending: 'En attente', confirmed: 'Confirmée', picked_up: 'Collectée',
    processing: 'En traitement', ready: 'Prête', out_for_delivery: 'En livraison',
    delivered: 'Livrée', cancelled: 'Annulée'
  };

  statusActions: Record<string, string> = {
    confirmed: '✓ Confirmer', picked_up: '🚗 Marquer collectée', processing: '🔄 En traitement',
    ready: '✅ Prête', out_for_delivery: '🚚 En livraison', delivered: '🏠 Livrée', cancelled: '✕ Annuler'
  };

  paymentLabels: Record<string, string> = {
    cash: 'Espèces', mobile_money: 'Mobile Money', card: 'Carte bancaire'
  };

  constructor(private route: ActivatedRoute, private orderService: OrderService) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    try {
      const [order, history] = await Promise.all([
        this.orderService.getOrderById(id),
        this.orderService.getOrderHistory(id)
      ]);
      this.order.set(order);
      this.history.set(history);
    } finally {
      this.loading.set(false);
    }
  }

  getNextStatuses(current: string): string[] {
    const flow: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['picked_up', 'cancelled'],
      picked_up: ['processing'],
      processing: ['ready'],
      ready: ['out_for_delivery'],
      out_for_delivery: ['delivered'],
      delivered: [],
      cancelled: []
    };
    return flow[current] ?? [];
  }

  async changeStatus(newStatus: string) {
    const order = this.order();
    if (!order) return;
    await this.orderService.updateOrderStatus(order.id, newStatus);
    this.order.update(o => o ? { ...o, status: newStatus as any } : null);
    const history = await this.orderService.getOrderHistory(order.id);
    this.history.set(history);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
