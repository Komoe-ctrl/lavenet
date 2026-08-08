import { createZodDto } from 'nestjs-zod';
import {
  listOrdersQuerySchema,
  orderDetailResponseSchema,
  orderListResponseSchema,
} from '@lavenet/shared-schemas';

export class ListOrdersQueryDto extends createZodDto(listOrdersQuerySchema) {}
export class OrderListResponseDto extends createZodDto(orderListResponseSchema) {}
export class OrderDetailResponseDto extends createZodDto(orderDetailResponseSchema) {}
