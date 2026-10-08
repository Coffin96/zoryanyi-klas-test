import { test, describe } from 'node:test';
import assert from 'node:assert';
import { encodeP, encodeR, decode } from '../src/engine/qr-protocol.js';

describe('QR Protocol Tests', () => {
  const validUUID = '123e4567-e89b-42d3-a456-426614174000';
  
  test('encodeP and decode P', () => {
    const encoded = encodeP(validUUID);
    assert.strictEqual(encoded, `KR1|P|${validUUID}`);
    const decoded = decode(encoded);
    assert.deepStrictEqual(decoded, { type: 'card', uuid: validUUID });
  });

  test('encodeR and decode R', () => {
    const encoded = encodeR(validUUID, '12345678', 'tartlet', 2, '261025');
    assert.strictEqual(encoded, `KR1|R|${validUUID}|12345678|tartlet.2|261025`);
    const decoded = decode(encoded);
    assert.deepStrictEqual(decoded, { type: 'order', uuid: validUUID, id: '12345678', item: 'tartlet', qty: 2, ymd: '261025' });
  });

  test('decode URL card', () => {
    const url = `https://zoryanyi-klas.app/#/p/${validUUID}`;
    const decoded = decode(url);
    assert.deepStrictEqual(decoded, { type: 'card', uuid: validUUID });
  });

  test('decode throws on invalid UUID', () => {
    assert.throws(() => decode('KR1|P|invalid-uuid'), /bad-qr/);
    assert.throws(() => decode(`https://zoryanyi-klas.app/#/p/invalid-uuid`), /bad-qr/);
  });

  test('decode throws on invalid item/qty/date in R', () => {
    assert.throws(() => decode(`KR1|R|${validUUID}|12345678|tartlet.0|261025`), /bad-qr/);
    assert.throws(() => decode(`KR1|R|${validUUID}|12345678|tartlet.11|261025`), /bad-qr/);
    assert.throws(() => decode(`KR1|R|${validUUID}|12345678|A B.2|261025`), /bad-qr/); // invalid item char
    assert.throws(() => decode(`KR1|R|${validUUID}|12345678|tartlet.2|abc`), /bad-qr/); // invalid date
  });

  test('decode throws on unknown format', () => {
    assert.throws(() => decode('hello world'), /bad-qr/);
    assert.throws(() => decode(''), /bad-qr/);
    assert.throws(() => decode(`KR2|P|${validUUID}`), /bad-qr/);
  });
});
