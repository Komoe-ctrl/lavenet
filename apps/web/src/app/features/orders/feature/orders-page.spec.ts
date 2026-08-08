import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from '../data-access/orders.service';
import { SessionStore } from '../../../core/auth/session.store';
import { OrderListResponseDtoOutput } from '../../../core/api-client/models/order-list-response-dto-output';
import { OrdersPage } from './orders-page';

const ORDER_PENDING = {
  id: 'ord_1',
  reference: 'LN-2026-000001',
  status: 'PENDING_PICKUP' as const,
  totalXof: 3400,
  itemsCount: 2,
  createdAt: '2026-08-08T10:00:00.000Z',
};

const ORDER_DELIVERED = {
  id: 'ord_2',
  reference: 'LN-2026-000002',
  status: 'DELIVERED' as const,
  totalXof: 5000,
  itemsCount: 1,
  createdAt: '2026-08-01T10:00:00.000Z',
};

type FakeOrdersService = {
  list: (status: string | null) => Promise<OrderListResponseDtoOutput>;
};

// SiteHeader (rendered by OrdersPage) reads isAuthenticated()/user() -- a
// user browsing their order history is always logged in already.
function configureWith(service: Partial<FakeOrdersService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: OrdersService,
        useValue: { list: vi.fn().mockResolvedValue({ orders: [] }), ...service },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('OrdersPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ list: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Mes commandes');
    expect(text).toContain('Chargement de vos commandes');
  });

  it('shows an empty state when there are no orders', async () => {
    configureWith({ list: () => Promise.resolve({ orders: [] }) });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain("n'avez pas encore passé de commande");
  });

  it('shows an error state when the list fails to load', async () => {
    configureWith({ list: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger vos commandes');
  });

  it('lists orders with their French status label and total', async () => {
    configureWith({
      list: () => Promise.resolve({ orders: [ORDER_PENDING, ORDER_DELIVERED] }),
    });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LN-2026-000001');
    expect(text).toContain("En attente d'enlèvement");
    expect(text).toContain('LN-2026-000002');
    expect(text).toContain('Livré');
  });

  it('reloads the list with the selected status filter', async () => {
    const list = vi.fn().mockResolvedValue({ orders: [] });
    configureWith({ list });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(list).toHaveBeenCalledWith(null);

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-chip'),
    ) as HTMLButtonElement[];
    const deliveredChip = chips.find((btn) => btn.textContent?.trim() === 'Livré');
    deliveredChip?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(list).toHaveBeenCalledWith('DELIVERED');
  });
});
