#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tapnow Studio 本地全功能服务器 (Tapnow Local Server Full)
版本: 2.3 (ComfyUI Compatible)

功能概述:
1. [Core] 本地文件服务: 提供文件的保存 (/save)、批量操作、删除等基础能力。
2. [Core] HTTP 代理服务: 绕过浏览器 CORS 限制 (/proxy)。
3. [Module] ComfyUI 中间件: 任务队列、模板管理、BizyAir/RunningHub 风格接口 (/comfy/*)。

设计原则:
- 原有功能 100% 兼容，代码逻辑尽量保持原貌。
- 新增 ComfyUI 模块通过 FEATURE_FLAGS 控制开关。
- 结构清晰，分块管理：Config -> Core Utils -> Comfy Module -> HTTP Handlers -> Main。
"""

import os
import sys
import json
import random
import base64
import argparse
import threading
import webbrowser
import http.client
import queue
import time
import uuid
import mimetypes
import subprocess
import glob
import re
import urllib.request
import urllib.error
import urllib.parse
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote, parse_qs
from datetime import datetime
from io import BytesIO
from email.utils import formatdate

# ==============================================================================
# SECTION 1: 依赖检查与全局配置
# ==============================================================================

# 1.1 依赖库检查
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("[提示] PIL未安装，PNG转JPG功能将不可用 (pip install Pillow)")

try:
    import websocket
    WS_AVAILABLE = True
except ImportError:
    WS_AVAILABLE = False
    print("[提示] websocket-client未安装，ComfyUI中间件功能将不可用 (pip install websocket-client)")

# 1.2 功能开关 (Feature Flags)
# 最佳实践：使用环境变量控制功能开关，方便在部署或调试时快速切换
# 可以通过设置环境变量 (如 set TAPNOW_ENABLE_COMFY=0) 来强制关闭某模块
def get_env_bool(key, default):
    val = os.environ.get(key)
    if val is None: return default
    return val.lower() in ('true', '1', 'yes', 'on')

FEATURES = {
    # 核心文件服务 (默认开启)
    "file_server": get_env_bool("TAPNOW_ENABLE_FILE_SERVER", True),   
    
    # 代理服务 (默认开启)
    "proxy_server": get_env_bool("TAPNOW_ENABLE_PROXY", True),  
    
    # ComfyUI 中间件 (依赖存在且未被环境变量禁用时开启)
    "comfy_middleware": get_env_bool("TAPNOW_ENABLE_COMFY", WS_AVAILABLE), 
    
    # 控制台日志 (可关闭以减少噪音)
    "log_console": get_env_bool("TAPNOW_ENABLE_LOG", True)    
}

# 1.3 默认配置常量
DEFAULT_PORT = 9527
DEFAULT_SAVE_PATH = os.path.expanduser("~/Downloads/TapnowStudio")
DEFAULT_ALLOWED_ROOTS = [
    os.path.expanduser("~/Downloads"),
    os.path.abspath(r"D:\TapnowData")
]
DEFAULT_PROXY_ALLOWED_HOSTS = [
    "api.openai.com", "generativelanguage.googleapis.com", 
    "ai.comfly.chat", "api-inference.modelscope.cn", 
    "vibecodingapi.ai", "yunwu.ai", 
    "muse-ai.oss-cn-hangzhou.aliyuncs.com", "googlecdn.datas.systems",
    "127.0.0.1:8188", "localhost:8188"
]
DEFAULT_PROXY_TIMEOUT = 300
CONFIG_FILENAME = "tapnow-local-config.json"
LOCAL_FILE_CACHE_CONTROL = "public, max-age=31536000, immutable"
PROXY_MEDIA_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"
MEDIA_FILE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif',
    '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'
}

# ComfyUI 特有配置
COMFY_URL = "http://127.0.0.1:8188"
COMFY_WS_URL = "ws://127.0.0.1:8188/ws"
# 自动定位到当前脚本所在目录下的 workflows 文件夹
WORKFLOWS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workflows")

# 1.4 全局运行时配置字典
config = {
    "port": DEFAULT_PORT,
    "save_path": DEFAULT_SAVE_PATH,
    "image_save_path": "",
    "video_save_path": "",
    "allowed_roots": DEFAULT_ALLOWED_ROOTS,
    "proxy_allowed_hosts": DEFAULT_PROXY_ALLOWED_HOSTS,
    "proxy_timeout": DEFAULT_PROXY_TIMEOUT,
    "auto_create_dir": True,
    "allow_overwrite": False,
    "log_enabled": True,
    "convert_png_to_jpg": True,
    "jpg_quality": 95
}

# 1.5 全局状态对象
# ComfyUI 队列相关
JOB_QUEUE = queue.Queue()
JOB_STATUS = {}
STATUS_LOCK = threading.Lock()
CLIENT_ID = str(uuid.uuid4())
WS_MESSAGES = {}
PROMPT_TO_JOB = {}

# ==============================================================================
# SECTION 2: 核心工具函数 (Core Utilities)
# ==============================================================================

def log(message):
    """统一日志输出"""
    if config["log_enabled"] and FEATURES["log_console"]:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")

def ensure_dir(path):
    """确保目录存在"""
    if not os.path.exists(path):
        try:
            os.makedirs(path)
            log(f"创建目录: {path}")
        except Exception as e:
            log(f"创建目录失败 {path}: {e}")

def load_config_file():
    """加载本地配置文件 (tapnow-local-config.json)"""
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), CONFIG_FILENAME)
    if not os.path.exists(config_path):
        return
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # 安全更新配置，不覆盖未定义的字段
        if data.get("allowed_roots"): config["allowed_roots"] = data["allowed_roots"]
        if data.get("proxy_allowed_hosts"): config["proxy_allowed_hosts"] = data["proxy_allowed_hosts"]
        if data.get("proxy_timeout"): config["proxy_timeout"] = int(data["proxy_timeout"])

        # [NEW] 允许通过 config 文件覆盖环境变量开关
        # 例如 json 中: { "features": { "comfy_middleware": false } }
        if "features" in data and isinstance(data["features"], dict):
            for k, v in data["features"].items():
                if k in FEATURES:
                    FEATURES[k] = bool(v)
                    log(f"功能开关已更新 (from config): {k} -> {v}")

        log(f"已加载配置文件: {config_path}")
    except Exception as exc:
        log(f"[警告] 读取配置文件失败: {exc}")

def get_allowed_roots():
    """获取允许的文件操作根目录列表"""
    if sys.platform == 'win32':
        return config.get("allowed_roots", DEFAULT_ALLOWED_ROOTS)
    return [config["save_path"]]

def is_path_allowed(path):
    """安全检查：路径是否在白名单内"""
    try:
        path_abs = os.path.abspath(os.path.expanduser(path))
        path_norm = os.path.normcase(path_abs)
        for root in get_allowed_roots():
            root_abs = os.path.abspath(os.path.expanduser(root))
            root_norm = os.path.normcase(root_abs)
            # 检查 commonpath 前缀是否匹配
            if os.path.commonpath([path_norm, root_norm]) == root_norm:
                return True
    except Exception:
        pass
    return False

def normalize_rel_path(rel_path):
    rel_path = unquote(rel_path or "")
    rel_path = rel_path.replace('\\', '/').lstrip('/')
    if not rel_path:
        return ""
    norm = os.path.normpath(rel_path)
    if norm.startswith("..") or os.path.isabs(norm):
        return None
    return norm.replace('/', os.sep)

def safe_join(base, rel_path):
    rel_norm = normalize_rel_path(rel_path)
    if rel_norm is None:
        return None
    base_abs = os.path.abspath(base)
    candidate = os.path.abspath(os.path.join(base_abs, rel_norm))
    base_norm = os.path.normcase(base_abs)
    cand_norm = os.path.normcase(candidate)
    try:
        if os.path.commonpath([cand_norm, base_norm]) != base_norm:
            return None
    except ValueError:
        return None
    return candidate

def get_unique_filename(filepath):
    """生成不冲突的文件名 (file.png -> file_1.png)"""
    if not os.path.exists(filepath): return filepath
    base, ext = os.path.splitext(filepath)
    counter = 1
    while os.path.exists(f"{base}_{counter}{ext}"):
        counter += 1
    return f"{base}_{counter}{ext}"

# --- 代理相关工具 ---
PROXY_SKIP_REQUEST_HEADERS = {
    'host', 'content-length', 'connection', 'proxy-connection', 'keep-alive',
    'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authorization',
    'proxy-authenticate', 'x-proxy-target', 'x-proxy-method'
}
PROXY_SKIP_RESPONSE_HEADERS = {
    'connection', 'proxy-connection', 'keep-alive', 'transfer-encoding', 'te',
    'trailer', 'upgrade', 'proxy-authenticate', 'proxy-authorization',
    'access-control-allow-origin', 'access-control-allow-methods',
    'access-control-allow-headers', 'access-control-expose-headers'
}

def parse_proxy_target(parsed, headers):
    """解析代理目标 URL"""
    target = headers.get('X-Proxy-Target')
    if not target:
        params = parse_qs(parsed.query or '')
        target = params.get('url', [None])[0] or params.get('target', [None])[0]
    return unquote(target) if target else None

def parse_allowed_host_entry(entry):
    entry = entry.strip()
    if not entry:
        return None, None, False
    if entry == '*':
        return '*', None, False
    wildcard = False
    if entry.startswith('*.'):
        wildcard = True
        entry = entry[2:]
    if '://' in entry:
        parsed = urlparse(entry)
    else:
        parsed = urlparse('//' + entry)
    host = parsed.hostname.lower() if parsed.hostname else None
    return host, parsed.port, wildcard

def is_proxy_target_allowed(target_url):
    allowed_hosts = config.get("proxy_allowed_hosts", [])
    parsed = urlparse(target_url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    # Always allow local ComfyUI output fetch (avoid 403 loop)
    if host in ('127.0.0.1', 'localhost') and port == 8188:
        return True
    if not allowed_hosts:
        return False
    for entry in allowed_hosts:
        if entry is None:
            continue
        host_entry, port_entry, wildcard = parse_allowed_host_entry(str(entry))
        if not host_entry:
            continue
        if host_entry == '*':
            return True
        if wildcard:
            if host == host_entry:
                continue
            if host.endswith('.' + host_entry):
                if port_entry is None or port_entry == port:
                    return True
        else:
            if host == host_entry and (port_entry is None or port_entry == port):
                return True
    return False

def iter_proxy_response_chunks(response, chunk_size=8192):
    if response.fp and hasattr(response.fp, 'read1'):
        while True:
            chunk = response.fp.read1(chunk_size)
            if not chunk:
                break
            yield chunk
        return
    while True:
        chunk = response.read(chunk_size)
        if not chunk:
            break
        yield chunk

def convert_png_to_jpg(png_data, quality=95):
    if not PIL_AVAILABLE:
        return png_data, False
    try:
        img = Image.open(BytesIO(png_data))
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        output = BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        return output.getvalue(), True
    except Exception as e:
        log(f"PNG转JPG失败: {str(e)}")
        return png_data, False

def is_image_file(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

def is_video_file(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ['.mp4', '.mov', '.webm', '.avi', '.mkv']

def is_media_content_type(content_type):
    if not content_type:
        return False
    lower = content_type.lower()
    return lower.startswith('image/') or lower.startswith('video/') or lower.startswith('audio/')

def is_media_path(path):
    try:
        clean_path = (path or '').split('?', 1)[0]
        ext = os.path.splitext(clean_path)[1].lower()
    except Exception:
        return False
    return ext in MEDIA_FILE_EXTENSIONS

def read_json_file(path):
    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

# ==============================================================================
# SECTION 3: ComfyUI 中间件模块 (Comfy Middleware Module)
# ==============================================================================

class ComfyMiddleware:
    """封装所有 ComfyUI 相关逻辑"""

    @staticmethod
    def coerce_value(val):
        if isinstance(val, str):
            raw = val.strip()
            if raw.lower() in ('true', 'false'):
                return raw.lower() == 'true'
            if raw == '':
                return ''
            try:
                if '.' in raw:
                    return float(raw)
                return int(raw)
            except Exception:
                return val
        return val

    @staticmethod
    def normalize_seed_value(value):
        if value is None:
            return None
        if isinstance(value, str) and value.strip() == '-1':
            return random.randint(0, 2**31 - 1)
        if isinstance(value, (int, float)) and int(value) == -1:
            return random.randint(0, 2**31 - 1)
        return value

    @staticmethod
    def set_by_path(target, path_parts, value):
        current = target
        for part in path_parts[:-1]:
            if not isinstance(current, dict):
                return False
            if part not in current or not isinstance(current[part], dict):
                current[part] = {}
            current = current[part]
        if isinstance(current, dict):
            current[path_parts[-1]] = value
            return True
        return False

    @staticmethod
    def extract_batch_size(workflow):
        try:
            for node in workflow.values():
                if not isinstance(node, dict):
                    continue
                inputs = node.get('inputs')
                if not isinstance(inputs, dict):
                    continue
                if 'batch_size' in inputs:
                    try:
                        return int(inputs.get('batch_size') or 1)
                    except Exception:
                        return 1
        except Exception:
            return 1
        return 1
    
    @staticmethod
    def is_enabled():
        return FEATURES["comfy_middleware"]

    @staticmethod
    def load_template(app_id):
        """读取 Workflow 模板"""
        template_path = os.path.join(WORKFLOWS_DIR, app_id, "template.json")
        meta_path = os.path.join(WORKFLOWS_DIR, app_id, "meta.json")
        
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"模板不存在: {app_id}")
            
        workflow = read_json_file(template_path)
            
        params_map = {}
        if os.path.exists(meta_path):
            meta = read_json_file(meta_path)
            params_map = meta.get('params_map', {})
                
        return workflow, params_map

    @staticmethod
    def apply_inputs(workflow, params_map, user_inputs):
        """填充参数到 Workflow"""
        if not user_inputs:
            return workflow

        # RunningHub List 格式
        if isinstance(user_inputs, list):
            for item in user_inputs:
                node_id = str(item.get('nodeId') or item.get('node_id') or item.get('id') or '').strip()
                field = (item.get('fieldName') or item.get('field') or '').strip()
                if not node_id or not field:
                    continue
                raw_value = item.get('fieldValue')
                if raw_value is None:
                    continue
                if isinstance(raw_value, str) and raw_value.strip() == '':
                    continue
                value = ComfyMiddleware.coerce_value(raw_value)
                if field == 'seed':
                    value = ComfyMiddleware.normalize_seed_value(value)
                if node_id in workflow:
                    inputs = workflow[node_id].setdefault('inputs', {})
                    if isinstance(inputs, dict):
                        inputs[field] = value
            return workflow

        # 默认 Dict 模式
        if not isinstance(user_inputs, dict):
            return workflow

        def find_unique_node_with_input(input_name):
            matches = []
            for node_id, node in workflow.items():
                inputs = node.get('inputs') if isinstance(node, dict) else None
                if isinstance(inputs, dict) and input_name in inputs:
                    matches.append(node_id)
            return matches

        for key, val in user_inputs.items():
            if val is None:
                continue
            if isinstance(val, str) and val.strip() == '':
                continue
            if isinstance(key, str):
                # 支持前端 *_input 命名（如 seed_input / batch_input）
                if key.endswith('_input') and len(key) > 6:
                    key = key[:-6]
                if key in ('batch_size', 'batchSize'):
                    key = 'batch'
                if key in ('sampler_name', 'samplerName'):
                    key = 'sampler'
            value = ComfyMiddleware.coerce_value(val)
            handled = False
            if key in params_map:
                mapping = params_map[key]
                node_id = str(mapping.get('node_id', '')).strip()
                field_path = (mapping.get('field', '') or '').split('.')
                if node_id in workflow and field_path and field_path[0]:
                    if field_path[-1] == 'seed':
                        value = ComfyMiddleware.normalize_seed_value(value)
                    target = workflow[node_id]
                    if not ComfyMiddleware.set_by_path(target, field_path, value):
                        log(f"[Comfy] 参数填充失败 {key}: 无法写入路径 {field_path}")
                handled = True
                continue

            # 兼容 BizyAir 风格: "NodeID:NodeType.field"
            if isinstance(key, str) and ':' in key:
                node_part, field_part = key.split(':', 1)
                node_id = node_part.strip()
                field_name = field_part.split('.')[-1].strip() if field_part else ''
                if node_id in workflow and field_name:
                    if field_name == 'seed':
                        value = ComfyMiddleware.normalize_seed_value(value)
                    inputs = workflow[node_id].setdefault('inputs', {})
                    if isinstance(inputs, dict):
                        inputs[field_name] = value
                handled = True
                continue

            # 兼容简化 "NodeID.field"
            if isinstance(key, str) and '.' in key:
                node_part, field_name = key.split('.', 1)
                node_id = node_part.strip()
                field_name = field_name.strip()
                if node_id in workflow and field_name:
                    if field_name == 'seed':
                        value = ComfyMiddleware.normalize_seed_value(value)
                    inputs = workflow[node_id].setdefault('inputs', {})
                    if isinstance(inputs, dict):
                        inputs[field_name] = value
                handled = True
                continue

            # 兜底：允许用通用键名（prompt/seed/steps/width/height）
            if not handled and isinstance(key, str):
                alias_map = {
                    "prompt": ["text", "prompt"],
                    "text": ["text", "prompt"],
                    "seed": ["seed"],
                    "steps": ["steps"],
                    "width": ["width"],
                    "height": ["height"],
                    "batch": ["batch_size", "batch"],
                    "sampler": ["sampler_name", "sampler"],
                    "scheduler": ["scheduler"]
                }
                if key in alias_map:
                    for input_name in alias_map[key]:
                        matches = find_unique_node_with_input(input_name)
                        if len(matches) == 1:
                            inputs = workflow[matches[0]].setdefault('inputs', {})
                            if isinstance(inputs, dict):
                                if input_name == 'seed':
                                    value = ComfyMiddleware.normalize_seed_value(value)
                                inputs[input_name] = value
                            handled = True
                            break
                if not handled and key in ("seed", "steps", "width", "height"):
                    matches = find_unique_node_with_input(key)
                    if len(matches) == 1:
                        inputs = workflow[matches[0]].setdefault('inputs', {})
                        if isinstance(inputs, dict):
                            if key == 'seed':
                                value = ComfyMiddleware.normalize_seed_value(value)
                            inputs[key] = value
                        handled = True
        return workflow

    @staticmethod
    def send_to_comfy(workflow):
        """提交 Prompt 到 ComfyUI"""
        payload = {"client_id": CLIENT_ID, "prompt": workflow}
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{COMFY_URL}/prompt",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                try:
                    return json.loads(raw.decode('utf-8-sig'))
                except Exception:
                    return json.loads(raw)
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode('utf-8', errors='replace')
                log(f"[Comfy] HTTPError {e.code}: {err_body}")
            except Exception:
                log(f"[Comfy] HTTPError {e.code}")
            raise

    @staticmethod
    def worker_loop():
        """后台 Worker 线程的主循环"""
        if not ComfyMiddleware.is_enabled():
            return

        log("ComfyUI Worker 线程已启动 (等待任务...)")
        
        # 1. 启动 WebSocket 监听线程
        def on_message(ws, message):
            try:
                msg = json.loads(message)
                mtype = msg.get('type')
                if mtype == 'executed': # 节点执行完成
                    pid = msg.get('data', {}).get('prompt_id')
                    if not pid:
                        return
                    if pid not in WS_MESSAGES:
                        WS_MESSAGES[pid] = []
                    WS_MESSAGES[pid].append(msg)
                elif mtype == 'progress':
                    data = msg.get('data', {})
                    pid = data.get('prompt_id')
                    if not pid:
                        return
                    job_id = PROMPT_TO_JOB.get(pid)
                    if not job_id:
                        return
                    with STATUS_LOCK:
                        if job_id in JOB_STATUS:
                            JOB_STATUS[job_id]['progress'] = {
                                'value': data.get('value', 0),
                                'max': data.get('max', 0)
                            }
                elif mtype == 'execution_error':
                    data = msg.get('data', {})
                    pid = data.get('prompt_id')
                    job_id = PROMPT_TO_JOB.get(pid) if pid else None
                    if job_id:
                        with STATUS_LOCK:
                            if job_id in JOB_STATUS and JOB_STATUS[job_id].get('status') not in ('success', 'failed'):
                                JOB_STATUS[job_id]['status'] = 'failed'
                                JOB_STATUS[job_id]['error'] = data.get('exception_message') or 'execution_error'
            except: pass

        def ws_thread_func():
            while True:
                try:
                    # 自动重连逻辑
                    ws = websocket.WebSocketApp(f"{COMFY_WS_URL}?clientId={CLIENT_ID}", on_message=on_message)
                    ws.run_forever()
                except Exception:
                    time.sleep(5) 
                time.sleep(1)

        threading.Thread(target=ws_thread_func, daemon=True).start()

        # 2. 任务处理循环
        while True:
            job = JOB_QUEUE.get() # 阻塞获取任务
            job_id = job['id']
            prompt_id = None
            
            with STATUS_LOCK:
                JOB_STATUS[job_id]['status'] = 'processing'
                JOB_STATUS[job_id]['started_at'] = time.time()
                JOB_STATUS[job_id]['progress'] = {'value': 0, 'max': 0}
                
            try:
                log(f"[Comfy] 开始执行任务: {job_id} ({job['app_id']})")
                
                # 加载与填充
                if job.get('prompt'):
                    wf = job['prompt']
                else:
                    wf, pmap = ComfyMiddleware.load_template(job['app_id'])
                    wf = ComfyMiddleware.apply_inputs(wf, pmap, job['inputs'])
                
                # 提交
                resp = ComfyMiddleware.send_to_comfy(wf)
                prompt_id = resp['prompt_id']
                log(f"[Comfy] 已提交到后端, PromptID: {prompt_id}")
                with STATUS_LOCK:
                    JOB_STATUS[job_id]['prompt_id'] = prompt_id
                PROMPT_TO_JOB[prompt_id] = job_id
                expected_count = 1
                try:
                    expected_count = max(1, int(ComfyMiddleware.extract_batch_size(wf)))
                except Exception:
                    expected_count = 1
                
                # 等待结果 (简化版 Event Loop)
                timeout = 600
                start_t = time.time()
                final_images = []
                
                last_count = 0
                stable_ticks = 0
                while time.time() - start_t < timeout:
                    if prompt_id in WS_MESSAGES:
                        msgs = WS_MESSAGES[prompt_id]
                        for m in msgs:
                            # 提取 output 图片
                            outputs = m['data'].get('output', {}).get('images', [])
                            for img in outputs:
                                url = f"{COMFY_URL}/view?filename={img['filename']}&type={img['type']}&subfolder={img['subfolder']}"
                                final_images.append(url)
                        if len(final_images) >= expected_count:
                            break
                        if len(final_images) == last_count and final_images:
                            stable_ticks += 1
                            if stable_ticks >= 3:
                                break
                        else:
                            stable_ticks = 0
                            last_count = len(final_images)
                    time.sleep(0.5)
                
                if final_images:
                    with STATUS_LOCK:
                        JOB_STATUS[job_id]['status'] = 'success'
                        JOB_STATUS[job_id]['result'] = {'images': final_images}
                        JOB_STATUS[job_id]['finished_at'] = time.time()
                        JOB_STATUS[job_id]['progress'] = {'value': 100, 'max': 100}
                    log(f"[Comfy] 任务完成: {len(final_images)} images")
                else:
                    raise TimeoutError("等待生成结果超时")
                    
            except Exception as e:
                log(f"[Comfy] 任务异常: {e}")
                with STATUS_LOCK:
                    JOB_STATUS[job_id]['status'] = 'failed'
                    JOB_STATUS[job_id]['error'] = str(e)
                    JOB_STATUS[job_id]['finished_at'] = time.time()
            finally:
                if prompt_id in WS_MESSAGES:
                    WS_MESSAGES.pop(prompt_id, None)
                if prompt_id in PROMPT_TO_JOB:
                    PROMPT_TO_JOB.pop(prompt_id, None)
                JOB_QUEUE.task_done()

def format_timestamp(ts):
    try:
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""

def normalize_job_status(status):
    mapping = {
        'queued': 'Queued',
        'processing': 'Running',
        'success': 'Success',
        'failed': 'Failed',
        'canceled': 'Canceled'
    }
    if not status:
        return 'Unknown'
    return mapping.get(status, status)

def build_detail_response(job):
    data = {
        "requestId": job.get('id'),
        "taskId": job.get('id'),
        "app_id": job.get('app_id'),
        "status": normalize_job_status(job.get('status')),
        "created_at": format_timestamp(job.get('created_at', 0)),
        "updated_at": format_timestamp(job.get('finished_at') or job.get('started_at') or job.get('created_at', 0)),
        "progress": job.get('progress') or {"value": 0, "max": 0}
    }
    if job.get('prompt_id'):
        data["prompt_id"] = job.get('prompt_id')
    if job.get('error'):
        data["error"] = job.get('error')
    return {
        "code": 20000,
        "message": "Ok",
        "status": True,
        "data": data
    }

def build_outputs_response(job):
    outputs = []
    images = job.get('result', {}).get('images', []) if job else []
    for url in images:
        outputs.append({"object_url": url})
    return {
        "code": 20000,
        "message": "Ok",
        "status": True,
        "data": {
            "outputs": outputs,
            "images": images
        },
        "outputs": outputs
    }

def resolve_job_by_request_id(request_id):
    if not request_id:
        return None
    with STATUS_LOCK:
        job = JOB_STATUS.get(request_id)
        if job:
            return job
        for candidate in JOB_STATUS.values():
            if candidate.get('prompt_id') == request_id:
                return candidate
    return None

RUNTIME_TOOL_TEMPLATE_PATTERN = re.compile(r'\{\{\s*([^}]+?)\s*\}\}')
RUNTIME_TOOL_MAX_TEXT = 40000
MCP_PROTOCOL_VERSION = "2024-11-05"

def get_runtime_tool_context(tool_def, args, context):
    args_dict = args if isinstance(args, dict) else {"value": args}
    data = {
        "args": args_dict,
        "context": context if isinstance(context, dict) else {},
        "env": dict(os.environ),
        "tool": tool_def or {}
    }
    if isinstance(args_dict, dict):
        for key, value in args_dict.items():
            if key not in data:
                data[key] = value
    return data

def get_runtime_context_value(data, path):
    raw_path = str(path or '').strip()
    if not raw_path:
        return ''
    current = data
    normalized = raw_path.replace('[', '.').replace(']', '').replace('..', '.')
    for part in [p for p in normalized.split('.') if p]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list):
            try:
                index = int(part)
            except Exception:
                return ''
            if index < 0 or index >= len(current):
                return ''
            current = current[index]
        else:
            return ''
    return current

def stringify_runtime_value(value):
    if value is None:
        return ''
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value)

def render_runtime_template(value, data):
    if isinstance(value, str):
        stripped = value.strip()
        full_match = RUNTIME_TOOL_TEMPLATE_PATTERN.fullmatch(stripped)
        if full_match:
            return get_runtime_context_value(data, full_match.group(1))
        return RUNTIME_TOOL_TEMPLATE_PATTERN.sub(
            lambda match: stringify_runtime_value(get_runtime_context_value(data, match.group(1))),
            value
        )
    if isinstance(value, list):
        return [render_runtime_template(item, data) for item in value]
    if isinstance(value, dict):
        return {key: render_runtime_template(val, data) for key, val in value.items()}
    return value

def truncate_runtime_text(text, max_chars=RUNTIME_TOOL_MAX_TEXT):
    text = str(text or '')
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...[truncated]"

def maybe_parse_json_text(text):
    candidate = str(text or '').strip()
    if not candidate:
        return None
    try:
        return json.loads(candidate)
    except Exception:
        return None

def append_query_params(url, query_obj):
    if not isinstance(query_obj, dict) or not query_obj:
        return url
    items = []
    for key, value in query_obj.items():
        if value is None:
            continue
        if isinstance(value, list):
            for item in value:
                items.append((str(key), '' if item is None else str(item)))
        else:
            items.append((str(key), str(value)))
    if not items:
        return url
    separator = '&' if '?' in url else '?'
    query = '&'.join([
        f"{urllib.parse.quote_plus(k)}={urllib.parse.quote_plus(v)}"
        for k, v in items
    ])
    return f"{url}{separator}{query}"

def build_runtime_result(tool_def, request, success, output=None, output_text='', error=''):
    return {
        "requestId": request.get("id") or request.get("requestId") or '',
        "tool": request.get("tool") or tool_def.get("id") or '',
        "kind": tool_def.get("kind") or '',
        "success": bool(success),
        "output": output,
        "outputText": truncate_runtime_text(output_text),
        "error": str(error or '')
    }

def flatten_mcp_result_text(result):
    if result is None:
        return ''
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        content = result.get('content')
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get('text') or item.get('content') or ''
                    if text:
                        parts.append(str(text))
            if parts:
                return '\n'.join(parts)
        if result.get('structuredContent') is not None:
            return stringify_runtime_value(result.get('structuredContent'))
        if result.get('content') is not None:
            return stringify_runtime_value(result.get('content'))
    return stringify_runtime_value(result)

def execute_runtime_http_tool(tool_def, args, context):
    data = get_runtime_tool_context(tool_def, args, context)
    url = str(render_runtime_template(tool_def.get('url') or tool_def.get('endpoint') or '', data)).strip()
    if not url:
        raise ValueError('HTTP 工具缺少 url')
    method = str(render_runtime_template(tool_def.get('method') or 'POST', data)).upper() or 'POST'
    headers = render_runtime_template(tool_def.get('headers') or {}, data)
    headers = headers if isinstance(headers, dict) else {}
    query = render_runtime_template(tool_def.get('query') or {}, data)
    body = render_runtime_template(tool_def.get('body'), data)
    timeout_sec = max(1, int((tool_def.get('timeoutMs') or 30000) / 1000))
    final_url = append_query_params(url, query)
    request_data = None
    if method not in ('GET', 'HEAD') and body is not None:
        if isinstance(body, (dict, list)):
            request_data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            headers.setdefault('Content-Type', 'application/json')
        elif isinstance(body, bytes):
            request_data = body
        else:
            request_data = str(body).encode('utf-8')
            headers.setdefault('Content-Type', 'text/plain; charset=utf-8')
    request = urllib.request.Request(final_url, data=request_data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        raw_bytes = response.read()
        content_type = response.headers.get('Content-Type', '')
    raw_text = raw_bytes.decode('utf-8', errors='ignore') if isinstance(raw_bytes, bytes) else str(raw_bytes or '')
    parsed = maybe_parse_json_text(raw_text) if 'json' in content_type.lower() else None
    return {
        "output": parsed if parsed is not None else raw_text,
        "outputText": stringify_runtime_value(parsed) if parsed is not None else raw_text
    }

def execute_runtime_cli_tool(tool_def, args, context):
    data = get_runtime_tool_context(tool_def, args, context)
    env_extra = render_runtime_template(tool_def.get('env') or {}, data)
    env = os.environ.copy()
    if isinstance(env_extra, dict):
        env.update({str(k): '' if v is None else str(v) for k, v in env_extra.items()})
    cwd = render_runtime_template(tool_def.get('cwd') or '', data)
    cwd = os.path.abspath(os.path.expanduser(str(cwd))) if cwd else None
    timeout_sec = max(1, int((tool_def.get('timeoutMs') or 30000) / 1000))
    shell_command = render_runtime_template(tool_def.get('shellCommand') or '', data)
    if shell_command:
        completed = subprocess.run(
            str(shell_command),
            shell=True,
            capture_output=True,
            text=True,
            cwd=cwd,
            env=env,
            timeout=timeout_sec,
            encoding='utf-8',
            errors='ignore'
        )
    else:
        command = render_runtime_template(tool_def.get('command') or '', data)
        if not command:
            raise ValueError('CLI 工具缺少 command')
        args_list = render_runtime_template(tool_def.get('argsTemplate') or tool_def.get('args') or [], data)
        if not isinstance(args_list, list):
            args_list = [args_list]
        completed = subprocess.run(
            [str(command), *[str(item) for item in args_list if item is not None]],
            shell=False,
            capture_output=True,
            text=True,
            cwd=cwd,
            env=env,
            timeout=timeout_sec,
            encoding='utf-8',
            errors='ignore'
        )
    stdout = completed.stdout or ''
    stderr = completed.stderr or ''
    if completed.returncode != 0:
        raise RuntimeError((stderr or stdout or f'命令退出码 {completed.returncode}').strip())
    parsed = maybe_parse_json_text(stdout)
    return {
        "output": parsed if parsed is not None else stdout,
        "outputText": stdout.strip() or stderr.strip()
    }

def resolve_runtime_skill_path(path_value):
    raw_path = os.path.expanduser(str(path_value or '').strip())
    if not raw_path:
        return ''
    if os.path.isabs(raw_path):
        return os.path.abspath(raw_path)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(base_dir, raw_path))

def execute_runtime_skill_tool(tool_def, args, context):
    data = get_runtime_tool_context(tool_def, args, context)
    mode = str(render_runtime_template(tool_def.get('mode') or 'read', data)).strip().lower() or 'read'
    target_path = resolve_runtime_skill_path(render_runtime_template(tool_def.get('path') or tool_def.get('skillPath') or '', data))
    if not target_path or not os.path.exists(target_path):
        raise FileNotFoundError('Skill 路径不存在')
    max_bytes = int(tool_def.get('maxBytes') or 24000)
    if mode == 'list':
        if os.path.isdir(target_path):
            entries = sorted(os.listdir(target_path))[:200]
            return {"output": entries, "outputText": '\n'.join(entries)}
        return {"output": [target_path], "outputText": os.path.basename(target_path)}
    if mode == 'search':
        query = str(render_runtime_template(args.get('query') or args.get('needle') or '', data)).strip()
        if not query:
            raise ValueError('Skill search 缺少 query')
        if os.path.isdir(target_path):
            pattern = str(render_runtime_template(tool_def.get('glob') or '**/*', data)).strip() or '**/*'
            files = [p for p in glob.glob(os.path.join(target_path, pattern), recursive=True) if os.path.isfile(p)]
        else:
            files = [target_path]
        matches = []
        for file_path in files[:200]:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as handle:
                    for line_no, line in enumerate(handle, 1):
                        if query.lower() in line.lower():
                            matches.append({
                                "path": file_path,
                                "line": line_no,
                                "text": line.strip()
                            })
                        if len(matches) >= 40:
                            break
            except Exception:
                continue
            if len(matches) >= 40:
                break
        output_text = '\n'.join([f"{item['path']}:{item['line']} {item['text']}" for item in matches])
        return {"output": matches, "outputText": output_text}
    if os.path.isdir(target_path):
        entries = sorted(os.listdir(target_path))[:200]
        return {"output": entries, "outputText": '\n'.join(entries)}
    with open(target_path, 'r', encoding='utf-8', errors='ignore') as handle:
        content = handle.read(max_bytes + 1)
    truncated = len(content) > max_bytes
    final_text = content[:max_bytes]
    if truncated:
        final_text += "\n...[truncated]"
    return {
        "output": {
            "path": target_path,
            "content": final_text
        },
        "outputText": final_text
    }

def _write_mcp_message(stream, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    header = f"Content-Length: {len(body)}\r\n\r\n".encode('ascii')
    stream.write(header)
    stream.write(body)
    stream.flush()

def _read_mcp_message(stream):
    headers = {}
    while True:
        line = stream.readline()
        if not line:
            return None
        if line in (b'\n', b'\r\n'):
            break
        decoded = line.decode('utf-8', errors='ignore').strip()
        if not decoded:
            break
        if ':' in decoded:
            key, value = decoded.split(':', 1)
            headers[key.strip().lower()] = value.strip()
    content_length = int(headers.get('content-length', '0') or '0')
    if content_length <= 0:
        return None
    body = stream.read(content_length)
    if not body:
        return None
    return json.loads(body.decode('utf-8', errors='ignore'))

def _start_mcp_stdout_reader(process, output_queue):
    def reader_loop():
        try:
            while True:
                message = _read_mcp_message(process.stdout)
                if message is None:
                    break
                output_queue.put(message)
        except Exception as exc:
            output_queue.put({"__reader_error__": str(exc)})
    thread = threading.Thread(target=reader_loop, daemon=True)
    thread.start()
    return thread

def _drain_pipe_async(pipe, sink):
    def reader_loop():
        try:
            while True:
                chunk = pipe.readline()
                if not chunk:
                    break
                sink.append(chunk.decode('utf-8', errors='ignore'))
        except Exception:
            pass
    thread = threading.Thread(target=reader_loop, daemon=True)
    thread.start()
    return thread

def _wait_for_mcp_response(output_queue, request_id, timeout_sec):
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        remaining = max(0.05, deadline - time.time())
        try:
            message = output_queue.get(timeout=remaining)
        except queue.Empty:
            continue
        if isinstance(message, dict) and message.get('__reader_error__'):
            raise RuntimeError(message['__reader_error__'])
        if isinstance(message, dict) and message.get('id') == request_id:
            return message
    raise TimeoutError('MCP 响应超时')

def send_mcp_http_message(url, payload, headers, timeout_sec):
    request_headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
    if isinstance(headers, dict):
        request_headers.update({str(k): str(v) for k, v in headers.items()})
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers=request_headers,
        method='POST'
    )
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        raw_text = response.read().decode('utf-8', errors='ignore')
        response_headers = {str(k).lower(): str(v) for k, v in response.getheaders()}
    parsed = maybe_parse_json_text(raw_text)
    if parsed is None and raw_text.startswith('data:'):
        lines = [line[5:].strip() for line in raw_text.splitlines() if line.startswith('data:')]
        parsed = maybe_parse_json_text(lines[-1] if lines else '')
    return parsed or {}, response_headers

def execute_runtime_mcp_http_tool(tool_def, args, context):
    data = get_runtime_tool_context(tool_def, args, context)
    url = str(render_runtime_template(tool_def.get('url') or '', data)).strip()
    if not url:
        raise ValueError('MCP HTTP 工具缺少 url')
    tool_name = str(render_runtime_template(tool_def.get('toolName') or args.get('toolName') or '', data)).strip()
    if not tool_name:
        raise ValueError('MCP 工具缺少 toolName')
    timeout_sec = max(1, int((tool_def.get('timeoutMs') or 45000) / 1000))
    headers = render_runtime_template(tool_def.get('headers') or {}, data)
    headers = headers if isinstance(headers, dict) else {}
    protocol_version = str(tool_def.get('protocolVersion') or MCP_PROTOCOL_VERSION)
    merged_args = render_runtime_template(tool_def.get('fixedArgs') or {}, data)
    if not isinstance(merged_args, dict):
        merged_args = {}
    if isinstance(args, dict):
        merged_args.update(args)
    session_headers = dict(headers)
    if not tool_def.get('skipInitialize'):
        init_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": protocol_version,
                "capabilities": {},
                "clientInfo": {"name": "tapnow-localserver", "version": "2.4.0"}
            }
        }
        init_response, init_headers = send_mcp_http_message(url, init_payload, session_headers, timeout_sec)
        if init_response.get('error'):
            raise RuntimeError(init_response['error'].get('message') or 'MCP initialize 失败')
        session_id = init_headers.get('mcp-session-id') or init_headers.get('x-mcp-session-id')
        if session_id:
            session_headers['Mcp-Session-Id'] = session_id
        initialized_payload = {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}
        try:
            send_mcp_http_message(url, initialized_payload, session_headers, timeout_sec)
        except Exception:
            pass
    call_payload = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": merged_args
        }
    }
    response, _headers = send_mcp_http_message(url, call_payload, session_headers, timeout_sec)
    if response.get('error'):
        raise RuntimeError(response['error'].get('message') or 'MCP tools/call 失败')
    result = response.get('result')
    return {
        "output": result,
        "outputText": flatten_mcp_result_text(result)
    }

def execute_runtime_mcp_stdio_tool(tool_def, args, context):
    data = get_runtime_tool_context(tool_def, args, context)
    command = render_runtime_template(tool_def.get('command') or '', data)
    if not command:
        raise ValueError('MCP stdio 工具缺少 command')
    args_list = render_runtime_template(tool_def.get('commandArgs') or tool_def.get('argsTemplate') or tool_def.get('args') or [], data)
    if not isinstance(args_list, list):
        args_list = [args_list]
    cwd = render_runtime_template(tool_def.get('cwd') or '', data)
    cwd = os.path.abspath(os.path.expanduser(str(cwd))) if cwd else None
    env_extra = render_runtime_template(tool_def.get('env') or {}, data)
    env = os.environ.copy()
    if isinstance(env_extra, dict):
        env.update({str(k): '' if v is None else str(v) for k, v in env_extra.items()})
    timeout_sec = max(1, int((tool_def.get('timeoutMs') or 45000) / 1000))
    tool_name = str(render_runtime_template(tool_def.get('toolName') or args.get('toolName') or '', data)).strip()
    if not tool_name:
        raise ValueError('MCP 工具缺少 toolName')
    merged_args = render_runtime_template(tool_def.get('fixedArgs') or {}, data)
    if not isinstance(merged_args, dict):
        merged_args = {}
    if isinstance(args, dict):
        merged_args.update(args)
    process = subprocess.Popen(
        [str(command), *[str(item) for item in args_list if item is not None]],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        env=env
    )
    output_queue = queue.Queue()
    stderr_lines = []
    _start_mcp_stdout_reader(process, output_queue)
    _drain_pipe_async(process.stderr, stderr_lines)
    try:
        _write_mcp_message(process.stdin, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "tapnow-localserver", "version": "2.4.0"}
            }
        })
        init_response = _wait_for_mcp_response(output_queue, 1, timeout_sec)
        if init_response.get('error'):
            raise RuntimeError(init_response['error'].get('message') or 'MCP initialize 失败')
        _write_mcp_message(process.stdin, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})
        _write_mcp_message(process.stdin, {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": merged_args
            }
        })
        response = _wait_for_mcp_response(output_queue, 2, timeout_sec)
        if response.get('error'):
            raise RuntimeError(response['error'].get('message') or 'MCP tools/call 失败')
        result = response.get('result')
        return {
            "output": result,
            "outputText": flatten_mcp_result_text(result) or ''.join(stderr_lines).strip()
        }
    finally:
        try:
            process.terminate()
        except Exception:
            pass
        try:
            process.wait(timeout=1)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass

def execute_runtime_mcp_tool(tool_def, args, context):
    transport = str(tool_def.get('transport') or 'http').strip().lower()
    if transport == 'stdio':
        return execute_runtime_mcp_stdio_tool(tool_def, args, context)
    return execute_runtime_mcp_http_tool(tool_def, args, context)

def execute_runtime_builtin_tool(tool_def, args, context):
    action = str(tool_def.get('action') or tool_def.get('builtin') or 'echo').strip().lower()
    if action == 'time':
        text = datetime.now().isoformat()
        return {"output": {"now": text}, "outputText": text}
    return {
        "output": {
            "args": args,
            "context": context
        },
        "outputText": stringify_runtime_value(args if args is not None else context)
    }

def execute_runtime_tool(tool_def, args, context):
    kind = str(tool_def.get('kind') or 'http').strip().lower()
    if kind == 'cli':
        return execute_runtime_cli_tool(tool_def, args, context)
    if kind == 'skill':
        return execute_runtime_skill_tool(tool_def, args, context)
    if kind == 'mcp':
        return execute_runtime_mcp_tool(tool_def, args, context)
    if kind == 'builtin':
        return execute_runtime_builtin_tool(tool_def, args, context)
    return execute_runtime_http_tool(tool_def, args, context)

def execute_runtime_tool_requests(payload):
    requests = payload.get('toolRequests') or []
    runtime_tools = payload.get('runtimeTools') or []
    context = payload.get('context') or {}
    tool_map = {}
    if isinstance(runtime_tools, list):
        for item in runtime_tools:
            if isinstance(item, dict) and item.get('id'):
                tool_map[str(item.get('id'))] = item
    results = []
    for index, raw_request in enumerate(requests if isinstance(requests, list) else []):
        request = raw_request if isinstance(raw_request, dict) else {}
        tool_id = str(request.get('tool') or '').strip()
        tool_def = tool_map.get(tool_id)
        if not tool_def:
            results.append(build_runtime_result({"id": tool_id, "kind": ""}, {"id": request.get('id') or f"tool-{index+1}", "tool": tool_id}, False, error='未找到对应的运行时工具定义'))
            continue
        try:
            execution = execute_runtime_tool(tool_def, request.get('args') or {}, context)
            results.append(build_runtime_result(tool_def, request, True, execution.get('output'), execution.get('outputText')))
        except Exception as exc:
            results.append(build_runtime_result(tool_def, request, False, error=str(exc)))
    return {
        "success": all(item.get('success') for item in results) if results else True,
        "results": results
    }

# ==============================================================================
# SECTION 4: HTTP 处理器 (Request Handlers)
# ==============================================================================

class TapnowFullHandler(BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # 覆盖默认日志，使用统一的 log 函数
        if config.get("log_enabled", True) and FEATURES.get("log_console", True):
            try:
                log(f"HTTP: {format % args}")
            except Exception:
                log("HTTP: request received")

    # --- 基础 Helper ---
    
    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', '*')
    
    def _send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._send_cors()
            self.end_headers()
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def _read_json_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length == 0: return {}
            return json.loads(self.rfile.read(length).decode('utf-8'))
        except:
            return None

    # --- Router ---

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. ComfyUI 路由
        if (path.startswith('/comfy/')
            or path.startswith('/w/v1/webapp/task/openapi')
            or path.startswith('/task/openapi')) and FEATURES['comfy_middleware']:
            self.handle_comfy_get(path, parsed)
            return

        # 2. 原有功能路由
        if path in ('/proxy', '/proxy/'):
            self.handle_proxy(parsed)
            return
        
        if path == '/status' or path == '/ping':
            self._send_json({
                "status": "running",
                "version": "2.4.0",
                "features": {**FEATURES, "runtime_tools": True},
                "config": {
                    "save_path": config["save_path"],
                    "image_save_path": config["image_save_path"] or config["save_path"],
                    "video_save_path": config["video_save_path"] or config["save_path"],
                    "port": config["port"],
                    "pil_available": PIL_AVAILABLE,
                    "convert_png_to_jpg": config["convert_png_to_jpg"]
                }
            })
            return

        if path == '/runtime-tools/ping':
            self._send_json({"success": True, "runtime_tools": True})
            return
            
        if path == '/config':
            self._send_json({
                "save_path": config["save_path"],
                "image_save_path": config["image_save_path"] or config["save_path"],
                "video_save_path": config["video_save_path"] or config["save_path"],
                "image_save_path_raw": config["image_save_path"],
                "video_save_path_raw": config["video_save_path"],
                "auto_create_dir": config["auto_create_dir"],
                "allow_overwrite": config["allow_overwrite"],
                "convert_png_to_jpg": config["convert_png_to_jpg"],
                "jpg_quality": config["jpg_quality"],
                "proxy_allowed_hosts": config.get("proxy_allowed_hosts", []),
                "proxy_timeout": config.get("proxy_timeout", DEFAULT_PROXY_TIMEOUT),
                "pil_available": PIL_AVAILABLE
            })
            return

        if path == '/list-files':
            base_path = config["save_path"]
            if not os.path.exists(base_path):
                self._send_json({"success": True, "files": [], "base_path": base_path})
                return
            files = []
            for root, dirs, filenames in os.walk(base_path):
                for filename in filenames:
                    if not (is_image_file(filename) or is_video_file(filename)):
                        continue
                    filepath = os.path.join(root, filename)
                    rel_path = os.path.relpath(filepath, base_path)
                    files.append({
                        "filename": filename,
                        "path": filepath.replace('\\', '/'),
                        "rel_path": rel_path.replace('\\', '/'),
                        "size": os.path.getsize(filepath),
                        "mtime": os.path.getmtime(filepath)
                    })
            self._send_json({"success": True, "files": files, "base_path": base_path.replace('\\', '/')})
            return

        if path.startswith('/file/'):
            # 本地文件访问 (/file/download/image.png)
            self.handle_file_serve(path[6:]) # strip '/file/'
            return

        self._send_json({"error": "Endpoint not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. ComfyUI 路由
        if (path.startswith('/comfy/')
            or path.startswith('/w/v1/webapp/task/openapi')
            or path.startswith('/task/openapi')) and FEATURES['comfy_middleware']:
            self.handle_comfy_post(path)
            return

        if path in ('/proxy', '/proxy/'):
            self.handle_proxy(parsed)
            return
            
        # 2. 原有功能路由 (Save)
        body = self._read_json_body()
        if body is None and path != '/proxy':
            self._send_json({"error": "Invalid JSON"}, 400)
            return

        if path == '/save':
            self.handle_save(body)
        elif path == '/runtime-tools/execute':
            self.handle_runtime_tool_execute(body)
        elif path == '/save-batch':
            self.handle_batch_save(body) # 简化：复用 save 逻辑或自行展开
        elif path == '/save-thumbnail':
            self.handle_save_thumbnail(body)
        elif path == '/save-cache':
            self.handle_save_cache(body)
        elif path == '/delete-file':
            self.handle_delete_file(body)
        elif path == '/delete-batch':
            self.handle_delete_batch(body)
        elif path == '/config':
            self.handle_update_config(body)
        else:
            self._send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path in ('/proxy', '/proxy/'):
            self.handle_proxy(parsed)
            return
        self._send_json({"error": "Endpoint not found"}, 404)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path in ('/proxy', '/proxy/'):
            self.handle_proxy(parsed)
            return
        self._send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path in ('/proxy', '/proxy/'):
            self.handle_proxy(parsed)
            return
        self._send_json({"error": "Endpoint not found"}, 404)

    # --- Handlers 实现 ---

    def handle_comfy_get(self, path, parsed):
        if path == '/comfy/apps':
            apps = []
            if os.path.exists(WORKFLOWS_DIR):
                apps = [d for d in os.listdir(WORKFLOWS_DIR) if os.path.isdir(os.path.join(WORKFLOWS_DIR, d))]
            self._send_json({"apps": apps})
            
        elif path.startswith('/comfy/status/'):
            job_id = path.split('/')[-1]
            status = resolve_job_by_request_id(job_id)
            if status: self._send_json(status)
            else: self._send_json({"error": "Job not found"}, 404)

        elif path.startswith('/comfy/outputs/'):
            job_id = path.split('/')[-1]
            job = resolve_job_by_request_id(job_id)
            if job:
                self._send_json(build_outputs_response(job))
            else:
                self._send_json({"code": 404, "message": "Job not found"}, 404)

        elif path in ('/comfy/detail', '/w/v1/webapp/task/openapi/detail', '/task/openapi/detail'):
            params = parse_qs(parsed.query or '')
            request_id = params.get('requestId', [None])[0] or params.get('request_id', [None])[0] or params.get('taskId', [None])[0]
            job = resolve_job_by_request_id(request_id)
            if job:
                self._send_json(build_detail_response(job))
            else:
                self._send_json({"code": 404, "message": "Job not found"}, 404)

        elif path in ('/comfy/outputs', '/w/v1/webapp/task/openapi/outputs', '/task/openapi/outputs'):
            params = parse_qs(parsed.query or '')
            request_id = params.get('requestId', [None])[0] or params.get('request_id', [None])[0] or params.get('taskId', [None])[0]
            job = resolve_job_by_request_id(request_id)
            if job:
                self._send_json(build_outputs_response(job))
            else:
                self._send_json({"code": 404, "message": "Job not found"}, 404)

    def handle_comfy_post(self, path):
        if path in ('/comfy/queue', '/task/openapi/create', '/task/openapi/ai-app/run', '/w/v1/webapp/task/openapi/create'):
            body = self._read_json_body()
            if body is None:
                self._send_json({"error": "Invalid JSON"}, 400)
                return

            app_id = body.get('app_id') or body.get('web_app_id') or body.get('webappId') or body.get('workflow_id') or body.get('appId')
            params = body.get('input_values') or body.get('inputs') or body.get('nodeInfoList') or {}
            raw_prompt = body.get('prompt') if isinstance(body.get('prompt'), dict) else None

            if not app_id and not raw_prompt:
                self._send_json({"code": 400, "message": "Missing app_id or prompt"}, 400)
                return

            job_id = str(uuid.uuid4())
            job = {
                "id": job_id,
                "app_id": app_id,
                "inputs": params,
                "prompt": raw_prompt,
                "status": "queued",
                "created_at": time.time()
            }

            with STATUS_LOCK:
                JOB_STATUS[job_id] = job
            JOB_QUEUE.put(job)

            log(f"[Comfy] 接收任务: {job_id}")
            self._send_json({
                "code": 20000,
                "message": "Ok",
                "status": True,
                "requestId": job_id,
                "request_id": job_id,
                "job_id": job_id,
                "taskId": job_id,
                "data": {
                    "requestId": job_id,
                    "taskId": job_id,
                    "status": "Queued"
                }
            })

    def handle_save(self, data):
        """处理单个文件保存"""
        try:
            filename = data.get('filename', '')
            content = data.get('content', '')
            url = data.get('url', '')
            subfolder = data.get('subfolder', '')
            custom_path = data.get('path', '')

            if not filename and not custom_path:
                self._send_json({"success": False, "error": "缺少文件名"}, 400)
                return

            if custom_path:
                custom_path = os.path.expanduser(custom_path)
                if not os.path.isabs(custom_path):
                    custom_path = safe_join(config["save_path"], custom_path)
                    if not custom_path:
                        self._send_json({"success": False, "error": "非法路径"}, 400)
                        return
                else:
                    custom_path = os.path.abspath(custom_path)
                if not is_path_allowed(custom_path):
                    self._send_json({"success": False, "error": "不允许保存到该路径"}, 403)
                    return
                save_dir = os.path.dirname(custom_path)
                filepath = custom_path
            else:
                if subfolder:
                    save_dir = safe_join(config["save_path"], subfolder)
                    if not save_dir:
                        self._send_json({"success": False, "error": "非法子目录"}, 400)
                        return
                else:
                    save_dir = config["save_path"]
                filepath = os.path.join(save_dir, filename)

            if config["auto_create_dir"]:
                ensure_dir(save_dir)
            elif not os.path.exists(save_dir):
                self._send_json({"success": False, "error": f"目录不存在: {save_dir}"}, 400)
                return

            if not config["allow_overwrite"]:
                filepath = get_unique_filename(filepath)

            if content:
                if ',' in content:
                    content = content.split(',', 1)[1]
                file_data = base64.b64decode(content)
            elif url:
                with urllib.request.urlopen(url) as response:
                    file_data = response.read()
            else:
                self._send_json({"success": False, "error": "缺少文件内容"}, 400)
                return

            with open(filepath, 'wb') as f:
                f.write(file_data)

            log(f"文件已保存: {filepath} ({len(file_data)} bytes)")
            self._send_json({
                "success": True,
                "message": "文件保存成功",
                "path": filepath,
                "size": len(file_data)
            })
        except Exception as e:
            log(f"文件保存失败: {e}")
            self._send_json({"success": False, "error": str(e)}, 500)

    def handle_batch_save(self, data):
        files = data.get('files', [])
        if not files:
            self._send_json({"success": True, "saved_count": 0, "results": []})
            return
        results = []
        for item in files:
            try:
                filename = item.get('filename', '')
                content = item.get('content', '')
                url = item.get('url', '')
                subfolder = item.get('subfolder', '')
                custom_path = item.get('path', '')

                if not filename and not custom_path:
                    results.append({"success": False, "error": "缺少文件名"})
                    continue

                if custom_path:
                    custom_path = os.path.expanduser(custom_path)
                    if not os.path.isabs(custom_path):
                        custom_path = safe_join(config["save_path"], custom_path)
                        if not custom_path:
                            results.append({"success": False, "error": "非法路径"})
                            continue
                    else:
                        custom_path = os.path.abspath(custom_path)
                    if not is_path_allowed(custom_path):
                        results.append({"success": False, "error": "不允许保存到该路径"})
                        continue
                    save_dir = os.path.dirname(custom_path)
                    filepath = custom_path
                else:
                    if subfolder:
                        save_dir = safe_join(config["save_path"], subfolder)
                        if not save_dir:
                            results.append({"success": False, "error": "非法子目录"})
                            continue
                    else:
                        save_dir = config["save_path"]
                    filepath = os.path.join(save_dir, filename)

                if config["auto_create_dir"]:
                    ensure_dir(save_dir)
                elif not os.path.exists(save_dir):
                    results.append({"success": False, "error": f"目录不存在: {save_dir}"})
                    continue

                if not config["allow_overwrite"]:
                    filepath = get_unique_filename(filepath)

                if content:
                    if ',' in content:
                        content = content.split(',', 1)[1]
                    file_data = base64.b64decode(content)
                elif url:
                    with urllib.request.urlopen(url) as response:
                        file_data = response.read()
                else:
                    results.append({"success": False, "error": "缺少文件内容"})
                    continue

                with open(filepath, 'wb') as f:
                    f.write(file_data)

                results.append({"success": True, "path": filepath, "size": len(file_data)})
            except Exception as e:
                results.append({"success": False, "error": str(e)})
        saved_count = sum(1 for r in results if r.get('success'))
        self._send_json({
            "success": True,
            "saved_count": saved_count,
            "results": results
        })

    def handle_delete_file(self, data):
        path = data.get('path', '')
        url = data.get('url', '')
        if not path and url and url.startswith(f"http://127.0.0.1:{config['port']}/file/"):
            rel_path = url.replace(f"http://127.0.0.1:{config['port']}/file/", '')
            rel_path = normalize_rel_path(rel_path)
            if rel_path:
                path = os.path.join(config["save_path"], rel_path)
        if not path or not is_path_allowed(path):
            self._send_json({"error": "Invalid path or permission denied"}, 403)
            return
        try:
            if os.path.exists(path):
                os.remove(path)
                log(f"文件删除: {path}")
                self._send_json({"success": True})
            else:
                self._send_json({"error": "File not found"}, 404)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def handle_delete_batch(self, data):
        files = data.get('files', [])
        if not files:
            self._send_json({"success": False, "error": "没有要删除的文件"}, 400)
            return
        results = []
        base_dirs = [config["save_path"]]
        if config["image_save_path"]:
            base_dirs.append(config["image_save_path"])
        if config["video_save_path"]:
            base_dirs.append(config["video_save_path"])
        for file_info in files:
            try:
                filepath = ''
                url = ''
                if isinstance(file_info, str):
                    filepath = file_info
                else:
                    filepath = file_info.get('path') or ''
                    url = file_info.get('url') or ''
                found_path = None
                if filepath and os.path.isabs(filepath) and os.path.exists(filepath):
                    found_path = filepath
                if not found_path and url and '/file/' in url:
                    rel_path = url.split('/file/')[-1]
                    rel_path = normalize_rel_path(rel_path)
                    if rel_path:
                        for base_dir in base_dirs:
                            check_path = os.path.join(base_dir, rel_path)
                            if os.path.exists(check_path):
                                found_path = check_path
                                break
                if not found_path and filepath and not os.path.isabs(filepath):
                    rel_path_os = filepath.replace('/', os.sep)
                    for base_dir in base_dirs:
                        check_path = os.path.join(base_dir, rel_path_os)
                        if os.path.exists(check_path):
                            found_path = check_path
                            break
                if not found_path:
                    results.append({"path": filepath or url, "success": False, "error": "文件不存在"})
                    continue
                abs_path = os.path.abspath(found_path)
                allowed = any(abs_path.startswith(os.path.abspath(d)) for d in base_dirs)
                if not allowed:
                    ext = os.path.splitext(abs_path)[1].lower()
                    if ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'}:
                        allowed = True
                if not allowed:
                    results.append({"path": found_path, "success": False, "error": "不允许删除"})
                    continue
                os.remove(found_path)
                results.append({"path": found_path, "success": True})
            except Exception as e:
                results.append({"path": filepath or url, "success": False, "error": str(e)})
        success_count = sum(1 for r in results if r.get('success'))
        self._send_json({
            "success": True,
            "message": f"已删除 {success_count}/{len(files)} 个文件",
            "results": results
        })

    def handle_update_config(self, data):
        # 简单的配置更新逻辑
        if 'save_path' in data: 
            config['save_path'] = data['save_path']
        if 'image_save_path' in data:
            config['image_save_path'] = data['image_save_path'] or ''
        if 'video_save_path' in data:
            config['video_save_path'] = data['video_save_path'] or ''
        if 'log_enabled' in data:
            # 仅在明确提供布尔值时更新，避免 null/空字符串误关闭日志
            if isinstance(data['log_enabled'], bool):
                config['log_enabled'] = data['log_enabled']
        if 'convert_png_to_jpg' in data:
            config['convert_png_to_jpg'] = bool(data['convert_png_to_jpg'])
        if 'jpg_quality' in data:
            try:
                config['jpg_quality'] = int(data['jpg_quality'])
            except Exception:
                pass
        if 'proxy_allowed_hosts' in data and isinstance(data['proxy_allowed_hosts'], list):
            config['proxy_allowed_hosts'] = data['proxy_allowed_hosts']
        if 'proxy_timeout' in data:
            try:
                config['proxy_timeout'] = int(data['proxy_timeout'])
            except Exception:
                pass
        log("配置已更新")
        self._send_json({"success": True, "config": config})

    def handle_runtime_tool_execute(self, data):
        try:
            result = execute_runtime_tool_requests(data if isinstance(data, dict) else {})
            self._send_json(result)
        except Exception as exc:
            log(f"运行时工具执行失败: {exc}")
            self._send_json({"success": False, "error": str(exc)}, 500)

    def handle_save_thumbnail(self, data):
        try:
            item_id = data.get('id', '')
            content = data.get('content', '')
            category = data.get('category', 'history')
            if not item_id or not content:
                self._send_json({"success": False, "error": "缺少ID或内容"}, 400)
                return
            cache_dir = os.path.join(config["save_path"], '.tapnow_cache', category)
            ensure_dir(cache_dir)
            filename = f"{item_id}.jpg"
            filepath = os.path.join(cache_dir, filename)
            if ',' in content:
                content = content.split(',', 1)[1]
            file_data = base64.b64decode(content)
            with open(filepath, 'wb') as f:
                f.write(file_data)
            rel_path = f".tapnow_cache/{category}/{filename}"
            local_url = f"http://127.0.0.1:{config['port']}/file/{rel_path}"
            self._send_json({
                "success": True,
                "path": filepath,
                "url": local_url,
                "rel_path": rel_path
            })
        except Exception as e:
            self._send_json({"success": False, "error": str(e)}, 500)

    def handle_save_cache(self, data):
        try:
            item_id = data.get('id', '')
            content = data.get('content', '')
            category = data.get('category', 'characters')
            filename_ext = data.get('ext', '.jpg')
            file_type = data.get('type', 'image')
            custom_path = data.get('custom_path', '')
            if not item_id or not content:
                self._send_json({"success": False, "error": "缺少ID或内容"}, 400)
                return
            if custom_path:
                cache_dir = os.path.expanduser(custom_path)
                if not os.path.isabs(cache_dir):
                    cache_dir = safe_join(config["save_path"], cache_dir)
                    if not cache_dir:
                        self._send_json({"success": False, "error": "非法路径"}, 400)
                        return
                else:
                    cache_dir = os.path.abspath(cache_dir)
                if not is_path_allowed(cache_dir):
                    self._send_json({"success": False, "error": "不允许保存到该路径"}, 403)
                    return
                base_root = config["save_path"]
            elif file_type == 'video' and config["video_save_path"]:
                base_root = config["video_save_path"]
                cache_dir = os.path.join(base_root, category)
            elif file_type == 'image' and config["image_save_path"]:
                base_root = config["image_save_path"]
                cache_dir = os.path.join(base_root, category)
            else:
                base_root = config["save_path"]
                cache_dir = os.path.join(base_root, '.tapnow_cache', category)
            ensure_dir(cache_dir)
            if ',' in content:
                content = content.split(',', 1)[1]
            file_data = base64.b64decode(content)
            converted = False
            if file_type == 'image' and config["convert_png_to_jpg"] and filename_ext.lower() == '.png':
                file_data, converted = convert_png_to_jpg(file_data, config["jpg_quality"])
                if converted:
                    filename_ext = '.jpg'
            filename = f"{item_id}{filename_ext}"
            filepath = os.path.join(cache_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(file_data)
            try:
                rel_path = os.path.relpath(filepath, base_root).replace('\\', '/')
            except ValueError:
                rel_path = os.path.relpath(filepath, cache_dir).replace('\\', '/')
                if base_root == config["save_path"]:
                    rel_path = f".tapnow_cache/{category}/{rel_path}"
                else:
                    rel_path = f"{category}/{rel_path}"
            if rel_path.startswith('..'):
                rel_path = os.path.relpath(filepath, cache_dir).replace('\\', '/')
                if base_root == config["save_path"]:
                    rel_path = f".tapnow_cache/{category}/{rel_path}"
                else:
                    rel_path = f"{category}/{rel_path}"
            local_url = f"http://127.0.0.1:{config['port']}/file/{rel_path}"
            self._send_json({
                "success": True,
                "path": filepath,
                "url": local_url,
                "rel_path": rel_path,
                "converted": converted,
                "size": len(file_data)
            })
        except Exception as e:
            self._send_json({"success": False, "error": str(e)}, 500)

    def handle_file_serve(self, rel_path):
        rel_path = normalize_rel_path(rel_path)
        if not rel_path:
            self.send_response(400); self.end_headers(); return
        candidates = [
            os.path.join(config["save_path"], rel_path),
        ]
        if config["image_save_path"]:
            candidates.append(os.path.join(config["image_save_path"], rel_path))
        if config["video_save_path"]:
            candidates.append(os.path.join(config["video_save_path"], rel_path))
        filepath = None
        for candidate in candidates:
            if os.path.exists(candidate) and os.path.isfile(candidate):
                filepath = candidate
                break
        if not filepath:
            self.send_response(404); self.end_headers(); return
        try:
            stat = os.stat(filepath)
            etag = f"\"{int(stat.st_mtime)}-{stat.st_size}\""
            if_match = self.headers.get('If-None-Match', '')
            if if_match == etag:
                self.send_response(304)
                self.send_header('ETag', etag)
                self.send_header('Cache-Control', LOCAL_FILE_CACHE_CONTROL)
                self.send_header('Last-Modified', formatdate(stat.st_mtime, usegmt=True))
                self._send_cors()
                self.end_headers()
                return
            content_type, _ = mimetypes.guess_type(filepath)
            if not content_type:
                if filepath.endswith('.png'): content_type = 'image/png'
                elif filepath.endswith('.jpg') or filepath.endswith('.jpeg'): content_type = 'image/jpeg'
                elif filepath.endswith('.webp'): content_type = 'image/webp'
                elif filepath.endswith('.gif'): content_type = 'image/gif'
                elif filepath.endswith('.mp4'): content_type = 'video/mp4'
                elif filepath.endswith('.webm'): content_type = 'video/webm'
                else: content_type = 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(stat.st_size))
            self.send_header('ETag', etag)
            self.send_header('Last-Modified', formatdate(stat.st_mtime, usegmt=True))
            self.send_header('Cache-Control', LOCAL_FILE_CACHE_CONTROL)
            self._send_cors()
            self.end_headers()
            if self.command == 'HEAD':
                return
            with open(filepath, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except Exception:
            try:
                self.send_response(500); self.end_headers()
            except Exception:
                pass

    def handle_proxy(self, parsed):
        target_url = parse_proxy_target(parsed, self.headers)
        if not target_url:
            self._send_json({"success": False, "error": "缺少目标URL"}, 400)
            return
        parsed_target = urlparse(target_url)
        if parsed_target.scheme not in ('http', 'https') or not parsed_target.hostname:
            self._send_json({"success": False, "error": "非法目标URL"}, 400)
            return
        if not is_proxy_target_allowed(target_url):
            self._send_json({"success": False, "error": "目标域名不在允许列表"}, 403)
            return

        method = self.command
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        forward_headers = {}
        for key, value in self.headers.items():
            lower = key.lower()
            if lower in PROXY_SKIP_REQUEST_HEADERS:
                continue
            if lower in ('origin', 'referer'):
                continue
            forward_headers[key] = value
        if parsed_target.netloc:
            forward_headers['Host'] = parsed_target.netloc

        path = parsed_target.path or '/'
        if parsed_target.query:
            path = f"{path}?{parsed_target.query}"

        port = parsed_target.port or (443 if parsed_target.scheme == 'https' else 80)
        conn_class = http.client.HTTPSConnection if parsed_target.scheme == 'https' else http.client.HTTPConnection
        timeout_value = config.get("proxy_timeout", DEFAULT_PROXY_TIMEOUT)
        timeout_value = None if timeout_value == 0 else timeout_value
        try:
            conn = conn_class(parsed_target.hostname, port, timeout=timeout_value)
            conn.request(method, path, body=body, headers=forward_headers)
            resp = conn.getresponse()
        except Exception as exc:
            log(f"代理请求失败: {exc}")
            self._send_json({"success": False, "error": f"代理请求失败: {exc}"}, 502)
            try:
                conn.close()
            except Exception:
                pass
            return

        try:
            response_headers = resp.getheaders()
            content_type = ''
            for header, value in response_headers:
                if header.lower() == 'content-type':
                    content_type = value
                    break
            should_override_cache = (
                method in ('GET', 'HEAD')
                and resp.status in (200, 203, 206)
                and (is_media_content_type(content_type) or is_media_path(parsed_target.path))
            )
            self.send_response(resp.status, resp.reason)
            for header, value in response_headers:
                lower = header.lower()
                if lower in PROXY_SKIP_RESPONSE_HEADERS:
                    continue
                if should_override_cache and lower in ('cache-control', 'expires', 'pragma'):
                    continue
                self.send_header(header, value)
            if should_override_cache:
                self.send_header('Cache-Control', PROXY_MEDIA_CACHE_CONTROL)
            self._send_cors()
            self.end_headers()

            if method == 'HEAD':
                return

            for chunk in iter_proxy_response_chunks(resp):
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            resp.close()
            conn.close()


# ==============================================================================
# SECTION 5: 主程序入口 (Entry Point)
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description='Tapnow Studio Local Server v2.3')
    parser.add_argument('-p', '--port', type=int, default=DEFAULT_PORT, help='Port number')
    parser.add_argument('-d', '--dir', type=str, default=DEFAULT_SAVE_PATH, help='Save directory')
    args = parser.parse_args()
    
    # 1. 初始化配置
    config["port"] = args.port
    config["save_path"] = os.path.abspath(os.path.expanduser(args.dir))
    load_config_file()
    
    # 2. 准备目录
    ensure_dir(config["save_path"])
    if FEATURES["comfy_middleware"]:
        ensure_dir(WORKFLOWS_DIR)

    # 3. 启动后台线程
    if FEATURES["comfy_middleware"]:
        t = threading.Thread(target=ComfyMiddleware.worker_loop, daemon=True)
        t.start()
        log(f"ComfyUI 中间件模块已启用 (Workflows: {WORKFLOWS_DIR})")
    else:
        log("ComfyUI 中间件模块已禁用 (缺少 websocket-client 或手动关闭)")

    # 4. 启动 HTTP 服务
    server = ThreadingHTTPServer(('0.0.0.0', args.port), TapnowFullHandler)
    
    print("=" * 60)
    print(f"  Tapnow Local Server v2.3 running on http://127.0.0.1:{args.port}")
    print(f"  Save Path: {config['save_path']}")
    print("-" * 60)
    print("  Modules:")
    print(f"  [x] File Server")
    print(f"  [x] HTTP Proxy")
    print(f"  [x] Runtime Tools")
    print(f"  [{'x' if FEATURES['comfy_middleware'] else ' '}] ComfyUI Middleware")
    print("=" * 60)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")

if __name__ == '__main__':
    main()
