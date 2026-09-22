import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePlantImageDataUri } from '../src/storage/supabase-images.js';

function dataUri(mimeType, bytes) {
    return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

test('accepts JPEG, PNG and WebP matching their magic bytes', () => {
    assert.equal(parsePlantImageDataUri(dataUri('image/jpeg', [0xff, 0xd8, 0xff, 0x00])).extension, 'jpg');
    assert.equal(parsePlantImageDataUri(dataUri('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).extension, 'png');
    assert.equal(parsePlantImageDataUri(dataUri('image/webp', Buffer.from('RIFF1234WEBP'))).extension, 'webp');
});

test('rejects unsupported MIME types and mismatched image content', () => {
    assert.throws(() => parsePlantImageDataUri(dataUri('image/gif', [0x47, 0x49, 0x46])));
    assert.throws(() => parsePlantImageDataUri(dataUri('image/jpeg', [0x89, 0x50, 0x4e, 0x47])));
});

test('rejects oversized images beyond the 5 MB server-side limit', () => {
    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0x00]), Buffer.alloc(5 * 1024 * 1024)]);
    assert.throws(() => parsePlantImageDataUri(dataUri('image/jpeg', oversized)));
});

test('rejects non-string and malformed data URIs', () => {
    assert.throws(() => parsePlantImageDataUri(undefined));
    assert.throws(() => parsePlantImageDataUri('not-a-data-uri'));
    assert.throws(() => parsePlantImageDataUri('data:image/jpeg;base64,'));
});
