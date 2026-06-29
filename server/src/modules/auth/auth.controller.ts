import type { Request, Response } from 'express';

import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';

import { authService } from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    // 'strict' in dev, where the Vite proxy makes the client+API same-site. In production the
    // client (GitHub Pages) and API (Render) are on different domains, so the cookie must be
    // 'none' (requires secure, already true above) or the browser never sends it back on
    // refresh — see PRD 08 §8.1's CSRF mitigation note for the trade-off this introduces.
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}

function requestMeta(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.register(
      req.body,
      requestMeta(req),
    );
    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { user, accessToken }, { status: 201 });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.login(req.body, requestMeta(req));
    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { user, accessToken });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const incoming = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!incoming) throw new AppError('UNAUTHORIZED', 'No refresh token presented');

    const { user, accessToken, refreshToken } = await authService.refresh(incoming);
    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { user, accessToken });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await authService.logout(req.user.userId, req.user.organizationId);
    }
    clearRefreshCookie(res);
    sendSuccess(res, { message: 'Logged out' });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, { message: 'If that email exists, a reset link was sent' });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body, requestMeta(req));
    sendSuccess(res, { message: 'Password has been reset' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
    const user = await authService.getMe(req.user.organizationId, req.user.userId);
    sendSuccess(res, { user, permissions: req.user.permissions, role: req.user.roleName });
  }),
};
