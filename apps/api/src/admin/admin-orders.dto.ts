import { createZodDto } from 'nestjs-zod';
import {
  adminCourierListResponseSchema,
  adminListOrdersQuerySchema,
  adminOrderDetailResponseSchema,
  adminOrderListResponseSchema,
  adminUpdateOrderStatusResponseSchema,
  adminUpdateOrderStatusSchema,
  assignCourierSchema,
} from '@lavenet/shared-schemas';

export class AdminListOrdersQueryDto extends createZodDto(adminListOrdersQuerySchema) {}
export class AdminOrderListResponseDto extends createZodDto(adminOrderListResponseSchema) {}
export class AdminOrderDetailResponseDto extends createZodDto(adminOrderDetailResponseSchema) {}
export class AdminUpdateOrderStatusDto extends createZodDto(adminUpdateOrderStatusSchema) {}
export class AdminUpdateOrderStatusResponseDto extends createZodDto(
  adminUpdateOrderStatusResponseSchema,
) {}
export class AssignCourierDto extends createZodDto(assignCourierSchema) {}
export class AdminCourierListResponseDto extends createZodDto(adminCourierListResponseSchema) {}
