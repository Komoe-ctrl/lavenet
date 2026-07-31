import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import { catalogControllerGetCatalog } from '../../../core/api-client/functions';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly. Shared by the tarifs page and the
// home page enrichment.
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(Api);

  loadCatalog(): Promise<CatalogResponseDtoOutput> {
    return this.api.invoke(catalogControllerGetCatalog);
  }
}
