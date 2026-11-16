import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decryptChatMessage, encryptChatMessage } from './chatCrypto.js';

describe('chatCrypto', () => {
  it('round-trips a message in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CHAT_ENCRYPTION_KEY;

    const plain = 'Hello cashier';
    const encrypted = encryptChatMessage(plain);
    assert.notEqual(encrypted, plain);
    assert.equal(decryptChatMessage(encrypted), plain);
  });

  it('leaves plaintext without prefix unchanged on decrypt', () => {
    assert.equal(decryptChatMessage('already plain'), 'already plain');
  });
});
