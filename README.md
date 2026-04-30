
![Tapnow Studio](./assets/tapnow-studio-cover.png)

# Tapnow Studio

**AI 创意工作台** — 可视化节点画布 × 多模型图像/视频生成 × 智能分镜编辑

一个单文件 React 应用，通过可视化节点画布连接 AI 模型，完成从灵感构思到成品输出的完整创作流程。

---

## 核心能力

### ♾️ 可视化节点画布
- 4000×4000 无限画布，支持拖拽连线、框选批量操作、滚轮缩放平移
- 节点类型：图片/视频/文字输入、AI 绘图/视频、智能分镜、角色场景提取、预览窗口、本地保存
- 三级性能模式（关闭/普通/极速），大量节点下自动降级渲染

### 🎨 图像编辑工作台（v3.8.8 新增）
- **局部重绘**：画笔/矩形/椭圆/点标注工具，精细模式下笔刷可小至 1px
- **编号点标注**：在图上打点标记并备注要求，编译为结构化提示词精准传达给模型
- **文字无痕修改**：全图 OCR 扫描识字 → 原地编辑替换 → 保持字体排版一致
- **智能抠图**：主体分离 / 换底 / 电商精修，支持纯白/中性灰/透明感背景
- **拆图分层**：将成品图分解为主体层/背景层/文案层/渲染层，输出干净素材图

### 🤖 多模型支持
- **Chat**：GPT-5.5 / 5.4 / 5.2 / 5.1 / 4o，Gemini 3.1 Pro/Flash
- **Image**：gpt-image-2、GPT-5.4-image / 5.5-image（ChatImage）、GPT-4o-image
- **Video**：Sora-2 / Sora-2 Pro、Seedance 系列
- 统一请求模板系统，支持自定义参数、请求链、异步轮询、多 API Key 智能轮换

### 🎬 智能分镜系统
- 可视化分镜编辑器，支持批量生成、首尾帧控制、多图参考、实时预览
- 小说文本 → LLM 拆分 → 角色/场景提取 → 分镜脚本 → 批量出图全链路

### 📦 数据持久化
- IndexedDB 图像存储 + 内存 LRU 缓存，彻底解决 Blob URL 失效
- 自动保存（60s 间隔），画布状态断电不丢
- 支持 ZIP 批量导出 / 导入项目

---

## 最近更新

### v3.8.8 (2026-04-30)

**性能优化**
- blob URL 缓存加入 100 条目 LRU 逐出，杜绝无限增长
- IndexedDB getStats 改用游标累加，避免大型图像库加载卡死
- MaskEditor 绘制历史改为压缩 PNG Blob，大图下内存占用减少 10-50 倍
- LazyBase64Image 卸载时正确释放 blob URL

**模型升级**
- 新增 GPT-5.4 / GPT-5.5 / GPT-5.4-image / GPT-5.5-image 模型支持
- 扩展能力模式：原生图像编辑、多图输出、Inpainting、图层分解

**图像编辑增强**
- 精细画笔模式（1-9px）适配细节修改
- 编号点标注系统（①②③）结构化 prompt 编译
- 拆图分层预设：2-6 层可选，自动同步出图张数

**工程架构**
- 提取 7 个工具模块（api / storage / constants / normalization / image / geometry / validation）
- vite.config.js 添加路径别名

---

## 本地运行

### 1. 安装依赖

```bash
git clone https://github.com/tiaotiaoba/canva-gemini.git
cd canva-gemini
npm install
```

### 2. 启动服务

```bash
# 启动 Vite 开发服务器（前端）
npm run dev

# 另开终端，启动 Python 本地接收器（后端代理/文件存储）
python localserver/tapnow-server-full.py
```

启动后访问：
| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | `http://localhost:5173` | Vite 开发服务器 |
| 接收器 | `http://127.0.0.1:9527` | Python 本地服务（代理/文件存储） |

### 3. 构建单文件

```bash
npm run build     # 构建为 dist/index.html，可直接用浏览器打开
```

构建产物为 `dist/index.html`，无需服务器即可本地使用。

### Docker（可选）

```bash
docker compose up -d --build    # 前端 http://127.0.0.1:8080 + 接收器 http://127.0.0.1:9527
docker compose logs -f          # 查看日志
docker compose down             # 停止
```

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [模型库说明](./model-template-readme.md) | 模型配置、请求模板与自定义参数指南 |
| [本地服务说明](./localserver/LocalServer_README.md) | 本地接收器 API 与配置 |
| [ComfyUI 代理说明](./localserver/Middleware_README-ComfyUI.md) | 本地 ComfyUI 接入指南 |
| [Docker 部署说明](./localserver/Docker_README.md) | 双容器部署详细文档 |
| [详细更新日志](./changelog.md) | 全部版本变更记录 |

---

## 技术栈

- **前端**：React 18 + Vite + Tailwind CSS，构建为单文件 HTML
- **后端**：Python FastAPI 本地接收器（代理 / 文件存储 / ComfyUI 桥接）
- **存储**：IndexedDB + localStorage + 本地文件缓存
- **部署**：Vite 开发服务器 + Python FastAPI 本地接收器（可选 Docker Compose）
