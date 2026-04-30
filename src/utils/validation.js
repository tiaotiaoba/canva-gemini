// Validation and capability schema functions
// Extracted from App.jsx (lines ~4404-4473)

import {
    normalizeRequestTemplate,
    normalizeRequestChain,
    normalizeTransportMode,
    getValueByPathLoose,
    TRANSPORT_HTTP_SSE,
    TRANSPORT_WS_STREAM,
    getDefaultRequestTemplateForEntry
} from './api';

// ===================================================================
// buildDefaultCapabilitySchema(type) - Build a default capability schema for a model type
// ===================================================================
export function buildDefaultCapabilitySchema(type) {
    const modelType = String(type || 'Chat');
    const isChat = modelType === 'Chat' || modelType === 'ChatImage';
    const isMedia = modelType === 'Image' || modelType === 'Video' || modelType === 'ChatImage';
    return {
        supportsMultipart: isMedia,
        supportsRequestChain: false,
        supportsSSE: false,
        supportsWS: false,
        supportsTools: isChat
    };
}

// ===================================================================
// normalizeCapabilitySchema(capabilities, type) - Normalize/validate a capability schema
// ===================================================================
export const normalizeCapabilitySchema = (capabilities, type) => {
    const defaults = buildDefaultCapabilitySchema(type);
    if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
        return defaults;
    }
    return {
        supportsMultipart: capabilities.supportsMultipart === true,
        supportsRequestChain: capabilities.supportsRequestChain === true,
        supportsSSE: capabilities.supportsSSE === true,
        supportsWS: capabilities.supportsWS === true,
        supportsTools: capabilities.supportsTools === true
    };
};

// ===================================================================
// validateModelLibraryContract(entry) - Validate a model library entry's contract
// Returns an array of issue objects: { level, code, message }
// ===================================================================
export const validateModelLibraryContract = (entry) => {
    const issues = [];
    if (!entry || typeof entry !== 'object') return issues;

    const capabilities = normalizeCapabilitySchema(entry.capabilities, entry.type);
    const requestTemplate = normalizeRequestTemplate(entry.requestTemplate || getDefaultRequestTemplateForEntry(entry));
    const requestChain = normalizeRequestChain(entry.requestChain);
    const transportMode = normalizeTransportMode(entry.transport);

    const bodyType = String(requestTemplate?.bodyType || '').toLowerCase();
    if (bodyType === 'multipart' && !capabilities.supportsMultipart) {
        issues.push({ level: 'error', code: 'cap_multipart', message: '\u6A21\u677F\u4F7F\u7528 multipart\uFF0C\u4F46 capabilities.supportsMultipart=false' });
    }
    if (requestChain?.enabled) {
        if (!capabilities.supportsRequestChain) {
            issues.push({ level: 'error', code: 'cap_chain', message: 'requestChain \u5DF2\u542F\u7528\uFF0C\u4F46 capabilities.supportsRequestChain=false' });
        }
        if (!Array.isArray(requestChain.steps) || requestChain.steps.length === 0) {
            issues.push({ level: 'error', code: 'chain_empty', message: 'requestChain \u5DF2\u542F\u7528\uFF0C\u4F46 steps \u4E3A\u7A7A' });
        }
    }
    if (transportMode === TRANSPORT_HTTP_SSE && !capabilities.supportsSSE) {
        issues.push({ level: 'error', code: 'cap_sse', message: 'transport=http-sse\uFF0C\u4F46 capabilities.supportsSSE=false' });
    }
    if (transportMode === TRANSPORT_WS_STREAM && !capabilities.supportsWS) {
        issues.push({ level: 'error', code: 'cap_ws', message: 'transport=ws-stream\uFF0C\u4F46 capabilities.supportsWS=false' });
    }
    const streamValue = getValueByPathLoose(requestTemplate?.body || {}, 'stream');
    if (transportMode === TRANSPORT_HTTP_SSE && streamValue !== true) {
        issues.push({ level: 'warning', code: 'sse_stream_flag', message: 'transport=http-sse \u5EFA\u8BAE body.stream=true' });
    }
    if (transportMode === TRANSPORT_WS_STREAM && requestTemplate?.endpoint && !/^wss?:\/\//i.test(String(requestTemplate.endpoint))) {
        issues.push({ level: 'warning', code: 'ws_endpoint', message: 'ws-stream \u5EFA\u8BAE endpoint \u4F7F\u7528 ws:// \u6216 wss://' });
    }
    let bodyText = '';
    try {
        bodyText = JSON.stringify(requestTemplate?.body || {});
    } catch {
        bodyText = '';
    }
    if (/"tools"\s*:|"tool_choice"\s*:|"search"\s*:/i.test(bodyText) && !capabilities.supportsTools) {
        issues.push({ level: 'error', code: 'cap_tools', message: '\u6A21\u677F\u5305\u542B tools/tool_choice/search \u5B57\u6BB5\uFF0C\u4F46 capabilities.supportsTools=false' });
    }

    return issues;
};
