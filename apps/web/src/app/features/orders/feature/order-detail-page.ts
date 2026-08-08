import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import {
  ORDER_PROGRESS_STEPS,
  ORDER_STATUS_LABELS_FR,
  orderProgressStepIndex,
  type OrderStatus,
} from '@lavenet/shared-domain';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { OrdersService } from '../data-access/orders.service';

// F-STA-03. Detail + French progression frise. CANCELLED/ON_HOLD show a
// banner instead of the frise -- they're an interruption of the happy
// path, not a position within it (order-state-machine.ts's
// ORDER_PROGRESS_STEPS comment).
@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe, DatePipe],
  templateUrl: './order-detail-page.html',
  styleUrl: './order-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailPage {
  private readonly ordersService = inject(OrdersService);
  private readonly route = inject(ActivatedRoute);

  private readonly orderId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { requireSync: true },
  );

  protected readonly statusLabels = ORDER_STATUS_LABELS_FR;
  protected readonly progressSteps = ORDER_PROGRESS_STEPS;

  protected readonly order = resource({
    params: () => this.orderId(),
    loader: ({ params }) => this.ordersService.detail(params).then((r) => r.order),
  });

  protected readonly currentStepIndex = computed(() => {
    if (!this.order.hasValue()) {
      return -1;
    }
    return orderProgressStepIndex(this.order.value().status as OrderStatus);
  });

  protected isInterrupted(status: string): boolean {
    return status === 'CANCELLED' || status === 'ON_HOLD';
  }
}
