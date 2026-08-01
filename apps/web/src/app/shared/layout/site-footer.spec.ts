import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  it('shows the demo notice and contact, without a photo credit by default', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('projet de démonstration');
    expect(text).toContain('contact@lavenet.example');
    expect(text).toContain('adresse de démonstration');
    expect(text).not.toContain('Unsplash');
    // Explicit product decision: email only, never a phone/WhatsApp channel
    // that isn't real.
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]')).toBeNull();
    expect(text.toLowerCase()).not.toContain('whatsapp');
  });

  it('shows the Unsplash photo credit when showPhotoCredit is set', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.componentRef.setInput('showPhotoCredit', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dan Lefebvre (Unsplash)');
  });
});
