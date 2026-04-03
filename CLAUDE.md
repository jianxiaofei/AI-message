# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI-message 是一个 VS Code 扩展，支持多种 AI 模型为 Git/SVN 仓库生成专业的提交信息。支持 GitHub Copilot、本地 Ollama、通义千问、文心一言、智谱 AI 等多种 AI 提供商。

## 构建和开发命令

```bash
# 编译项目（包含类型检查和 lint）
npm run compile

# 开发模式：监听文件变化并自动重新编译
npm run watch

# 打包扩展（发布前）
npm run package

# 构建并打包（含版本号更新）
npm run build-and-package

# 运行测试
npm test

# 类型检查
npm run check-types

# 代码 lint
npm run lint
```

## 发布流程

```bash
# 发布新版本
npm publish

# 补丁版本更新并发布
npm run publish:patch

# 小版本更新并发布
npm run publish:minor

# 大版本更新并发布
npm run publish:major

# 预发布版本
npm run publish:pre
```

## 架构说明

### 核心模块

**入口文件**: `src/extension.ts`
- `activate()`: 扩展激活，注册三个命令
- `generate()`: 主生成流程，支持流式生成
- `streamGenerate()`: Copilot 流式生成实现
- `formatCommit()`: 提交信息格式化处理
- `setScmInputBox()`: 设置 Git/SVN 输入框

**版本控制层**: `src/vcs/`
- `vcsInterface.ts`: 定义 `IVersionControlService` 接口和类型
- `index.ts`: `VcsFactory.createService()` 自动检测并创建服务
- `gitService.ts`: Git 仓库操作实现
- `svnService.ts`: SVN 仓库操作实现

**AI 层**: `src/aiProviderFactory.ts`
- `AIProviderFactory.createProvider()`: 创建 AI 提供商实例
- `AIService.generateCommitMessage()`: 生成提交信息，含 fallback 逻辑
- `AIService.getProviderStatus()`: 获取所有提供商状态

**AI 提供商实现**: `src/providers/`
- `index.ts`: 包含 `createProvider()`、`buildPrompt()`、`extractCommitMessage()`、`EMOJI_MAP`
- 实现 Copilot、Ollama、Qianwen、Wenxin、Zhipu、Custom 六个提供商

### 接口定义

**VCS 接口** (`vcsInterface.ts`):
```
IVersionControlService {
  isInRepository(): Promise<boolean>
  getStatus(): Promise<VcsStatus>
  getSourceControlChanges(): Promise<VcsStatus>
  getCommitReadyChanges(): Promise<VcsStatus>
  getDiff(filePath?: string): Promise<string>
  getVcsType(): 'git' | 'svn'
}
```

### 数据流程

1. 用户触发命令 → `extension.ts` 处理
2. `VcsFactory.createService()` 检测仓库类型（Git 优先）
3. 调用 VCS 服务的 `getDiff()` 和 `getCommitReadyChanges()`
4. `AIService.generateCommitMessage()` 调用 AI 提供商
5. `buildPrompt()` 构建提示词
6. AI 生成 → `extractCommitMessage()` 提取 → `formatCommit()` 格式化
7. 设置到 SCM 输入框或复制到剪贴板

## 关键配置

- **入口**: `./dist/extension.js`
- **编译工具**: esbuild (见 `esbuild.js`)
- **TypeScript 目标**: ES2022
- **VS Code 引擎**: ^1.104.0

## 测试运行

按 F5 或使用 `vscode:prepublish` 任务在扩展开发主机中测试。
