import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminOrdersService } from '../data-access/admin-orders.service';
import { SessionStore } from '../../../core/auth/session.store';
import { AdminOrderDetailResponseDtoOutput } from '../../../core/api-client/models/admin-order-detail-response-dto-output';
import { AdminOrderDetailPage } from './admin-order-detail-page';

const BASE_ORDER = {
  id: 'ord_1',
  reference: 'LN-2026-000142',
  status: 'PROCESSING' as const,
  items: [
    {
      id: 'item_1',
      serviceId: 'svc_1',
      serviceName: 'Lavage au kilo',
      unit: 'KG' as const,
      articleTypeId: null,
      articleTypeName: null,
      quantity: 2,
      instructions: null,
      unitPriceXof: 1200,
      lineTotalXof: 2400,
    },
  ],
  subtotalXof: 2400,
  discountXof: 0,
  deliveryFeeXof: 1000,
  vatRateBps: 0,
  vatAmountXof: 0,
  totalXof: 3400,
  pickupType: 'HOME' as const,
  agencyId: null,
  agencyDropoffDate: null,
  pickupSlotId: 'slot_1',
  deliverySlotId: 'slot_2',
  deliveryCommune: 'Cocody',
  deliveryQuartier: 'Angré',
  deliveryDetails: 'Portail bleu',
  deliveryGeoLat: null,
  deliveryGeoLng: null,
  createdAt: '2026-08-08T10:00:00.000Z',
  clientName: 'Aya Kouassi',
  clientPhone: '+2250700000001',
  clientEmail: 'aya@example.com',
  statusHistory: [
    {
      fromStatus: 'DRAFT' as const,
      toStatus: 'PENDING_PICKUP' as const,
      reason: null,
      createdAt: '2026-08-08T10:00:00.000Z',
    },
  ],
};

type FakeAdminOrdersService = {
  detail: (id: string) => Promise<AdminOrderDetailResponseDtoOutput>;
  updateStatus: (id: string, body: unknown) => Promise<AdminOrderDetailResponseDtoOutput>;
};

function configureWith(service: Partial<FakeAdminOrdersService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 'ord_1' })) },
      },
      {
        provide: AdminOrdersService,
        useValue: {
          detail: vi.fn().mockResolvedValue({ order: BASE_ORDER }),
          updateStatus: vi.fn().mockResolvedValue({ order: BASE_ORDER }),
          ...service,
        },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('AdminOrderDetailPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ detail: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chargement de la commande');
  });

  it('shows an error state when the order fails to load', async () => {
    configureWith({ detail: () => Promise.reject(new Error('not found')) });
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Commande introuvable');
  });

  it('renders the reference, client identity, items and history', async () => {
    configureWith({});
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LN-2026-000142');
    expect(text).toContain('Aya Kouassi');
    expect(text).toContain('+2250700000001');
    expect(text).toContain('Lavage au kilo');
    expect(text).toContain('Historique');
  });

  it('only shows transition buttons canTransition allows for the current status', async () => {
    // PROCESSING -> READY | ON_HOLD, nothing else (order-state-machine.ts).
    configureWith({});
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.transition-button__label'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['Prêt', 'Suspendu']);
  });

  it('flags up front which transitions will demand a motif', async () => {
    // PROCESSING -> READY needs none, PROCESSING -> ON_HOLD does
    // (requiresReason in order-state-machine.ts) -- staff should know
    // before clicking, not after the form appears.
    configureWith({});
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.transition-button'),
    ) as HTMLButtonElement[];
    const flagged = buttons
      .filter((btn) => btn.querySelector('.transition-button__flag'))
      .map((btn) => btn.querySelector('.transition-button__label')?.textContent?.trim());
    expect(flagged).toEqual(['Suspendu']);
  });

  it('applies a non-ON_HOLD transition immediately on click', async () => {
    const updateStatus = vi.fn().mockResolvedValue({ order: { ...BASE_ORDER, status: 'READY' } });
    configureWith({ updateStatus });
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.transition-button'),
    ) as HTMLButtonElement[];
    const readyButton = buttons.find((btn) => btn.textContent?.trim() === 'Prêt');
    readyButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateStatus).toHaveBeenCalledWith('ord_1', { toStatus: 'READY', reason: undefined });
  });

  it('requires a non-blank reason before confirming ON_HOLD', async () => {
    const updateStatus = vi.fn().mockResolvedValue({ order: { ...BASE_ORDER, status: 'ON_HOLD' } });
    configureWith({ updateStatus });
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.transition-button'),
    ) as HTMLButtonElement[];
    const holdButton = buttons.find(
      (btn) => btn.querySelector('.transition-button__label')?.textContent?.trim() === 'Suspendu',
    );
    holdButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // No confirmation yet -- the reason form is up, nothing was submitted.
    expect(updateStatus).not.toHaveBeenCalled();
    const confirm: HTMLButtonElement = fixture.nativeElement.querySelector('.reason-form__confirm');
    expect(confirm.disabled).toBe(true);

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#reason-input');
    textarea.value = 'Article manquant';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirm.disabled).toBe(false);

    confirm.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateStatus).toHaveBeenCalledWith('ord_1', {
      toStatus: 'ON_HOLD',
      reason: 'Article manquant',
    });
  });

  it('shows no transition buttons for a terminal status', async () => {
    configureWith({
      detail: () => Promise.resolve({ order: { ...BASE_ORDER, status: 'DELIVERED' as const } }),
    });
    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.transition-button').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Aucune transition possible');
  });
});
