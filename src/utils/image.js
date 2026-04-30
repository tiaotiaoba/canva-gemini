// --- Image-related utility functions extracted from App.jsx ---

// --- Helper: Detect MIME type from raw Base64 payload (no data: prefix) ---
export const detectBase64ImageMime = (raw, fallback = 'image/png') => {
    if (!raw || typeof raw !== 'string') return fallback;
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith('data:')) {
        const match = trimmed.match(/^data:([^;]+);/i);
        return match?.[1]?.toLowerCase() || fallback;
    }
    if (trimmed.startsWith('/9j/')) return 'image/jpeg';
    if (trimmed.startsWith('iVBORw0KGgo')) return 'image/png';
    if (trimmed.startsWith('R0lGOD')) return 'image/gif';
    if (trimmed.startsWith('UklGR') && trimmed.toUpperCase().includes('WEBP')) return 'image/webp';
    return fallback;
};

// --- Normalize Base64 Data URL ---
export const normalizeDataUrl = (value) => {
    if (!value || typeof value !== 'string') return value;
    if (!value.startsWith('data:')) return value;
    const cleaned = value.replace(/\s+/g, '');
    const match = cleaned.match(/^data:([^;,]+)(;base64)?,(.*)$/i);
    if (!match) return cleaned;
    const mime = match[1] || 'application/octet-stream';
    const isBase64 = !!match[2];
    if (!isBase64) return cleaned;
    const payload = normalizeBase64Payload(match[3] || '');
    if (!payload) return cleaned;
    return `data:${mime};base64,${payload}`;
};

// --- Normalize Base64 payload string ---
export const normalizeBase64Payload = (value) => {
    if (!value) return '';
    let cleaned = value.replace(/\s+/g, '');
    if (/%[0-9A-Fa-f]{2}/.test(cleaned)) {
        try {
            cleaned = decodeURIComponent(cleaned);
        } catch (e) {
            // Keep original when decode fails.
        }
    }
    cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
    const pad = cleaned.length % 4;
    if (pad) cleaned += '='.repeat(4 - pad);
    return cleaned;
};

// --- Convert Data URL to Blob ---
export const dataUrlToBlob = (dataUrl) => {
    const normalized = normalizeDataUrl(dataUrl);
    const match = normalized.match(/^data:([^;,]+)(;base64)?,(.*)$/i);
    if (!match) return null;
    const mime = match[1] || 'application/octet-stream';
    const isBase64 = !!match[2];
    let data = match[3] || '';
    if (!isBase64) {
        try {
            return new Blob([decodeURIComponent(data)], { type: mime });
        } catch (e) {
            return new Blob([data], { type: mime });
        }
    }
    data = normalizeBase64Payload(data);
    let binary = '';
    try {
        binary = atob(data);
    } catch (e) {
        return null;
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
};

// --- Truncate string by byte size ---
export const truncateByBytes = (value, maxBytes) => {
    if (!value || !maxBytes || maxBytes <= 0) return value || '';
    const encoder = new TextEncoder();
    let used = 0;
    let output = '';
    for (const ch of value) {
        const size = encoder.encode(ch).length;
        if (used + size > maxBytes) break;
        output += ch;
        used += size;
    }
    if (output.length < value.length) return `${output}...`;
    return output;
};

// --- Helper: Get Image Dimensions ---
export const getImageDimensions = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
    });
};

// --- Helper: Check if URL is video ---
export const isVideoUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('data:video')) return true;
    if (url.includes('force_video_display=true')) return true;
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
};

// --- Get MIME type from file path ---
export const getMimeTypeFromPath = (path) => {
    if (!path || typeof path !== 'string') return '';
    const clean = path.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop().toLowerCase();
    const map = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        webm: 'video/webm',
        ogg: 'video/ogg',
        mov: 'video/quicktime'
    };
    return map[ext] || '';
};

// --- Convert Blob to Data URL ---
export const blobToDataURL = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Normalize an image URL value:
 * - data: URLs are normalized via normalizeDataUrl
 * - blob:/http:/https: URLs are returned as-is
 * - img_ IDs and asset:// URLs are returned as-is
 * - bare Base64 strings are wrapped into data: URLs
 */
export const normalizeImageUrlValue = (value, mimeHint = 'image/png') => {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:')) return normalizeDataUrl(trimmed);
    if (trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('img_') || trimmed.startsWith('asset://')) return trimmed;
    const base64Like = /^[A-Za-z0-9+/=_-]+$/.test(trimmed);
    if (base64Like && trimmed.length > 64) {
        const mimeType = detectBase64ImageMime(trimmed, mimeHint);
        const normalized = normalizeBase64Payload(trimmed);
        if (!normalized) return '';
        return `data:${mimeType};base64,${normalized}`;
    }
    return trimmed;
};

/**
 * Persist a Base64 data URL to IndexedDB via LocalImageManager.
 * Falls back to returning the original value if persistence is skipped or fails.
 */
export const persistBase64ImageUrl = async (value, options = {}, LocalImageManager) => {
    if (!value || typeof value !== 'string' || !value.startsWith('data:')) return value;
    if (options.persistBase64 === false) return value;
    if (!LocalImageManager?.saveImage) return value;
    const minLength = Number.isFinite(options.minLength) ? options.minLength : 2000;
    if (value.length < minLength) return value;
    try {
        const imgId = await LocalImageManager.saveImage(value);
        return imgId || value;
    } catch (e) {
        return value;
    }
};

/**
 * Normalize an array of image URLs and optionally persist them.
 */
export const normalizeImageUrls = async (urls, options = {}, LocalImageManager) => {
    if (!Array.isArray(urls)) return [];
    const normalized = urls
        .map((url) => normalizeImageUrlValue(url, options.mimeHint || 'image/png'))
        .filter(Boolean);
    const unique = [];
    normalized.forEach((url) => {
        if (!unique.includes(url)) unique.push(url);
    });
    if (options.persistBase64 === false) return unique;
    const persisted = await Promise.all(unique.map((url) => persistBase64ImageUrl(url, options, LocalImageManager)));
    return persisted.filter(Boolean);
};
