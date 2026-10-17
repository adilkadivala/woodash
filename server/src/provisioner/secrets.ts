import crypto from 'node:crypto';
import { decryptCredential, encryptCredential } from '../security/crypto.js';

export type StoreSecrets = {
  mariadbRootPassword: string;
  mariadbPassword: string;
  wordpressAdminUser: string;
  wordpressAdminPassword: string;
  wordpressAdminEmail: string;
  wooConsumerKey: string;
  wooConsumerSecret: string;
  wooMcpToken: string;
};

export function generateStoreSecrets(slug: string): StoreSecrets {
  return {
    mariadbRootPassword: crypto.randomBytes(18).toString('base64url'),
    mariadbPassword: crypto.randomBytes(18).toString('base64url'),
    wordpressAdminUser: 'admin',
    wordpressAdminPassword: crypto.randomBytes(12).toString('base64url'),
    wordpressAdminEmail: `admin@${slug}.store.local`,
    wooConsumerKey: `ck_${crypto.randomBytes(20).toString('hex')}`,
    // woocommerce_api_keys.consumer_secret is char(43): "cs_" + 40 hex, longer gets truncated
    wooConsumerSecret: `cs_${crypto.randomBytes(20).toString('hex')}`,
    wooMcpToken: crypto.randomBytes(32).toString('hex'),
  };
}

export function encryptStoreSecrets(secrets: StoreSecrets): Uint8Array<ArrayBuffer> {
  return encryptCredential(JSON.stringify(secrets)) as Uint8Array<ArrayBuffer>;
}

export function decryptStoreSecrets(enc: Uint8Array): StoreSecrets {
  return JSON.parse(decryptCredential(enc)) as StoreSecrets;
}
