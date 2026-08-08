import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import { ordersControllerDetail, ordersControllerList } from '../../../core/api-client/functions';
import { OrderDetailResponseDtoOutput } from '../../../core/api-client/models/order-detail-response-dto-output';
import { OrderListResponseDtoOutput } from '../../../core/api-client/models/order-list-response-dto-output';

export type PlacedOrderStatus = OrderListResponseDtoOutput['orders'][number]['status'];

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly.
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(Api);

  list(status: PlacedOrderStatus | null): Promise<OrderListResponseDtoOutput> {
    return this.api.invoke(ordersControllerList, status ? { status } : {});
  }

  detail(id: string): Promise<OrderDetailResponseDtoOutput> {
    return this.api.invoke(ordersControllerDetail, { id });
  }
}
