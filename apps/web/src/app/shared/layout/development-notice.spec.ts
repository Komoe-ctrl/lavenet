import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DevelopmentNotice } from './development-notice';

describe('DevelopmentNotice', () => {
  it('states that online ordering is not available yet', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(DevelopmentNotice);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('en cours de développement');
  });

  // No contact channel is configured yet (shared/config/site-config.ts) --
  // this must not point visitors to a footer that has nothing to show them.
  it('does not point to the footer while no contact channel is configured', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(DevelopmentNotice);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('pied de page');
  });
});
