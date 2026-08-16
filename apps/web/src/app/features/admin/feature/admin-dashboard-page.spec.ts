import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboardService } from '../data-access/admin-dashboard.service';
import { SessionStore } from '../../../core/auth/session.store';
import { AdminDashboardResponseDtoOutput } from '../../../core/api-client/models/admin-dashboard-response-dto-output';
import { AdminDashboardPage } from './admin-dashboard-page';

function dashboard(
  overrides: Partial<AdminDashboardResponseDtoOutput> = {},
): AdminDashboardResponseDtoOutput {
  return {
    revenue: { todayXof: 12_000, last7DaysXof: 84_000, last30DaysXof: 360_000 },
    averageBasketXof: 4_500,
    statusCounts: [
      { status: 'PENDING_PICKUP', count: 3 },
      { status: 'DELIVERED', count: 12 },
      { status: 'CANCELLED', count: 1 },
    ],
    topServices: [
      { serviceId: 'svc_1', serviceName: 'Lavage & pliage', quantity: 40, revenueXof: 180_000 },
    ],
    dailyRevenue: Array.from({ length: 60 }, (_, i) => ({
      date: `2026-0${(i % 9) + 1}-01`,
      revenueXof: i % 5 === 0 ? 6_000 : 0,
      orders: i % 5 === 0 ? 2 : 0,
    })),
    ...overrides,
  };
}

function emptyDashboard(): AdminDashboardResponseDtoOutput {
  return dashboard({
    revenue: { todayXof: 0, last7DaysXof: 0, last30DaysXof: 0 },
    averageBasketXof: 0,
    statusCounts: [],
    topServices: [],
    dailyRevenue: Array.from({ length: 60 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      revenueXof: 0,
      orders: 0,
    })),
  });
}

type FakeAdminDashboardService = {
  get: () => Promise<AdminDashboardResponseDtoOutput>;
  downloadOrdersCsv: (from: string, to: string) => Promise<Blob>;
  downloadPaymentsCsv: (from: string, to: string) => Promise<Blob>;
};

// SiteHeader (rendered by AdminDashboardPage) reads isAuthenticated()/user().
function configureWith(service: Partial<FakeAdminDashboardService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: AdminDashboardService,
        useValue: {
          get: vi.fn().mockResolvedValue(dashboard()),
          downloadOrdersCsv: vi.fn().mockResolvedValue(new Blob(['a;b'], { type: 'text/csv' })),
          downloadPaymentsCsv: vi.fn().mockResolvedValue(new Blob(['a;b'], { type: 'text/csv' })),
          ...service,
        },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('AdminDashboardPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ get: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Chargement du tableau de bord');
  });

  it('shows an error state when the dashboard fails to load', async () => {
    configureWith({ get: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger le tableau de bord');
  });

  it('shows an empty state when there is no data at all', async () => {
    configureWith({ get: () => Promise.resolve(emptyDashboard()) });
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucune commande enregistrée');
  });

  it('renders revenue tiles, status bars and top services', async () => {
    configureWith({ get: () => Promise.resolve(dashboard()) });
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();

    // fr-FR groups thousands with a narrow no-break space (U+202F), not a
    // plain space -- match on digits/FCFA only rather than the literal
    // separator character.
    const text = fixture.nativeElement.textContent.replace(/\s/g, ' ');
    expect(text).toMatch(/CA du jour\s*12\s*000\s*FCFA/);
    expect(text).toMatch(/CA sur 7 jours\s*84\s*000\s*FCFA/);
    expect(text).toMatch(/CA sur 30 jours\s*360\s*000\s*FCFA/);
    expect(text).toMatch(/Panier moyen \(30 j\)\s*4\s*500\s*FCFA/);
    expect(text).toContain("En attente d'enlèvement");
    expect(text).toContain('Annulé');
    expect(text).toContain('Lavage & pliage');

    const chart = fixture.nativeElement.querySelector('.chart polyline');
    expect(chart?.getAttribute('points')).toBeTruthy();
  });

  it('downloads the orders CSV for the selected date range', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const downloadOrdersCsv = vi
      .fn()
      .mockResolvedValue(new Blob(['a;b'], { type: 'text/csv' }));

    configureWith({ downloadOrdersCsv });
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.export__actions button'),
    ) as HTMLButtonElement[];
    const ordersButton = buttons.find((btn) => btn.textContent?.includes('commandes'));
    ordersButton?.click();
    await fixture.whenStable();

    expect(downloadOrdersCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows an inline error when an export fails', async () => {
    configureWith({ downloadPaymentsCsv: () => Promise.reject(new Error('boom')) });
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.export__actions button'),
    ) as HTMLButtonElement[];
    const paymentsButton = buttons.find((btn) => btn.textContent?.includes('paiements'));
    paymentsButton?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain("Impossible de générer l'export");
  });
});
