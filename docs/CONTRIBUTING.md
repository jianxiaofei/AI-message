# 贡献指南

感谢您对 AI-message 项目的兴趣！我们欢迎所有形式的贡献。

## 如何贡献

### 报告问题
- 使用 [GitHub Issues](https://github.com/jianxiaofei/AI-message/issues) 报告 bug
- 在报告前请先搜索现有的 issues
- 提供详细的复现步骤和环境信息

### 功能建议
- 在 Issues 中提出新功能建议
- 详细描述功能的用途和预期行为
- 考虑功能的通用性和实用性

### 代码贡献

#### 开发环境设置
1. Fork 项目到您的 GitHub 账户
2. 克隆您的 fork
   ```bash
   git clone https://github.com/YOUR_USERNAME/AI-message.git
   cd AI-message
   ```
3. 安装依赖
   ```bash
   npm install
   ```
4. 启动开发模式
   ```bash
   npm run watch
   ```

#### 开发流程
1. 创建功能分支
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. 进行更改
3. 运行测试
   ```bash
   npm test
   ```
4. 运行类型检查和 linting
   ```bash
   npm run check-types
   npm run lint
   ```
5. 提交更改
   ```bash
   git commit -m "feat: add your feature description"
   ```
6. 推送分支
   ```bash
   git push origin feature/your-feature-name
   ```
7. 创建 Pull Request

#### 代码规范
- 使用 TypeScript
- 遵循现有的代码风格
- 添加适当的注释
- 为新功能编写测试
- 确保 ESLint 检查通过

#### 提交信息规范
遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat: ` 新功能
- `fix: ` 修复 bug
- `docs: ` 文档更新
- `style: ` 代码格式化
- `refactor: ` 重构
- `test: ` 添加测试
- `chore: ` 其他杂务

### 项目结构
```
src/
├── extension.ts        # 主扩展入口
├── aiService.ts       # AI 服务，Copilot 集成
├── svnService.ts      # SVN 操作服务
├── gitService.ts      # Git 操作服务
├── vcsFactory.ts      # VCS 工厂类
├── vcsInterface.ts    # VCS 接口定义
└── test/             # 测试文件
```

### 测试
- 运行所有测试: `npm test`
- 运行类型检查: `npm run check-types`
- 运行 linting: `npm run lint`

### 调试
1. 在 VS Code 中按 F5 启动调试
2. 这会打开一个新的扩展开发主机窗口
3. 在新窗口中测试您的更改

## 发布流程

只有维护者可以发布新版本：

1. 更新版本号: `npm run version-patch`
2. 更新 CHANGELOG.md
3. 创建 PR 并合并到 main
4. 创建发布标签
5. 发布到市场: `vsce publish`

## 行为准则

- 保持友好和专业
- 尊重不同观点
- 专注于建设性反馈
- 帮助创建包容的环境

## 需要帮助？

如果您有任何问题，请：
- 查看现有的 Issues 和 PR
- 在 Issues 中提问
- 联系维护者 [@jianxiaofei](https://github.com/jianxiaofei)

感谢您的贡献！🎉