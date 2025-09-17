import * as vscode from 'vscode';
import { AIProvider, AIConfig } from './aiInterface';
import { CopilotProvider } from './providers/copilotProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import { QianwenProvider } from './providers/qianwenProvider';
import { WenxinProvider } from './providers/wenxinProvider';
import { ZhipuProvider } from './providers/zhipuProvider';
import { CustomProvider } from './providers/customProvider';
import { SvnFile } from './svnService';

export class AIProviderFactory {
    private static providers: Map<string, AIProvider> = new Map();

    static async createProvider(config: AIConfig): Promise<AIProvider> {
        const key = `${config.provider}-${JSON.stringify(config)}`;
        
        if (this.providers.has(key)) {
            return this.providers.get(key)!;
        }

        let provider: AIProvider;

        switch (config.provider) {
            case 'copilot':
                provider = new CopilotProvider();
                break;
            case 'ollama':
                provider = new OllamaProvider(config);
                break;
            case 'qianwen':
                provider = new QianwenProvider(config);
                break;
            case 'wenxin':
                provider = new WenxinProvider(config);
                break;
            case 'zhipu':
                provider = new ZhipuProvider(config);
                break;
            case 'custom':
                provider = new CustomProvider(config);
                break;
            default:
                throw new Error(`不支持的AI提供商: ${config.provider}`);
        }

        this.providers.set(key, provider);
        return provider;
    }

    static async getAvailableProviders(config: AIConfig): Promise<AIProvider[]> {
        const allProviders = [
            new CopilotProvider(),
            new OllamaProvider(config),
            new QianwenProvider(config),
            new WenxinProvider(config),
            new ZhipuProvider(config),
            new CustomProvider(config)
        ];

        const availableProviders: AIProvider[] = [];
        
        for (const provider of allProviders) {
            try {
                if (await provider.isAvailable()) {
                    availableProviders.push(provider);
                }
            } catch (error) {
                console.warn(`检查AI提供商 ${provider.name} 可用性时出错:`, error);
            }
        }

        return availableProviders;
    }

    static getConfigFromSettings(): AIConfig {
        const config = vscode.workspace.getConfiguration('aiMessage');
        
        return {
            provider: config.get('ai.provider', 'copilot') as any,
            timeout: config.get('ai.timeout', 30000),
            
            // Ollama配置
            ollamaEndpoint: config.get('ai.ollamaEndpoint', 'http://localhost:11434'),
            ollamaModel: config.get('ai.ollamaModel', 'qwen2.5:7b'),
            
            // 通义千问配置
            qianwenApiKey: config.get('ai.qianwenApiKey', ''),
            qianwenModel: config.get('ai.qianwenModel', 'qwen-plus'),
            
            // 文心一言配置
            wenxinApiKey: config.get('ai.wenxinApiKey', ''),
            wenxinSecretKey: config.get('ai.wenxinSecretKey', ''),
            wenxinModel: config.get('ai.wenxinModel', 'ernie-3.5-8k'),
            
            // 智谱AI配置
            zhipuApiKey: config.get('ai.zhipuApiKey', ''),
            zhipuModel: config.get('ai.zhipuModel', 'glm-4'),
            
            // 自定义配置
            customEndpoint: config.get('ai.customEndpoint', ''),
            customApiKey: config.get('ai.customApiKey', ''),
            customModel: config.get('ai.customModel', '')
        };
    }
}

export class AIService {
    private provider: AIProvider | null = null;
    private config: AIConfig;

    constructor() {
        this.config = AIProviderFactory.getConfigFromSettings();
        this.refreshProvider();
        
        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('aiMessage.ai')) {
                this.config = AIProviderFactory.getConfigFromSettings();
                this.refreshProvider();
            }
        });
    }

    private async refreshProvider() {
        try {
            this.provider = await AIProviderFactory.createProvider(this.config);
        } catch (error) {
            console.error('创建AI提供商失败:', error);
            this.provider = null;
        }
    }

    async generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string> {
        if (!this.provider) {
            await this.refreshProvider();
        }

        if (!this.provider) {
            throw new Error('未配置可用的AI提供商');
        }

        // 检查提供商是否可用
        const isAvailable = await this.provider.isAvailable();
        if (!isAvailable) {
            // 尝试使用后备提供商
            const fallbackProvider = await this.getFallbackProvider();
            if (fallbackProvider) {
                return await fallbackProvider.generateCommitMessage(diff, changedFiles);
            }
            
            throw new Error(`AI提供商 ${this.provider.name} 不可用`);
        }

        try {
            return await this.provider.generateCommitMessage(diff, changedFiles);
        } catch (error) {
            console.error(`AI提供商 ${this.provider.name} 生成失败:`, error);
            
            // 尝试使用后备提供商
            const fallbackProvider = await this.getFallbackProvider();
            if (fallbackProvider) {
                console.log(`使用后备提供商: ${fallbackProvider.name}`);
                return await fallbackProvider.generateCommitMessage(diff, changedFiles);
            }
            
            // 如果启用了后备功能，使用基于规则的生成
            if (vscode.workspace.getConfiguration('aiMessage').get('enableFallback', true)) {
                return this.generateFallbackMessage(diff, changedFiles);
            }
            
            throw error;
        }
    }

    private async getFallbackProvider(): Promise<AIProvider | null> {
        const availableProviders = await AIProviderFactory.getAvailableProviders(this.config);
        
        // 优先级：Copilot > Ollama > 国产模型 > 自定义
        const priorities = ['GitHub Copilot', 'Ollama', '通义千问', '文心一言', '智谱AI', '自定义API'];
        
        for (const priority of priorities) {
            const provider = availableProviders.find(p => p.name === priority);
            if (provider && provider !== this.provider) {
                return provider;
            }
        }
        
        return null;
    }

    private generateFallbackMessage(diff: string, changedFiles: SvnFile[]): string {
        // 基于规则的简单提交信息生成
        const fileTypes = new Set(changedFiles.map(f => f.path.split('.').pop()?.toLowerCase()));
        const operations = new Set(changedFiles.map(f => f.status));
        
        let type = 'chore';
        let emoji = '🔧';
        let scope = '';
        let subject = '更新代码';
        
        // 根据文件类型推断
        if (fileTypes.has('md')) {
            type = 'docs';
            emoji = '📝';
            subject = '更新文档';
        } else if (fileTypes.has('json') && changedFiles.some(f => f.path.includes('package.json'))) {
            type = 'build';
            emoji = '📦';
            subject = '更新依赖配置';
        } else if (operations.has('A')) {
            type = 'feat';
            emoji = '✨';
            subject = '添加新文件';
        } else if (operations.has('D')) {
            type = 'chore';
            emoji = '🔧';
            subject = '删除文件';
        } else if (operations.has('M')) {
            type = 'fix';
            emoji = '🐛';
            subject = '修复问题';
        }
        
        return `${emoji} ${type}(${scope || 'general'}): ${subject}`;
    }

    async getProviderStatus(): Promise<{ name: string; available: boolean; error?: string }[]> {
        const config = AIProviderFactory.getConfigFromSettings();
        const allProviders = [
            new CopilotProvider(),
            new OllamaProvider(config),
            new QianwenProvider(config),
            new WenxinProvider(config),
            new ZhipuProvider(config),
            new CustomProvider(config)
        ];

        const status: { name: string; available: boolean; error?: string }[] = [];

        for (const provider of allProviders) {
            try {
                const available = await provider.isAvailable();
                status.push({ name: provider.name, available });
            } catch (error) {
                status.push({
                    name: provider.name,
                    available: false,
                    error: error instanceof Error ? error.message : '未知错误'
                });
            }
        }

        return status;
    }

    getCurrentProviderName(): string {
        return this.provider?.name || '未配置';
    }
}