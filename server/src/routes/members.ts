import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import crypto from 'crypto';

export function createMembersRouter(): Router {
  const router = Router();
  router.use(requireAuth, requireRole('admin'));

  router.get('/', async (req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true }
    });
    res.json({ members: users });
  });

  router.post('/invite', async (req, res) => {
    const { email, role = 'member' } = req.body;
    if (!email) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email is required' } });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: { email, role, tokenHash, expiresAt, invitedBy: req.principal!.userId }
    });

    res.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token,
        expiresAt: invitation.expiresAt
      }
    });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { role, disabled } = req.body;

    if (id === req.principal!.userId) {
      if (role !== undefined || disabled !== undefined) {
         return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot change own role or disable self' } });
      }
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (disabled !== undefined) updateData.disabled = disabled;

    try {
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true }
      });
      res.json({ member: user });
    } catch (err) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (id === req.principal!.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot delete self' } });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.apiKey.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
      });
      res.status(204).end();
    } catch (err) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
  });

  return router;
}
