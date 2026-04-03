# 更新日志

AI-message 扩展的所有重要变更都将记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.4] - 2026-04-03

### 🐛 修复

- **Copilot 退出登录后生成流程可能挂起**：为 `selectChatModels` 增加超时保护，避免在未登录或不可用时让界面长时间停留在生成中。
- **大 diff 场景下远程模型容易超时**：限制提交提示词中的 diff 长度，避免请求体过大导致远程模型响应过慢。
- **通义千问默认超时过短**：将默认超时提升到 90 秒，更适配远程模型在复杂改动下的响应时间。
- **远程模型请求链路不一致**：新增 `curlClient`，统一 Qwen 与 GLM/智谱的远程请求、超时和错误处理逻辑，便于稳定性排查。
- **非 Copilot 提供商 fallback 误触发 Copilot 检查**：优化 fallback 逻辑，用户显式配置非 Copilot 提供商时跳过 Copilot 探测。

## [0.1.3] - 2026-04-03

### 🐛 修复

- **非 Copilot 提供商卡在"模型流式生成中..."**：修复使用通义千问、智谱 AI 等本地/第三方模型时，进度通知长时间卡住的问题。根本原因有两个：
  1. `generate()` 对所有提供商都先走 Copilot 流式路径（必然失败），在 catch 块中再调用实际 API，期间进度消息无变化、误导用户；现改为检测当前提供商是否为 Copilot，非 Copilot 直接调用对应 API，跳过无效的流式尝试。
  2. Qianwen API endpoint 错误（`apps/chat/completions` → `compatible-mode/v1/chat/completions`），导致请求挂起 30s 才超时。
- **智谱 AI API endpoint 拼写错误**：`paliv0` → `paas/v4`（`open.bigmodel.cn/api/paas/v4/chat/completions`）。
- **Qianwen 鉴权头错误**：从私有 `X-DashScope-Api-Key` 改为标准 `Authorization: Bearer`（OpenAI 兼容接口要求）。

## [0.1.2] - 2026-04-03

### 🐛 修复

- **`commitTemplate` 配置完全不生效**：修复 `aiMessage.commitTemplate` 设置后毫无作用的问题。根本原因是该配置项只在 `package.json` 中定义，但源码中从未读取。现在在 `formatFinalCommit` 中加入读取逻辑：若用户配置了含 `{message}` 占位符的模板（如 `"feat: {message}"`、`"JIRA-123: {message}"`），将用 AI 生成的原始内容直接替换 `{message}`，并跳过常规 Conventional Commit 格式化流程。
- 同步更新 `aiMessage.commitTemplate` 配置项描述，说明用法和示例。

## [0.1.1] - 2026-04-03

### 🐛 修复

- **SVN 流式生成卡住**：修复在 SVN 仓库中生成提交信息时，进度通知卡在"准备流式..."的问题。根本原因是中间进度更新调用 `setScmInputBox` 时，找不到 SVN SCM API 而走 fallback 分支，`await showInformationMessage` 阻塞等待用户点击，现改为 `silent=true` 跳过中间更新的弹窗。
- **进度通知不关闭**：修复流式生成完成后，进度通知一直显示"实时生成中..."的问题。根本原因是最终写入 SCM 输入框时 fallback 的 `await showInformationMessage` 阻塞了 `withProgress` 回调返回，现改为非阻塞 `.then()` 调用，进度通知可正常关闭。

## [0.0.43] - 2025-09-19

### ✨ 新增功能
- 🤖 支持多种 AI 提供商：GitHub Copilot、Ollama、千问、文心一言、智谱AI
- 🔧 灵活的 AI 提供商配置系统，支持自定义 API 端点
- 📝 智能提交信息生成，支持常规提交和约定式提交格式
- 🎯 完整的 Git 和 SVN 版本控制系统支持
- ⚡ 智能后备方案：当 AI 服务不可用时自动使用基于规则的生成
- 🔍 高级代码差异分析，识别函数变更、导入变更等
- 📋 一键复制功能，方便快速使用生成的提交信息
- ⌨️ 便捷的快捷键支持：`Ctrl+Alt+G` (生成)、`Ctrl+Alt+Q` (快速生成)

### 🎛️ 配置选项
- 可配置的 AI 提供商优先级
- 自定义提交信息模板和格式
- 智能 body 生成开关
- 详细的调试日志控制
- 质量检查和格式标准化选项

### 🔧 技术特性
- VS Code Language Model API 集成
- 智能模型降级机制（GPT-4o → GPT-4 → GPT-3.5-turbo）
- 流式响应支持，实时显示生成进度
- 完善的错误处理和用户反馈
- 多平台兼容性（Windows、macOS、Linux）

### 🎨 用户体验
- 友好的进度指示器
- 右键菜单和 SCM 面板集成
- 智能表情符号支持（✨🐛📝💄♻️⚡等）
- 摘要行显示所有变更文件
- ignore-on-commit 文件过滤功能

## [0.0.22] - 2025-01-17

### Added
- 完整的 Git 和 SVN 双重支持
- GitHub Copilot 驱动的 AI 提交信息生成
- 智能表情符号支持（✨🐛📝💄♻️⚡等）
- 摘要行功能，显示所有变更文件
- ignore-on-commit 文件过滤功能
- 专业级 AI 提示工程
- 快捷键支持（Ctrl+Alt+G, Ctrl+Alt+Q）
- 右键菜单和 SCM 面板集成
- 智能后备方案（基于规则的提交信息）

### Fixed
- SVN 仓库检测和状态获取优化
- 文件差异分析改进

## [未来版本计划] - 路线图

### 🚀 即将推出
- 🌐 支持更多国际化 AI 提供商
- 📚 提交信息模板库功能
- 🔄 提交历史分析和建议
- 🌍 多语言提交信息支持
- 📊 提交统计和分析面板
- 🎨 自定义主题和样式支持

### 💡 长期目标
- 🤝 团队协作功能
- 📝 代码审查集成
- 🔗 第三方工具集成（JIRA、Trello等）
- 🧪 A/B 测试不同提示策略
- 📈 机器学习个性化推荐

---

## 贡献指南

欢迎提交问题报告和功能请求到我们的 [GitHub Issues](https://github.com/jianxiaofei/AI-message/issues)。

如果您想为项目贡献代码，请查看我们的 [贡献指南](CONTRIBUTING.md)。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
- 错误处理和用户体验优化

### Changed
- 升级到 VS Code 1.104.0+ 支持
- 简化配置选项，无需 API 密钥
- 依赖 GitHub Copilot 扩展

## [0.0.1] - 2025-01-01

### Added
- 初始版本发布
- 基础 SVN 提交信息生成功能
