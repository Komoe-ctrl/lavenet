import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AddressesController } from './addresses.controller';
import { AddressesRepository } from './addresses.repository';
import { AddressesService } from './addresses.service';

@Module({
  // AuthModule for JwtAuthGuard (it needs AuthService injected, exported
  // alongside it from there -- see auth.module.ts).
  imports: [AuthModule],
  controllers: [AddressesController],
  providers: [AddressesService, AddressesRepository],
  // AddressesRepository: OrdersModule needs it too (F-CMD-05, PATCH
  // /cart/address validates ownership of the chosen address).
  exports: [AddressesRepository],
})
export class AddressesModule {}
