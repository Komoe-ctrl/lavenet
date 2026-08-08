import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ORDER_STATUS_LABELS_FR, type OrderStatus } from '@lavenet/shared-domain';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { type PlacedOrderStatus, OrdersService } from '../data-access/orders.service';

// F-CMD-09. Filter options in a fixed, sensible order (not the enum's
// declaration order) -- the happy path first, ON_HOLD/CANCELLED last.
const FILTER_STATUSES: PlacedOrderStatus[] = [
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'ON_HOLD',
  'CANCELLED',
];

@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe, DatePipe],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  private readonly ordersService = inject(OrdersService);

  protected readonly statusLabels = ORDER_STATUS_LABELS_FR;
  protected readonly filterStatuses = FILTER_STATUSES;

  protected readonly statusFilter = signal<PlacedOrderStatus | null>(null);

  protected readonly orders = resource({
    params: () => this.statusFilter(),
    loader: ({ params }) => this.ordersService.list(params).then((r) => r.orders),
  });

  protected setFilter(status: PlacedOrderStatus | null): void {
    this.statusFilter.set(status);
  }

  protected labelFor(status: PlacedOrderStatus): string {
    return this.statusLabels[status as OrderStatus];
  }
}
