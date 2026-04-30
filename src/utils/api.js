// API utility and request template functions
// Extracted from App.jsx (lines ~3440-5223)

// ===================================================================
// Image batch mode constants
// ===================================================================
export const IMAGE_BATCH_MODE_PARALLEL_AGGREGATE = 'parallel_aggregate';
export const IMAGE_BATCH_MODE_STANDARD_BATCH = 'standard_batch';

// ===================================================================
// Native multi-image mode constants
// ===================================================================
export const IMAGE_NATIVE_MULTI_IMAGE_MODE_AUTO = 'auto';
export const IMAGE_NATIVE_MULTI_IMAGE_MODE_FORCE = 'force_native';
export const IMAGE_NATIVE_MULTI_IMAGE_MODE_DISABLE = 'disable_native';
export const NATIVE_MULTI_IMAGE_CAPABILITY_STORAGE_KEY = 'tapnow_native_multi_image_capabilities';

// ===================================================================
// Transport mode constants
// ===================================================================
export const TRANSPORT_HTTP_JSON = 'http-json';
export const TRANSPORT_HTTP_SSE = 'http-sse';
export const TRANSPORT_WS_STREAM = 'ws-stream';

export const DEFAULT_TRANSPORT_OPTIONS = Object.freeze({
    sseDataPrefix: 'data:',
    sseDoneToken: '[DONE]',
    sseDeltaPath: '',
    sseDelimiter: '\n\n',
    wsMessagePath: '',
    wsDoneToken: '[DONE]'
});

// ===================================================================
// Other constants
// ===================================================================
export const NODE_IO_ENVELOPE_VERSION = '1.0';
export const DEFAULT_IMAGE_DISPATCH_INTERVAL_SECONDS = 2;
export const MAX_CUSTOM_PARAMS = 30;
export const INTERNAL_CUSTOM_PARAM_NAMES = new Set([
    'tapnow_image_concurrency',
    'tapnow_concurrency',
    'image_concurrency'
]);
export const TEMPLATE_VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)(?::([a-zA-Z0-9_-]+))?\s*\}\}/g;

// ===================================================================
// extractModelTextContent(payload) - Extract text content from model response payloads
// ===================================================================
export const extractModelTextContent = (payload) => {
    if (!payload || typeof payload !== 'object') return '';
    const primaryMessage = payload?.choices?.[0]?.message || payload?.data?.choices?.[0]?.message;
    if (primaryMessage?.content !== undefined) {
        if (Array.isArray(primaryMessage.content)) {
            return primaryMessage.content
                .map((part) => (typeof part?.text === 'string' ? part.text : ''))
                .filter(Boolean)
                .join('\n');
        }
        return String(primaryMessage.content || '');
    }
    if (payload.content !== undefined) return String(payload.content || '');
    if (payload.text !== undefined) return String(payload.text || '');
    if (payload.message !== undefined) {
        return typeof payload.message === 'string'
            ? payload.message
            : String(payload.message?.content || '');
    }
    if (payload.result !== undefined) {
        return typeof payload.result === 'string'
            ? payload.result
            : String(payload.result?.content || '');
    }
    if (payload.data?.content !== undefined) return String(payload.data.content || '');
    if (payload.data?.text !== undefined) return String(payload.data.text || '');
    if (payload.data?.message !== undefined) {
        return typeof payload.data.message === 'string'
            ? payload.data.message
            : String(payload.data.message?.content || '');
    }
    if (payload.data?.result !== undefined) {
        return typeof payload.data.result === 'string'
            ? payload.data.result
            : String(payload.data.result?.content || '');
    }
    return '';
};

// ===================================================================
// getDefaultRatiosForModel(modelId) - Get applicable ratio options for a model
// NOTE: Depends on RATIOS and GROK_VIDEO_RATIOS constants defined in App.jsx (lines ~2950-2951).
// These are expected to be defined in the calling scope or should be imported separately.
// ===================================================================
export const getDefaultRatiosForModel = (modelId) => {
    if (!modelId) return RATIOS;
    if (modelId.includes('grok')) return GROK_VIDEO_RATIOS;
    return RATIOS;
};

// ===================================================================
// normalizeImageRouteMode(value) - Normalize image route mode
// ===================================================================
export const normalizeImageRouteMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === 'edit') return 'edit';
    if (mode === 't2i') return 't2i';
    return 'auto';
};

// ===================================================================
// normalizeImageBatchMode(value) - Normalize image batch mode
// ===================================================================
export const normalizeImageBatchMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (
        mode === IMAGE_BATCH_MODE_STANDARD_BATCH
        || mode === 'standard'
        || mode === 'batch'
        || mode === 'standardbatch'
    ) {
        return IMAGE_BATCH_MODE_STANDARD_BATCH;
    }
    return IMAGE_BATCH_MODE_PARALLEL_AGGREGATE;
};

// ===================================================================
// normalizeNativeMultiImageMode(value) - Normalize native multi-image mode
// ===================================================================
export const normalizeNativeMultiImageMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (
        mode === IMAGE_NATIVE_MULTI_IMAGE_MODE_FORCE
        || mode === 'force'
        || mode === 'native'
        || mode === 'enabled'
        || mode === 'on'
        || mode === 'true'
    ) {
        return IMAGE_NATIVE_MULTI_IMAGE_MODE_FORCE;
    }
    if (
        mode === IMAGE_NATIVE_MULTI_IMAGE_MODE_DISABLE
        || mode === 'disable'
        || mode === 'disabled'
        || mode === 'off'
        || mode === 'false'
    ) {
        return IMAGE_NATIVE_MULTI_IMAGE_MODE_DISABLE;
    }
    return IMAGE_NATIVE_MULTI_IMAGE_MODE_AUTO;
};

// ===================================================================
// normalizeResolutionOption(value) - Normalize resolution option string
// ===================================================================
export const normalizeResolutionOption = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();
    if (upper === 'AUTO') return 'Auto';
    if (upper === '1K' || upper === '2K' || upper === '4K') return upper;
    const sizeMatch = raw.match(/^(\d+)\s*[xX]\s*(\d+)$/);
    if (sizeMatch) return `${sizeMatch[1]}x${sizeMatch[2]}`;
    const kMatch = upper.match(/^(\d+)K$/);
    if (kMatch) return `${kMatch[1]}K`;
    return raw;
};

// ===================================================================
// normalizeImageResolution(value) - Normalize image resolution
// ===================================================================
export const normalizeImageResolution = (value) => {
    const normalized = normalizeResolutionOption(value);
    if (normalized) return normalized;
    return '2K';
};

// ===================================================================
// isExplicitImageResolution(value) - Check if resolution is explicit (WxH format)
// ===================================================================
export const isExplicitImageResolution = (value) => {
    const raw = String(value || '').trim();
    return /^\d+\s*[xX]\s*\d+$/.test(raw);
};

// ===================================================================
// normalizeVideoResolution(value) - Normalize video resolution
// ===================================================================
export const normalizeVideoResolution = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '720P';
    if (raw === '\u4E0D\u9009') return 'Auto';
    const upper = raw.toUpperCase();
    if (upper === 'AUTO') return 'Auto';
    if (upper.endsWith('P') || upper.endsWith('K')) return upper;
    return upper;
};

// ===================================================================
// normalizeVideoResolutionLower(value) - Normalize video resolution to lowercase
// ===================================================================
export const normalizeVideoResolutionLower = (value) => {
    const normalized = normalizeVideoResolution(value);
    if (!normalized || normalized === 'Auto') return '';
    return normalized.toLowerCase();
};

// ===================================================================
// isImageModelType(type) / isChatModelType(type) - Type checking helpers
// ===================================================================
export const isImageModelType = (type) => type === 'Image' || type === 'ChatImage';
export const isChatModelType = (type) => type === 'Chat' || type === 'ChatImage';

// ===================================================================
// getDefaultRequestTemplateForType(type) - Generate default request template by model type
// ===================================================================
export function getDefaultRequestTemplateForType(type) {
    const modelType = type || 'Chat';
    let endpoint = '/v1/images/generations';
    if (modelType === 'Video') endpoint = '/v1/videos/generations';
    if (modelType === 'Chat' || modelType === 'ChatImage') endpoint = '/v1/chat/completions';
    let body = {
        model: '{{modelName}}',
        prompt: '{{prompt}}'
    };
    if (modelType === 'Video') {
        body = {
            model: '{{modelName}}',
            prompt: '{{prompt}}',
            duration: '{{duration:number}}',
            ratio: '{{ratio}}',
            resolution: '{{resolution}}'
        };
    } else if (modelType === 'Chat' || modelType === 'ChatImage') {
        body = {
            model: '{{modelName}}',
            messages: '{{messages}}',
            stream: false
        };
    } else {
        body = {
            model: '{{modelName}}',
            prompt: '{{prompt}}',
            n: '{{n:number}}',
            size: '{{size}}'
        };
    }
    return {
        enabled: false,
        endpoint,
        method: 'POST',
        bodyType: 'json',
        headers: { 'Content-Type': 'application/json' },
        query: {},
        files: {},
        timeoutMs: null,
        responseParser: '',
        body
    };
}

// ===================================================================
// Model ID detection helpers
// ===================================================================
export const isOpenAIGptImage2ModelId = (value) => /^gpt-image-2(?:$|-)/i.test(String(value || '').trim());
export const isOpenAIGptImageModelId = (value) => /^gpt-image-(?:1(?:\.5|-mini)?|2)(?:$|-)/i.test(String(value || '').trim());

// ===================================================================
// isJimengVideoModelId(value) - Check if model ID is a Jimeng/Dreamina video model
// ===================================================================
export function isJimengVideoModelId(value) {
    const raw = String(value || '').toLowerCase();
    if (!raw) return false;
    return raw.includes('jimeng') || raw.includes('dreamina');
}

// ===================================================================
// getJimengVideoRequestTemplate() - Get request template for Jimeng video models
// ===================================================================
export function getJimengVideoRequestTemplate() {
    return {
        enabled: true,
        endpoint: '/v1/videos/generations',
        method: 'POST',
        bodyType: 'auto',
        headers: { 'Content-Type': 'application/json' },
        query: {},
        files: {
            image_file_1: '{{firstFrame:blob}}',
            image_file_2: '{{lastFrame:blob}}'
        },
        timeoutMs: null,
        responseParser: 'jimeng.video',
        body: {
            model: '{{modelName}}',
            prompt: '{{prompt}}',
            duration: '{{jimengDuration:number}}',
            ratio: '{{jimengRatio}}',
            resolution: '{{jimengResolution}}'
        }
    };
}

// ===================================================================
// getDefaultRequestTemplateForEntry(entry) - Get default template for a library entry
// ===================================================================
export function getDefaultRequestTemplateForEntry(entry) {
    const type = entry?.type || 'Chat';
    const id = entry?.id || entry?.modelName || '';
    if (type === 'Video' && isJimengVideoModelId(id)) {
        return getJimengVideoRequestTemplate();
    }
    return getDefaultRequestTemplateForType(type);
}

// ===================================================================
// Custom param utilities
// ===================================================================
export const getCustomParamSelection = (param, selections) => {
    if (!param) return '';
    if (selections) {
        const byId = param.id && selections[param.id];
        if (byId !== undefined && byId !== null && byId !== '') return byId;
        const byName = param.name && selections[param.name];
        if (byName !== undefined && byName !== null && byName !== '') return byName;
    }
    const fallback = param?.defaultValue ?? '';
    if (fallback !== undefined && fallback !== null && fallback !== '') return fallback;
    return '';
};

export const getValueLabelWithNotes = (value, notesEnabled, notes) => {
    if (!value) return '';
    if (!notesEnabled) return value;
    const note = notes?.[value];
    return note ? `${value}(${note})` : value;
};

export const getNoteLabelWithNotes = (value, notesEnabled, notes) => {
    if (!value) return '';
    if (!notesEnabled) return value;
    const note = notes?.[value];
    return note || value;
};

export const getCustomParamValueLabel = (param, value) => {
    return getValueLabelWithNotes(value, !!param?.notesEnabled, param?.valueNotes || {});
};

export const isCustomParamInputMode = (param) => {
    if (!param) return false;
    const rawName = String(param?.name || '');
    const name = rawName.toLowerCase();
    if (name.includes('input') || rawName.includes('\u8F93\u5165')) return true;
    const values = Array.isArray(param?.values) ? param.values : [];
    return values.some((value) => {
        const rawValue = String(value || '');
        return rawValue.toLowerCase().includes('input') || rawValue.includes('\u8F93\u5165');
    });
};

export const applyCustomParamsToPayload = (payload, customParams, selections) => {
    if (!payload || !Array.isArray(customParams) || customParams.length === 0) return payload;
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    customParams.forEach((param) => {
        const name = String(param?.name || '').trim();
        if (!name) return;
        if (INTERNAL_CUSTOM_PARAM_NAMES.has(name)) return;
        const value = getCustomParamSelection(param, selections);
        if (value === '' || value === undefined || value === null) return;
        if (isFormData) {
            if (param.override || !payload.has(name)) {
                payload.set(name, value);
            }
            return;
        }
        if (param.override || payload[name] === undefined) {
            payload[name] = value;
        }
    });
    return payload;
};

export const buildCustomParamPreviewPayload = (basePayload, customParams) => {
    if (!basePayload) return basePayload;
    if (!Array.isArray(customParams) || customParams.length === 0) return basePayload;
    const preview = { ...basePayload };
    customParams.forEach((param) => {
        const name = String(param?.name || '').trim();
        if (!name) return;
        if (INTERNAL_CUSTOM_PARAM_NAMES.has(name)) return;
        const value = Array.isArray(param.values) && param.values.length > 0 ? param.values[0] : '';
        if (value === '') return;
        if (param.override || preview[name] === undefined) {
            preview[name] = value;
        }
    });
    return preview;
};

// ===================================================================
// Custom param normalization
// ===================================================================
export const normalizeCustomParamNotes = (notes) => {
    if (!notes || typeof notes !== 'object') return {};
    const next = {};
    Object.entries(notes).forEach(([value, note]) => {
        const key = String(value || '').trim();
        const text = typeof note === 'string' ? note.trim() : '';
        if (key && text) next[key] = text;
    });
    return next;
};

export const normalizeValueNotes = (notes) => normalizeCustomParamNotes(notes);

export const normalizeResolutionNotes = (notes) => {
    if (!notes || typeof notes !== 'object') return {};
    const next = {};
    Object.entries(notes).forEach(([value, note]) => {
        const key = normalizeResolutionOption(value);
        const text = typeof note === 'string' ? note.trim() : '';
        if (key && text) next[key] = text;
    });
    return next;
};

export const normalizeCustomParams = (params) => {
    if (!Array.isArray(params)) return [];
    return params.map((param, index) => {
        if (!param) return null;
        const id = String(param.id || '').trim()
            || `param-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${index}`;
        const rawName = param?.name ?? param?.label ?? param?.displayName ?? param?.paramName ?? param?.key;
        const name = rawName !== undefined && rawName !== null ? String(rawName).trim() : '';
        const values = Array.isArray(param.values)
            ? param.values.map(value => String(value).trim()).filter(Boolean)
            : [];
        const rawDefault = param?.defaultValue ?? param?.default ?? '';
        const defaultValue = rawDefault === null || rawDefault === undefined
            ? ''
            : String(rawDefault).trim();
        const normalizedNotes = normalizeCustomParamNotes(param.valueNotes || param.valueLabels || param.notes);
        const notesEnabled = typeof param.notesEnabled === 'boolean'
            ? param.notesEnabled
            : Object.keys(normalizedNotes).length > 0;
        return {
            id,
            name,
            values,
            override: !!param.override,
            notesEnabled,
            valueNotes: normalizedNotes,
            defaultValue
        };
    }).filter(Boolean);
};

export const getImageSourceFallbackByParam = (paramName, imageSources = []) => {
    if (!paramName || !Array.isArray(imageSources) || imageSources.length === 0) return null;
    const lower = String(paramName).toLowerCase();
    let index = null;
    if (lower.includes('imagea')) index = 0;
    else if (lower.includes('imageb')) index = 1;
    else if (lower.includes('imagec')) index = 2;
    else if (lower.includes('imaged')) index = 3;
    if (index === null) {
        const numberMatch = lower.match(/image(?:_|-)?(\d+)/);
        if (numberMatch) {
            const parsed = parseInt(numberMatch[1], 10);
            if (Number.isFinite(parsed) && parsed > 0) index = parsed - 1;
        }
    }
    if (index === null) return null;
    return imageSources[index] || null;
};

// ===================================================================
// Image concurrency utilities
// ===================================================================
export const normalizeImageConcurrency = (value) => {
    const parsed = parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(parsed, 9));
};

export const applyImageBatchCountToPayload = (payload, imageCount) => {
    const safeCount = normalizeImageConcurrency(imageCount);
    if (safeCount <= 1 || payload === null || payload === undefined) return payload;
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
        payload.set('n', String(safeCount));
        return payload;
    }
    if (typeof payload === 'string') {
        const trimmed = payload.trim();
        if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return payload;
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsed.n = safeCount;
                return JSON.stringify(parsed);
            }
            return payload;
        } catch (e) {
            return payload;
        }
    }
    if (typeof payload === 'object' && !Array.isArray(payload)) {
        return { ...payload, n: safeCount };
    }
    return payload;
};

export const normalizeImageDispatchIntervalSeconds = (value, fallback = DEFAULT_IMAGE_DISPATCH_INTERVAL_SECONDS) => {
    const parsed = parseFloat(String(value ?? '').trim());
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(parsed, 30));
};

export const waitForMilliseconds = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

export const resolveImageConcurrencyFromCustomParams = (customParams, selections, fallback = 1) => {
    const safeFallback = normalizeImageConcurrency(fallback);
    if (!Array.isArray(customParams) || customParams.length === 0) return safeFallback;
    for (const param of customParams) {
        const name = String(param?.name || '').trim();
        if (!name || !INTERNAL_CUSTOM_PARAM_NAMES.has(name)) continue;
        const value = getCustomParamSelection(param, selections || {});
        if (value === '' || value === undefined || value === null) continue;
        return normalizeImageConcurrency(value);
    }
    return safeFallback;
};

// ===================================================================
// Throttle/detection utilities
// ===================================================================
export const detectThrottleSignalsFromError = (message = '') => {
    const text = String(message || '');
    const is429 = /(^|[^\d])429([^\d]|$)/.test(text) || /too many requests/i.test(text);
    const isTimeout = /timeout|timed out|\u8D85\u65F6/i.test(text);
    return {
        http429Count: is429 ? 1 : 0,
        timeoutCount: isTimeout ? 1 : 0
    };
};

// ===================================================================
// Template variable resolution
// ===================================================================
export const getTemplateVarValue = (vars, path) => {
    if (!vars || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), vars);
};

export const coerceTemplateValue = (value, type, options = {}) => {
    if (type === 'number') {
        if (value === null || value === undefined || value === '') return value;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
        return Number.isFinite(parsed) ? parsed : value;
    }
    if (type === 'string') {
        return value === null || value === undefined ? '' : String(value);
    }
    if (type === 'blob') {
        if (options.bodyType === 'json' && options.fallbackBlobAsDataUrl) {
            return options.fallbackBlobAsDataUrl;
        }
        return value;
    }
    return value;
};

// ===================================================================
// Path-based value extraction helpers
// ===================================================================
export const getValueByPath = (data, path) => {
    if (!data || !path) return undefined;
    const normalizedPath = String(path).replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
    const parts = normalizedPath.split('.').filter(Boolean);
    let current = data;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
};

export const getValueByPathLoose = (data, path) => {
    const raw = String(path || '').trim();
    if (!raw) return undefined;
    const normalizedPath = raw.replace(/^\$\.?/, '');
    return getValueByPath(data, normalizedPath);
};

export const getValueByPathAny = (data, paths) => {
    if (!paths || paths.length === 0) return undefined;
    for (const path of paths) {
        const value = getValueByPath(data, path);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
};

// ===================================================================
// resolveTemplateString(value, vars, options) - Resolve {{varName}} template placeholders
// ===================================================================
export const resolveTemplateString = (value, vars, options = {}) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    const singleMatch = trimmed.match(/^{{\s*([a-zA-Z0-9_.-]+)(?::([a-zA-Z0-9_-]+))?\s*}}$/);
    if (singleMatch) {
        const [, varName, varType] = singleMatch;
        const fallbackBlob = varType === 'blob'
            ? (getTemplateVarValue(vars, `${varName}DataUrl`) || getTemplateVarValue(vars, `${varName}DataURL`))
            : undefined;
        const raw = getTemplateVarValue(vars, varType === 'blob' ? `${varName}Blob` : varName);
        return coerceTemplateValue(raw, varType, { bodyType: options.bodyType, fallbackBlobAsDataUrl: fallbackBlob });
    }
    return value.replace(TEMPLATE_VAR_PATTERN, (matchText, varName, varType, offset) => {
        const fallbackBlob = varType === 'blob'
            ? (getTemplateVarValue(vars, `${varName}DataUrl`) || getTemplateVarValue(vars, `${varName}DataURL`))
            : undefined;
        const raw = getTemplateVarValue(vars, varType === 'blob' ? `${varName}Blob` : varName);
        const coerced = coerceTemplateValue(raw, varType, { bodyType: options.bodyType, fallbackBlobAsDataUrl: fallbackBlob });
        if (coerced === null || coerced === undefined) {
            if (options.bodyType === 'raw') {
                const prevChar = value[offset - 1];
                const nextChar = value[offset + matchText.length];
                if (prevChar === '"' && nextChar === '"') {
                    return '';
                }
                return 'null';
            }
            return '';
        }
        if (typeof coerced === 'object') {
            try {
                return JSON.stringify(coerced);
            } catch (e) {
                return '';
            }
        }
        return String(coerced);
    });
};

// ===================================================================
// resolveTemplateValue(value, vars, options) - Recursively resolve template vars in any structure
// ===================================================================
export const resolveTemplateValue = (value, vars, options = {}) => {
    if (Array.isArray(value)) {
        return value.map((item) => resolveTemplateValue(item, vars, options));
    }
    if (value && typeof value === 'object' && !(value instanceof Blob) && !(value instanceof File)) {
        const next = {};
        Object.entries(value).forEach(([key, val]) => {
            next[key] = resolveTemplateValue(val, vars, options);
        });
        return next;
    }
    if (typeof value === 'string') {
        return resolveTemplateString(value, vars, options);
    }
    return value;
};

// ===================================================================
// appendQueryParams(endpoint, query) - Append query parameters to a URL/endpoint
// ===================================================================
export const appendQueryParams = (endpoint, query) => {
    if (!endpoint || !query || typeof query !== 'object') return endpoint;
    const entries = Object.entries(query).filter(([key, val]) => key);
    if (entries.length === 0) return endpoint;
    const isAbsolute = /^https?:/i.test(endpoint);
    const base = isAbsolute ? undefined : 'http://placeholder';
    let urlObj;
    try {
        urlObj = new URL(endpoint, base);
    } catch (e) {
        return endpoint;
    }
    entries.forEach(([key, val]) => {
        if (val === undefined || val === null || val === '') return;
        if (Array.isArray(val)) {
            val.forEach((item) => {
                if (item === undefined || item === null || item === '') return;
                urlObj.searchParams.append(key, String(item));
            });
            return;
        }
        urlObj.searchParams.set(key, String(val));
    });
    if (isAbsolute) return urlObj.toString();
    const path = urlObj.pathname || '';
    const search = urlObj.search || '';
    const hash = urlObj.hash || '';
    return `${path}${search}${hash}`;
};

// ===================================================================
// compactTemplateObject(value) - Remove undefined/null entries from template-resolved objects
// ===================================================================
export const compactTemplateObject = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => compactTemplateObject(item))
            .filter((item) => item !== undefined && item !== null);
    }
    if (value && typeof value === 'object' && !(value instanceof Blob) && !(value instanceof File)) {
        const next = {};
        Object.entries(value).forEach(([key, val]) => {
            if (!key) return;
            const cleaned = compactTemplateObject(val);
            if (cleaned === undefined || cleaned === null) return;
            next[key] = cleaned;
        });
        return next;
    }
    return value;
};

// ===================================================================
// hasBinaryTemplateValue(value) - Check if a resolved template value contains binary data
// ===================================================================
export const hasBinaryTemplateValue = (value) => {
    if (!value) return false;
    if (value instanceof Blob || value instanceof File) return true;
    if (typeof value === 'string' && value.startsWith('data:')) return true;
    if (Array.isArray(value)) return value.some((item) => hasBinaryTemplateValue(item));
    if (typeof value === 'object') {
        return Object.values(value).some((item) => hasBinaryTemplateValue(item));
    }
    return false;
};

// ===================================================================
// Data URL utilities (used by buildRequestFromTemplate for multipart body construction)
// ===================================================================
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

// ===================================================================
// buildRequestFromTemplate(template, vars, options) - Resolve a request template into an actual request
// ===================================================================
export const buildRequestFromTemplate = (template, vars, options = {}) => {
    if (!template) return null;
    const rawBodyType = (template.bodyType || 'json').toString().toLowerCase();
    const method = (template.method || 'POST').toString().toUpperCase();
    const resolveTemplateWith = (bodyTypeForResolve) => ({
        resolvedEndpoint: resolveTemplateString(template.endpoint || '', vars, { bodyType: bodyTypeForResolve }),
        headers: compactTemplateObject(resolveTemplateValue(template.headers || {}, vars, { bodyType: bodyTypeForResolve })),
        resolvedQuery: compactTemplateObject(resolveTemplateValue(template.query || {}, vars, { bodyType: bodyTypeForResolve })),
        resolvedBody: compactTemplateObject(resolveTemplateValue(template.body || {}, vars, { bodyType: bodyTypeForResolve })),
        resolvedFiles: compactTemplateObject(resolveTemplateValue(template.files || {}, vars, { bodyType: bodyTypeForResolve }))
    });
    const resolveBodyType = rawBodyType === 'auto' ? 'multipart' : rawBodyType;
    let { resolvedEndpoint, headers, resolvedQuery, resolvedBody, resolvedFiles } = resolveTemplateWith(resolveBodyType);
    let bodyType = rawBodyType === 'auto'
        ? (hasBinaryTemplateValue(resolvedBody) || hasBinaryTemplateValue(resolvedFiles) ? 'multipart' : 'json')
        : rawBodyType;
    if (rawBodyType === 'auto' && bodyType === 'json') {
        ({ resolvedEndpoint, headers, resolvedQuery, resolvedBody, resolvedFiles } = resolveTemplateWith('json'));
    }
    let body = resolvedBody;
    if (bodyType === 'multipart') {
        const form = new FormData();
        Object.entries(resolvedBody || {}).forEach(([key, val]) => {
            if (val === undefined || val === null || key === '') return;
            if (Array.isArray(val)) {
                val.forEach((item) => {
                    if (item === undefined || item === null) return;
                    if (item instanceof Blob || item instanceof File) {
                        form.append(key, item, item.name || 'file');
                    } else if (typeof item === 'object') {
                        form.append(key, JSON.stringify(item));
                    } else {
                        form.append(key, String(item));
                    }
                });
                return;
            }
            if (val instanceof Blob || val instanceof File) {
                form.append(key, val, val.name || 'file');
            } else if (typeof val === 'object') {
                form.append(key, JSON.stringify(val));
            } else {
                form.append(key, String(val));
            }
        });
        Object.entries(resolvedFiles || {}).forEach(([key, val]) => {
            if (!key || val === undefined || val === null) return;
            const appendFile = (fileVal) => {
                if (!fileVal) return;
                if (fileVal instanceof Blob || fileVal instanceof File) {
                    form.append(key, fileVal, fileVal.name || 'file');
                    return;
                }
                if (typeof fileVal === 'string' && fileVal.startsWith('data:')) {
                    try {
                        const blob = dataUrlToBlob(fileVal);
                        form.append(key, blob, 'file');
                    } catch (e) { /* ignore */ }
                }
            };
            if (Array.isArray(val)) {
                val.forEach(appendFile);
                return;
            }
            appendFile(val);
        });
        body = form;
    } else if (bodyType === 'raw') {
        if (typeof body !== 'string') {
            body = JSON.stringify(body ?? {});
        }
    }
    return {
        url: appendQueryParams(resolvedEndpoint, resolvedQuery),
        method,
        headers,
        body,
        bodyType,
        timeoutMs: Number.isFinite(template.timeoutMs) ? Number(template.timeoutMs) : null,
        responseParser: template.responseParser || ''
    };
};

// ===================================================================
// normalizeRequestTemplate(template) - Normalize/validate a request template object
// ===================================================================
export const normalizeRequestTemplate = (template) => {
    if (!template || typeof template !== 'object') return null;
    const normalized = {
        enabled: template.enabled !== false,
        endpoint: typeof template.endpoint === 'string' ? template.endpoint.trim() : '',
        method: (template.method || 'POST').toString().toUpperCase(),
        bodyType: (template.bodyType || 'json').toString().toLowerCase(),
        headers: (template.headers && typeof template.headers === 'object' && !Array.isArray(template.headers))
            ? { ...template.headers }
            : {},
        query: (template.query && typeof template.query === 'object' && !Array.isArray(template.query))
            ? { ...template.query }
            : {},
        files: (template.files && typeof template.files === 'object' && !Array.isArray(template.files))
            ? { ...template.files }
            : {},
        timeoutMs: Number.isFinite(template.timeoutMs) ? Number(template.timeoutMs) : null,
        responseParser: typeof template.responseParser === 'string' ? template.responseParser.trim() : '',
        body: (template.body && typeof template.body === 'object' && !Array.isArray(template.body))
            ? template.body
            : (template.body ?? {})
    };
    return normalized;
};

// ===================================================================
// normalizeTransportMode(transport) - Normalize transport mode string
// ===================================================================
export const normalizeTransportMode = (transport) => {
    const raw = String(transport || '').trim().toLowerCase();
    if (raw === TRANSPORT_HTTP_SSE || raw === 'sse' || raw === 'http_sse') return TRANSPORT_HTTP_SSE;
    if (raw === TRANSPORT_WS_STREAM || raw === 'ws' || raw === 'websocket' || raw === 'ws_stream') return TRANSPORT_WS_STREAM;
    return TRANSPORT_HTTP_JSON;
};

// ===================================================================
// normalizeTransportOptions(options) - Normalize transport options
// ===================================================================
export const normalizeTransportOptions = (options) => {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return { ...DEFAULT_TRANSPORT_OPTIONS };
    }
    return {
        sseDataPrefix: String(options.sseDataPrefix || DEFAULT_TRANSPORT_OPTIONS.sseDataPrefix),
        sseDoneToken: String(options.sseDoneToken || DEFAULT_TRANSPORT_OPTIONS.sseDoneToken),
        sseDeltaPath: String(options.sseDeltaPath || ''),
        sseDelimiter: String(options.sseDelimiter || DEFAULT_TRANSPORT_OPTIONS.sseDelimiter),
        wsMessagePath: String(options.wsMessagePath || ''),
        wsDoneToken: String(options.wsDoneToken || DEFAULT_TRANSPORT_OPTIONS.wsDoneToken)
    };
};

// ===================================================================
// normalizeRequestChainExtract(extract) - Normalize chain step extract config
// ===================================================================
export const normalizeRequestChainExtract = (extract) => {
    if (!extract) return {};
    if (Array.isArray(extract)) {
        const mapped = {};
        extract.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const targetKey = String(item.to || item.key || item.var || item.name || '').trim();
            const sourcePath = String(item.path || item.from || item.value || '').trim();
            if (!targetKey || !sourcePath) return;
            mapped[targetKey] = sourcePath;
        });
        return mapped;
    }
    if (typeof extract === 'object') {
        const mapped = {};
        Object.entries(extract).forEach(([targetKey, sourcePath]) => {
            const key = String(targetKey || '').trim();
            const path = String(sourcePath || '').trim();
            if (!key || !path) return;
            mapped[key] = path;
        });
        return mapped;
    }
    return {};
};

// ===================================================================
// normalizeRequestChainStep(step, index) - Normalize a single chain step
// ===================================================================
export const normalizeRequestChainStep = (step, index = 0) => {
    if (!step || typeof step !== 'object') return null;
    const typeRaw = String(step.type || 'http').trim().toLowerCase();
    const type = typeRaw === 'transform' ? 'transform' : 'http';
    const id = String(step.id || step.name || `step-${index + 1}`).trim() || `step-${index + 1}`;
    const onErrorRaw = String(step.onError || step.errorStrategy || 'stop').trim().toLowerCase();
    const onError = ['stop', 'continue', 'fallback'].includes(onErrorRaw) ? onErrorRaw : 'stop';
    const fallbackVars = step.fallbackVars && typeof step.fallbackVars === 'object' && !Array.isArray(step.fallbackVars)
        ? { ...step.fallbackVars }
        : {};

    if (type === 'transform') {
        const assign = step.assign && typeof step.assign === 'object' && !Array.isArray(step.assign)
            ? step.assign
            : {};
        return {
            id,
            type,
            onError,
            assign,
            extract: normalizeRequestChainExtract(step.extract),
            fallbackVars
        };
    }

    const requestRaw = step.request || step.template || step.requestTemplate || step.http || step;
    const request = normalizeRequestTemplate({ ...requestRaw, enabled: true });
    return {
        id,
        type,
        onError,
        request,
        extract: normalizeRequestChainExtract(step.extract),
        transport: normalizeTransportMode(step.transport),
        transportOptions: normalizeTransportOptions(step.transportOptions),
        fallbackVars
    };
};

// ===================================================================
// normalizeRequestChain(chain) - Normalize a full request chain
// ===================================================================
export const normalizeRequestChain = (chain) => {
    if (!chain || typeof chain !== 'object') return null;
    const steps = Array.isArray(chain.steps)
        ? chain.steps.map((step, idx) => normalizeRequestChainStep(step, idx)).filter(Boolean)
        : [];
    return {
        enabled: chain.enabled === true,
        steps
    };
};

// ===================================================================
// normalizeAsyncRequestTemplate(template) - Normalize an async polling request template
// ===================================================================
export const normalizeAsyncRequestTemplate = (template) => {
    if (!template || typeof template !== 'object') return null;
    return normalizeRequestTemplate({ ...template, enabled: true });
};

// ===================================================================
// coerceAsyncRequestTemplate(value, defaultMethod) - Coerce async request template from various formats
// ===================================================================
export const coerceAsyncRequestTemplate = (value, defaultMethod = 'GET') => {
    if (!value) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const hasRequestId = /\{\{\s*requestId\s*\}\}/i.test(trimmed)
            || /requestId=|request_id=|taskId=/.test(trimmed);
        const endpoint = hasRequestId
            ? trimmed
            : `${trimmed}${trimmed.includes('?') ? '&' : '?'}requestId={{requestId}}`;
        return normalizeRequestTemplate({ endpoint, method: defaultMethod });
    }
    if (typeof value === 'object') {
        return normalizeAsyncRequestTemplate(value);
    }
    return null;
};

// ===================================================================
// normalizeAsyncConfig(config) - Normalize async polling configuration
// ===================================================================
export const normalizeAsyncConfig = (config) => {
    if (!config || typeof config !== 'object') return null;
    const normalized = {
        enabled: config.enabled === true,
        requestIdPaths: normalizeStringArray(config.requestIdPaths || config.requestIdPath || config.requestId),
        pollIntervalMs: Number.isFinite(Number(config.pollIntervalMs)) ? Number(config.pollIntervalMs) : 3000,
        maxAttempts: Number.isFinite(Number(config.maxAttempts)) ? Number(config.maxAttempts) : 300,
        statusRequest: coerceAsyncRequestTemplate(config.statusRequest || config.status || config.pollRequest || config.detail),
        statusPath: typeof config.statusPath === 'string' ? config.statusPath.trim() : '',
        successValues: normalizeStringArray(config.successValues || config.successStatuses || config.successStatus || config.success),
        failureValues: normalizeStringArray(config.failureValues || config.failureStatuses || config.failureStatus || config.failure),
        outputsRequest: coerceAsyncRequestTemplate(config.outputsRequest || config.outputs || config.resultRequest),
        outputsPath: typeof config.outputsPath === 'string' ? config.outputsPath.trim() : '',
        outputsUrlField: typeof config.outputsUrlField === 'string' ? config.outputsUrlField.trim() : '',
        errorPath: typeof config.errorPath === 'string' ? config.errorPath.trim() : ''
    };
    if (!normalized.requestIdPaths.length) {
        normalized.requestIdPaths = ['requestId', 'request_id', 'data.requestId', 'data.request_id'];
    }
    normalized.successValues = normalized.successValues.length
        ? normalized.successValues.map(v => v.toUpperCase())
        : ['SUCCESS', 'SUCCEED', 'COMPLETED', 'FINISHED', 'DONE'];
    normalized.failureValues = normalized.failureValues.length
        ? normalized.failureValues.map(v => v.toUpperCase())
        : ['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'FAILURE'];
    return normalized;
};

// ===================================================================
// normalizeStringArray(value) - Normalize to string array
// ===================================================================
export const normalizeStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }
    return [];
};

// ===================================================================
// applyRequestOverridePatch(request, patch) - Apply an override patch to a request
// ===================================================================
export const applyRequestOverridePatch = (request, patch) => {
    if (!request || !patch || typeof patch !== 'object') return request;
    const next = { ...request };
    Object.entries(patch).forEach(([key, value]) => {
        if (!key) return;
        if (value === null) {
            delete next[key];
        } else {
            next[key] = value;
        }
    });
    return next;
};

// ===================================================================
// coerceFormDataFromObject(data) - Convert an object to FormData
// ===================================================================
export const coerceFormDataFromObject = (data) => {
    if (typeof FormData === 'undefined') return data;
    if (data instanceof FormData) return data;
    const form = new FormData();
    const entries = data && typeof data === 'object' ? Object.entries(data) : [];
    entries.forEach(([key, val]) => {
        if (val === undefined || val === null || key === '') return;
        if (Array.isArray(val)) {
            val.forEach((item) => {
                if (item === undefined || item === null) return;
                if (item instanceof Blob || item instanceof File) {
                    form.append(key, item, item.name || 'file');
                } else if (typeof item === 'object') {
                    form.append(key, JSON.stringify(item));
                } else {
                    form.append(key, String(item));
                }
            });
            return;
        }
        if (val instanceof Blob || val instanceof File) {
            form.append(key, val, val.name || 'file');
        } else if (typeof val === 'object') {
            form.append(key, JSON.stringify(val));
        } else {
            form.append(key, String(val));
        }
    });
    return form;
};

// ===================================================================
// formatRequestPreview(request) - Format a request for preview display
// ===================================================================
export const formatRequestPreview = (request) => {
    if (!request) return null;
    const formatted = { ...request };
    if (request.body instanceof FormData) {
        const formEntries = {};
        request.body.forEach((value, key) => {
            if (!formEntries[key]) formEntries[key] = [];
            if (value instanceof Blob || value instanceof File) {
                formEntries[key].push('[Blob]');
            } else {
                formEntries[key].push(value);
            }
        });
        formatted.body = formEntries;
    }
    return formatted;
};

// ===================================================================
// getModelLibraryPreviewEndpoint(entry) - Get preview endpoint for a model library entry
// ===================================================================
export const getModelLibraryPreviewEndpoint = (entry) => {
    if (!entry) return '/v1/images/generations';
    if (entry.type === 'Video') return '/v1/videos/generations';
    if (entry.type === 'Chat' || entry.type === 'ChatImage') return '/v1/chat/completions';
    return '/v1/images/generations';
};

// ===================================================================
// normalizePreviewOverridePatch(patch) - Normalize a preview override patch
// ===================================================================
export const normalizePreviewOverridePatch = (patch) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return null;
    return { ...patch };
};

// ===================================================================
// isPreviewValueEqual(left, right) - Check equality of preview values (deep for objects)
// ===================================================================
export const isPreviewValueEqual = (left, right) => {
    if (left === right) return true;
    if (typeof left === 'object' || typeof right === 'object') {
        try {
            return JSON.stringify(left) === JSON.stringify(right);
        } catch (e) {
            return false;
        }
    }
    return false;
};

// ===================================================================
// buildPreviewOverridePatch(basePayload, editedPayload) - Build a patch from edited payload
// ===================================================================
export const buildPreviewOverridePatch = (basePayload, editedPayload) => {
    if (!basePayload || !editedPayload || typeof editedPayload !== 'object') return null;
    const patch = {};
    const baseKeys = new Set(Object.keys(basePayload));
    Object.keys(editedPayload).forEach((key) => {
        const editedValue = editedPayload[key];
        const baseValue = basePayload[key];
        if (!isPreviewValueEqual(baseValue, editedValue)) {
            patch[key] = editedValue;
        }
        baseKeys.delete(key);
    });
    baseKeys.forEach((key) => {
        patch[key] = null;
    });
    return Object.keys(patch).length > 0 ? patch : null;
};

// ===================================================================
// applyPreviewOverridePatch(payload, patch) - Apply an override patch to a payload
// ===================================================================
export const applyPreviewOverridePatch = (payload, patch) => {
    if (!payload || !patch || typeof patch !== 'object') return payload;
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    Object.entries(patch).forEach(([key, value]) => {
        if (!key) return;
        if (value === null) {
            if (isFormData) {
                payload.delete(key);
            } else {
                delete payload[key];
            }
            return;
        }
        if (isFormData) {
            const nextValue = typeof value === 'string' ? value : JSON.stringify(value);
            payload.set(key, nextValue);
            return;
        }
        payload[key] = value;
    });
    return payload;
};

// ===================================================================
// normalizeAsyncStatusValue(value) - Normalize async status value for comparison
// ===================================================================
export const normalizeAsyncStatusValue = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim().toUpperCase();
};

// ===================================================================
// extractAsyncOutputUrls(outputs, urlField) - Extract output URLs from async response
// ===================================================================
export const extractAsyncOutputUrls = (outputs, urlField) => {
    const urls = [];
    const pushUrl = (value) => {
        if (!value) return;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) urls.push(trimmed);
        }
    };
    const pushFromObject = (value) => {
        if (!value || typeof value !== 'object') return;
        if (urlField && value[urlField]) {
            pushUrl(value[urlField]);
            return;
        }
        const directUrl = value.url || value.image_url || value.imageUrl || value.object_url || value.objectUrl || value.path || value.uri || value.file_uri || value.fileUri;
        if (directUrl) pushUrl(directUrl);
        const base64Payload = value.b64_json || value.base64 || value.data;
        if (typeof base64Payload === 'string' && base64Payload.trim()) {
            pushUrl(base64Payload);
        }
    };
    if (Array.isArray(outputs)) {
        outputs.forEach((item) => {
            if (!item) return;
            if (typeof item === 'string') {
                pushUrl(item);
                return;
            }
            if (typeof item === 'object') {
                pushFromObject(item);
            }
        });
    } else if (outputs && typeof outputs === 'object') {
        pushFromObject(outputs);
    } else if (typeof outputs === 'string') {
        pushUrl(outputs);
    }
    return urls;
};

// ===================================================================
// isLikelyImagePayload(value) - Check if a value looks like an image payload
// ===================================================================
export const isLikelyImagePayload = (value) => {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return true;
    if (typeof LocalImageManager !== 'undefined' && LocalImageManager?.isImageId && LocalImageManager.isImageId(trimmed)) return true;
    const base64Like = /^[A-Za-z0-9+/=_-]+$/.test(trimmed);
    return base64Like && trimmed.length > 64;
};

// ===================================================================
// collectDeepImageValues(input, maxDepth) - Deeply collect image-like values from nested structures
// ===================================================================
export const collectDeepImageValues = (input, maxDepth = 6) => {
    const results = new Set();
    const visited = new WeakSet();
    const pushValue = (value) => {
        if (isLikelyImagePayload(value)) results.add(value.trim());
    };
    const walk = (obj, depth = 0) => {
        if (depth > maxDepth || obj === null || obj === undefined) return;
        if (typeof obj === 'string') {
            pushValue(obj);
            return;
        }
        if (typeof obj !== 'object') return;
        if (visited.has(obj)) return;
        visited.add(obj);
        const urlFields = ['url', 'image_url', 'imageUrl', 'image', 'src', 'link', 'href', 'object_url', 'objectUrl', 'path', 'uri', 'file_uri', 'fileUri', 'data', 'base64', 'b64_json'];
        for (const field of urlFields) {
            if (obj[field]) pushValue(obj[field]);
        }
        if (Array.isArray(obj)) {
            obj.forEach((item) => walk(item, depth + 1));
            return;
        }
        Object.values(obj).forEach((value) => walk(value, depth + 1));
    };
    walk(input, 0);
    return Array.from(results);
};

// ===================================================================
// collectImmediateImageUrls(data) - Collect immediate image URLs from top-level fields
// ===================================================================
export const collectImmediateImageUrls = (data) => {
    if (!data || typeof data !== 'object') return [];
    const urls = new Set();
    const pushUrl = (value) => {
        if (!value) return;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) urls.add(trimmed);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((entry) => pushUrl(entry));
            return;
        }
        if (typeof value === 'object') {
            const directUrl = value.url || value.image_url || value.imageUrl || value.object_url || value.objectUrl || value.path || value.uri || value.file_uri || value.fileUri;
            if (directUrl) pushUrl(directUrl);
            const b64 = value.b64_json || value.base64 || value.data || value.result;
            if (typeof b64 === 'string' && b64.trim()) {
                const trimmed = b64.trim();
                const base64Like = /^[A-Za-z0-9+/=]+$/.test(trimmed);
                urls.add(base64Like && trimmed.length > 64 ? `data:image/png;base64,${trimmed}` : trimmed);
            }
        }
    };
    if (Array.isArray(data)) {
        data.forEach((item) => pushUrl(item));
    } else {
        Object.values(data).forEach((value) => pushUrl(value));
    }
    return Array.from(urls);
};

// ===================================================================
// Component-scoped utility functions (extracted from React components)
// These were originally defined inside components via useCallback().
// Dependencies that were captured from component state are now explicit parameters.
// ===================================================================

// -------------------------------------------------------------------
// stripGoogleModelPrefix(value) - Strip "models/" prefix from model names
// Original dependency: none (empty deps array)
// -------------------------------------------------------------------
export const stripGoogleModelPrefix = (value) => {
    return String(value || '').trim().replace(/^models\//i, '');
};

// -------------------------------------------------------------------
// isOfficialGeminiProvider(providerKey, providers)
// Original dependency: providers (component state)
// -------------------------------------------------------------------
export const isOfficialGeminiProvider = (providerKey, providers = {}) => {
    if (!providerKey) return false;
    const provider = providers?.[providerKey];
    const baseUrl = String(provider?.url || '').trim().toLowerCase();
    return !!(provider?.officialApi || baseUrl.includes('generativelanguage.googleapis.com'));
};

// -------------------------------------------------------------------
// isGeminiAgentModelConfig(cfg, providers)
// Original dependencies: providers, stripGoogleModelPrefix
// -------------------------------------------------------------------
export const isGeminiAgentModelConfig = (cfg, providers = {}) => {
    if (!cfg || typeof cfg !== 'object') return false;
    const providerKey = cfg.provider || '';
    const providerApiType = String(cfg.apiType || providers?.[providerKey]?.apiType || '').toLowerCase();
    const modelId = stripGoogleModelPrefix(cfg.modelName || cfg.id || '').toLowerCase();
    return providerApiType === 'gemini' || providerKey === 'google' || modelId.includes('gemini');
};

// -------------------------------------------------------------------
// buildProxyUrl(targetUrl, providerKey, providers, localServerUrl)
// Original dependencies: providers, localServerUrl (component state)
// -------------------------------------------------------------------
export const buildProxyUrl = (targetUrl, providerKey, providers = {}, localServerUrl = '') => {
    if (!targetUrl) return targetUrl;
    const provider = providers[providerKey];
    if (!provider?.useProxy) return targetUrl;
    const base = (localServerUrl || '').trim().replace(/\/+$/, '');
    if (!base) return targetUrl;
    return `${base}/proxy?url=${encodeURIComponent(targetUrl)}`;
};

// -------------------------------------------------------------------
// getProxyPreferenceForUrl(url, fallback, deps)
// Original dependencies: historyUrlProxyMap, historyLocalCacheMap, localServerUrl,
//                        localCacheActive, isLocalCacheUrlAvailable, isComfyLocalUrl
// -------------------------------------------------------------------
// NOTE: This function depends on several runtime maps and utilities that are managed
// within the main App component. It is defined here as a reference but typically
// needs component-level state to function correctly.
export const getProxyPreferenceForUrl = (url, fallback = false, {
    historyUrlProxyMap = new Map(),
    historyLocalCacheMap = new Map(),
    localServerUrl = '',
    localCacheActive = false,
    isLocalCacheUrlAvailable = () => false,
    isComfyLocalUrl = () => false
} = {}) => {
    if (!url) return !!fallback;
    const raw = String(url);
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return false;
    const base = (localServerUrl || '').trim();
    if (base && raw.startsWith(base)) return false;
    if (localCacheActive && isComfyLocalUrl(raw)) return true;
    if (localCacheActive && historyLocalCacheMap.has(raw)) {
        const cached = historyLocalCacheMap.get(raw);
        if (cached && isLocalCacheUrlAvailable(cached)) return false;
    }
    if (historyUrlProxyMap.has(raw)) return !!historyUrlProxyMap.get(raw);
    return !!fallback;
};

// -------------------------------------------------------------------
// getBase64FromUrl(url, options)
// Original dependencies: resolveSpecialUrl, normalizeDataUrl, dataUrlToBlob,
//                        blobToDataURL, getBlobFromUrl (all component-scoped)
// -------------------------------------------------------------------
// NOTE: This function requires browser APIs (FileReader, Blob) and depends on
// several helper functions also defined within the App component:
//   - resolveSpecialUrl(url) - resolves special URL references
//   - dataUrlToBlob(dataUrl) - converts data URL to Blob
//   - normalizeDataUrl(url) - normalizes data URL format (exported from geometry.js or similar)
//   - blobToDataURL(blob) - converts Blob to data URL
//   - getBlobFromUrl(url, options) - fetches a URL and returns a Blob

// ===================================================================
// parseGeminiAssistantPayload(payload)
// Original dependencies: buildGeminiGroundingFooter, mimeTypeToFileExt (component-scoped)
// ===================================================================
// NOTE: parseGeminiAssistantPayload requires these component-scoped helpers:
//   - buildGeminiGroundingFooter(groundingMetadata)
//   - mimeTypeToFileExt(mimeType)
// These are defined inside the main App component and are not yet extracted.

// ===================================================================
// normalizeModelLibraryEntry(entry, index) - Complete model library entry normalizer
// NOTE: This function references many normalizers defined above.
// It is included here for reference; the full version spans lines 4605-4676 of App.jsx.
// ===================================================================
// See the full implementation in the App component (normalizeModelLibraryEntry)
