# AI-message

一个智能的VS Code扩展，使用GitHub Copilot的AI能力为Git/SVN仓库生成专业的提交信息。支持自动检测仓库类型，无需配置API密钥，开箱即用！

## 功能特性

- 🤖 **Copilot驱动**：使用VS Code内置的GitHub Copilot API生成专业提交信息
- � **智能检测**：自动识别Git或SVN仓库，无需手动配置
- 📁 **双重支持**：完整支持Git和SVN版本控制系统
- 🎨 **表情符号支持**：自动为不同类型的提交添加合适的表情符号（✨🐛📝💄♻️⚡等）
- 📊 **智能分析**：深度分析代码变更，生成详细的提交描述和摘要行
- 🔍 **文件过滤**：支持忽略ignore-on-commit文件，遵循.gitignore/.svnignore规则
- 🚀 **开箱即用**：无需配置API密钥，依赖GitHub Copilot扩展
- 🎯 **快速操作**：支持快速提交和自定义编辑
- ⌨️ **快捷键支持**：提供便捷的键盘快捷键
- 🔄 **智能后备**：Copilot不可用时自动使用基于规则的提交信息

## 前置要求

1. **VS Code 1.104.0** 或更高版本
2. **GitHub Copilot 扩展**：必须安装并登录
3. **版本控制工具**：
   - **Git**: 系统中需要安装Git命令行工具
   - **SVN**: 如使用SVN仓库，需要安装SVN命令行工具

## 安装

1. 打开VS Code
2. 进入扩展市场（Ctrl+Shift+X）
3. 搜索"AI-message"
4. 点击安装
5. 确保已安装并登录 **GitHub Copilot** 扩展

## 配置

### 自动配置
扩展会自动检测Git或SVN仓库，并使用VS Code的GitHub Copilot，无需手动配置API密钥。

### 可选设置

1. 打开VS Code设置（`Ctrl+,`）
2. 搜索"AI Message"或相关选项
3. 可配置以下选项：
   - **git.ignoreOnCommit**：定义要在Git提交时忽略的文件模式（glob patterns）
   - **svn.ignoreOnCommit**：定义要在SVN提交时忽略的文件模式（glob patterns）
   - **提交信息模板**：自定义模板格式（使用 {message} 占位符）
   - **启用后备方案**：当Copilot不可用时使用基于规则的生成
   - **自定义可执行文件路径**：指定git或svn的自定义安装路径

### 配置示例

```json
{
  "git.ignoreOnCommit": ["*.log", "*.tmp", "node_modules/**", ".vscode/settings.json"],
  "svn.ignoreOnCommit": ["*.log", "*.tmp", "node_modules/**", ".vscode/settings.json"],
  "aiMessage.commitTemplate": "feat: {message}",
  "aiMessage.enableFallback": true,
  "aiMessage.git.path": "/usr/local/bin/git",
  "aiMessage.svn.path": "/opt/homebrew/bin/svn"
}
```

### 智能文件过滤

扩展会根据仓库类型自动过滤以下文件：

**Git仓库**：
- VS Code配置：`git.ignoreOnCommit` 设置的文件模式
- `.gitignore`文件中定义的模式

**SVN仓库**：
- VS Code配置：`svn.ignoreOnCommit` 设置的文件模式  
- `.svnignore`文件中定义的模式

**通用过滤**：
- 常见的临时文件和构建产物

## 使用方法

### 命令面板

1. 按`Ctrl+Shift+P`打开命令面板
2. 输入以下命令之一：
   - **AI Message: 生成提交信息** - 生成提交信息并允许编辑
   - **AI Message: 快速提交** - 直接生成并复制到剪贴板
   - **AI Message: 配置 AI 设置** - 打开Copilot设置或安装页面

### 快捷键

- `Ctrl+Alt+G` (Mac: `Cmd+Alt+G`) - 生成提交信息
- `Ctrl+Alt+Q` (Mac: `Cmd+Alt+Q`) - 快速提交

### 右键菜单

在文件资源管理器或编辑器中右键，选择"生成提交信息"

## 工作流程

1. **自动检测仓库**：扩展智能检测当前工作区的版本控制系统（Git优先，然后SVN）
2. **获取文件变更**：根据检测到的VCS类型使用相应命令获取变更
   - Git: 使用`git status --porcelain`和`git diff`
   - SVN: 使用`svn status`和`svn diff`
3. **生成差异**：使用`svn diff`获取代码差异
4. **Copilot分析**：将差异发送给GitHub Copilot生成提交信息
5. **用户确认**：允许用户编辑生成的提交信息
6. **执行提交**：可选择立即提交或仅复制到剪贴板

## AI技术

本扩展使用：
- **GitHub Copilot**：VS Code内置的AI编程助手
- **Language Model API**：VS Code提供的统一AI模型接口
- **GPT-4o优先**：优先使用最新最强大的模型
- **自动降级**：不可用时自动尝试其他Copilot模型

## 系统要求

- VS Code 1.104.0 或更高版本
- GitHub Copilot 扩展（已安装并登录）
- 系统中安装SVN命令行工具
- 有效的GitHub Copilot订阅

## 故障排除

### 常见问题

**问题：提示"当前工作区不是SVN仓库"**
- 确保在VS Code中打开了**真正的SVN工作副本**目录
- 检查系统是否安装了SVN命令行工具：`svn --version`
- 验证目录是SVN仓库：在终端中运行 `svn info`
- 注意：Git仓库不是SVN仓库，确保打开的是SVN工作副本

**创建测试SVN仓库**：
```bash
mkdir test-svn && cd test-svn
svnadmin create repo
svn checkout file://$(pwd)/repo working-copy
cd working-copy
echo "test" > test.txt && svn add test.txt
code .  # 在VS Code中打开
```

**问题：Copilot不可用**
- 确保已安装GitHub Copilot扩展
- 检查是否已登录GitHub账号
- 验证GitHub Copilot订阅是否有效
- 尝试重新启动VS Code

**问题：没有发现文件变更**
- 确保有未提交的文件修改
- 使用`svn status`命令确认SVN状态

### 调试

1. 查看VS Code输出面板的错误信息
2. 检查GitHub Copilot扩展状态
3. 确认SVN命令行工具可用性

## 使用示例

### 生成的提交信息示例

**场景1：添加新功能**
```
feat(auth): ✨ implement user authentication system

Add comprehensive user authentication with JWT tokens and secure session management.

Key changes:
- Implement login/logout functionality with password validation
- Add JWT token generation and verification middleware  
- Create secure session management with refresh tokens
- Add password hashing with bcrypt for security

Summary of all changes:
• src/auth/AuthService.ts: Added authentication service with login/logout methods
• src/middleware/authMiddleware.ts: Created JWT verification middleware
• src/models/User.ts: Updated user model with password hashing
• tests/auth.test.ts: Added comprehensive authentication test suite
```

**场景2：修复Bug**
```
fix(api): 🐛 resolve null pointer exception in user data processing

Fix critical null pointer exception that occurs when processing user data with missing profile information.

Key changes:
- Add null checks for user profile data
- Implement default values for missing user fields
- Add comprehensive error handling and logging
- Update unit tests to cover edge cases

Summary of all changes:
• src/services/UserService.ts: Added null safety checks and default values
• src/utils/ValidationHelper.ts: Enhanced validation with null checks
• tests/services/UserService.test.ts: Added edge case test scenarios
```

**场景3：文档更新**
```
docs: 📝 update API documentation and usage examples

Update comprehensive API documentation with new endpoints and improved examples.

Summary of all changes:
• docs/api.md: Updated with new authentication endpoints
• README.md: Added usage examples and troubleshooting section
• docs/examples/: Added sample code for common use cases
```

### 支持的提交类型和表情符号

| 类型 | 表情符号 | 说明 | 示例 |
|------|---------|------|------|
| feat | ✨ | 新功能 | `feat(ui): ✨ add dark mode toggle` |
| fix | 🐛 | Bug修复 | `fix(api): 🐛 resolve memory leak in cache` |
| docs | 📝 | 文档更新 | `docs: 📝 update installation guide` |
| style | 💄 | 样式改进 | `style(ui): 💄 improve button hover effects` |
| refactor | ♻️ | 代码重构 | `refactor(core): ♻️ simplify data processing logic` |
| perf | ⚡ | 性能优化 | `perf(db): ⚡ optimize query performance` |
| test | ✅ | 测试相关 | `test(auth): ✅ add integration tests` |
| build | 📦 | 构建系统 | `build: 📦 update webpack configuration` |
| ci | 👷 | CI配置 | `ci: 👷 add automated testing workflow` |
| chore | 🔧 | 其他杂务 | `chore: 🔧 update dependencies` |

## 开发和贡献

### 本地开发

```bash
# 克隆仓库
git clone <repository-url>
cd AI-message

# 安装依赖
npm install

# 编译
npm run compile

# 在扩展开发主机中测试
# 按F5或使用调试配置
```

### 项目结构

```
├── src/
│   ├── extension.ts      # 主扩展入口
│   ├── svnService.ts     # SVN操作服务
│   ├── aiService.ts      # AI集成服务
│   └── test/             # 测试文件
├── package.json          # 扩展配置
└── README.md            # 项目文档
```

## 许可证

MIT License

## 更新日志

### 0.0.1

- 🎉 首次发布
- ✨ 集成GitHub Copilot AI生成SVN提交信息
- 🚀 开箱即用，无需API密钥配置
- 🎯 提供快速提交功能
- ⌨️ 添加快捷键支持
- 🔄 智能后备方案

---

**开始使用SVN AI提交信息生成器，让GitHub Copilot帮您写出更好的提交信息！**

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
