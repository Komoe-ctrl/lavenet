import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  it('shows the brand and demo notice, without a photo credit by default', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('projet de démonstration');
    expect(text).not.toContain('Unsplash');
  });

  // No real contact channel is configured yet (see shared/config/site-config.ts):
  // no email/phone/WhatsApp/address value has been filled in. The footer
  // must never show a dead link or an invented value for any of them.
  it('hides every contact channel and address while none is configured', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent.toLowerCase();
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href^="https://wa.me/"]')).toBeNull();
    expect(text).not.toContain('whatsapp');
    expect(fixture.nativeElement.querySelector('.address')).toBeNull();
    expect(fixture.nativeElement.querySelector('.social')).toBeNull();
  });

  it('shows the Unsplash photo credit when showPhotoCredit is set', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.componentRef.setInput('showPhotoCredit', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dan Lefebvre (Unsplash)');
  });
});
