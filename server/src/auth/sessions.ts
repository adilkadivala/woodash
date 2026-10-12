import crypto from 'crypto';
import { prisma } from '../db/client.js';

const SESSION_TTL_DAYS = 7;

/**
 * Create a new session for a user.
 */
export async function createSession(userId: string): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
    
    await prisma.session.create({
        data: {
            id: sessionId,
            userId,
            expiresAt
        }
    });
    
    return sessionId;
}

/**
 * Verify a session exists and has not expired.
 * Deletes the session if it is expired.
 */
export async function verifySession(sessionId: string): Promise<{userId: string, role: string} | null> {
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true }
    });
    
    if (!session) {
        return null;
    }
    
    if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: sessionId } });
        return null;
    }
    
    return {
        userId: session.userId,
        role: session.user.role
    };
}

/**
 * Delete a specific session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
    await prisma.session.delete({
        where: { id: sessionId }
    });
}

/**
 * Delete all sessions for a given user.
 */
export async function deleteUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
        where: { userId }
    });
}
