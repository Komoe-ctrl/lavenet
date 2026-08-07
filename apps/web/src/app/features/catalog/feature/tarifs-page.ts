import {
  ChangeDetectionStrategy,
  Component,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { CartService } from '../../cart/data-access/cart.service';
import { SessionStore } from '../../../core/auth/session.store';
import { siteConfig } from '../../../shared/config/site-config';
import { DevelopmentNotice } from '../../../shared/layout/development-notice';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { setPageMeta } from '../../../shared/seo/set-page-meta';
import { CatalogService } from '../data-access/catalog.service';

const DEFAULT_ERROR = "Impossible d'ajouter cet article. Réessayez.";

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

function rowKey(serviceId: string, articleTypeId: string | null): string {
  return `${serviceId}:${articleTypeId ?? 'base'}`;
}

// Public, prerendered (apps/web/src/app/app.routes.server.ts): the catalog
// fetch below runs at build time against the real API, not in the visitor's
// browser -- see docs/DETTE.md for the freshness tradeoff this implies.
@Component({
  selector: 'app-tarifs-page',
  imports: [MoneyPipe, SiteHeader, SiteFooter, DevelopmentNotice],
  templateUrl: './tarifs-page.html',
  styleUrl: './tarifs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarifsPage {
  private readonly catalogService = inject(CatalogService);
  private readonly cartService = inject(CartService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly config = siteConfig;

  constructor() {
    setPageMeta(inject(Title), inject(Meta), {
      title: `Nos tarifs — ${siteConfig.brandName}`,
      description: `Grille tarifaire du pressing en ligne ${siteConfig.brandName} à Abidjan : lavage, repassage, par catégorie et type d’article.`,
      path: '/tarifs',
    });
  }

  protected readonly catalog = resource({
    loader: () => this.catalogService.loadCatalog(),
  });

  // resource() drops its value the moment a reload errors -- catalog.value()
  // throws in that state. This carries the last successfully loaded catalog
  // forward through any later loading/error state, so a background refresh
  // (in flight or failed) never blanks out prices already on screen.
  protected readonly lastGoodCatalog = linkedSignal<
    CatalogResponseDtoOutput | null,
    CatalogResponseDtoOutput | null
  >({
    source: () => (this.catalog.hasValue() ? this.catalog.value() : null),
    computation: (source, previous) => source ?? previous?.value ?? null,
  });

  protected readonly addingKey = signal<string | null>(null);
  protected readonly addSuccessKey = signal<string | null>(null);
  protected readonly addError = signal<string | null>(null);

  protected rowKey = rowKey;

  // /tarifs never restores the session on its own (no guard runs here --
  // CLAUDE.md's "restauration paresseuse" rule), so a returning logged-in
  // visitor can still show as unauthenticated in the signal at the moment
  // they click. This is the one place that's allowed to trigger restore():
  // it's a direct response to a deliberate user action, not an eager call
  // at page load.
  protected async addToCart(
    serviceId: string,
    articleTypeId: string | null,
    quantity: number,
  ): Promise<void> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return;
    }
    const key = rowKey(serviceId, articleTypeId);
    this.addingKey.set(key);
    this.addError.set(null);
    this.addSuccessKey.set(null);
    try {
      if (!(await this.ensureAuthenticated())) {
        await this.router.navigate(['/login']);
        return;
      }
      await this.cartService.addItem({
        serviceId,
        articleTypeId: articleTypeId ?? undefined,
        quantity,
      });
      this.addSuccessKey.set(key);
    } catch (err) {
      this.addError.set(extractErrorMessage(err));
    } finally {
      this.addingKey.set(null);
    }
  }

  private async ensureAuthenticated(): Promise<boolean> {
    if (this.session.status() === 'idle') {
      await this.session.restore();
    }
    return this.session.isAuthenticated();
  }
}
