# AI Message v0.0.23 - 多AI模型支持重大更新

## 🎉 新功能

### 🤖 多AI提供商支持
- **GitHub Copilot**: 默认支持，无需配置API密钥
- **Ollama**: 本地大模型支持，保护代码隐私
- **通义千问**: 阿里云AI服务集成
- **文心一言**: 百度AI服务集成
- **智谱AI**: 清华系AI服务集成
- **自定义API**: 支持OpenAI兼容的API接口

### 🏠 本地优先
- 支持Ollama本地运行，完全离线工作
- 推荐模型：qwen2.5:7b, llama3:8b, codegemma:7b
- 无需网络连接，响应速度更快

### 🇨🇳 国产AI完整支持
- 集成主流国产AI服务
- 针对中文代码注释优化
- 支持国内网络环境

### 🔧 灵活配置系统
- 图形化AI配置界面
- 实时连接测试功能
- 智能后备机制
- 自动服务切换

### 🔄 智能后备机制
- 优先级：Copilot > Ollama > 国产模型 > 自定义API
- 自动检测服务可用性
- 失败时自动切换到下一个可用服务

## 🛠️ 改进

### 架构重构
- 插件化AI提供商架构
- 统一的AI接口设计
- 更好的错误处理和日志

### 用户体验
- 新增"配置 AI 设置"命令
- AI提供商状态检查
- 详细的配置向导

### 配置选项
- 18个新的配置选项
- 支持超时设置
- 模型参数配置

## 📋 配置示例

### Ollama本地模型
```json
{
  "aiMessage.ai.provider": "ollama",
  "aiMessage.ai.ollamaEndpoint": "http://localhost:11434",
  "aiMessage.ai.ollamaModel": "qwen2.5:7b"
}
```

### 通义千问
```json
{
  "aiMessage.ai.provider": "qianwen",
  "aiMessage.ai.qianwenApiKey": "your-api-key",
  "aiMessage.ai.qianwenModel": "qwen-plus"
}
```

### 文心一言
```json
{
  "aiMessage.ai.provider": "wenxin",
  "aiMessage.ai.wenxinApiKey": "your-api-key",
  "aiMessage.ai.wenxinSecretKey": "your-secret-key"
}
```

## 🔗 相关链接

- [Ollama官网](https://ollama.ai)
- [通义千问API](https://dashscope.aliyun.com/)
- [文心一言API](https://cloud.baidu.com/product/wenxinworkshop)
- [智谱AI API](https://open.bigmodel.cn/)

## 🚀 升级建议

1. 现有用户将自动使用GitHub Copilot（如果已安装）
2. 想要本地运行的用户推荐安装Ollama
3. 国内用户可考虑使用国产AI服务
4. 企业用户可配置自定义API接口

## 🔧 迁移说明

- 原有配置保持兼容
- 新增配置项都有合理默认值
- 无需修改现有工作流程
- 所有功能向后兼容

这次更新大大增强了扩展的灵活性和可用性，用户现在可以根据自己的需求选择最适合的AI服务！