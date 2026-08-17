import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import {
  couriersControllerConfirm,
  couriersControllerMarkAbsent,
  couriersControllerTour,
} from '../../../core/api-client/functions';
import { CourierActionResponseDtoOutput } from '../../../core/api-client/models/courier-action-response-dto-output';
import { CourierTourResponseDtoOutput } from '../../../core/api-client/models/courier-tour-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3.
@Injectable({ providedIn: 'root' })
export class CourierService {
  private readonly api = inject(Api);

  tour(): Promise<CourierTourResponseDtoOutput> {
    return this.api.invoke(couriersControllerTour);
  }

  confirm(orderId: string, otpCode: string): Promise<CourierActionResponseDtoOutput> {
    return this.api.invoke(couriersControllerConfirm, { id: orderId, body: { otpCode } });
  }

  markAbsent(
    orderId: string,
    reason: string,
    newDeliverySlotId: string,
  ): Promise<CourierActionResponseDtoOutput> {
    return this.api.invoke(couriersControllerMarkAbsent, {
      id: orderId,
      body: { reason, newDeliverySlotId },
    });
  }
}
