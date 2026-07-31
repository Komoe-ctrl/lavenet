import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { AuthService } from './auth.service';
import { AuthUserDto, LoginDto, LoginResponseDto, RefreshResponseDto } from './auth.dto';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const REFRESH_COOKIE_NAME = 'refresh_token';
// Scoped to /api/auth: the cookie is only ever read by refresh/logout, no
// need to send it on every request to the API.
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ZodResponse({ type: LoginResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      dto.email,
      dto.password,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(200)
  @ZodResponse({ type: RefreshResponseDto })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertSameOriginHeader(req);
    const { accessToken, refreshToken } = await this.authService.refresh(
      req.cookies?.[REFRESH_COOKIE_NAME],
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.assertSameOriginHeader(req);
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ZodResponse({ type: AuthUserDto })
  me(@CurrentUser() userId: string) {
    return this.authService.me(userId);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      // SameSite=None requires Secure, which requires HTTPS — true only in
      // production (web and api on different domains there). Locally both
      // run on http://localhost on different ports, where SameSite=Lax
      // still lets the cookie through and doesn't need Secure.
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  // SameSite=None (required cross-domain in production) drops the browser's
  // default CSRF protection on cookie-authenticated routes. A custom header
  // can't be set by a cross-site <form> POST, and CORS (see main.ts) already
  // rejects the preflight it would trigger from any origin but CORS_ORIGIN —
  // so requiring one blocks the classic CSRF vector here at no extra cost.
  // Full double-submit CSRF tokens are deferred to the first real mutating
  // business route (checkout) if one ends up needing cookie auth too.
  private assertSameOriginHeader(req: Request): void {
    if (!req.headers['x-requested-with']) {
      throw new UnauthorizedException('Requête cross-site refusée.');
    }
  }
}
