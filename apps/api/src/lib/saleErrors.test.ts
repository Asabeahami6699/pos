import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseInsufficientStock } from './saleErrors.js';

describe('parseInsufficientStock', () => {
  it('parses INSUFFICIENT_STOCK exception text', () => {
    const result = parseInsufficientStock({
      message: 'INSUFFICIENT_STOCK:11111111-1111-1111-1111-111111111111:3:1',
    });
    assert.deepEqual(result, {
      productId: '11111111-1111-1111-1111-111111111111',
      need: 3,
      have: 1,
    });
  });

  it('returns null for unrelated errors', () => {
    assert.equal(parseInsufficientStock(new Error('Invalid branch for company')), null);
  });
});
