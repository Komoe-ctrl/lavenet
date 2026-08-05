import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AddressesService } from '../data-access/addresses.service';
import { SessionStore } from '../../../core/auth/session.store';
import { AddressesPage } from './addresses-page';

const ADDRESS_A = {
  id: 'addr_1',
  label: 'Maison',
  commune: 'Cocody',
  quartier: 'Angré',
  details: 'Immeuble bleu, 2e portail après la pharmacie',
  geoLat: null,
  geoLng: null,
  isDefault: true,
};

const ADDRESS_B = {
  id: 'addr_2',
  label: 'Bureau',
  commune: 'Plateau',
  quartier: 'Rue du Commerce',
  details: 'Tour Alpha 2000, 5e étage',
  geoLat: null,
  geoLng: null,
  isDefault: false,
};

type FakeAddressesService = {
  list: () => Promise<{ addresses: (typeof ADDRESS_A)[] }>;
  create: (body: unknown) => Promise<{ address: unknown }>;
  update: (id: string, body: unknown) => Promise<{ address: unknown }>;
  remove: (id: string) => Promise<void>;
};

// SiteHeader (rendered by AddressesPage) reads isAuthenticated()/user() --
// a user browsing their address book is always logged in already.
function configureWith(service: Partial<FakeAddressesService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: AddressesService,
        useValue: {
          list: vi.fn().mockResolvedValue({ addresses: [] }),
          create: vi.fn(),
          update: vi.fn(),
          remove: vi.fn(),
          ...service,
        },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

function setValue(fixture: { nativeElement: Element }, selector: string, value: string): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('AddressesPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ list: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain("Carnet d'adresses");
    expect(text).toContain('Chargement de vos adresses');
  });

  it('shows an empty state when there are no addresses', async () => {
    configureWith({ list: () => Promise.resolve({ addresses: [] }) });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucune adresse enregistrée');
  });

  it('shows an error state when the list fails to load', async () => {
    configureWith({ list: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger vos adresses');
  });

  it('lists addresses, showing the default badge and the repère prominently', async () => {
    configureWith({ list: () => Promise.resolve({ addresses: [ADDRESS_A, ADDRESS_B] }) });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Maison');
    expect(text).toContain('Cocody, Angré');
    expect(text).toContain('Immeuble bleu, 2e portail après la pharmacie');
    expect(text).toContain('Par défaut');
    expect(text).toContain('Bureau');
    // Only the non-default address offers "set as default".
    const setDefaultButtons = Array.from(fixture.nativeElement.querySelectorAll('button')).filter(
      (b) => (b as HTMLButtonElement).textContent?.includes('Définir par défaut'),
    );
    expect(setDefaultButtons).toHaveLength(1);
  });

  it('shows the commune format hint from the centralized list, not a hardcoded one', async () => {
    configureWith({ list: () => Promise.resolve({ addresses: [] }) });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const options = fixture.nativeElement.querySelectorAll('#address-commune option');
    // The placeholder plus every commune from @lavenet/shared-domain.
    expect(options.length).toBeGreaterThan(1);
    expect(Array.from(options).map((o) => (o as HTMLOptionElement).textContent)).toContain(
      'Cocody',
    );
  });

  it('creates a new address and reloads the list', async () => {
    const create = vi.fn().mockResolvedValue({ address: ADDRESS_A });
    const list = vi
      .fn()
      .mockResolvedValueOnce({ addresses: [] })
      .mockResolvedValueOnce({ addresses: [ADDRESS_A] });
    configureWith({ list, create });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    setValue(fixture, '#address-label', 'Maison');
    const communeSelect = fixture.nativeElement.querySelector(
      '#address-commune',
    ) as HTMLSelectElement;
    communeSelect.value = 'Cocody';
    communeSelect.dispatchEvent(new Event('change'));
    setValue(fixture, '#address-quartier', 'Angré');
    setValue(fixture, '#address-details', 'Immeuble bleu, 2e portail');
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({
      label: 'Maison',
      commune: 'Cocody',
      quartier: 'Angré',
      details: 'Immeuble bleu, 2e portail',
      isDefault: false,
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Maison');
  });

  it('shows the API error message when create fails, without navigating away', async () => {
    const create = vi.fn(() =>
      Promise.reject(
        new HttpErrorResponse({ status: 400, error: { message: 'Commune invalide.' } }),
      ),
    );
    configureWith({ list: () => Promise.resolve({ addresses: [] }), create });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    setValue(fixture, '#address-label', 'Maison');
    setValue(fixture, '#address-quartier', 'Angré');
    setValue(fixture, '#address-details', 'Repère');
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Commune invalide.');
  });

  it('pre-fills the form and updates an existing address on edit', async () => {
    const update = vi.fn().mockResolvedValue({ address: { ...ADDRESS_A, label: 'Maison (maj)' } });
    configureWith({
      list: () => Promise.resolve({ addresses: [ADDRESS_A] }),
      update,
    });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const editButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLButtonElement).textContent?.includes('Modifier'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#address-label').value).toBe('Maison');
    expect(fixture.nativeElement.textContent).toContain("Modifier l'adresse");

    setValue(fixture, '#address-label', 'Maison (maj)');
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(update).toHaveBeenCalledWith(
      'addr_1',
      expect.objectContaining({ label: 'Maison (maj)' }),
    );
  });

  it('asks for confirmation before deleting, then deletes on confirm', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const list = vi
      .fn()
      .mockResolvedValueOnce({ addresses: [ADDRESS_B] })
      .mockResolvedValueOnce({ addresses: [] });
    configureWith({ list, remove });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const deleteButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLButtonElement).textContent?.trim() === 'Supprimer',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Supprimer cette adresse ?');
    expect(remove).not.toHaveBeenCalled();

    const confirmButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLButtonElement).textContent?.includes('Confirmer la suppression'),
    ) as HTMLButtonElement;
    confirmButton.click();
    await fixture.whenStable();

    expect(remove).toHaveBeenCalledWith('addr_2');
    expect(fixture.nativeElement.textContent).toContain('Aucune adresse enregistrée');
  });

  it('promotes a non-default address to default', async () => {
    const update = vi.fn().mockResolvedValue({ address: { ...ADDRESS_B, isDefault: true } });
    const list = vi
      .fn()
      .mockResolvedValueOnce({ addresses: [ADDRESS_A, ADDRESS_B] })
      .mockResolvedValueOnce({
        addresses: [
          { ...ADDRESS_A, isDefault: false },
          { ...ADDRESS_B, isDefault: true },
        ],
      });
    configureWith({ list, update });
    const fixture = TestBed.createComponent(AddressesPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const setDefaultButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('Définir par défaut'),
    ) as HTMLButtonElement;
    setDefaultButton.click();
    await fixture.whenStable();

    expect(update).toHaveBeenCalledWith('addr_2', { isDefault: true });
  });
});
