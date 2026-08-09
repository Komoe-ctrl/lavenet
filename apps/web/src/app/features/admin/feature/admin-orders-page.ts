import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ORDER_STATUS_LABELS_FR, type OrderStatus } from '@lavenet/shared-domain';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { AdminOrdersService, type AdminOrderStatus } from '../data-access/admin-orders.service';

// F-ADM-02. Same fixed, sensible order as the client's own orders-page
// filter chips.
const FILTER_STATUSES: AdminOrderStatus[] = [
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
  selector: 'app-admin-orders-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe, DatePipe],
  templateUrl: './admin-orders-page.html',
  styleUrl: './admin-orders-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrdersPage {
  private readonly adminOrdersService = inject(AdminOrdersService);

  protected readonly statusLabels = ORDER_STATUS_LABELS_FR;
  protected readonly filterStatuses = FILTER_STATUSES;

  protected readonly statusFilter = signal<AdminOrderStatus | null>(null);
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  protected readonly referenceInput = signal('');
  protected readonly appliedReference = signal<string | null>(null);
  protected readonly page = signal(1);

  protected readonly result = resource({
    params: () => ({
      status: this.statusFilter(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      reference: this.appliedReference(),
      page: this.page(),
    }),
    loader: ({ params }) => this.adminOrdersService.list(params),
  });

  protected readonly totalPages = () => {
    const data = this.result.value();
    return data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  };

  protected setFilter(status: AdminOrderStatus | null): void {
    this.statusFilter.set(status);
    this.page.set(1);
  }

  protected setDateFrom(value: string): void {
    this.dateFrom.set(value || null);
    this.page.set(1);
  }

  protected setDateTo(value: string): void {
    this.dateTo.set(value || null);
    this.page.set(1);
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.appliedReference.set(this.referenceInput().trim() || null);
    this.page.set(1);
  }

  protected goToPage(page: number): void {
    this.page.set(page);
  }

  protected labelFor(status: AdminOrderStatus): string {
    return this.statusLabels[status as OrderStatus];
  }
}
