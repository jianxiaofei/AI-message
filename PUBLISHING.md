# 📦 AI-message 发版指南

本文档详细说明如何将 AI-message 扩展发布到 VS Code 扩展市场。

## 🚀 快速发版流程

### 前提条件

1. **安装 vsce 工具**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **配置 Microsoft 发布者账号**
   - 访问 [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
   - 使用 Microsoft 账号登录
   - 发布者 ID：`jianxiaofei`（已配置）

3. **设置个人访问令牌**
   - 访问 [Azure DevOps](https://dev.azure.com)
   - 创建 PAT，权限设置为 `Marketplace (manage)`
   - 在 GitHub 仓库添加 Secret：`VSCE_PAT`

## 📋 发版方式

### 方式一：自动发版（推荐）

使用 Git 标签触发自动发布：

```bash
# 1. 确保代码已提交并推送
git add .
git commit -m "feat: ready for release v1.0.0"
git push

# 2. 创建版本标签（触发自动发布）
git tag v1.0.0
git push origin v1.0.0
```

### 方式二：手动发版

```bash
# 发布补丁版本 (0.0.43 -> 0.0.44)
npm run publish:patch

# 发布小版本 (0.0.43 -> 0.1.0)
npm run publish:minor

# 发布大版本 (0.0.43 -> 1.0.0)
npm run publish:major

# 发布预发布版本
npm run publish:pre
```

### 方式三：GitHub Actions 手动触发

1. 访问 GitHub 仓库的 Actions 页面
2. 选择 "Release" 工作流
3. 点击 "Run workflow"
4. 输入版本号（如：1.0.0）
5. 点击 "Run workflow"

## 🔍 发版检查清单

发版前请确保：

- [ ] ✅ 代码已完成测试和审查
- [ ] ✅ [`CHANGELOG.md`](CHANGELOG.md) 已更新当前版本信息
- [ ] ✅ [`README.md`](README.md) 内容准确完整
- [ ] ✅ [`package.json`](package.json) 版本号正确
- [ ] ✅ 所有图片和资源文件已优化
- [ ] ✅ GitHub Secrets 中的 `VSCE_PAT` 已配置
- [ ] ✅ 本地测试扩展功能正常
- [ ] ✅ CI 流水线通过所有检查

## 📊 自动化流程说明

当推送版本标签时，GitHub Actions 会自动执行：

1. **代码检查**
   - 类型检查 (`npm run check-types`)
   - 代码规范检查 (`npm run lint`)
   - 扩展编译 (`npm run compile`)
   - 扩展打包 (`npm run package`)

2. **发布到市场**
   - 使用 vsce 发布到 VS Code Marketplace
   - 自动创建 GitHub Release
   - 上传 `.vsix` 文件到 Release

3. **通知和文档**
   - 生成发版说明
## 🛠️ 可用的 NPM 脚本

```json
{
  "publish": "vsce publish",                    // 发布当前版本
  "publish:patch": "vsce publish patch",       // 发布补丁版本
  "publish:minor": "vsce publish minor",       // 发布小版本  
  "publish:major": "vsce publish major",       // 发布大版本
  "publish:pre": "vsce publish --pre-release", // 发布预发布版本
  "package": "npm run check-types && npm run lint && node esbuild.js --production",
  "build-and-package": "npm run version-patch && npm run package && vsce package --out releases/"
}
```

## 📈 版本控制策略

我们遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **补丁版本** (0.0.X)：Bug 修复、小改进
- **小版本** (0.X.0)：新功能、功能增强
- **大版本** (X.0.0)：破坏性更改、重大重构

当前版本：`0.0.43` → 建议下一个版本：`0.1.0`（功能相对完善）

## 🎯 发版后操作

1. **验证发布**
   - 在 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jianxiaofei.ai-message) 查看扩展
   - 测试从市场安装扩展
   - 验证功能正常工作

2. **推广和反馈**
   - 更新项目文档
   - 收集用户反馈
   - 监控下载量和评价

3. **问题处理**
   - 监控错误报告
   - 准备热修复版本（如需要）

## 🔒 安全注意事项

- `VSCE_PAT` 令牌具有发布权限，请妥善保管
- 定期更新 PAT（建议每年更新）
- 不要在代码中硬编码任何密钥或令牌

## 📞 问题排查

### 常见问题

1. **发布失败：401 Unauthorized**
   - 检查 `VSCE_PAT` 是否正确配置
   - 验证 PAT 是否有 Marketplace 权限

2. **包构建失败**
   - 运行 `npm run check-types` 检查类型错误
   - 运行 `npm run lint` 检查代码规范

3. **GitHub Release 创建失败**
   - 检查 `GITHUB_TOKEN` 权限
   - 确保标签格式正确 (`v*.*.*`)

### 获取帮助

- 提交 [GitHub Issues](https://github.com/jianxiaofei/AI-message/issues)
- 查看 [VS Code 发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- 参考 [vsce 官方文档](https://github.com/microsoft/vscode-vsce)

---

**准备好了吗？开始您的发版之旅！** 🚀