import { createZodDto } from 'nestjs-zod';
import {
  createAddressResponseSchema,
  createAddressSchema,
  listAddressesResponseSchema,
  updateAddressResponseSchema,
  updateAddressSchema,
} from '@lavenet/shared-schemas';

export class CreateAddressDto extends createZodDto(createAddressSchema) {}
export class CreateAddressResponseDto extends createZodDto(createAddressResponseSchema) {}
export class UpdateAddressDto extends createZodDto(updateAddressSchema) {}
export class UpdateAddressResponseDto extends createZodDto(updateAddressResponseSchema) {}
export class ListAddressesResponseDto extends createZodDto(listAddressesResponseSchema) {}
