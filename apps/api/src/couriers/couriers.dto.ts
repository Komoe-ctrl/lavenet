import { createZodDto } from 'nestjs-zod';
import {
  confirmDeliverySchema,
  courierActionResponseSchema,
  courierTourResponseSchema,
  markClientAbsentSchema,
} from '@lavenet/shared-schemas';

export class CourierTourResponseDto extends createZodDto(courierTourResponseSchema) {}
export class ConfirmDeliveryDto extends createZodDto(confirmDeliverySchema) {}
export class MarkClientAbsentDto extends createZodDto(markClientAbsentSchema) {}
export class CourierActionResponseDto extends createZodDto(courierActionResponseSchema) {}
