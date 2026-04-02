# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 概述

这是一个名为 "AI-message" 的 VS Code 扩展，支持多种 AI 提供商（GitHub Copilot、Ollama、通义千问、文心一言、智谱 AI）为 Git 和 SVN 仓库生成智能提交信息。它允许开发者生成专业的、符合约定式提交格式的提交信息，支持表情符号、智能正文描述以及多种 AI 服务。

## 主要功能

- 🤖 多 AI 提供商支持：GitHub Copilot、Ollama、阿里通义千问、百度文心一言、智谱 AI 以及自定义 API
- 🏠 本地优先：支持 Ollama 本地大模型，保护代码隐私
- 🇨🇳 国产 AI 支持：完整支持通义千问、文心一言和智谱 AI 模型
- 🔧 灵活配置：可配置模型参数、API 端点、超时设置等
- 📁 双版本控制：完整支持 Git 和 SVN 版本控制系统
- 🎨 表情符号支持：根据提交类型自动添加合适的表情符号
- 📊 智能分析：深度分析代码变更，生成详细的提交描述
- 🔍 文件过滤：支持基于 .gitignore/.svnignore 和自定义忽略模式的文件过滤

## 开发与构建设置

### 如何构建和运行

```bash
# 克隆仓库
git clone <repository-url>
cd AI-message

# 安装依赖
npm install

# 编译扩展
npm run compile

# 开发模式运行
npm run watch

# 发布打包
npm run package
```

### 主要代码架构

扩展分为以下几个关键组件：

1. **扩展入口点**: `src/extension.ts` - 处理激活、命令和用户交互
2. **版本控制接口**: `src/vcsInterface.ts` - Git/SVN 操作的抽象接口
3. **VCS 工厂**: `src/vcsFactory.ts` - 用于确定并创建适当的 VCS 服务
4. **Git 服务**: `src/gitService.ts` - Git 特定的 VCS 操作实现
5. **SVN 服务**: `src/svnService.ts` - SVN 特定的 VCS 操作实现
6. **AI 服务和提供商**: 
   - `src/aiService.ts` - 主 AI 服务，处理提供商选择和后备机制
   - `src/aiProviderFactory.ts` - 用于创建 AI 提供商的工厂
   - `src/providers/*` - 各个提供商的实现（Copilot、Ollama、千问、文心、智谱、自定义）

## AI 提供商支持

### GitHub Copilot（推荐）

- 使用 VS Code 内置的 Copilot API
- 基本使用无需 API 密钥
- 支持最新的 GPT-4o 等模型

### Ollama（本地模型）

- 完全本地运行，保护隐私
- 支持 Qwen2.5、Llama3、CodeGemma 等模型
- 默认端点：http://localhost:11434

### 国产 AI 模型

- **通义千问**: 阿里千问模型（qwen-max、qwen-plus 等）
- **文心一言**: 百度 ERNIE 模型（ernie-4.0、ernie-3.5 等）
- **智谱 AI**: 清华系模型家族（glm-4、codegeex-4 等）

### 自定义 API

- 支持 OpenAI 兼容的 API 端点
- 可配置端点、API 密钥和模型参数

## 版本控制支持

扩展同时支持 Git 和 SVN 仓库：

1. **Git**: 
   - 使用 `git status --porcelain` 和 `git diff` 命令获取变更
   - 遵守 `.gitignore` 和 `git.ignoreOnCommit` 配置
2. **SVN**: 
   - 使用 `svn status` 和 `svn diff` 命令获取变更
   - 遵守 `.svnignore` 和 `svn.ignoreOnCommit` 配置

## 扩展配置

配置选项位于 `package.json` 的 `aiMessage` 命名空间下，包括：

- 提供商选择（copilot、ollama、qianwen、wenxin、zhipu、custom）
- API 调用超时设置
- 表情符号和正文内容偏好
- 各提供商的 API 密钥和端点
- git/svn 可执行文件的自定义路径

## 测试

运行测试：

```bash
npm test
```

测试文件位于 `src/test/`。

## 发布流程

发布管理方式：
- `npm run build-and-package` - 构建并打包扩展
- `vsce publish` - 发布到市场

## 开发工作流

1. `npm run compile` - 编译 TypeScript 文件
2. `npm run watch` - 监视文件更改并重新编译
3. `npm run package` - 创建 .vsix 分发包

## 扩展主流程

1. 用户触发 "AI Message: 生成提交信息"（或快速提交变体）
2. 扩展检测 VCS 类型（Git 或 SVN）
3. 从 VCS 系统收集文件变更
4. 从配置中确定当前 AI 提供商
5. 将变更发送到选定的 AI 提供商
6. 处理 AI 响应，生成带表情符号的约定式提交格式
7. 显示或复制提交信息供用户审阅

## 扩展权限和安全

本扩展具有以下权限：

- 访问 VS Code 扩展 API
- 访问文件系统以执行 VCS 操作
- 网络访问外部 AI 服务（配置后）

本扩展不会：

- 在未经用户配置的情况下访问敏感数据
- 在未经用户操作的情况下修改仓库
- 在配置的 AI 提供商之外存储或传输用户数据
