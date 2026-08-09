import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

// Must run after JwtAuthGuard (which populates req.userRole) --
// @UseGuards(JwtAuthGuard, RolesGuard), always in that order. A route with
// no @Roles metadata is left open to any authenticated user, same as
// today's behaviour for every existing route.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<string[] | undefined>(ROLES_KEY, context.getHandler()) ??
      this.reflector.get<string[] | undefined>(ROLES_KEY, context.getClass());
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { userRole?: string }>();
    if (!req.userRole || !requiredRoles.includes(req.userRole)) {
      // Plain 403, not the 404-either-way IDOR convention: the existence
      // of an admin endpoint isn't a secret, only access to it is denied.
      throw new ForbiddenException('Accès réservé.');
    }
    return true;
  }
}
