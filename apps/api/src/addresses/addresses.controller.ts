import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateAddressDto,
  CreateAddressResponseDto,
  ListAddressesResponseDto,
  UpdateAddressDto,
  UpdateAddressResponseDto,
} from './addresses.dto';
import { AddressesService } from './addresses.service';

// Every route scoped to the current token's user -- there is no
// :userId in any URL, only :id (the address). Ownership of that address
// is checked in the service (AddressesService.assertOwnedAddress), not
// here (CLAUDE.md §5: "vérification de propriété de la ressource").
@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ZodResponse({ type: ListAddressesResponseDto })
  list(@CurrentUser() userId: string) {
    return this.addressesService.list(userId);
  }

  @Post()
  @ZodResponse({ type: CreateAddressResponseDto })
  create(@CurrentUser() userId: string, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(userId, dto);
  }

  @Patch(':id')
  @ZodResponse({ type: UpdateAddressResponseDto })
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
    return this.addressesService.remove(userId, id);
  }
}
