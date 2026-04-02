import * as vscode from 'vscode';
import { AIProvider, AIConfig } from './aiInterface';
import { createProvider, CopilotProvider, OllamaProvider, QianwenProvider, WenxinProvider, ZhipuProvider, CustomProvider } from './providers';
import { VcsFile } from './vcsInterface';

const PROVIDER_DEFAULTS: Record<string, { endpoint?: string; model: string }> = {
    copilot: { model: 'gpt-4o' },
    ollama: { endpoint: 'http://localhost:11434', model: 'qwen2.5:7b' },
    qianwen: { model: 'qwen-plus' },
    wenxin: { model: 'ernie-3.5-8k' },
    zhipu: { model: 'glm-4' },
    custom: { model: 'gpt-3.5-turbo' }
};

export class AIProviderFactory {
    static async createProvider(config: AIConfig): Promise<AIProvider> {
        return createProvider(config);
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

        const available: AIProvider[] = [];
        for (const p of allProviders) {
            try { if (await p.isAvailable()) available.push(p); } catch {}
        }
        return available;
    }

    static getConfigFromSettings(): AIConfig {
        const config = vscode.workspace.getConfiguration('aiMessage');
        const provider = config.get('ai.provider', 'copilot');
        const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom;
        
        return {
            provider: provider as AIConfig['provider'],
            apiKey: config.get('ai.apiKey', ''),
            model: config.get('ai.model', defaults.model),
            endpoint: config.get('ai.endpoint', defaults.endpoint || ''),
            timeout: config.get('ai.timeout', 30000),
            enableEmoji: config.get('commit.enableEmoji', true),
            enableBody: config.get('commit.enableBody', true),
            enableScope: config.get('commit.enableScope', true),
            language: config.get('commit.language', '简体中文')
        };
    }
}

export class AIService {
    private provider: AIProvider | null = null;
    private config: AIConfig;

    constructor() {
        this.config = AIProviderFactory.getConfigFromSettings();
        this.refreshProvider();
        
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('aiMessage.ai')) {
                this.config = AIProviderFactory.getConfigFromSettings();
                this.refreshProvider();
            }
        });
    }

    private async refreshProvider() {
        try { this.provider = await AIProviderFactory.createProvider(this.config); }
        catch (error) { console.error('创建AI提供商失败:', error); this.provider = null; }
    }

    getCurrentProvider(): AIProvider | null { return this.provider; }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        if (!this.provider) { await this.refreshProvider(); }
        if (!this.provider) throw new Error('未配置可用的AI提供商');

        if (!await this.provider.isAvailable()) {
            const fallback = await this.getFallbackProvider();
            if (fallback) return fallback.generateCommitMessage(diff, changedFiles);
            throw new Error(`AI提供商 ${this.provider.name} 不可用`);
        }

        try {
            return await this.provider.generateCommitMessage(diff, changedFiles);
        } catch (error) {
            const fallback = await this.getFallbackProvider();
            if (fallback) return fallback.generateCommitMessage(diff, changedFiles);
            if (vscode.workspace.getConfiguration('aiMessage').get('enableFallback', true)) {
                return this.generateFallbackMessage(diff, changedFiles);
            }
            throw error;
        }
    }

    private async getFallbackProvider(): Promise<AIProvider | null> {
        const available = await AIProviderFactory.getAvailableProviders(this.config);
        const priorities = ['GitHub Copilot', 'Ollama', '通义千问', '文心一言', '智谱AI', '自定义API'];
        for (const name of priorities) {
            const p = available.find(x => x.name === name);
            if (p && p !== this.provider) return p;
        }
        return null;
    }

    private generateFallbackMessage(diff: string, changedFiles: VcsFile[]): string {
        const types = new Set(changedFiles.map(f => f.path.split('.').pop()?.toLowerCase()));
        const ops = new Set(changedFiles.map(f => f.status));
        
        let type = 'chore', emoji = '🔧', subject = '更新代码';
        if (types.has('md')) { type = 'docs'; emoji = '📝'; subject = '更新文档'; }
        else if (types.has('json') && changedFiles.some(f => f.path.includes('package.json'))) { type = 'build'; emoji = '📦'; subject = '更新依赖'; }
        else if (ops.has('A')) { type = 'feat'; emoji = '✨'; subject = '添加新文件'; }
        else if (ops.has('D')) { type = 'chore'; emoji = '🔧'; subject = '删除文件'; }
        else if (ops.has('M')) { type = 'fix'; emoji = '🐛'; subject = '修复问题'; }
        
        return `${emoji} ${type}(general): ${subject}`;
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
        for (const p of allProviders) {
            try { status.push({ name: p.name, available: await p.isAvailable() }); }
            catch (e) { status.push({ name: p.name, available: false, error: e instanceof Error ? e.message : '未知错误' }); }
        }
        return status;
    }

    getCurrentProviderName(): string { return this.provider?.name || '未配置'; }
}
