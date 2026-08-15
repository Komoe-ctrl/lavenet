import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
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
import { InvoicesService } from '../data-access/invoices.service';
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
  private readonly invoicesService = inject(InvoicesService);
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

  protected readonly downloadingInvoice = signal(false);
  protected readonly invoiceError = signal<string | null>(null);

  // F-PAY-05. Fetched as a Blob (InvoicesService, not the generated client
  // -- see its own comment on why) and handed to the browser via a
  // throwaway object URL: the only way to trigger a save dialog for
  // content already in memory, no server-rendered download link involved.
  protected async downloadInvoice(invoiceId: string, invoiceNumber: string): Promise<void> {
    this.downloadingInvoice.set(true);
    this.invoiceError.set(null);
    try {
      const blob = await this.invoicesService.downloadPdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.invoiceError.set('Impossible de télécharger la facture. Réessayez.');
    } finally {
      this.downloadingInvoice.set(false);
    }
  }
}
