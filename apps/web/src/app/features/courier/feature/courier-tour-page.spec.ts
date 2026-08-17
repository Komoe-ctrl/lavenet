import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CourierService } from '../data-access/courier.service';
import { SlotsService } from '../../cart/data-access/slots.service';
import { SessionStore } from '../../../core/auth/session.store';
import { CourierTourResponseDtoOutput } from '../../../core/api-client/models/courier-tour-response-dto-output';
import { SlotsResponseDtoOutput } from '../../../core/api-client/models/slots-response-dto-output';
import { CourierTourPage } from './courier-tour-page';

const DELIVERY_CASH = {
  id: 'ord_1',
  reference: 'LN-2026-000010',
  clientName: 'Aya Kouassi',
  clientPhone: '+2250700000001',
  deliveryCommune: 'Cocody',
  deliveryQuartier: 'Angré',
  deliveryDetails: 'Portail bleu',
  deliverySlotStartsAt: '2026-08-20T08:00:00.000Z',
  deliverySlotEndsAt: '2026-08-20T09:00:00.000Z',
  amountDueXof: 3400,
};

function emptyTour(): CourierTourResponseDtoOutput {
  return { deliveries: [] };
}

function oneSlot(): SlotsResponseDtoOutput {
  return {
    slots: [
      {
        id: 'slot_new',
        date: '2026-08-21',
        startsAt: '2026-08-21T14:00:00.000Z',
        endsAt: '2026-08-21T15:00:00.000Z',
        capacity: 5,
        seatsAvailable: 3,
      },
    ],
  };
}

type FakeCourierService = {
  tour: () => Promise<CourierTourResponseDtoOutput>;
  confirm: (orderId: string, otpCode: string) => Promise<{ orderId: string; status: string }>;
  markAbsent: (
    orderId: string,
    reason: string,
    newDeliverySlotId: string,
  ) => Promise<{ orderId: string; status: string }>;
};

function configureWith(
  courier: Partial<FakeCourierService>,
  slots: Partial<{ listSlots: () => Promise<SlotsResponseDtoOutput> }> = {},
) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: CourierService,
        useValue: {
          tour: vi.fn().mockResolvedValue(emptyTour()),
          confirm: vi.fn(),
          markAbsent: vi.fn(),
          ...courier,
        },
      },
      {
        provide: SlotsService,
        useValue: { listSlots: vi.fn().mockResolvedValue(oneSlot()), ...slots },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('CourierTourPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ tour: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Chargement de la tournée');
  });

  it('shows an error state when the tour fails to load', async () => {
    configureWith({ tour: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger la tournée');
  });

  it('shows an empty state when there is no delivery', async () => {
    configureWith({ tour: () => Promise.resolve(emptyTour()) });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucune livraison en attente');
  });

  it('lists a delivery with a tel: link and the amount to collect', async () => {
    configureWith({ tour: () => Promise.resolve({ deliveries: [DELIVERY_CASH] }) });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LN-2026-000010');
    expect(text).toContain('Aya Kouassi');
    expect(text).toContain('Angré');

    const phoneLink: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '.delivery-card__phone',
    );
    expect(phoneLink.getAttribute('href')).toBe('tel:+2250700000001');
  });

  it('shows "déjà payé" instead of an amount when amountDueXof is null', async () => {
    configureWith({
      tour: () => Promise.resolve({ deliveries: [{ ...DELIVERY_CASH, amountDueXof: null }] }),
    });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Déjà payé en ligne');
  });

  it('confirms delivery with a 6-digit OTP and refreshes the tour', async () => {
    const confirm = vi.fn().mockResolvedValue({ orderId: 'ord_1', status: 'DELIVERED' });
    const tour = vi
      .fn()
      .mockResolvedValueOnce({ deliveries: [DELIVERY_CASH] })
      .mockResolvedValueOnce(emptyTour());
    configureWith({ tour, confirm });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const deliverButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.delivery-card__deliver',
    );
    deliverButton.click();
    fixture.detectChanges();

    const confirmButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.action-panel__confirm');
    expect(confirmButton.disabled).toBe(true);

    const otpInput: HTMLInputElement = fixture.nativeElement.querySelector('#otp-ord_1');
    otpInput.value = '123456';
    otpInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmButton.disabled).toBe(false);

    confirmButton.click();
    await fixture.whenStable();
    // submitConfirm() is a bare async call, not itself a resource() the
    // zoneless fixture's whenStable() tracks -- one more microtask flush
    // plus a render pass covers the gap before asserting post-resolution
    // state.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalledWith('ord_1', '123456');
    expect(tour).toHaveBeenCalledTimes(2);
  });

  it('marks client absent with a reason and a newly picked slot', async () => {
    const markAbsent = vi.fn().mockResolvedValue({ orderId: 'ord_1', status: 'OUT_FOR_DELIVERY' });
    configureWith({ tour: () => Promise.resolve({ deliveries: [DELIVERY_CASH] }), markAbsent });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const absentButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.delivery-card__absent',
    );
    absentButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const reasonInput: HTMLTextAreaElement = fixture.nativeElement.querySelector('#reason-ord_1');
    reasonInput.value = 'Client injoignable';
    reasonInput.dispatchEvent(new Event('input'));

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#slot-ord_1');
    select.value = 'slot_new';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirmButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.action-panel__confirm');
    expect(confirmButton.disabled).toBe(false);
    confirmButton.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(markAbsent).toHaveBeenCalledWith('ord_1', 'Client injoignable', 'slot_new');
  });

  it('shows an inline error when confirm fails, keeping the panel open', async () => {
    const confirm = vi.fn().mockRejectedValue(new Error('boom'));
    configureWith({ tour: () => Promise.resolve({ deliveries: [DELIVERY_CASH] }), confirm });
    const fixture = TestBed.createComponent(CourierTourPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const deliverButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.delivery-card__deliver',
    );
    deliverButton.click();
    fixture.detectChanges();

    const otpInput: HTMLInputElement = fixture.nativeElement.querySelector('#otp-ord_1');
    otpInput.value = '000000';
    otpInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const confirmButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.action-panel__confirm');
    confirmButton.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Code invalide');
    expect(fixture.nativeElement.querySelector('.action-panel')).not.toBeNull();
  });
});
