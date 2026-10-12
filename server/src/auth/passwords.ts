import bcrypt from 'bcryptjs';

/**
 * Hash a plain text password with 12 rounds.
 */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
}

/**
 * Verify a plain text password against a hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}
