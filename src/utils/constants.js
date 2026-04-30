// Extracted from App.jsx - All constants

import i18n from '../i18n';

const t = i18n.t.bind(i18n);

const DEFAULT_VIEW = { x: 0, y: 0, zoom: 1 };

const TEXT_REWRITE_ROLE_LABELS = Object.freeze({
    brandName: '品牌名',
    headline: '大标题',
    subheadline: '副标题',
    body: '正文',
    callToAction: 'CTA',
    other: '其他'
});
const LOCAL_EDIT_ACTION_LABELS = Object.freeze({
    repair: '修复/清理',
    replace: '替换/改成',
    erase: '擦除/移除',
    material: '按素材替换'
});

const CHAT_ASSISTANT_META_BLOCK_PATTERN = /```(?:tapnow-meta|tapnow_meta|tapnowmeta)\s*([\s\S]*?)```/gi;
const CHAT_RUNTIME_TOOL_KINDS = new Set(['mcp', 'cli', 'skill', 'http', 'builtin']);

// --- 虚拟画布尺寸 ---
const VIRTUAL_CANVAS_WIDTH = 4000;
const VIRTUAL_CANVAS_HEIGHT = 4000;
const IMAGE_TASK_TIMEOUT_MS = 60 * 1000;
const VIDEO_TASK_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_NODE_WIDTH = 220;
const MIN_NODE_HEIGHT = 160;

// --- 默认配置 ---
const DEFAULT_BASE_URL = 'https://ai.comfly.chat';
const GOOGLE_OFFICIAL_BASE_URL = 'https://generativelanguage.googleapis.com';
const CHAT_CANVAS_CONTEXT_STORAGE_KEY = 'tapnow_chat_canvas_context_enabled';
const CHAT_AUTO_ATTACH_MEDIA_STORAGE_KEY = 'tapnow_chat_canvas_media_enabled';
const CHAT_GEMINI_THINKING_STORAGE_KEY = 'tapnow_chat_gemini_thinking';
const CHAT_GEMINI_SEARCH_STORAGE_KEY = 'tapnow_chat_gemini_search';
const CHAT_GEMINI_THINKING_BUDGET = 4096;
const CHAT_CANVAS_CONTEXT_MAX_NODES = 18;
const CHAT_CANVAS_CONTEXT_MAX_MEDIA = 8;
const CHAT_CANVAS_CONTEXT_MAX_SHOTS = 6;
const CHAT_CANVAS_CONTEXT_TEXT_LIMIT = 320;
const PROVIDER_MODEL_RENDER_STEP = 80;
const MODEL_LIBRARY_RENDER_STEP = 60;

const CHAT_AGENT_INTENT_MODES = Object.freeze({
    CONVERSATION: 'conversation',
    IDEATION: 'ideation',
    MATERIAL: 'material',
    TEXT: 'text',
    PLANNING: 'planning',
    EXECUTION: 'execution'
});
const CHAT_AGENT_INTENT_MODE_LABELS = Object.freeze({
    [CHAT_AGENT_INTENT_MODES.CONVERSATION]: '思考对话',
    [CHAT_AGENT_INTENT_MODES.IDEATION]: '创意共创',
    [CHAT_AGENT_INTENT_MODES.MATERIAL]: '素材分析',
    [CHAT_AGENT_INTENT_MODES.TEXT]: '文本处理',
    [CHAT_AGENT_INTENT_MODES.PLANNING]: '方案规划',
    [CHAT_AGENT_INTENT_MODES.EXECUTION]: '执行落地'
});

const CHAT_AGENT_FOLLOW_UP_PATTERN = /^(继续|再来|换一版|换个|多来|还有吗|然后|细化|展开|延展|深入|优化一下|改一下|偏向|那如果|或者|基于这个|照这个|按这个|再给我|多给我|补充)/i;
const CHAT_AGENT_EXECUTION_PATTERNS = [
    /(直接(生成|输出|给|做)|帮我(生成|输出|写|做)|给我(?:一版|一个|几个)?(?:提示词|prompt|json|工作流|节点配置)|输出(?:成|为)?\s*(?:json|prompt|提示词|工作流)|创建(?:到)?画布|落到节点|落地执行|开始做|开做)/i,
    /(生成(?:一张|一版|一组)?(?:主图|海报|KV|分镜|提示词|workflow|工作流)|做(?:一版|一组|一套)|出图|做图|产出(?:提示词|方案))/i,
    /\b(?:system_reasoning|api_payload|compiled_prompt|edit_instruction|negative_prompt)\b/i
];
const CHAT_AGENT_PLANNING_PATTERNS = [
    /(方案|策略|工作流|流程|步骤|拆解|规划|怎么做|怎么搭|节点编排|路线|主图结构|套图思路|分镜脚本|执行路径|plan|roadmap)/i
];
const CHAT_AGENT_MATERIAL_PATTERNS = [
    /(抓取|提取|整理|分析|识别|盘点|总结|归纳|拆一下|看看|读一下).{0,12}(素材|参考图|图片|图里|画面|元素|卖点|品牌|参数|信息|内容|视频|附件)/i,
    /(素材|参考图|这张图|这些图|这个视频|附件|资料包|产品图|详情页|海报|pdf|文档)/i
];
const CHAT_AGENT_TEXT_PATTERNS = [
    /(提取|识别|ocr|改写|润色|翻译|重写|扩写|压缩|整理|提炼|校对|转成表格|摘出).{0,10}(文案|文字|文本|标题|副标题|正文|口播|字幕|卖点|参数|copy|headline|text)/i,
    /\b(?:ocr|copywriting|headline|subheadline|voiceover|subtitle)\b/i
];
const CHAT_AGENT_IDEATION_PATTERNS = [
    /(创意|灵感|脑暴|脑洞|方向|风格|调性|概念|想法|一起想|聊聊|聊一下|有没有更好|还有什么可能|怎么更像|怎么更高级|主视觉方向|文案方向|品牌感|氛围感|参考方向)/i
];
const CHAT_AGENT_SEARCH_PATTERNS = [
    /(趋势|竞品|市场|行业|小红书|抖音|天猫|京东|淘宝|亚马逊|amazon|shopify|官网|review|测评|参数|最新|今年|最近|资料|品牌|对标)/i
];
const CHAT_AGENT_CANVAS_PATTERNS = [
    /(节点#?\s*\d+|素材#?\s*\d+|画布|节点|工作流|workflow|source_refs|node)/i
];
const CHAT_AGENT_URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const CHAT_AGENT_MODE_INSTRUCTIONS = Object.freeze({
    [CHAT_AGENT_INTENT_MODES.CONVERSATION]: [
        '- 先像协作搭子一样直接回应用户，优先给判断、解释和下一步建议，不要默认上来就写完整方案。',
        '- 只有在缺少关键信息时才追问 1 个最重要的问题；否则先继续对话。',
        '- 只要用户还在讨论阶段，就不要把整段自然语言回复写成可直接同步到绘图节点的 prompt。'
    ].join('\n'),
    [CHAT_AGENT_INTENT_MODES.IDEATION]: [
        '- 像创意搭档一样共创，优先提供 2-4 个方向、切角、风格差异或文案方向。',
        '- 默认先帮助用户把想法想透，再进入方案或执行；除非用户明确要求，不要直接切到 SOP、节点编排或 JSON。',
        '- 不要把创意分析段落直接伪装成最终 prompt。'
    ].join('\n'),
    [CHAT_AGENT_INTENT_MODES.MATERIAL]: [
        '- 先抓取和整理素材本身：主体、卖点、品牌元素、版式、镜头、色彩、文案、尺寸/参数、可复用信息与缺失信息。',
        '- 回答重点放在"识别出了什么 / 能怎么用 / 还缺什么"，不要默认直接生成整套设计方案。',
        '- 如果只是做素材分析，不要顺手输出可执行 prompt。'
    ].join('\n'),
    [CHAT_AGENT_INTENT_MODES.TEXT]: [
        '- 以文字任务为主，优先交付提取、OCR、改写、润色、翻译、提炼卖点或结构整理的结果。',
        '- 先把文字结果本身做好，再补一句可选设计建议；除非用户要求，不要展开成完整视觉方案。',
        '- 不要把文案改写结果直接当作图像 prompt。'
    ].join('\n'),
    [CHAT_AGENT_INTENT_MODES.PLANNING]: [
        '- 把需求拆成 1-3 个可执行方案或工作流，明确目标、步骤、素材对应关系、节点建议和预期产出。',
        '- 涉及多素材 / 多节点时，要显式写清 SOURCE_REFS，或在正文中明确标注"素材# / 节点#"的对应关系。',
        '- 只有在用户明显要求直接执行时，再附上精简 JSON prompt spec。',
        '- 如果还处在方案阶段，不要把整段方案正文写成可直接喂给模型的 prompt。'
    ].join('\n'),
    [CHAT_AGENT_INTENT_MODES.EXECUTION]: [
        '- 目标是直接落地。先用 1-2 句话说明执行意图，再输出可直接用于节点的精简结构。',
        '- 图像相关任务优先使用全大写下划线格式的 SYSTEM_REASONING + API_PAYLOAD；API_PAYLOAD 尽量包含 COMPILED_PROMPT、EDIT_INSTRUCTION、NEGATIVE_PROMPT、ASPECT_RATIO、RESOLUTION、SAMPLE_COUNT，空字段不要输出。',
        '- 如果输出纯文本提示词，必须明确使用"提示词："标签或 ```prompt 代码块，避免把解释性正文误判为 prompt。'
    ].join('\n')
});

const NODE_TYPE_LABELS = Object.freeze({
    'input-image': '图片输入',
    'video-input': '视频输入',
    'text-node': '文字节点',
    'novel-input': '小说输入',
    'storyboard-node': '智能分镜表',
    'gen-image': 'AI 绘图',
    'gen-video': 'AI 视频',
    'video-analyze': '视频拆解',
    'extract-characters-scenes': '提取角色和场景',
    'character-description': '角色描述',
    'scene-description': '场景描述',
    'generate-character-image': '生成角色图片',
    'generate-scene-image': '生成场景图片',
    'generate-character-video': '生成角色视频',
    'generate-scene-video': '生成场景视频',
    'create-character': '创建角色',
    'create-scene': '创建场景',
    'image-compare': '图像对比',
    'preview': '预览窗口',
    'local-save': '保存到本地'
});

// 即梦API配置（代理地址，默认本地5100端口）
const JIMENG_API_BASE_URL = 'http://localhost:5100';
const JIMENG_SESSION_ID = '7a16459fbd65d9c87b4ea44d3318f5fa';
const SEEDANCE_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_PROVIDER_KEYS = new Set(['openai', 'google', 'seedance']);

// V3.6.0: 供应商配置（简化版 - 无 name 字段，直接用 key 作为显示名）
const DEFAULT_PROVIDERS = {
    'openai': { key: '', url: DEFAULT_BASE_URL, apiType: 'openai', useProxy: false, forceAsync: false },
    'google': { key: '', url: GOOGLE_OFFICIAL_BASE_URL, apiType: 'gemini', useProxy: false, forceAsync: false, officialApi: true },
    'seedance': { key: '', url: SEEDANCE_API_BASE_URL, apiType: 'openai', useProxy: false, forceAsync: false },
};

// V3.6.0: 模型配置（简化版 - id 即 modelName，无 displayName）
const DEFAULT_API_CONFIGS = [
    // Chat Models
    { id: 'gpt-5.1', provider: 'openai', type: 'Chat' },
    { id: 'gpt-5.2', provider: 'openai', type: 'Chat' },
    { id: 'gpt-4o', provider: 'openai', type: 'Chat' },
    { id: 'gemini-3.1-pro-preview', provider: 'google', type: 'Chat' },
    { id: 'gemini-3.1-flash-preview', provider: 'google', type: 'Chat' },
    { id: 'gemini-3-flash-preview', provider: 'google', type: 'Chat' },
    { id: 'gemini-3-pro-image-preview', provider: 'google', type: 'ChatImage' },

    // Image Models
    { id: 'gpt-image-2', provider: 'openai', type: 'ChatImage', modelName: 'gpt-image-2' },
    { id: 'gpt-4o-image', provider: 'openai', type: 'Image' },

    // Video Models
    { id: 'sora-2', provider: 'openai', type: 'Video', durations: ['5s', '10s'] },
    { id: 'sora-2-pro', provider: 'openai', type: 'Video', durations: ['15s', '25s'] },
    { id: 'seedance-1-0-pro-250528', provider: 'seedance', type: 'Video', durations: ['5s', '10s'] },
    { id: 'seedance-1-0-lite-t2v-250428', provider: 'seedance', type: 'Video', durations: ['5s', '10s'] },
    { id: 'seedance-1-0-lite-i2v-250428', provider: 'seedance', type: 'Video', durations: ['5s', '10s'] },
];

const RATIOS = ['Auto', '1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'];
const GROK_VIDEO_RATIOS = ['3:2', '2:3', '1:1'];
const VIDEO_RES_OPTIONS = ['1080P', '720P'];
const PROMPT_LIBRARY_KEY = 'tapnow_prompt_library';
const GRID_PROMPT_TEXT = `基于我上传的这张参考图，生成一张九宫格（3x3 grid）布局的分镜脚本。请严格保持角色与参考图一致（Keep character strictly consistent），但在9个格子中展示该角色不同的动作、表情和拍摄角度（如正面、侧面、背面、特写等）。要求风格高度统一，形成一张完整的角色动态表（Character Sheet）。`;
const UPSCALE_PROMPT_TEXT = `请对参考图片进行无损高清放大（Upscale）。请严格保持原图的构图、色彩、光影和所有细节元素不变，不要进行任何创造性的重绘或添加新内容。仅专注于提升分辨率、锐化边缘（Sharpening）和去除噪点（Denoising），实现像素级的高清修复。Best quality, 8k, masterpiece, highres, ultra detailed, sharp focus, image restoration, upscale, faithful to original.`;
const INPAINT_PROMPT_TEXT = `请仅修改透明遮罩区域，其余未遮罩区域必须保持像素级一致。优先执行局部重绘、局部替换、瑕疵修复、文字擦除与版面微调，边缘过渡自然，不要破坏原图构图、材质、反光、阴影和文字排版。`;
const TEXT_RETOUCH_PROMPT_TEXT = `请基于透明遮罩区域进行无痕文字修改。保持原海报/包装/画面的视觉风格、字体气质、字重、基线、字距、透视、阴影、反光与排版节奏一致，只替换或重绘指定文案，不要影响未遮罩区域。`;
const CUTOUT_PROMPT_TEXT = `请精准识别主体并完成抠图/换底级编辑：保留主体轮廓、发丝、透明材质与阴影细节，清理杂乱背景，输出适合继续排版或换底合成的干净结果。`;

const IMAGE_BACKGROUND_PRESETS = Object.freeze([
    { id: 'auto', label: '跟随提示词', prompt: '' },
    { id: 'pure-white', label: '纯白抠图底', prompt: 'pure white seamless backdrop' },
    { id: 'luxury-gray', label: '极简高级灰', prompt: 'minimal premium light gray backdrop' },
    { id: 'industrial-workbench', label: '工业风工作台', prompt: 'industrial workbench surface, controlled commercial workshop setup' },
    { id: 'marble-table', label: '大理石台面', prompt: 'clean marble tabletop, premium studio setup' }
]);

const IMAGE_LIGHTING_PRESETS = Object.freeze([
    { id: 'auto', label: '跟随提示词', prompt: '' },
    { id: 'soft-studio', label: '柔和影棚光', prompt: 'soft studio lighting, bright even illumination' },
    { id: 'hard-rim', label: '硬朗轮廓光', prompt: 'hard rim lighting, crisp contour highlights' },
    { id: 'natural-sun', label: '自然阳光', prompt: 'natural daylight, realistic sunlight highlights' }
]);

const IMAGE_SHADOW_PRESETS = Object.freeze([
    { id: 'auto', label: '跟随提示词', prompt: '' },
    { id: 'no-shadow', label: '无阴影', prompt: 'no visible shadow' },
    { id: 'soft-bottom', label: '底部软阴影', prompt: 'soft natural drop shadow under the product' },
    { id: 'side-long', label: '侧向长阴影', prompt: 'long directional side shadow' }
]);

const IMAGE_ECOMMERCE_STYLE_PRESETS = Object.freeze([
    {
        id: 'white-soft-shadow',
        label: '纯白底 + 柔和阴影',
        description: '阿里国际 / 亚马逊标准白底主图',
        backgroundPreset: 'pure-white',
        lightingPreset: 'soft-studio',
        shadowPreset: 'soft-bottom',
        stylePrompt: 'resting on a pure white seamless background (RGB 255,255,255), bright even studio illumination, very soft and subtle contact shadow directly beneath the product, minimalist e-commerce style, edge-to-edge clarity, 8k resolution, highly detailed photorealistic',
        negativePromptAddon: 'dark background, harsh shadows, dramatic lighting, reflections, floating in air, colored background'
    },
    {
        id: 'white-reflection',
        label: '白底 + 镜面轻倒影',
        description: '适合数码 / 五金 / 高端仪器',
        backgroundPreset: 'pure-white',
        lightingPreset: 'soft-studio',
        shadowPreset: 'no-shadow',
        stylePrompt: 'placed on a pristine glossy white acrylic surface, a crystal-clear and elegant mirror reflection beneath the product, studio softbox lighting highlighting product textures, premium commercial advertising photography, clean and clinical',
        negativePromptAddon: 'matte surface, blurry reflection, distorted reflection, messy environment, dark shadows'
    },
    {
        id: 'gray-side-shadow',
        label: '高级灰 + 侧向阴影',
        description: '适合独立站 / 社媒推广图',
        backgroundPreset: 'luxury-gray',
        lightingPreset: 'soft-studio',
        shadowPreset: 'side-long',
        stylePrompt: 'centered on a seamless flat neutral light gray background, minimalist setup, soft directional lighting from the top left casting a clean diagonal drop shadow to the right, modern aesthetic, trendy e-commerce product shot, sharp focus',
        negativePromptAddon: 'complex background, textures on background, multiple light sources, messy shadows, pure white background'
    },
    {
        id: 'pro-workbench-dof',
        label: '专业工作台 + 极度景深',
        description: '适合工业 / 专业工具 / 仪表',
        backgroundPreset: 'industrial-workbench',
        lightingPreset: 'hard-rim',
        shadowPreset: 'soft-bottom',
        stylePrompt: 'resting on a clean, sleek industrial metallic or matte black workbench. In the background, a heavily blurred, shallow depth-of-field professional workshop environment. Studio rim lighting outlining the product shape, cinematic commercial lighting, 85mm lens, f/1.8',
        negativePromptAddon: 'cluttered background, clear background details, people, distracting elements, white background, flat lighting'
    }
]);

const splitPromptSegments = (text) => String(text || '').split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);

const IMAGE_ECOMMERCE_PRESET_NEGATIVE_SEGMENTS = Object.freeze(
    Array.from(new Set(
        IMAGE_ECOMMERCE_STYLE_PRESETS.flatMap((preset) => splitPromptSegments(preset.negativePromptAddon).map((segment) => segment.toLowerCase()))
    ))
);

const IMAGE_ECOMMERCE_PRESET_PROMPT_SEGMENTS = Object.freeze(
    Array.from(new Set(
        IMAGE_ECOMMERCE_STYLE_PRESETS.flatMap((preset) => splitPromptSegments(preset.stylePrompt).map((segment) => segment.toLowerCase()))
    ))
);

const IMAGE_CONSOLE_PRESET_PROMPT_SEGMENTS = Object.freeze(
    Array.from(new Set([
        ...IMAGE_BACKGROUND_PRESETS.flatMap((preset) => splitPromptSegments(preset.prompt).map((segment) => segment.toLowerCase())),
        ...IMAGE_LIGHTING_PRESETS.flatMap((preset) => splitPromptSegments(preset.prompt).map((segment) => segment.toLowerCase())),
        ...IMAGE_SHADOW_PRESETS.flatMap((preset) => splitPromptSegments(preset.prompt).map((segment) => segment.toLowerCase())),
        ...IMAGE_ECOMMERCE_PRESET_PROMPT_SEGMENTS
    ]))
);

const IMAGE_NEGATIVE_FLAG_DEFS = Object.freeze([
    { id: 'preserve-proportion', label: '拒绝改变产品比例', prompt: 'changed product proportions, altered structural details, distorted interfaces' },
    { id: 'clean-background', label: '拒绝背景杂乱', prompt: 'messy background, clutter, distracting props' },
    { id: 'no-extra-text', label: '拒绝生成多余文字 / 水印', prompt: 'extra text, watermark, random labels' },
    { id: 'logical-shadow', label: '拒绝阴影不合逻辑', prompt: 'illogical shadow, floating shadow, harsh unrealistic shadow' }
]);

const STORYBOARD_PROMPT_TEXT = `you are a veteran Hollywood storyboard artist with years of experience. You have the ability to accurately analyze character features and scene characteristics based on images. Provide me with the most suitable camera angles and storyboards. Strictly base this on the uploaded character and scene images, while maintaining a consistent visual style.

MANDATORY LAYOUT: Create a precise 3x3 GRID containing exactly 9 distinct panels.

- The output image MUST be a single image divided into a 3 (rows) by 3 (columns) matrix.
- There must be EXACTLY 3 horizontal rows and 3 vertical columns.
- Each panel must be completely separated by a thin, distinct, solid black line.
- DO NOT create a collage. DO NOT overlap images. DO NOT create random sizes.
- The grid structure must be perfectly aligned for slicing.

Subject Content: "[在此处填充你对故事的描述]"

Styling Instructions:
- Each panel shows the SAME subject/scene from a DIFFERENT angle (e.g., Front, Side, Back, Action, Close-up).
- Maintain perfect consistency of the character/object across all panels.
- Cinematic lighting, high fidelity, 8k resolution.

Negative Constraints:
- No text, no captions, no UI elements.
- No watermarks.
- No broken grid lines.`;

const CHARACTER_SHEET_PROMPT_TEXT = `(strictly mimic source image art style:1.5), (same visual style:1.4),
score_9, score_8_up, masterpiece, best quality, (character sheet:1.4), (reference sheet:1.3), (consistent art style:1.3), matching visual style,

[Structure & General Annotations]:
multiple views, full body central figure, clean background,
(heavy annotation:1.4), (text labels with arrows:1.3), handwriting, data readout,

[SPECIAL CHARACTER DESCRIPTION AREA]:
(prominent character profile text box:1.6), (dedicated biography section:1.5), large descriptive text block,
[在此处填写特殊角色说明，例如：姓名、种族、背景故事等],

[Clothing Breakdown]:
(clothing breakdown:1.5), (outfit decomposition:1.4), garment analysis, (floating apparel:1.3),
displaying outerwear, displaying upper body garment, displaying lower body garment,

[Footwear Focus]:
(detailed footwear display:1.5), (floating shoes:1.4), shoe design breakdown, focus on shoes,

[Inventory & Details]:
(inventory knolling:1.2), open container, personal accessories, organized items display, expression panels`;

const MOOD_BOARD_PROMPT_TEXT = `# Directive: Create a "Rich Narrative Mood Board" (8-Grid Layout)

## 1. PROJECT INPUT

**A. [Story & Concept / 故事与核心想法]**
> [跟据自身内容书写]

**B. [Key Symbols / 核心意象 (Optional)]**
> [深度理解参考图，自行创作]

**C. [Color Preferences / 色彩倾向 (Optional)]**
> [深度理解参考图，自行创作]

**D. [Reference Images / 参考图]**
> (See attached images / 请读取我上传的图片)

---

## 2. Role Definition
Act as a **Senior Art Director**. Synthesize the Input above into a single, cohesive, high-density **Visual Mood Board** using a complex **8-Panel Asymmetrical Grid Layout**.

## 3. Layout Mapping (Strict Adherence)
You must design a visual composition that tells the story through **8 distinct panels** within one image. **Do not** generate random grids. Map the content exactly as follows:

* **Panel 1 (The World):** A wide, cinematic establishing shot of the environment (based on Input A).
* **Panel 2 (The Protagonist):** A portrait close-up (based on reference images), focusing on micro-expressions.
* **Panel 3 (The Metaphor):** An **abstract symbolic object** representing the core theme (based on Input B).
* **Panel 4 (The Palette):** A graphical **Color Palette Strip** showcasing 5 specific colors extracted from the scene.
* **Panel 5 (The Texture):** Extreme macro close-up of a material surface (e.g., rust, skin, fabric) to add tactile richness.
* **Panel 6 (The Motion):** A motion-blurred or long-exposure shot representing time/chaos.
* **Panel 7 (The Detail):** A focused shot of a specific prop or accessory relevant to the plot.
* **Panel 8 (The AI Art Interpretation - CRITICAL):** This is your **free creative space**. Generate an artistic, surreal, or abstract re-interpretation of the story's emotion. **Do not just copy the inputs.** Create a "Vibe Image" (e.g., Double Exposure, Oil Painting style, or abstract geometry) that captures the *soul* of the narrative.

## 4. Execution Requirements
* **Composition Style:** High-end Editorial / Magazine Layout. Clean, thin white borders.
* **Visual Unity:** All panels must share the same lighting conditions and color grading logic (Unified Aesthetic).
* **Task:** Provide the **Final English Image Prompt** that explicitly describes this 8-grid layout, ensuring Panel 8 stands out as an artistic variation.`;

// 已删除的模型ID列表（用于过滤）
const DELETED_MODEL_IDS = [
    'gemini-image',
    'qwen-image',
    'doubao-seedream',
    'hailuo-02',
    'kling-v1-6',
    'wan-2.5'
];

const ASYNC_CONFIG_TEMPLATE = {
    enabled: true,
    requestIdPaths: ['requestId', 'request_id'],
    pollIntervalMs: 3000,
    maxAttempts: 300,
    statusRequest: {
        endpoint: '/w/v1/webapp/task/openapi/detail',
        method: 'GET',
        headers: { Authorization: 'Bearer {{provider.key}}' },
        query: { requestId: '{{requestId}}' },
        bodyType: 'json',
        body: {}
    },
    statusPath: 'data.status',
    successValues: ['Success'],
    failureValues: ['Failed', 'Canceled'],
    outputsRequest: {
        endpoint: '/w/v1/webapp/task/openapi/outputs',
        method: 'GET',
        headers: { Authorization: 'Bearer {{provider.key}}' },
        query: { requestId: '{{requestId}}' },
        bodyType: 'json',
        body: {}
    },
    outputsPath: 'data.outputs',
    outputsUrlField: 'object_url',
    errorPath: 'message'
};

const SIMPLE_NUMERIC_SHOT_ID_RE = /^-?\d+(?:\.\d+)?$/;
const MAX_STORYBOARD_OUTPUT_HISTORY = 20;

const IMAGE_BATCH_MODE_PARALLEL_AGGREGATE = 'parallel_aggregate';
const IMAGE_BATCH_MODE_STANDARD_BATCH = 'standard_batch';
const IMAGE_NATIVE_MULTI_IMAGE_MODE_AUTO = 'auto';
const IMAGE_NATIVE_MULTI_IMAGE_MODE_FORCE = 'force_native';
const IMAGE_NATIVE_MULTI_IMAGE_MODE_DISABLE = 'disable_native';
const NATIVE_MULTI_IMAGE_CAPABILITY_STORAGE_KEY = 'tapnow_native_multi_image_capabilities';
const NODE_IO_ENVELOPE_VERSION = '1.0';
const TRANSPORT_HTTP_JSON = 'http-json';
const TRANSPORT_HTTP_SSE = 'http-sse';
const TRANSPORT_WS_STREAM = 'ws-stream';
const DEFAULT_TRANSPORT_OPTIONS = Object.freeze({
    sseDataPrefix: 'data:',
    sseDoneToken: '[DONE]',
    sseDeltaPath: '',
    sseDelimiter: '\n\n',
    wsMessagePath: '',
    wsDoneToken: '[DONE]'
});

export {
    t,
    DEFAULT_VIEW,
    TEXT_REWRITE_ROLE_LABELS,
    LOCAL_EDIT_ACTION_LABELS,
    CHAT_ASSISTANT_META_BLOCK_PATTERN,
    CHAT_RUNTIME_TOOL_KINDS,
    VIRTUAL_CANVAS_WIDTH,
    VIRTUAL_CANVAS_HEIGHT,
    IMAGE_TASK_TIMEOUT_MS,
    VIDEO_TASK_TIMEOUT_MS,
    MIN_NODE_WIDTH,
    MIN_NODE_HEIGHT,
    DEFAULT_BASE_URL,
    GOOGLE_OFFICIAL_BASE_URL,
    CHAT_CANVAS_CONTEXT_STORAGE_KEY,
    CHAT_AUTO_ATTACH_MEDIA_STORAGE_KEY,
    CHAT_GEMINI_THINKING_STORAGE_KEY,
    CHAT_GEMINI_SEARCH_STORAGE_KEY,
    CHAT_GEMINI_THINKING_BUDGET,
    CHAT_CANVAS_CONTEXT_MAX_NODES,
    CHAT_CANVAS_CONTEXT_MAX_MEDIA,
    CHAT_CANVAS_CONTEXT_MAX_SHOTS,
    CHAT_CANVAS_CONTEXT_TEXT_LIMIT,
    PROVIDER_MODEL_RENDER_STEP,
    MODEL_LIBRARY_RENDER_STEP,
    CHAT_AGENT_INTENT_MODES,
    CHAT_AGENT_INTENT_MODE_LABELS,
    CHAT_AGENT_FOLLOW_UP_PATTERN,
    CHAT_AGENT_EXECUTION_PATTERNS,
    CHAT_AGENT_PLANNING_PATTERNS,
    CHAT_AGENT_MATERIAL_PATTERNS,
    CHAT_AGENT_TEXT_PATTERNS,
    CHAT_AGENT_IDEATION_PATTERNS,
    CHAT_AGENT_SEARCH_PATTERNS,
    CHAT_AGENT_CANVAS_PATTERNS,
    CHAT_AGENT_URL_PATTERN,
    CHAT_AGENT_MODE_INSTRUCTIONS,
    NODE_TYPE_LABELS,
    JIMENG_API_BASE_URL,
    JIMENG_SESSION_ID,
    SEEDANCE_API_BASE_URL,
    DEFAULT_PROVIDER_KEYS,
    DEFAULT_PROVIDERS,
    DEFAULT_API_CONFIGS,
    RATIOS,
    GROK_VIDEO_RATIOS,
    VIDEO_RES_OPTIONS,
    PROMPT_LIBRARY_KEY,
    GRID_PROMPT_TEXT,
    UPSCALE_PROMPT_TEXT,
    INPAINT_PROMPT_TEXT,
    TEXT_RETOUCH_PROMPT_TEXT,
    CUTOUT_PROMPT_TEXT,
    IMAGE_BACKGROUND_PRESETS,
    IMAGE_LIGHTING_PRESETS,
    IMAGE_SHADOW_PRESETS,
    IMAGE_ECOMMERCE_STYLE_PRESETS,
    IMAGE_ECOMMERCE_PRESET_NEGATIVE_SEGMENTS,
    IMAGE_ECOMMERCE_PRESET_PROMPT_SEGMENTS,
    IMAGE_CONSOLE_PRESET_PROMPT_SEGMENTS,
    IMAGE_NEGATIVE_FLAG_DEFS,
    splitPromptSegments,
    STORYBOARD_PROMPT_TEXT,
    CHARACTER_SHEET_PROMPT_TEXT,
    MOOD_BOARD_PROMPT_TEXT,
    DELETED_MODEL_IDS,
    ASYNC_CONFIG_TEMPLATE,
    SIMPLE_NUMERIC_SHOT_ID_RE,
    MAX_STORYBOARD_OUTPUT_HISTORY,
    IMAGE_BATCH_MODE_PARALLEL_AGGREGATE,
    IMAGE_BATCH_MODE_STANDARD_BATCH,
    IMAGE_NATIVE_MULTI_IMAGE_MODE_AUTO,
    IMAGE_NATIVE_MULTI_IMAGE_MODE_FORCE,
    IMAGE_NATIVE_MULTI_IMAGE_MODE_DISABLE,
    NATIVE_MULTI_IMAGE_CAPABILITY_STORAGE_KEY,
    NODE_IO_ENVELOPE_VERSION,
    TRANSPORT_HTTP_JSON,
    TRANSPORT_HTTP_SSE,
    TRANSPORT_WS_STREAM,
    DEFAULT_TRANSPORT_OPTIONS,
};
