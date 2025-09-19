# 🔐 GitHub Secrets 配置指南

本指南帮助您配置 GitHub Secrets，以便自动发布 AI-message 扩展到 VS Code Marketplace。

## 🎯 需要配置的 Secrets

### 1. VSCE_PAT (必需)
用于发布扩展到 VS Code Marketplace 的个人访问令牌。

### 2. GITHUB_TOKEN (自动提供)
GitHub 自动提供，用于创建 Release 和上传文件。

## 🚀 配置步骤

### 步骤 1: 创建 Microsoft 个人访问令牌

1. **访问 Azure DevOps**
   - 打开 [https://dev.azure.com](https://dev.azure.com)
   - 使用您的 Microsoft 账号登录

2. **创建 Personal Access Token**
   - 点击右上角用户头像
   - 选择 "Personal access tokens"
   - 点击 "+ New Token"

3. **配置令牌权限**
   ```
   Name: AI-message VS Code Extension Publishing
   Organization: All accessible organizations
   Expiration: 1 year (建议)
   Scopes: Custom defined
   ```

4. **选择权限范围**
   - 展开 "Marketplace" 部分
   - 勾选 "Manage" 权限
   - 其他权限可以不选

5. **创建并复制令牌**
   - 点击 "Create"
   - **重要**：立即复制生成的令牌（只显示一次）

### 步骤 2: 在 GitHub 中添加 Secret

1. **访问仓库设置**
   - 在 GitHub 中打开 AI-message 仓库
   - 点击 "Settings" 标签

2. **添加 Secret**
   - 在左侧菜单选择 "Secrets and variables" → "Actions"
   - 点击 "New repository secret"

3. **配置 VSCE_PAT Secret**
   ```
   Name: VSCE_PAT
   Secret: [粘贴您的个人访问令牌]
   ```
   - 点击 "Add secret"

### 步骤 3: 验证配置

1. **测试自动发布**
   ```bash
   # 创建测试标签
   git tag v0.0.44-test
   git push origin v0.0.44-test
   ```

2. **检查 Actions 运行**
   - 访问 GitHub 仓库的 "Actions" 标签
   - 查看 "Release" 工作流是否成功运行

3. **验证发布（测试用，记得删除）**
   - 如果是测试，记得在 VS Code Marketplace 删除测试版本
   - 删除测试标签：`git tag -d v0.0.44-test && git push origin :refs/tags/v0.0.44-test`

## 🔧 故障排查

### 常见问题

1. **401 Unauthorized Error**
   ```
   错误：Failed to publish extension: Error: Request failed with status code 401
   ```
   **解决方案**：
   - 检查 VSCE_PAT 是否正确配置
   - 确认 PAT 具有 Marketplace Manage 权限
   - 验证 PAT 是否已过期

2. **Publisher Not Found**
   ```
   错误：Extension publisher 'jianxiaofei' not found
   ```
   **解决方案**：
   - 确认您在 VS Code Marketplace 中创建了发布者账号
   - 验证 package.json 中的 publisher 名称正确

3. **Secret Not Found**
   ```
   错误：The secret `VSCE_PAT` is not set
   ```
   **解决方案**：
   - 检查 Secret 名称是否正确 (大小写敏感)
   - 确认 Secret 已保存并生效

### 调试技巧

1. **查看 Actions 日志**
   - 在 GitHub Actions 中查看详细错误信息
   - 检查每个步骤的执行结果

2. **本地测试**
   ```bash
   # 设置环境变量（临时测试用）
   export VSCE_PAT="your-token-here"
   
   # 本地测试发布（不推荐生产环境）
   vsce publish --pat $VSCE_PAT
   ```

## 🔒 安全最佳实践

### Token 管理
- ✅ 定期更新 PAT（建议每年）
- ✅ 使用最小权限原则
- ✅ 不要在代码中硬编码 token
- ✅ 监控 token 使用情况

### GitHub Secrets 安全
- ✅ 只授予需要的仓库权限
- ✅ 定期审查 Secret 配置
- ✅ 使用不同环境的不同 token
- ✅ 记录 token 创建和更新时间

## 📊 发布者账号管理

### 创建发布者账号（如果还没有）

1. **访问 Visual Studio Marketplace**
   - 打开 [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
   - 使用 Microsoft 账号登录

2. **创建发布者**
   - 如果是第一次，系统会提示创建发布者
   - 发布者 ID：`jianxiaofei`（已在 package.json 中配置）
   - 显示名称：可以设置为更友好的名称

3. **验证发布者**
   - 确保发布者状态为 "Active"
   - 记录发布者 ID，确保与 package.json 一致

## 🚨 应急处理

### 如果 Token 泄露

1. **立即撤销 Token**
   - 在 Azure DevOps 中撤销泄露的 token
   - 创建新的 token

2. **更新 GitHub Secret**
   - 用新 token 替换 VSCE_PAT secret
   - 测试新 token 是否工作正常

3. **审查安全日志**
   - 检查是否有异常的扩展发布活动
   - 审查 Azure DevOps 的访问日志

### 紧急发布

如果自动发布失败，可以手动发布：

```bash
# 1. 本地构建
npm run package

# 2. 手动发布
npx vsce publish --pat YOUR_TOKEN

# 3. 手动创建 GitHub Release
# 通过 GitHub 网页界面创建 Release 并上传 .vsix 文件
```

---

## 📞 获取帮助

如果遇到配置问题：
- 查看 [Azure DevOps PAT 文档](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- 参考 [VS Code 发布指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- 提交 [GitHub Issues](https://github.com/jianxiaofei/AI-message/issues)

配置完成后，您就可以通过 Git 标签自动发布扩展了！🎉