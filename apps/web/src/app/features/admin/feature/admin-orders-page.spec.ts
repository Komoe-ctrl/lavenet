import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AdminOrdersService } from '../data-access/admin-orders.service';
import { SessionStore } from '../../../core/auth/session.store';
import { AdminOrderListResponseDtoOutput } from '../../../core/api-client/models/admin-order-list-response-dto-output';
import { AdminOrdersPage } from './admin-orders-page';

const ORDER_PENDING = {
  id: 'ord_1',
  reference: 'LN-2026-000001',
  status: 'PENDING_PICKUP' as const,
  totalXof: 3400,
  itemsCount: 2,
  createdAt: '2026-08-08T10:00:00.000Z',
  clientName: 'Aya Kouassi',
  clientPhone: '+2250700000001',
};

const ORDER_DELIVERED = {
  id: 'ord_2',
  reference: 'LN-2026-000002',
  status: 'DELIVERED' as const,
  totalXof: 5000,
  itemsCount: 1,
  createdAt: '2026-08-01T10:00:00.000Z',
  clientName: null,
  clientPhone: '+2250700000002',
};

function emptyPage(page = 1): AdminOrderListResponseDtoOutput {
  return { orders: [], total: 0, page, pageSize: 20 };
}

type FakeAdminOrdersService = {
  list: (filters: unknown) => Promise<AdminOrderListResponseDtoOutput>;
};

// SiteHeader (rendered by AdminOrdersPage) reads isAuthenticated()/user().
function configureWith(service: Partial<FakeAdminOrdersService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: AdminOrdersService,
        useValue: { list: vi.fn().mockResolvedValue(emptyPage()), ...service },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('AdminOrdersPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ list: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Chargement des commandes');
  });

  it('shows an empty state when no order matches', async () => {
    configureWith({ list: () => Promise.resolve(emptyPage()) });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucune commande ne correspond');
  });

  it('shows an error state when the list fails to load', async () => {
    configureWith({ list: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger les commandes');
  });

  it('lists orders with client identity, French status label and total', async () => {
    configureWith({
      list: () =>
        Promise.resolve({
          orders: [ORDER_PENDING, ORDER_DELIVERED],
          total: 2,
          page: 1,
          pageSize: 20,
        }),
    });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LN-2026-000001');
    expect(text).toContain('Aya Kouassi');
    expect(text).toContain("En attente d'enlèvement");
    expect(text).toContain('LN-2026-000002');
    // clientName null falls back to the phone number.
    expect(text).toContain('+2250700000002');
    expect(text).toContain('Livré');
  });

  it('reloads with the selected status filter, resetting to page 1', async () => {
    const list = vi.fn().mockResolvedValue(emptyPage());
    configureWith({ list });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: null, page: 1 }));

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-chip'),
    ) as HTMLButtonElement[];
    const deliveredChip = chips.find((btn) => btn.textContent?.trim() === 'Livré');
    deliveredChip?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'DELIVERED', page: 1 }));
  });

  it('reloads with the searched reference on submit', async () => {
    const list = vi.fn().mockResolvedValue(emptyPage());
    configureWith({ list });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#reference-search-input');
    input.value = 'LN-2026-000001';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('.reference-search');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ reference: 'LN-2026-000001' }));
  });

  it('paginates via the next/previous buttons', async () => {
    const list = vi.fn().mockResolvedValue({
      orders: [ORDER_PENDING],
      total: 30,
      page: 1,
      pageSize: 20,
    });
    configureWith({ list });
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Page 1 / 2');

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.pagination button'),
    ) as HTMLButtonElement[];
    const next = buttons.find((btn) => btn.textContent?.includes('Suivant'));
    next?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});
