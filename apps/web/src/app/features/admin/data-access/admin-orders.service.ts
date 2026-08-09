import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import {
  adminOrdersControllerDetail,
  adminOrdersControllerList,
  adminOrdersControllerUpdateStatus,
} from '../../../core/api-client/functions';
import { AdminOrderDetailResponseDtoOutput } from '../../../core/api-client/models/admin-order-detail-response-dto-output';
import { AdminOrderListResponseDtoOutput } from '../../../core/api-client/models/admin-order-list-response-dto-output';
import { AdminUpdateOrderStatusDto } from '../../../core/api-client/models/admin-update-order-status-dto';

export type AdminOrderStatus = AdminOrderListResponseDtoOutput['orders'][number]['status'];

export interface AdminOrdersFilters {
  status: AdminOrderStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
  reference: string | null;
  page: number;
}

const PAGE_SIZE = 20;

// Thin wrapper around the generated client, per CLAUDE.md §3 -- same shape
// as features/orders/data-access/orders.service.ts.
@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private readonly api = inject(Api);

  list(filters: AdminOrdersFilters): Promise<AdminOrderListResponseDtoOutput> {
    return this.api.invoke(adminOrdersControllerList, {
      status: filters.status ?? undefined,
      dateFrom: filters.dateFrom ?? undefined,
      dateTo: filters.dateTo ?? undefined,
      reference: filters.reference ?? undefined,
      page: filters.page,
      pageSize: PAGE_SIZE,
    });
  }

  detail(id: string): Promise<AdminOrderDetailResponseDtoOutput> {
    return this.api.invoke(adminOrdersControllerDetail, { id });
  }

  updateStatus(
    id: string,
    body: AdminUpdateOrderStatusDto,
  ): Promise<AdminOrderDetailResponseDtoOutput> {
    return this.api.invoke(adminOrdersControllerUpdateStatus, { id, body });
  }
}
