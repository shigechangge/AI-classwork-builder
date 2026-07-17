# Classwork Studio

> 本地版 — 在自己电脑上跑，不部署到公网。
> 香港中小学 AI 工作单生成器：选定 Level + Subject + Difficulty（可附加课程 PDF），一键生成完整、可打印的工作单。

---

## 功能

- **快速生成（Quick Generate）**：Level + Subject + Difficulty → 一键出题
- **自定义出题（Custom）**：自定义每个分部（Part）的题型、权重、备注、难度
- **课程 PDF 支撑**：把香港课程大纲 PDF 放进 `curriculum/` 文件夹，AI 自动按大纲出题
- **流式 + 持久化**：长题目用 SSE 推到浏览器，进度同时写入磁盘；24 小时内重连可恢复
- **Recent Tasks**：每用户 24 小时任务历史，支持查看/删除
- **数学公式**：浏览器 KaTeX 渲染；导出 DOCX 时自动转为 Unicode 符号
- **图片占位符**：需要图的题目用 `[IMAGE: prompt]` 占位，不再有乱码 ASCII 画

---

## 目录结构

```
classwork-studio-clean/
├── app.py                  # Flask 后端
├── wsgi.py                 # Waitress 入口（Windows 友好）
├── start.bat               # Windows 一键启动
├── requirements.txt
├── .env.example            # 复制为 .env 后填 API key
├── .gitignore
├── LICENSE                 # MIT
├── README.md
├── static/                 # 前端
│   ├── index.html
│   ├── login.html
│   ├── script.js
│   └── style.css
├── curriculum/             # 把 HK 大纲 PDF 放这里
│   └── README.md
└── tasks/                  # 运行时自动生成，存放任务进度
```

---

## 快速开始（Windows）

### 1. 安装 Python 3.10+

### 2. 配置环境

复制一份环境变量模板：

```cmd
copy .env.example .env
```

编辑 `.env`，填入（最简模式：单模型）：

```env
LLM_API_KEY=你的key
ADMIN_PASSWORD=随便设一个
```

或者用多模型模式（见下方"配置项"），每加一个模型一组 `LLM_<KEY>_*`。

### 3. 一键启动

双击 `start.bat`，浏览器打开 [http://localhost:3000](http://localhost:3000)。

`start.bat` 会自动：
1. 创建并激活 `venv\` 虚拟环境
2. 安装 `requirements.txt`
3. 用 Waitress 启动 Flask app

用 `.env` 里设的账号密码登录即可使用。

### 4. 手动启动（可选）

```cmd
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python wsgi.py
```

---

## 配置项

全部在 `.env` 文件里。

### 模型配置

任何兼容 OpenAI Chat Completions 接口的服务都可以用。配置方式有两种：

**多模型模式（推荐）** —— 每加一个模型配一组 `LLM_<KEY>_*` 变量：

| 变量                       | 是否必填 | 说明                                       |
| -------------------------- | -------- | ------------------------------------------ |
| `LLM_<KEY>_API_KEY`        | 必填     | 该模型的 API key，前端下拉里显示 `<KEY>`  |
| `LLM_<KEY>_BASE_URL`       | 可选     | 默认 `https://api.openai.com/v1`           |
| `LLM_<KEY>_MODEL`          | 可选     | 实际请求时发给接口的 model 名，默认等于 `<KEY>` |
| `LLM_<KEY>_MAX_TOKENS`     | 可选     | 默认 `32768`                               |
| `MODEL_NAME`               | 可选     | 默认用的 `<KEY>`；不填就用字母序第一个      |

`<KEY>` 任意字母数字下划线，例如 `PROD` / `FAST` / `OPENAI_OFFICIAL` / `MY_SERVER`。

**单模型模式（最简单）** —— 只设一个 `LLM_API_KEY` 即可，自动成为唯一的默认模型。

示例 `.env`：

```env
LLM_PROD_API_KEY=sk-prod-xxx
LLM_PROD_BASE_URL=https://api.openai.com/v1
LLM_PROD_MODEL=gpt-4o-mini
LLM_PROD_MAX_TOKENS=16384

LLM_FAST_API_KEY=sk-fast-xxx
LLM_FAST_BASE_URL=https://api.openai.com/v1
LLM_FAST_MODEL=gpt-4o-mini

MODEL_NAME=PROD
```

### 其它

| 变量              | 默认值      | 说明                                       |
| ----------------- | ----------- | ------------------------------------------ |
| `ADMIN_USERNAME`  | `admin`     | 唯一允许登录的账号                         |
| `ADMIN_PASSWORD`  | 必填        | 登录密码                                   |
| `SECRET_KEY`      | 自动        | Flask session 密钥，生产环境建议设个随机串 |
| `PORT`            | `5000`      | wsgi.py 监听端口                           |

---

切换/加模型不用动 `app.py`，改 `.env` 即可。多模型会在前端下拉里自动出现。

---

## 课程 PDF

把香港课程/大纲的 PDF 直接丢进 `curriculum/` 文件夹，前端的"Curriculum File"下拉会自动出现。AI 会基于这些内容出题。

每个 PDF 最好控制在几百 KB 内 —— 过大的 PDF 会拖慢生成速度。

---

## 数学、图、DOCX 导出

- **数学公式**：`$...$` 或 `$$...$$` 中写 LaTeX，浏览器用 KaTeX 渲染；导出 DOCX 时自动用 Unicode 字符（`× ÷ √ ² ¹` 等），Word / WPS 直接能看。
- **图**：AI 会用 `[IMAGE: prompt]` 代替 ASCII 艺术。这是占位文本，方便之后接真实出图 API。
- **DOCX**：标准 `python-docx`，可在 `app.py` 顶部调整页边距、字体。

---

## 故障排查

| 症状                                            | 解决                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `proxies`/`proxy` 报错                          | `app.py` 顶部已加 httpx 兼容补丁，重启即可                                      |
| 401 登录失败                                    | 检查 `.env` 里 `ADMIN_USERNAME` / `ADMIN_PASSWORD`                                |
| Tasks 显示 "No tasks found"                     | 还没生成过任务，或当前用户名不同                                                 |
| 题目到一半被截断                                | 模型 `max_tokens` 到了。改 `app.py` 里 `MODEL_CONFIG` 的 `max_tokens` 或换模型  |
| DOCX 里数学符号是普通文本                        | 字体换 Times New Roman / Calibri / Arial / 宋体                                  |

---

## License

MIT
