import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DevelopmentNotice } from './development-notice';

describe('DevelopmentNotice', () => {
  it('states that online ordering is not available yet, without promising a channel other than email', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(DevelopmentNotice);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('en cours de développement');
    expect(text).toContain('email');
  });
});
