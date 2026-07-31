import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CatalogResponseDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

// Public: no guard. This is the endpoint the prerendered / and /tarifs
// pages call at build time (see apps/web/src/app/features/catalog) -- it
// must work with no Authorization header and no cookie.
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ZodResponse({ type: CatalogResponseDto })
  getCatalog() {
    return this.catalogService.getPublicCatalog();
  }
}
