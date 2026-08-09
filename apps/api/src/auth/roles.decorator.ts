import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// F-ADM-10. Paired with RolesGuard -- lists which UserRole values may
// access the decorated controller/handler. Never used alone: a route with
// @Roles but no RolesGuard in @UseGuards would silently allow everyone.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
