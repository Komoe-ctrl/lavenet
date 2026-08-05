import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { COMMUNES } from '@lavenet/shared-domain';
import { AddressesService } from '../data-access/addresses.service';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';

interface AddressListItem {
  id: string;
  label: string;
  commune: string;
  quartier: string;
  details: string;
  isDefault: boolean;
}

const DEFAULT_ERROR = 'Une erreur est survenue. Réessayez.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

// Geo coordinates (Address.geoLat/geoLng) aren't entered here -- no map
// picker exists yet in this lot, and the API/schema already accept them as
// optional, so nothing about adding one later needs a contract change.
@Component({
  selector: 'app-addresses-page',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './addresses-page.html',
  styleUrl: './addresses-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressesPage {
  private readonly addressesService = inject(AddressesService);

  protected readonly communes = COMMUNES;

  protected readonly addresses = resource({
    loader: () => this.addressesService.list().then((r) => r.addresses),
  });

  // null = creating a new address; an id = editing that existing one. Same
  // form fields either way, just a different submit target.
  protected readonly editingId = signal<string | null>(null);
  protected readonly label = signal('');
  protected readonly commune = signal('');
  protected readonly quartier = signal('');
  protected readonly details = signal('');
  protected readonly isDefault = signal(false);
  protected readonly formSubmitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  // Inline confirmation instead of a native confirm() dialog -- consistent
  // and testable across mobile WebView, no browser-chrome dependency.
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly deleteSubmitting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly defaultSubmittingId = signal<string | null>(null);
  protected readonly defaultError = signal<string | null>(null);

  protected startEdit(address: AddressListItem): void {
    this.editingId.set(address.id);
    this.label.set(address.label);
    this.commune.set(address.commune);
    this.quartier.set(address.quartier);
    this.details.set(address.details);
    this.isDefault.set(address.isDefault);
    this.formError.set(null);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    this.formSubmitting.set(true);
    this.formError.set(null);
    const payload = {
      label: this.label().trim(),
      // Cast: the <select> only ever offers COMMUNES options (template),
      // the API/zod still re-validates it regardless.
      commune: this.commune() as (typeof COMMUNES)[number],
      quartier: this.quartier().trim(),
      details: this.details().trim(),
      isDefault: this.isDefault(),
    };
    try {
      const id = this.editingId();
      if (id) {
        await this.addressesService.update(id, payload);
      } else {
        await this.addressesService.create(payload);
      }
      this.resetForm();
      this.addresses.reload();
    } catch (err) {
      this.formError.set(extractErrorMessage(err));
    } finally {
      this.formSubmitting.set(false);
    }
  }

  protected askDeleteConfirmation(id: string): void {
    this.confirmingDeleteId.set(id);
    this.deleteError.set(null);
  }

  protected cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  protected async confirmDelete(id: string): Promise<void> {
    this.deleteSubmitting.set(true);
    this.deleteError.set(null);
    try {
      await this.addressesService.remove(id);
      this.confirmingDeleteId.set(null);
      this.addresses.reload();
    } catch (err) {
      this.deleteError.set(extractErrorMessage(err));
    } finally {
      this.deleteSubmitting.set(false);
    }
  }

  protected async setDefault(id: string): Promise<void> {
    this.defaultSubmittingId.set(id);
    this.defaultError.set(null);
    try {
      await this.addressesService.update(id, { isDefault: true });
      this.addresses.reload();
    } catch (err) {
      this.defaultError.set(extractErrorMessage(err));
    } finally {
      this.defaultSubmittingId.set(null);
    }
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.label.set('');
    this.commune.set('');
    this.quartier.set('');
    this.details.set('');
    this.isDefault.set(false);
    this.formError.set(null);
  }
}
