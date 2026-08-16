import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ORDER_STATUS_LABELS_FR } from '@lavenet/shared-domain';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { AdminDashboardService } from '../data-access/admin-dashboard.service';
import type { AdminDashboardResponseDtoOutput } from '../../../core/api-client/models/admin-dashboard-response-dto-output';

// The dashboard's own response shape excludes DRAFT (a cart, never a
// placed order) at the type level, unlike OrderStatus -- using it here
// means the DRAFT case can't compile back in by accident.
type DashboardOrderStatus = AdminDashboardResponseDtoOutput['statusCounts'][number]['status'];

// F-ADM-02's fixed status order, minus DRAFT -- kept in sync by hand
// rather than imported, since the two pages read the list for different
// reasons (a filter chip row vs. a fixed bar order).
const STATUS_ORDER: DashboardOrderStatus[] = [
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'ON_HOLD',
  'CANCELLED',
];

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const MS_PER_DAY = 86_400_000;

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe],
  templateUrl: './admin-dashboard-page.html',
  styleUrl: './admin-dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  private readonly adminDashboardService = inject(AdminDashboardService);

  protected readonly statusLabels = ORDER_STATUS_LABELS_FR;
  protected readonly statusOrder = STATUS_ORDER;

  protected readonly result = resource({
    loader: () => this.adminDashboardService.get(),
  });

  // Every status bar renders even at zero -- a vitrine screen shouldn't
  // reshuffle its own layout depending on which statuses happen to have an
  // order right now.
  protected readonly statusBars = computed(() => {
    const data = this.result.value();
    if (!data) return [];
    const counts = new Map(data.statusCounts.map((row) => [row.status, row.count]));
    const max = Math.max(1, ...data.statusCounts.map((row) => row.count));
    return STATUS_ORDER.map((status) => {
      const count = counts.get(status) ?? 0;
      return { status, count, percent: Math.round((count / max) * 100) };
    });
  });

  protected readonly isEmpty = computed(() => {
    const data = this.result.value();
    if (!data) return false;
    return (
      data.revenue.last30DaysXof === 0 &&
      data.statusCounts.every((row) => row.count === 0) &&
      data.topServices.length === 0
    );
  });

  // Hand-rolled sparkline: no charting dependency for a single 60-point
  // line (CLAUDE.md §2 -- justify every addition, and this one doesn't
  // clear the bar). Scaled into a fixed viewBox; a flat series (or a
  // single point) still renders as a flat line rather than dividing by
  // zero.
  protected readonly chartViewBox = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;

  protected readonly chartPoints = computed(() => {
    const daily = this.result.value()?.dailyRevenue ?? [];
    if (daily.length === 0) return '';
    const max = Math.max(1, ...daily.map((d) => d.revenueXof));
    const stepX = daily.length > 1 ? CHART_WIDTH / (daily.length - 1) : 0;
    return daily
      .map((point, index) => {
        const x = index * stepX;
        const y = CHART_HEIGHT - (point.revenueXof / max) * (CHART_HEIGHT - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  protected readonly chartAreaPath = computed(() => {
    const points = this.chartPoints();
    if (!points) return '';
    return `M0,${CHART_HEIGHT} L${points} L${CHART_WIDTH},${CHART_HEIGHT} Z`;
  });

  protected readonly exportFrom = signal(isoDateDaysAgo(30));
  protected readonly exportTo = signal(isoDateDaysAgo(0));
  protected readonly exportError = signal<string | null>(null);
  protected readonly exportingOrders = signal(false);
  protected readonly exportingPayments = signal(false);

  protected setExportFrom(value: string): void {
    this.exportFrom.set(value);
  }

  protected setExportTo(value: string): void {
    this.exportTo.set(value);
  }

  protected async exportOrders(): Promise<void> {
    await this.runExport(this.exportingOrders, (from, to) =>
      this.adminDashboardService.downloadOrdersCsv(from, to),
    'commandes');
  }

  protected async exportPayments(): Promise<void> {
    await this.runExport(this.exportingPayments, (from, to) =>
      this.adminDashboardService.downloadPaymentsCsv(from, to),
    'paiements');
  }

  private async runExport(
    loading: ReturnType<typeof signal<boolean>>,
    download: (from: string, to: string) => Promise<Blob>,
    filePrefix: string,
  ): Promise<void> {
    const from = this.exportFrom();
    const to = this.exportTo();
    this.exportError.set(null);
    loading.set(true);
    try {
      const blob = await download(from, to);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filePrefix}-${from}-${to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.exportError.set("Impossible de générer l'export. Vérifiez la période et réessayez.");
    } finally {
      loading.set(false);
    }
  }

  protected labelFor(status: DashboardOrderStatus): string {
    return this.statusLabels[status];
  }
}
