# AI-message

一个智能的VS Code扩展，支持多种AI模型为Git/SVN仓库生成专业的提交信息。支持GitHub Copilot、本地Ollama、通义千问、文心一言、智谱AI等多种AI提供商。

## 功能特性

- 🤖 **多AI支持**：支持GitHub Copilot、Ollama、通义千问、文心一言、智谱AI、自定义API
- 🏠 **本地优先**：支持Ollama本地大模型，保护代码隐私
- 🇨🇳 **国产AI**：完整支持通义千问、文心一言、智谱AI等国产大模型
- 🔧 **灵活配置**：可配置模型参数、API地址、超时时间等
- � **智能检测**：自动识别Git或SVN仓库，无需手动配置
- 📁 **双重支持**：完整支持Git和SVN版本控制系统
- 🎨 **表情符号支持**：自动为不同类型的提交添加合适的表情符号（✨🐛📝💄♻️⚡等）
- 📊 **智能分析**：深度分析代码变更，生成详细的提交描述和摘要行
- 🔍 **文件过滤**：支持忽略ignore-on-commit文件，遵循.gitignore/.svnignore规则
- 🚀 **开箱即用**：默认使用GitHub Copilot，支持无API密钥配置
- 🎯 **快速操作**：支持快速提交和自定义编辑
- ⌨️ **快捷键支持**：提供便捷的键盘快捷键
- 🔄 **智能后备**：AI不可用时自动使用基于规则的提交信息

## 支持的AI模型

### 🤖 GitHub Copilot（推荐）
- 无需配置API密钥
- 使用VS Code内置API
- 支持GPT-4o等最新模型

### 🏠 Ollama（本地模型）
- 完全本地运行，保护代码隐私
- 支持Qwen2.5、Llama3、CodeGemma等模型
- 默认端点：http://localhost:11434

### 🇨🇳 国产AI模型
- **通义千问**：支持qwen-max、qwen-plus等模型
- **文心一言**：支持ernie-4.0、ernie-3.5等模型  
- **智谱AI**：支持glm-4、codegeex-4等模型

### 🔧 自定义API
- 支持OpenAI兼容的API接口
- 可配置自定义端点和模型

## 前置要求

1. **VS Code 1.104.0** 或更高版本
2. **版本控制工具**：
   - **Git**: 系统中需要安装Git命令行工具
   - **SVN**: 如使用SVN仓库，需要安装SVN命令行工具
3. **AI服务**（至少配置一种）：
   - **GitHub Copilot**: 安装GitHub Copilot扩展（推荐）
   - **Ollama**: 本地安装并运行Ollama服务
   - **国产AI**: 获取相应的API密钥
   - **自定义API**: 准备兼容OpenAI格式的API服务

## 安装

1. 打开VS Code
2. 进入扩展市场（Ctrl+Shift+X）
3. 搜索"AI-message"
4. 点击安装

## 配置

### 快速开始
1. 安装扩展后，使用 `Ctrl+Alt+G` 生成提交信息
2. 默认使用GitHub Copilot（需要GitHub Copilot扩展）
3. 如果没有Copilot，扩展会使用基于规则的后备方案

### AI提供商配置

#### 1. GitHub Copilot（默认）
```json
{
  "aiMessage.ai.provider": "copilot"
}
```
需要安装GitHub Copilot扩展。

#### 2. Ollama（本地模型）
```json
{
  "aiMessage.ai.provider": "ollama",
  "aiMessage.ai.ollamaEndpoint": "http://localhost:11434",
  "aiMessage.ai.ollamaModel": "qwen2.5:7b"
}
```

#### 3. 通义千问
```json
{
  "aiMessage.ai.provider": "qianwen",
  "aiMessage.ai.qianwenApiKey": "your-api-key",
  "aiMessage.ai.qianwenModel": "qwen-plus"
}
```

#### 4. 文心一言
```json
{
  "aiMessage.ai.provider": "wenxin",
  "aiMessage.ai.wenxinApiKey": "your-api-key",
  "aiMessage.ai.wenxinSecretKey": "your-secret-key",
  "aiMessage.ai.wenxinModel": "ernie-3.5-8k"
}
```

#### 5. 智谱AI
```json
{
  "aiMessage.ai.provider": "zhipu",
  "aiMessage.ai.zhipuApiKey": "your-api-key",
  "aiMessage.ai.zhipuModel": "glm-4"
}
```

#### 6. 自定义API
```json
{
  "aiMessage.ai.provider": "custom",
  "aiMessage.ai.customEndpoint": "https://api.your-service.com/v1/chat/completions",
  "aiMessage.ai.customApiKey": "your-api-key",
  "aiMessage.ai.customModel": "your-model-name"
}
```

### 其他设置

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

### 1. 配置AI提供商

#### 通过UI配置（推荐）
1. 使用快捷键 `Ctrl+Alt+G` 或命令面板搜索"AI Message: 配置 AI 设置"
2. 选择"打开AI设置"配置您的AI提供商
3. 选择"测试AI连接"检查配置是否正确

#### 通过设置文件配置
1. 打开VS Code设置（`Ctrl+,`）
2. 搜索"AI Message"
3. 选择您想要的AI提供商和相关配置

### 2. 生成提交信息

#### 命令面板
1. 按`Ctrl+Shift+P`打开命令面板
2. 输入以下命令之一：
   - **AI Message: 生成提交信息** - 生成提交信息并允许编辑
   - **AI Message: 快速提交** - 直接生成并复制到剪贴板
   - **AI Message: 配置 AI 设置** - 配置和测试AI服务

#### 快捷键
- `Ctrl+Alt+G` (Mac: `Cmd+Alt+G`) - 生成提交信息
- `Ctrl+Alt+Q` (Mac: `Cmd+Alt+Q`) - 快速提交

#### 右键菜单
在文件资源管理器或编辑器中右键，选择"生成提交信息"

### 3. AI提供商状态检查
使用"配置 AI 设置"命令可以：
- 查看当前AI提供商状态
- 测试所有AI提供商的连接
- 查看详细的错误信息

## 工作流程

1. **自动检测仓库**：扩展智能检测当前工作区的版本控制系统（Git优先，然后SVN）
2. **获取文件变更**：根据检测到的VCS类型使用相应命令获取变更
   - Git: 使用`git status --porcelain`和`git diff`
   - SVN: 使用`svn status`和`svn diff`
3. **AI分析**：将代码差异发送给配置的AI提供商生成提交信息
4. **智能后备**：如果主AI提供商不可用，自动尝试其他可用的提供商
5. **用户确认**：允许用户编辑生成的提交信息
6. **执行提交**：可选择立即提交或仅复制到剪贴板

## AI技术

本扩展支持多种AI技术：

### GitHub Copilot
- VS Code内置的AI编程助手
- 无需配置API密钥
- 支持GPT-4o等最新模型
- 自动降级到可用模型

### 本地AI (Ollama)
- 完全本地运行，保护代码隐私
- 支持多种开源模型
- 无网络依赖，响应速度快

### 国产AI服务
- **通义千问**：阿里云的大语言模型
- **文心一言**：百度的对话式AI
- **智谱AI**：清华系AI公司的模型

### 智能后备机制
- 优先级：Copilot > Ollama > 国产模型 > 自定义API
- 自动检测服务可用性
- 失败时自动切换到下一个可用服务
- 最后使用基于规则的生成作为后备

## 系统要求

- **VS Code**: 1.104.0 或更高版本
- **版本控制工具**: Git 或 SVN 命令行工具
- **AI服务**（至少一种）：
  - GitHub Copilot扩展（推荐）
  - Ollama本地服务
  - 国产AI的API密钥
  - 自定义OpenAI兼容API

## Ollama设置指南

### 安装Ollama
1. 访问 [Ollama官网](https://ollama.ai) 下载安装
2. 启动Ollama服务：`ollama serve`
3. 下载推荐模型：`ollama pull qwen2.5:7b`

### 推荐模型
- **qwen2.5:7b** - 中文优化，代码能力强（推荐）
- **llama3:8b** - 综合能力强
- **codegemma:7b** - 专门用于代码生成

## 故障排除

### 常见问题

**问题：AI提供商不可用**
- 使用"配置 AI 设置" > "测试AI连接"检查状态
- 查看具体的错误信息和解决建议
- 检查网络连接和API密钥配置

**问题：GitHub Copilot不可用**
- 确保已安装GitHub Copilot扩展
- 检查是否已登录GitHub账号
- 验证GitHub Copilot订阅是否有效
- 尝试重新启动VS Code

**问题：Ollama连接失败**
- 确保Ollama服务正在运行：`ollama serve`
- 检查端点配置：默认`http://localhost:11434`
- 确认模型已下载：`ollama list`
- 尝试下载推荐模型：`ollama pull qwen2.5:7b`

**问题：国产AI API错误**
- 检查API密钥是否正确
- 确认账户余额和配额
- 验证模型名称是否正确
- 检查网络连接

**问题：提示"当前工作区不是Git/SVN仓库"**
- 确保在VS Code中打开了**真正的仓库**目录
- 检查系统是否安装了Git/SVN命令行工具
- Git: `git --version` 和 `git status`
- SVN: `svn --version` 和 `svn info`

**创建测试SVN仓库**：
```bash
mkdir test-svn && cd test-svn
svnadmin create repo
svn checkout file://$(pwd)/repo working-copy
cd working-copy
echo "test" > test.txt && svn add test.txt
code .  # 在VS Code中打开
```

**问题：没有发现文件变更**
- 确保有未提交的文件修改
- Git: 使用`git status`确认状态
- SVN: 使用`svn status`确认状态

### API密钥获取指南

**通义千问**：
1. 访问 [阿里云DashScope](https://dashscope.aliyun.com/)
2. 注册并创建API Key
3. 在设置中配置 `aiMessage.ai.qianwenApiKey`

**文心一言**：
1. 访问 [百度千帆大模型平台](https://cloud.baidu.com/product/wenxinworkshop)
2. 创建应用获取API Key和Secret Key
3. 配置 `aiMessage.ai.wenxinApiKey` 和 `aiMessage.ai.wenxinSecretKey`

**智谱AI**：
1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册并获取API Key
3. 配置 `aiMessage.ai.zhipuApiKey`

### 调试

1. 使用"配置 AI 设置" > "查看当前AI提供商状态"
2. 查看VS Code输出面板的错误信息
3. 检查具体AI服务的状态和错误信息
4. 尝试不同的AI提供商作为后备

## 使用示例

### 生成的提交信息示例

**场景1：添加新功能**
```
✨ feat(auth): 实现用户认证系统

- 添加JWT令牌认证功能
- 实现用户登录和注册接口
- 添加密码加密和验证
- 创建用户会话管理
```

**场景2：修复bug**
```
🐛 fix(api): 修复用户数据查询异常

- 修正SQL查询条件错误
- 处理空值异常情况
- 优化错误返回信息
```

**场景3：更新文档**
```
📝 docs(readme): 更新安装和配置说明

- 添加AI模型配置指南
- 更新Ollama设置步骤
- 补充故障排除信息
```
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
