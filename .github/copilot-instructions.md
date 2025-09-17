# AI-message VS Code Extension

## Project Overview
This is a VS Code extension that generates SVN commit messages using AI, similar to Dish AI Commit Message Gen.

## Checklist Progress
- [x] Clarify Project Requirements: Creating AI-message generator extension
- [x] Scaffold the Project: Using Yeoman generator for VS Code extension
- [x] Customize the Project: Add SVN integration and AI commit message generation
- [x] Install Required Extensions: Installed esbuild problem matchers
- [x] Compile the Project: Build TypeScript extension successfully
- [x] Create and Run Task: Set up watch tasks for development
- [x] Launch the Project: Ready for debugging in Extension Development Host
- [x] Ensure Documentation is Complete: Updated README and this file

## Extension Features
✅ **已实现**：
- SVN仓库检测和状态获取
- GitHub Copilot驱动的提交信息生成
- VS Code Language Model API集成
- 智能代码差异分析
- 用户友好的命令面板集成
- 快捷键支持（Ctrl+Alt+G, Ctrl+Alt+Q）
- 右键菜单集成
- 简化的配置选项（无需API密钥）
- 智能后备方案（规则基础的提交信息）
- 进度指示器和错误处理
- GitHub Copilot可用性检测

## 架构说明
- `src/extension.ts` - 主扩展入口，命令注册和用户交互
- `src/svnService.ts` - SVN操作服务，处理仓库检测和差异获取
- `src/aiService.ts` - Copilot集成服务，使用VS Code Language Model API
- `package.json` - 扩展配置，命令定义和简化的设置架构

## 使用方法
1. 在SVN仓库中打开VS Code
2. 确保已安装并登录GitHub Copilot扩展
3. 使用快捷键或命令面板生成提交信息
4. 编辑生成的信息并选择提交或复制

## 技术亮点
- 使用VS Code内置的Language Model API
- 优先使用GPT-4o模型，自动降级到可用模型
- 无需用户配置API密钥
- 依赖GitHub Copilot扩展
- 智能错误处理和后备方案

## 下一步可能的改进
- 添加更多AI提供商支持
- 提供提交信息模板功能
- 添加提交历史分析
- 支持多语言提交信息
- 添加测试覆盖