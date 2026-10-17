import { Router } from 'express';
import crypto from 'node:crypto';
import { stringifySetCookie } from 'cookie';
import { prisma } from '../db/client.js';
import { config } from '../config.js';
import { parseCookie } from 'cookie';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSession, deleteSession } from '../auth/sessions.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

/**
 * POST /login - Email + password login
 * Sets HttpOnly session cookie on success.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
    return;
  }

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    return;
  }

  // Check if user is disabled
  if (user.disabled) {
    res.status(401).json({ error: { code: 'ACCOUNT_DISABLED', message: 'Your account is disabled. Contact an admin.' } });
    return;
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    return;
  }

  // Create session
  const sessionId = await createSession(user.id);

  // Set cookie
  res.setHeader('Set-Cookie', stringifySetCookie({
    name: 'sid',
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    secure: config.COOKIE_SECURE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  }));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

/**
 * POST /logout - Clear session and cookie
 */
router.post('/logout', async (req, res) => {
  const cookies = parseCookie(req.headers.cookie || '');
  if (cookies.sid) {
    await deleteSession(cookies.sid).catch(() => undefined);
  }

  // Clear cookie
  res.setHeader('Set-Cookie', stringifySetCookie({
    name: 'sid',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: config.COOKIE_SECURE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  }));

  res.status(204).end();
});

/**
 * GET /me - Get current user info
 */
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.principal!.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'User not found' } });
    return;
  }

  res.json({ user });
});

/**
 * POST /accept-invite - Accept an invitation and create account
 */
router.post('/accept-invite', async (req, res) => {
  const { token, name, password } = req.body;

  if (!token || !name || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Token, name, and password are required' } });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
    return;
  }

  // Hash the token to find the invitation
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
  if (!invitation) {
    res.status(400).json({ error: { code: 'INVALID_INVITE', message: 'This invite is no longer valid. Ask your admin for a new one.' } });
    return;
  }

  if (invitation.acceptedAt) {
    res.status(400).json({ error: { code: 'INVITE_USED', message: 'This invite has already been used.' } });
    return;
  }

  if (invitation.expiresAt < new Date()) {
    res.status(400).json({ error: { code: 'INVITE_EXPIRED', message: 'This invite has expired. Ask your admin for a new one.' } });
    return;
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) {
    res.status(400).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } });
    return;
  }

  // Create user and mark invitation as accepted (in a transaction)
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: invitation.email,
        name,
        passwordHash,
        role: invitation.role,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return newUser;
  });

  // Auto-login: create session and set cookie
  const sessionId = await createSession(user.id);

  res.setHeader('Set-Cookie', stringifySetCookie({
    name: 'sid',
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    secure: config.COOKIE_SECURE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  }));

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

export default router;
