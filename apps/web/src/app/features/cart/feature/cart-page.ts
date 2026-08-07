import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CartService } from '../data-access/cart.service';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

const DEFAULT_ERROR = 'Une erreur est survenue. Réessayez.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  private readonly cartService = inject(CartService);

  protected readonly cart = resource({ loader: () => this.cartService.getCart() });

  protected readonly updatingItemId = signal<string | null>(null);
  protected readonly removingItemId = signal<string | null>(null);
  protected readonly clearing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) {
      return;
    }
    this.updatingItemId.set(itemId);
    this.actionError.set(null);
    try {
      await this.cartService.updateItem(itemId, { quantity });
      this.cart.reload();
    } catch (err) {
      this.actionError.set(extractErrorMessage(err));
    } finally {
      this.updatingItemId.set(null);
    }
  }

  protected async removeItem(itemId: string): Promise<void> {
    this.removingItemId.set(itemId);
    this.actionError.set(null);
    try {
      await this.cartService.removeItem(itemId);
      this.cart.reload();
    } catch (err) {
      this.actionError.set(extractErrorMessage(err));
    } finally {
      this.removingItemId.set(null);
    }
  }

  protected async clearCart(): Promise<void> {
    this.clearing.set(true);
    this.actionError.set(null);
    try {
      await this.cartService.clearCart();
      this.cart.reload();
    } catch (err) {
      this.actionError.set(extractErrorMessage(err));
    } finally {
      this.clearing.set(false);
    }
  }
}
