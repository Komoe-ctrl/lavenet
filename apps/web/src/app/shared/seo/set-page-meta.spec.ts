import { Meta, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { setPageMeta } from './set-page-meta';

describe('setPageMeta', () => {
  it('sets the title and the description/OG/Twitter tags from an absolute URL', () => {
    TestBed.configureTestingModule({});
    const titleService = TestBed.inject(Title);
    const metaService = TestBed.inject(Meta);

    setPageMeta(titleService, metaService, {
      title: 'Nos tarifs — LaveNet',
      description: 'Grille tarifaire du pressing en ligne à Abidjan.',
      path: '/tarifs',
    });

    expect(titleService.getTitle()).toBe('Nos tarifs — LaveNet');
    expect(metaService.getTag('name="description"')?.content).toBe(
      'Grille tarifaire du pressing en ligne à Abidjan.',
    );
    expect(metaService.getTag('property="og:title"')?.content).toBe('Nos tarifs — LaveNet');
    expect(metaService.getTag('property="og:url"')?.content).toBe(`${environment.siteUrl}/tarifs`);
    expect(metaService.getTag('property="og:image"')?.content).toBe(
      `${environment.siteUrl}/images/og-image.webp`,
    );
    expect(metaService.getTag('property="og:image:type"')?.content).toBe('image/webp');
    expect(metaService.getTag('property="og:image:width"')?.content).toBe('1200');
    expect(metaService.getTag('property="og:image:height"')?.content).toBe('630');
    expect(metaService.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
  });

  it('accepts a custom image path', () => {
    TestBed.configureTestingModule({});
    const titleService = TestBed.inject(Title);
    const metaService = TestBed.inject(Meta);

    setPageMeta(titleService, metaService, {
      title: 'x',
      description: 'y',
      path: '/',
      image: '/images/custom.webp',
    });

    expect(metaService.getTag('property="og:image"')?.content).toBe(
      `${environment.siteUrl}/images/custom.webp`,
    );
  });
});
