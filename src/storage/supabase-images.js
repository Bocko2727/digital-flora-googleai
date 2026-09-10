import crypto from 'node:crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXTENSION = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

function hasExpectedMagicBytes(buffer, mimeType) {
    if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    return false;
}

export function parsePlantImageDataUri(image) {
    if (typeof image !== 'string') throw new Error('Image payload must be a data URI string.');
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!match || match[2].length % 4 === 1) throw new Error('Invalid image data URI.');

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Image must be between 1 byte and 5 MB after decoding.');
    if (!hasExpectedMagicBytes(buffer, mimeType)) throw new Error('Image content does not match its declared MIME type.');

    return { buffer, mimeType, extension: MIME_TO_EXTENSION[mimeType] };
}

const PLANT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertSafePlantId(plantId) {
    if (typeof plantId !== 'string' || !PLANT_ID_RE.test(plantId)) throw new Error('Invalid plant id.');
    return plantId;
}

function storageConfig() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secretKey) throw new Error('Supabase Storage server configuration is unavailable.');
    return { url: url.replace(/\/$/, ''), secretKey };
}

// Server-only helper: uses the Supabase service-role key to write directly
// to Storage. This module must never be imported into browser bundles.
// Object keys are namespaced per plant id so uploads are traceable and so
// a future move to a private bucket + signed URLs needs no key migration.
export async function storePlantImage(plantId, image) {
    const safePlantId = assertSafePlantId(plantId);
    const { buffer, mimeType, extension } = parsePlantImageDataUri(image);
    const { url, secretKey } = storageConfig();
    const objectKey = `plants/${safePlantId}/${crypto.randomUUID()}.${extension}`;
    const target = `${url}/storage/v1/object/plant-images/${encodeURIComponent(objectKey).replace(/%2F/g, '/')}`;

    const response = await fetch(target, {
        method: 'POST',
        headers: {
            apikey: secretKey,
            authorization: `Bearer ${secretKey}`,
            'content-type': mimeType,
            'x-upsert': 'false',
        },
        body: buffer,
    });

    if (!response.ok) throw new Error('Could not persist image to Supabase Storage.');
    return {
        mimeType,
        imageUrl: `${url}/storage/v1/object/public/plant-images/${encodeURIComponent(objectKey).replace(/%2F/g, '/')}`,
        objectKey,
    };
}
