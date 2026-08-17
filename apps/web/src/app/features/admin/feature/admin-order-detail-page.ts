import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import {
  canTransition,
  ORDER_STATUS_LABELS_FR,
  requiresReason,
  type OrderStatus,
} from '@lavenet/shared-domain';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { AdminOrdersService } from '../data-access/admin-orders.service';
import { AdminUpdateOrderStatusDto } from '../../../core/api-client/models/admin-update-order-status-dto';

// F-ADM-02/F-STA-01. The set of statuses a manager might transition into is
// never hardcoded here -- ALL_STATUSES is just the state machine's own
// label table read back as a list, and canTransition() (imported straight
// from the shared domain lib, the same source of truth the API enforces)
// is what actually decides which of those become a visible button.
const ALL_STATUSES = Object.keys(ORDER_STATUS_LABELS_FR) as OrderStatus[];

@Component({
  selector: 'app-admin-order-detail-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe, DatePipe],
  templateUrl: './admin-order-detail-page.html',
  styleUrl: './admin-order-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderDetailPage {
  private readonly adminOrdersService = inject(AdminOrdersService);
  private readonly route = inject(ActivatedRoute);

  private readonly orderId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { requireSync: true },
  );

  protected readonly statusLabels = ORDER_STATUS_LABELS_FR;

  protected readonly refreshTick = signal(0);

  protected readonly order = resource({
    params: () => ({ id: this.orderId(), tick: this.refreshTick() }),
    loader: ({ params }) => this.adminOrdersService.detail(params.id).then((r) => r.order),
  });

  // The status a click is pending confirmation for -- null once idle.
  // ON_HOLD stays pending until a non-blank reason is entered, DELIVERED
  // until a 6-digit OTP is entered (F-LIV-04: the transition requires one
  // regardless of who triggers it, staff included); every other target
  // applies immediately on click.
  protected readonly pendingTarget = signal<OrderStatus | null>(null);
  protected readonly reason = signal('');
  protected readonly otpCode = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  // F-LIV-04. Only ever populated in DEMO_MODE, by the one response that
  // can carry it (the READY -> OUT_FOR_DELIVERY transition itself) --
  // OtpService only ever stores a hash, so this is the one moment the raw
  // code exists anywhere to show. Nowhere else (a page reload, the client's
  // own order view) can ever recover it after the fact.
  protected readonly deliveryDemoOtpCode = signal<string | null>(null);

  protected readonly availableTransitions = computed<OrderStatus[]>(() => {
    if (!this.order.hasValue()) {
      return [];
    }
    const current = this.order.value().status as OrderStatus;
    return ALL_STATUSES.filter((candidate) => canTransition(current, candidate));
  });

  protected isInterrupted(status: string): boolean {
    return status === 'CANCELLED' || status === 'ON_HOLD';
  }

  protected requiresReason(status: OrderStatus): boolean {
    return requiresReason(status);
  }

  // F-LIV-04. Not part of the shared state-machine domain (order-state-
  // machine.ts) -- unlike requiresReason, this is an API implementation
  // detail (OtpService), not a rule about which transitions are legal.
  protected requiresOtp(status: OrderStatus): boolean {
    return status === 'DELIVERED';
  }

  protected selectTransition(target: OrderStatus): void {
    this.actionError.set(null);
    if (requiresReason(target) || this.requiresOtp(target)) {
      this.pendingTarget.set(target);
      this.reason.set('');
      this.otpCode.set('');
      return;
    }
    void this.applyTransition(target);
  }

  protected cancelPending(): void {
    this.pendingTarget.set(null);
    this.reason.set('');
    this.otpCode.set('');
  }

  protected confirmPending(): void {
    const target = this.pendingTarget();
    if (!target) {
      return;
    }
    if (this.requiresOtp(target)) {
      if (this.otpCode().trim().length !== 6) {
        return;
      }
      void this.applyTransition(target, undefined, this.otpCode().trim());
      return;
    }
    if (this.reason().trim().length === 0) {
      return;
    }
    void this.applyTransition(target, this.reason().trim());
  }

  private async applyTransition(
    target: OrderStatus,
    reason?: string,
    otpCode?: string,
  ): Promise<void> {
    this.isSubmitting.set(true);
    this.actionError.set(null);
    try {
      const result = await this.adminOrdersService.updateStatus(this.orderId(), {
        // target is never 'DRAFT' at runtime -- canTransition()'s own
        // TRANSITIONS map never lists it as a target of anything, which is
        // exactly why the API's toStatus type excludes it too.
        toStatus: target as AdminUpdateOrderStatusDto['toStatus'],
        reason,
        otpCode,
      });
      this.deliveryDemoOtpCode.set(result.demoOtpCode ?? null);
      this.pendingTarget.set(null);
      this.reason.set('');
      this.otpCode.set('');
      this.refreshTick.update((n) => n + 1);
    } catch (err) {
      this.actionError.set(this.requiresOtp(target) ? this.deliveryErrorMessage(err) : 'Le changement de statut a échoué -- réessayez.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private deliveryErrorMessage(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' ? message : 'Le changement de statut a échoué -- réessayez.';
  }

  // F-LIV-02. Fetched lazily: most visits to this page never touch
  // assignment, no need to load every courier account up front.
  protected readonly couriersRequested = signal(false);
  protected readonly couriers = resource({
    params: () => (this.couriersRequested() ? {} : undefined),
    loader: () => this.adminOrdersService.listCouriers().then((r) => r.couriers),
  });
  protected readonly selectedCourierId = signal('');
  protected readonly isAssigningCourier = signal(false);
  protected readonly courierError = signal<string | null>(null);

  protected openCourierPicker(): void {
    this.couriersRequested.set(true);
    this.courierError.set(null);
  }

  protected async assignCourier(): Promise<void> {
    const courierId = this.selectedCourierId();
    if (!courierId) {
      return;
    }
    this.isAssigningCourier.set(true);
    this.courierError.set(null);
    try {
      await this.adminOrdersService.assignCourier(this.orderId(), courierId);
      this.refreshTick.update((n) => n + 1);
    } catch {
      this.courierError.set("L'affectation a échoué -- réessayez.");
    } finally {
      this.isAssigningCourier.set(false);
    }
  }
}
