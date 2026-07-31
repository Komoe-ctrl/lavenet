import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Populated by JwtAuthGuard — only meaningful on routes that use it.
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request & { userId: string }>();
  return req.userId;
});
