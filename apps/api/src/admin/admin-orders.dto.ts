import { createZodDto } from 'nestjs-zod';
import {
  adminListOrdersQuerySchema,
  adminOrderDetailResponseSchema,
  adminOrderListResponseSchema,
  adminUpdateOrderStatusSchema,
} from '@lavenet/shared-schemas';

export class AdminListOrdersQueryDto extends createZodDto(adminListOrdersQuerySchema) {}
export class AdminOrderListResponseDto extends createZodDto(adminOrderListResponseSchema) {}
export class AdminOrderDetailResponseDto extends createZodDto(adminOrderDetailResponseSchema) {}
export class AdminUpdateOrderStatusDto extends createZodDto(adminUpdateOrderStatusSchema) {}
