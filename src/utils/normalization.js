// Extracted from App.jsx - Normalization/validation pure functions

import {
    CHAT_ASSISTANT_META_BLOCK_PATTERN,
    CHAT_RUNTIME_TOOL_KINDS,
    SIMPLE_NUMERIC_SHOT_ID_RE
} from './constants';

// --- Basic Math Utilities ---

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

// --- Text Rewrite Normalization ---

const normalizeTextRewriteRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'other';
    if (['brand', 'brandname', 'logo', '品牌', '品牌名', '商标'].includes(normalized)) return 'brandName';
    if (['headline', 'title', 'heading', '主标题', '标题', '大标题'].includes(normalized)) return 'headline';
    if (['subheadline', 'subtitle', 'subheading', '副标题', '副文案', '副标'].includes(normalized)) return 'subheadline';
    if (['body', 'bodycopy', 'copy', 'text', 'paragraph', '正文', '文案', '说明', '内容'].includes(normalized)) return 'body';
    if (['cta', 'calltoaction', 'button', 'action', '按钮', '行动按钮'].includes(normalized)) return 'callToAction';
    return 'other';
};

const normalizeTextRewriteUnit = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const absolute = Math.abs(numeric);
    if (absolute <= 1) return numeric * 1000;
    if (absolute <= 100) return numeric * 10;
    return numeric;
};

const normalizeTextRewriteBBox = (rawBox = {}) => {
    if (!rawBox || typeof rawBox !== 'object') return null;
    const left = rawBox.left ?? rawBox.x ?? rawBox.x1 ?? rawBox.l ?? 0;
    const top = rawBox.top ?? rawBox.y ?? rawBox.y1 ?? rawBox.t ?? 0;
    const width = rawBox.width ?? rawBox.w ?? rawBox.boxWidth ?? rawBox.bboxWidth;
    const height = rawBox.height ?? rawBox.h ?? rawBox.boxHeight ?? rawBox.bboxHeight;
    const right = rawBox.right ?? rawBox.x2;
    const bottom = rawBox.bottom ?? rawBox.y2;
    const normalizedX = clampNumber(Math.round(normalizeTextRewriteUnit(left)), 0, 1000);
    const normalizedY = clampNumber(Math.round(normalizeTextRewriteUnit(top)), 0, 1000);
    const normalizedRight = Number.isFinite(Number(right))
        ? clampNumber(Math.round(normalizeTextRewriteUnit(right)), 0, 1000)
        : null;
    const normalizedBottom = Number.isFinite(Number(bottom))
        ? clampNumber(Math.round(normalizeTextRewriteUnit(bottom)), 0, 1000)
        : null;
    const normalizedW = Number.isFinite(Number(width))
        ? clampNumber(Math.round(normalizeTextRewriteUnit(width)), 0, 1000)
        : (normalizedRight !== null ? clampNumber(normalizedRight - normalizedX, 0, 1000) : 0);
    const normalizedH = Number.isFinite(Number(height))
        ? clampNumber(Math.round(normalizeTextRewriteUnit(height)), 0, 1000)
        : (normalizedBottom !== null ? clampNumber(normalizedBottom - normalizedY, 0, 1000) : 0);
    if (normalizedW <= 0 || normalizedH <= 0) return null;
    return {
        x: normalizedX,
        y: normalizedY,
        w: normalizedW,
        h: normalizedH
    };
};

const normalizeTextRewriteBlocks = (rawBlocks = []) => {
    if (!Array.isArray(rawBlocks)) return [];
    return rawBlocks
        .map((block, index) => {
            if (!block || typeof block !== 'object') return null;
            const text = String(
                block.text
                ?? block.content
                ?? block.value
                ?? block.label
                ?? block.copy
                ?? ''
            )
                .replace(/\r/g, '')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            const bbox = normalizeTextRewriteBBox(
                block.bbox
                || block.box
                || block.rect
                || block.bounds
                || {
                    x: block.x,
                    y: block.y,
                    w: block.w ?? block.width,
                    h: block.h ?? block.height,
                    left: block.left,
                    top: block.top,
                    right: block.right,
                    bottom: block.bottom
                }
            );
            if (!text || !bbox) return null;
            const order = Number.isFinite(Number(block.order))
                ? Number(block.order)
                : (bbox.y * 1000 + bbox.x + index);
            return {
                id: String(block.id || `text-block-${index + 1}`),
                text,
                role: normalizeTextRewriteRole(block.role || block.kind || block.type),
                order,
                bbox
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);
};

const buildTextRewriteCopyDraft = (blocks = []) => {
    const list = Array.isArray(blocks) ? blocks : [];
    const getFirstByRole = (role) => list.find((item) => item.role === role)?.text || '';
    const bodyBlocks = list
        .filter((item) => item.role === 'body')
        .map((item) => item.text)
        .filter(Boolean);
    return {
        brandName: getFirstByRole('brandName'),
        headline: getFirstByRole('headline'),
        subheadline: getFirstByRole('subheadline'),
        body: bodyBlocks.join('\n'),
        callToAction: getFirstByRole('callToAction')
    };
};

// --- JSON Parsing ---

const parseLooseJsonObject = (rawText) => {
    const source = String(rawText || '').trim();
    if (!source) return null;
    const candidates = [];
    const fencedJson = source.match(/```json\s*([\s\S]*?)```/i);
    if (fencedJson?.[1]?.trim()) candidates.push(fencedJson[1].trim());
    const fencedAny = source.match(/```(?:javascript|js|text)?\s*([\s\S]*?)```/i);
    if (fencedAny?.[1]?.trim()) candidates.push(fencedAny[1].trim());
    candidates.push(source);
    const objectWindow = source.match(/\{[\s\S]*\}/);
    if (objectWindow?.[0]) candidates.push(objectWindow[0]);
    for (const candidate of candidates) {
        const cleaned = String(candidate || '').trim();
        if (!cleaned) continue;
        try {
            return JSON.parse(cleaned);
        } catch (error) {
            try {
                const repaired = cleaned
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/^\s*\/\/.*$/gm, '')
                    .replace(/,(\s*[}\]])/g, '$1')
                    .trim();
                if (!repaired) continue;
                return JSON.parse(repaired);
            } catch (repairError) { }
        }
    }
    return null;
};

// --- String Utilities ---

const mergeUniqueStrings = (...groups) => {
    const seen = new Set();
    const list = [];
    groups.flat().forEach((item) => {
        const normalized = String(item || '').trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        list.push(normalized);
    });
    return list;
};

const truncateByBytes = (value, maxBytes) => {
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

// --- Chat Assistant Meta Parsing ---

const normalizeChatSuggestedReplies = (value) => {
    if (Array.isArray(value)) {
        return mergeUniqueStrings(value)
            .filter((item) => item.length <= 120)
            .slice(0, 4);
    }
    if (typeof value === 'string') {
        return mergeUniqueStrings(
            value.split(/\r?\n|[|｜]/).map((item) => item.trim())
        )
            .filter((item) => item.length <= 120)
            .slice(0, 4);
    }
    return [];
};

const normalizeChatToolRequestItem = (value, index = 0) => {
    if (!value) return null;
    if (typeof value === 'string') {
        const toolId = value.trim();
        return toolId ? { id: `tool-request-${index + 1}`, tool: toolId, args: {} } : null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) return null;
    const toolId = String(value.tool || value.toolId || value.id || value.name || '').trim();
    if (!toolId) return null;
    const rawArgs = value.args || value.arguments || value.params || value.input || {};
    const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
        ? rawArgs
        : {};
    return {
        id: String(value.requestId || value.callId || value.id || `tool-request-${index + 1}`).trim() || `tool-request-${index + 1}`,
        tool: toolId,
        args
    };
};

const normalizeChatToolRequests = (value) => {
    const list = Array.isArray(value) ? value : [value];
    return list
        .map((item, index) => normalizeChatToolRequestItem(item, index))
        .filter(Boolean);
};

const extractChatAssistantWorkflowPayload = (meta) => {
    if (!meta || typeof meta !== 'object') return null;
    const direct = [
        meta.workflow,
        meta.workflowJson,
        meta.promptPayload,
        meta.promptSpec,
        meta.promptJson,
        meta.promptJSON,
        meta.actionablePrompt
    ].find((value) => (
        typeof value === 'string'
            ? value.trim()
            : (
                Array.isArray(value)
                    ? value.length > 0
                    : value && typeof value === 'object'
            )
    ));
    if (direct) return direct;
    const compiledPrompt = String(meta.compiledPrompt || '').trim();
    const editInstruction = String(meta.editInstruction || '').trim();
    const negativePrompt = String(meta.negativePrompt || '').trim();
    if (!compiledPrompt && !editInstruction && !negativePrompt) return null;
    return {
        apiPayload: {
            compiledPrompt,
            editInstruction,
            negativePrompt
        }
    };
};

const normalizeChatAssistantMeta = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {
            suggestedReplies: [],
            toolRequests: []
        };
    }
    const normalized = {
        suggestedReplies: normalizeChatSuggestedReplies(
            value.suggestedReplies
            || value.replyOptions
            || value.quickReplies
            || value.quickReply
        ),
        toolRequests: normalizeChatToolRequests(
            value.toolRequests
            || value.tool_calls
            || value.toolCalls
            || value.requests
        )
    };
    const workflowPayload = extractChatAssistantWorkflowPayload(value);
    if (workflowPayload) normalized.workflow = workflowPayload;
    return normalized;
};

const mergeChatAssistantMeta = (base = {}, extra = {}) => {
    const left = normalizeChatAssistantMeta(base);
    const right = normalizeChatAssistantMeta(extra);
    const workflow = extractChatAssistantWorkflowPayload(right) || extractChatAssistantWorkflowPayload(left) || null;
    return {
        ...left,
        ...right,
        workflow,
        suggestedReplies: mergeUniqueStrings(left.suggestedReplies || [], right.suggestedReplies || []).slice(0, 4),
        toolRequests: [...(left.toolRequests || []), ...(right.toolRequests || [])]
    };
};

const buildChatAssistantDisplayFallback = (meta) => {
    if (extractChatAssistantWorkflowPayload(meta)) {
        return '已整理好可执行提示词，可直接创建到画布。';
    }
    if ((meta?.suggestedReplies || []).length > 0) {
        return '我给你准备了几个继续推进的选项，可以直接点下面。';
    }
    if ((meta?.toolRequests || []).length > 0) {
        return '正在补充工具结果，请稍等。';
    }
    return '';
};

const parseChatAssistantEnvelope = (rawText) => {
    const source = String(rawText || '');
    if (!source.trim()) {
        return {
            rawText: '',
            displayText: '',
            meta: normalizeChatAssistantMeta(null)
        };
    }
    let mergedMeta = normalizeChatAssistantMeta(null);
    const cleanText = source.replace(CHAT_ASSISTANT_META_BLOCK_PATTERN, (_, block) => {
        const parsed = parseLooseJsonObject(block);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            mergedMeta = mergeChatAssistantMeta(mergedMeta, parsed);
        }
        return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
    return {
        rawText: source,
        displayText: cleanText || buildChatAssistantDisplayFallback(mergedMeta),
        meta: mergedMeta
    };
};

const resolveChatAssistantEnvelopeInput = (value) => {
    if (typeof value === 'string') {
        const envelope = parseChatAssistantEnvelope(value);
        return {
            rawText: envelope.rawText,
            displayText: envelope.displayText,
            meta: envelope.meta
        };
    }
    if (!value || typeof value !== 'object') {
        return {
            rawText: '',
            displayText: '',
            meta: normalizeChatAssistantMeta(null)
        };
    }
    const rawText = String(value.rawContent || value.rawText || value.content || '').trim();
    const displayText = String(value.content || '').trim();
    const meta = mergeChatAssistantMeta(
        rawText && !value.assistantMeta && !value.meta ? parseChatAssistantEnvelope(rawText).meta : null,
        value.assistantMeta || value.meta || null
    );
    return {
        rawText,
        displayText: displayText || buildChatAssistantDisplayFallback(meta),
        meta
    };
};

// --- Chat Runtime Tool Normalization ---

const normalizeChatRuntimeToolDefinition = (value, index = 0) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const kindRaw = String(value.kind || value.type || 'http').trim().toLowerCase();
    const kind = CHAT_RUNTIME_TOOL_KINDS.has(kindRaw) ? kindRaw : 'http';
    const id = String(value.id || value.tool || value.name || value.label || `${kind}-tool-${index + 1}`).trim();
    if (!id) return null;
    const timeoutMs = Number(value.timeoutMs);
    return {
        ...value,
        id,
        kind,
        label: String(value.label || value.name || id).trim() || id,
        name: String(value.name || value.label || id).trim() || id,
        description: String(value.description || value.summary || '').trim(),
        enabled: value.enabled !== false,
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : undefined
    };
};

const normalizeChatRuntimeToolDefinitions = (value) => {
    const parsed = typeof value === 'string' ? parseLooseJsonObject(value) : value;
    const list = Array.isArray(parsed) ? parsed : [];
    return list
        .map((item, index) => normalizeChatRuntimeToolDefinition(item, index))
        .filter(Boolean);
};

// --- Model Content Extraction ---

const extractModelTextContent = (payload) => {
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

// --- Data URL / Base64 Normalization ---

const normalizeBase64Payload = (value) => {
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

const normalizeDataUrl = (value) => {
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

const dataUrlToBlob = (dataUrl) => {
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

// --- Video URL Detection ---

const isVideoUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('data:video')) return true;
    if (url.includes('force_video_display=true')) return true;
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
};

// --- Storyboard Shot Normalization ---

const normalizeShotIdValue = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const isSameShotId = (a, b) => {
    const rawA = normalizeShotIdValue(a);
    const rawB = normalizeShotIdValue(b);
    if (!rawA || !rawB) return false;
    if (rawA === rawB) return true;
    if (!SIMPLE_NUMERIC_SHOT_ID_RE.test(rawA) || !SIMPLE_NUMERIC_SHOT_ID_RE.test(rawB)) return false;
    const numA = Number(rawA);
    const numB = Number(rawB);
    if (!Number.isFinite(numA) || !Number.isFinite(numB)) return false;
    if (Math.abs(numA - numB) < 1e-6) return true;
    return false;
};

const normalizeStoryboardOutputSnapshot = (shotLike) => {
    if (!shotLike || typeof shotLike !== 'object') return null;
    const explicitVideoUrl = String(shotLike.video_url || '').trim();
    const explicitImages = Array.isArray(shotLike.output_images)
        ? shotLike.output_images.map((url) => String(url || '').trim()).filter(Boolean)
        : [];
    const explicitOutputUrl = String(shotLike.output_url || '').trim();
    const mode = explicitVideoUrl || (explicitOutputUrl && isVideoUrl(explicitOutputUrl))
        ? 'video'
        : 'image';
    if (mode === 'video') {
        const videoUrl = explicitVideoUrl || explicitOutputUrl;
        if (!videoUrl) return null;
        return {
            mode: 'video',
            output_url: videoUrl,
            video_url: videoUrl,
            output_images: [],
            selectedImageIndex: -1
        };
    }
    const imageUrls = explicitImages.length > 0
        ? explicitImages
        : (explicitOutputUrl ? [explicitOutputUrl] : []);
    if (imageUrls.length === 0) return null;
    const selectedRaw = Number.isInteger(shotLike.selectedImageIndex)
        ? shotLike.selectedImageIndex
        : 0;
    const selectedImageIndex = Math.max(-1, Math.min(imageUrls.length - 1, selectedRaw));
    return {
        mode: 'image',
        output_url: imageUrls[0],
        video_url: '',
        output_images: imageUrls,
        selectedImageIndex
    };
};

const isSameStoryboardOutputSnapshot = (a, b) => {
    if (!a || !b) return false;
    if (a.mode !== b.mode) return false;
    if (String(a.output_url || '') !== String(b.output_url || '')) return false;
    if (String(a.video_url || '') !== String(b.video_url || '')) return false;
    const imagesA = Array.isArray(a.output_images) ? a.output_images : [];
    const imagesB = Array.isArray(b.output_images) ? b.output_images : [];
    if (imagesA.length !== imagesB.length) return false;
    for (let i = 0; i < imagesA.length; i += 1) {
        if (String(imagesA[i] || '') !== String(imagesB[i] || '')) return false;
    }
    return Number(a.selectedImageIndex ?? -1) === Number(b.selectedImageIndex ?? -1);
};

const materializeStoryboardOutputFromSnapshot = (snapshot, currentShot) => {
    const normalized = normalizeStoryboardOutputSnapshot(snapshot) || normalizeStoryboardOutputSnapshot(currentShot);
    if (!normalized) return null;
    if (normalized.mode === 'video') {
        return {
            video_url: normalized.video_url,
            output_url: normalized.output_url,
            output_images: [],
            selectedImageIndex: -1
        };
    }
    const outputImages = Array.isArray(normalized.output_images) ? normalized.output_images : [];
    const safeIndex = Number.isInteger(normalized.selectedImageIndex)
        ? Math.max(-1, Math.min(outputImages.length - 1, normalized.selectedImageIndex))
        : (outputImages.length > 0 ? 0 : -1);
    return {
        video_url: '',
        output_images: outputImages,
        output_url: outputImages[0] || '',
        selectedImageIndex: safeIndex
    };
};

export {
    clampNumber,
    clampValue,
    normalizeTextRewriteRole,
    normalizeTextRewriteUnit,
    normalizeTextRewriteBBox,
    normalizeTextRewriteBlocks,
    buildTextRewriteCopyDraft,
    parseLooseJsonObject,
    mergeUniqueStrings,
    truncateByBytes,
    normalizeChatSuggestedReplies,
    normalizeChatToolRequestItem,
    normalizeChatToolRequests,
    extractChatAssistantWorkflowPayload,
    normalizeChatAssistantMeta,
    mergeChatAssistantMeta,
    buildChatAssistantDisplayFallback,
    parseChatAssistantEnvelope,
    resolveChatAssistantEnvelopeInput,
    normalizeChatRuntimeToolDefinition,
    normalizeChatRuntimeToolDefinitions,
    extractModelTextContent,
    normalizeBase64Payload,
    normalizeDataUrl,
    dataUrlToBlob,
    isVideoUrl,
    normalizeShotIdValue,
    isSameShotId,
    normalizeStoryboardOutputSnapshot,
    isSameStoryboardOutputSnapshot,
    materializeStoryboardOutputFromSnapshot,
};
