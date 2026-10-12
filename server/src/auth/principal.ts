/**
 * Principal represents the authenticated identity making a request.
 * Built from either a session cookie or an API key.
 */
export interface Principal {
  userId: string;
  role: 'admin' | 'member';
  /** How the user authenticated: 'session' (cookie) or 'apikey' */
  via: 'session' | 'apikey';
  /** The API key ID if authenticated via API key (for audit attribution) */
  apiKeyId?: string;
}
