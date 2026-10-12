import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { runChatAgent } from '../chat/agent.js';
import { setupSSE, sendEvent } from '../chat/stream.js';
import type { UpstreamManager } from '../upstream/manager.js';

function idParam(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

export function createChatRouter(_manager: UpstreamManager): Router {
  const router = Router();
  router.use(requireAuth);

  // List own conversations
  router.get('/conversations', async (req, res) => {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.principal!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ conversations });
  });

  // Create a new conversation
  router.post('/conversations', async (req, res) => {
    const { title } = req.body;
    const conversation = await prisma.conversation.create({
      data: {
        userId: req.principal!.userId,
        title: title || 'New chat',
      },
    });
    res.status(201).json({ conversation });
  });

  // Get messages for a conversation
  router.get('/conversations/:id/messages', async (req, res) => {
    const conversation = await prisma.conversation.findFirst({
      where: { id: idParam(req.params.id), userId: req.principal!.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: idParam(req.params.id) },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ messages });
  });

  // Send a message (SSE streaming response)
  router.post('/conversations/:id/messages', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Message is required' } });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: idParam(req.params.id), userId: req.principal!.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }

    // Setup SSE
    setupSSE(res);

    // Run the chat agent (streams events to res)
    await runChatAgent(_manager, req.principal!, idParam(req.params.id), message, res);

    res.end();
  });

  // Delete a conversation
  router.delete('/conversations/:id', async (req, res) => {
    const conversation = await prisma.conversation.findFirst({
      where: { id: idParam(req.params.id), userId: req.principal!.userId },
    });
    if (!conversation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }

    await prisma.conversation.delete({ where: { id: idParam(req.params.id) } });
    res.status(204).end();
  });

  return router;
}
