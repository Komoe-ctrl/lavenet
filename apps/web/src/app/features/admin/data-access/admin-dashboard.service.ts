import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../../core/api-client/api';
import { adminDashboardControllerGet } from '../../../core/api-client/functions';
import { adminExportControllerOrders } from '../../../core/api-client/fn/admin-export/admin-export-controller-orders';
import { adminExportControllerPayments } from '../../../core/api-client/fn/admin-export/admin-export-controller-payments';
import { AdminDashboardResponseDtoOutput } from '../../../core/api-client/models/admin-dashboard-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3. The export
// routes return a CSV body with no OpenAPI response schema (a
// StreamableFile, same limitation as GET /invoices/:id/pdf) -- their
// generated functions discard the body, so downloading them goes through
// HttpClient directly instead, reusing only the generated PATH constant.
// Still authenticated: the interceptor runs for every HttpClient request,
// not just generated-client calls.
@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);

  get(): Promise<AdminDashboardResponseDtoOutput> {
    return this.api.invoke(adminDashboardControllerGet);
  }

  downloadOrdersCsv(from: string, to: string): Promise<Blob> {
    return this.downloadCsv(adminExportControllerOrders.PATH, from, to);
  }

  downloadPaymentsCsv(from: string, to: string): Promise<Blob> {
    return this.downloadCsv(adminExportControllerPayments.PATH, from, to);
  }

  private downloadCsv(path: string, from: string, to: string): Promise<Blob> {
    const params = new URLSearchParams({ from, to });
    return firstValueFrom(
      this.http.get(`${this.api.rootUrl}${path}?${params.toString()}`, { responseType: 'blob' }),
    );
  }
}
