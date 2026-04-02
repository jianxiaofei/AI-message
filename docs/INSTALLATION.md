# AI-message 扩展安装说明

## 🚀 快速安装

### 方法1：从VSIX文件安装
1. 下载 `ai-message-0.0.2.vsix` 文件
2. 打开VS Code
3. 按 `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) 打开命令面板
4. 输入 "Extensions: Install from VSIX..."
5. 选择下载的 `ai-message-0.0.2.vsix` 文件
6. 重启VS Code

### 方法2：命令行安装
```bash
code --install-extension ai-message-0.0.2.vsix
```

## ✅ 验证安装

安装完成后，你应该能够：
1. 在扩展列表中看到 "AI-message"
2. 使用快捷键 `Ctrl+Alt+G` (Mac: `Cmd+Alt+G`) 生成提交信息
3. 在命令面板中找到 "AI Message" 相关命令
4. **🆕 在Source Control面板看到AI生成按钮** ✨

## 🔧 前置要求

确保你已经安装：
- **GitHub Copilot 扩展** (必需)
- **Git** 和/或 **SVN** 命令行工具

## 📋 功能特性

✨ **新增SCM集成**：
- 🎯 Source Control面板直接显示AI按钮
- 🔄 生成的提交信息直接填充到输入框
- ⚡ 一键生成，无需复制粘贴

🔧 **支持的版本控制系统**：
- ✅ Git (自动检测，SCM集成)
- ✅ SVN (自动检测) 
- 🚀 智能切换，无需配置

## 🎯 使用方法

### 方式1：Source Control面板（推荐）
1. 打开Source Control面板（`Ctrl+Shift+G`）
2. 点击输入框旁边的 ✨ 按钮（生成提交信息）
3. 或点击 ⚡ 按钮（快速生成）
4. 提交信息会自动填充到输入框中

### 方式2：快捷键
- **快捷键**: `Ctrl+Alt+G` / `Cmd+Alt+G` 生成提交信息
- **快捷键**: `Ctrl+Alt+Q` / `Cmd+Alt+Q` 快速生成

### 方式3：命令面板
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "AI Message: 生成提交信息"

## 🆘 问题排查

如果遇到问题：
1. 确保GitHub Copilot扩展已安装并登录
2. 检查当前工作区是否为Git/SVN仓库
3. 验证Git/SVN命令行工具是否可用
4. 查看VS Code开发者控制台的错误信息

---

**版本**: v0.0.1 - Git+SVN双重支持版本  
**发布日期**: 2025年9月17日