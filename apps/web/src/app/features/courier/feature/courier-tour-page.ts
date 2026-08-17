import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { SlotsService } from '../../cart/data-access/slots.service';
import { CourierService } from '../data-access/courier.service';

type ActionMode = 'confirm' | 'absent';

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  return typeof message === 'string' ? message : fallback;
}

// Abidjan is UTC+0 with no DST -- formatting in UTC is formatting in local
// time. Same formatters as cart-page.ts's slot picker (duplicated once,
// not yet worth extracting -- see _states.scss's own comment on why a
// third occurrence is the line).
const SLOT_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const SLOT_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

function formatSlotLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${SLOT_LABEL_FORMAT.format(start)}, ${SLOT_TIME_FORMAT.format(start)} - ${SLOT_TIME_FORMAT.format(end)}`;
}

// F-LIV-03/04/05. Mobile-first, not mobile-friendly-as-an-afterthought:
// 375px is the actual, primary use case here (a courier holding a phone at
// a client's door), unlike the back-office screens this app otherwise
// builds desktop-first with a phone fallback.
@Component({
  selector: 'app-courier-tour-page',
  imports: [SiteHeader, SiteFooter, MoneyPipe],
  templateUrl: './courier-tour-page.html',
  styleUrl: './courier-tour-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourierTourPage {
  private readonly courierService = inject(CourierService);
  private readonly slotsService = inject(SlotsService);

  protected readonly formatSlotLabel = formatSlotLabel;

  protected readonly refreshTick = signal(0);

  protected readonly tour = resource({
    params: () => ({ tick: this.refreshTick() }),
    loader: () => this.courierService.tour(),
  });

  // Only fetched lazily, the first time a courier actually opens the
  // "client absent" panel -- most stops end in a normal confirm, no need
  // to load the slot list on every page visit.
  protected readonly slotsRequested = signal(false);
  protected readonly slots = resource({
    params: () => (this.slotsRequested() ? {} : undefined),
    loader: () => this.slotsService.listSlots(),
  });

  protected readonly availableSlots = computed(() => {
    const slots = this.slots.value()?.slots ?? [];
    return slots.filter((slot) => slot.seatsAvailable > 0);
  });

  protected readonly active = signal<{ orderId: string; mode: ActionMode } | null>(null);
  protected readonly otpCode = signal('');
  protected readonly absentReason = signal('');
  protected readonly newSlotId = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected openConfirm(orderId: string): void {
    this.active.set({ orderId, mode: 'confirm' });
    this.otpCode.set('');
    this.actionError.set(null);
  }

  protected openAbsent(orderId: string): void {
    this.active.set({ orderId, mode: 'absent' });
    this.absentReason.set('');
    this.newSlotId.set('');
    this.actionError.set(null);
    this.slotsRequested.set(true);
  }

  protected closeAction(): void {
    this.active.set(null);
    this.actionError.set(null);
  }

  protected async submitConfirm(): Promise<void> {
    const current = this.active();
    if (!current || this.otpCode().trim().length !== 6) {
      return;
    }
    this.isSubmitting.set(true);
    this.actionError.set(null);
    try {
      await this.courierService.confirm(current.orderId, this.otpCode().trim());
      this.active.set(null);
      this.refreshTick.update((n) => n + 1);
    } catch (err) {
      this.actionError.set(errorMessage(err, 'Code invalide -- réessayez.'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async submitAbsent(): Promise<void> {
    const current = this.active();
    if (!current || this.absentReason().trim().length === 0 || !this.newSlotId()) {
      return;
    }
    this.isSubmitting.set(true);
    this.actionError.set(null);
    try {
      await this.courierService.markAbsent(
        current.orderId,
        this.absentReason().trim(),
        this.newSlotId(),
      );
      this.active.set(null);
      this.refreshTick.update((n) => n + 1);
    } catch (err) {
      this.actionError.set(errorMessage(err, 'La replanification a échoué -- réessayez.'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected telHref(phone: string): string {
    return `tel:${phone.replace(/\s+/g, '')}`;
  }
}
