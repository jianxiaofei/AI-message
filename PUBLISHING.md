# 发布指南

## 发布到 VS Code Marketplace

### 前置要求
1. 安装 vsce（Visual Studio Code Extension manager）
   ```bash
   npm install -g vsce
   ```
2. 获取 Azure DevOps Personal Access Token
3. 注册 VS Code Marketplace Publisher

### 发布步骤

#### 1. 版本管理
```bash
# 自动增加版本号并打包到 releases/ 文件夹
npm run build-and-package

# 或只打包不更新版本
npm run package-only

# 或手动增加版本
npm version patch  # 增加补丁版本 (0.0.1 -> 0.0.2)
npm version minor  # 增加次版本 (0.1.0 -> 0.2.0)
npm version major  # 增加主版本 (1.0.0 -> 2.0.0)
```

#### 2. 打包验证
```bash
# 打包扩展到 releases/ 文件夹
npm run package-only

# 测试打包的扩展
code --install-extension releases/ai-message-x.x.x.vsix

# 测试打包的扩展
code --install-extension releases/ai-message-x.x.x.vsix
```

#### 3. 发布到市场
```bash
# 登录（首次）
vsce login <publisher-name>

# 发布
vsce publish

# 或从已打包的 .vsix 文件发布
vsce publish releases/ai-message-x.x.x.vsix
```

### 发布检查清单

- [ ] 更新版本号
- [ ] 更新 CHANGELOG.md
- [ ] 确保所有测试通过
- [ ] 更新 README.md（如有必要）
- [ ] 确保图标和截图正确
- [ ] 验证 package.json 的所有字段
- [ ] 本地测试扩展功能
- [ ] 检查 GitHub Copilot 扩展依赖

### 自动化发布

可以在 GitHub Actions 中设置自动发布工作流：

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run package
      - run: vsce publish -p ${{ secrets.VSCE_PAT }}
```

### 发布注意事项

1. **版本控制**: 遵循语义版本控制 (SemVer)
2. **兼容性**: 确保向后兼容性
3. **文档**: 及时更新使用文档
4. **测试**: 在多个环境中测试
5. **依赖**: 确保所有依赖项都正确设置