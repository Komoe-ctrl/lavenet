import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../../core/api-client/api';
import { invoicesControllerDownloadPdf } from '../../../core/api-client/fn/invoices/invoices-controller-download-pdf';

// F-PAY-05. The generated client function for this route (ng-openapi-gen)
// has no way to know the response is a binary PDF -- the controller
// returns a StreamableFile with no OpenAPI response schema, so the
// generated function's responseType defaults to 'text' and discards the
// body entirely. Calling HttpClient directly here (through the same auth
// interceptor every other request goes through, since it applies to all
// HttpClient calls, not just generated-client ones) is the fix for this
// one binary route, reusing the generated PATH constant so the URL stays
// in sync with the API if the route ever moves.
@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(Api);

  downloadPdf(invoiceId: string): Promise<Blob> {
    const path = invoicesControllerDownloadPdf.PATH.replace('{id}', invoiceId);
    return firstValueFrom(this.http.get(`${this.api.rootUrl}${path}`, { responseType: 'blob' }));
  }
}
