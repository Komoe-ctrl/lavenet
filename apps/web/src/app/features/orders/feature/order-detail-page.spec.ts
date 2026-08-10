import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from '../data-access/orders.service';
import { SessionStore } from '../../../core/auth/session.store';
import { OrderDetailResponseDtoOutput } from '../../../core/api-client/models/order-detail-response-dto-output';
import { OrderDetailPage } from './order-detail-page';

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
  statusHistory: [
    {
      fromStatus: 'DRAFT' as const,
      toStatus: 'PENDING_PICKUP' as const,
      reason: null,
      createdAt: '2026-08-08T10:00:00.000Z',
    },
    {
      fromStatus: 'PENDING_PICKUP' as const,
      toStatus: 'PICKED_UP' as const,
      reason: null,
      createdAt: '2026-08-09T08:00:00.000Z',
    },
  ],
};

type FakeOrdersService = { detail: (id: string) => Promise<OrderDetailResponseDtoOutput> };

// SiteHeader (rendered by OrderDetailPage) reads isAuthenticated()/user()
// -- a user viewing an order's detail is always logged in already.
function configureWith(service: Partial<FakeOrdersService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 'ord_1' })) },
      },
      {
        provide: OrdersService,
        useValue: { detail: vi.fn().mockResolvedValue({ order: BASE_ORDER }), ...service },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('OrderDetailPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ detail: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Chargement de la commande');
  });

  it('shows an error state when the order fails to load', async () => {
    configureWith({ detail: () => Promise.reject(new Error('not found')) });
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Commande introuvable');
  });

  it('renders the reference, items, totals and the progression frise', async () => {
    configureWith({});
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LN-2026-000142');
    expect(text).toContain('Lavage au kilo');
    expect(text).toContain('Cocody');
    // Every happy-path step's French label appears in the frise.
    expect(text).toContain("En attente d'enlèvement");
    expect(text).toContain('Récupéré');
    expect(text).toContain('En traitement');
    expect(text).toContain('Prêt');
    expect(text).toContain('En livraison');
    expect(text).toContain('Livré');
    // History rows.
    expect(text).toContain('Historique');
  });

  it('marks the current step, the ones before it as past, and none after', async () => {
    configureWith({});
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const steps = fixture.nativeElement.querySelectorAll('.progress-frise__step');
    // PROCESSING is index 2 (PENDING_PICKUP, PICKED_UP, PROCESSING, ...).
    // --past and --current are mutually exclusive: the frise lights the
    // connector *into* the current node but not the one out of it.
    expect(steps[2].classList.contains('progress-frise__step--current')).toBe(true);
    expect(steps[2].classList.contains('progress-frise__step--past')).toBe(false);
    expect(steps[0].classList.contains('progress-frise__step--past')).toBe(true);
    expect(steps[5].classList.contains('progress-frise__step--past')).toBe(false);
    expect(steps[5].classList.contains('progress-frise__step--current')).toBe(false);
  });

  it('dates each reached step from the real transition history', async () => {
    configureWith({});
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const steps = fixture.nativeElement.querySelectorAll('.progress-frise__step');
    // BASE_ORDER's history has rows for PENDING_PICKUP and PICKED_UP only.
    expect(steps[0].querySelector('.progress-frise__at')?.textContent).toContain('08/08');
    expect(steps[1].querySelector('.progress-frise__at')?.textContent).toContain('09/08');
    // PROCESSING is the current status but has no history row in the
    // fixture -- no date is invented for it.
    expect(steps[2].querySelector('.progress-frise__at')).toBeNull();
  });

  it('shows a banner instead of the frise for a cancelled order', async () => {
    configureWith({
      detail: () =>
        Promise.resolve({
          order: { ...BASE_ORDER, status: 'CANCELLED' as const },
        }),
    });
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.progress-frise')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Annulé');
  });
});
