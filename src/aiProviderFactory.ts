import * as vscode from 'vscode';
import { AIProvider, AIConfig } from './aiInterface';
import { createProvider, CopilotProvider, OllamaProvider, QianwenProvider, WenxinProvider, ZhipuProvider, CustomProvider } from './providers';
import { VcsFile } from './vcs';

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
            try {
                if (await p.isAvailable()) available.push(p);
            } catch {}
        }
        return available;
    }

    static getConfigFromSettings(): AIConfig {
        const config = vscode.workspace.getConfiguration('aiMessage');
        const provider = config.get<string>('ai.provider', 'copilot');
        const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom;

        const defaultTimeout = provider === 'qianwen' ? 90000 : 30000;

        return {
            provider: provider as AIConfig['provider'],
            apiKey: config.get('ai.apiKey', ''),
            model: config.get('ai.model', defaults.model),
            endpoint: config.get('ai.endpoint', defaults.endpoint || ''),
            timeout: config.get('ai.timeout', defaultTimeout),
            enableEmoji: config.get('commit.enableEmoji', true),
            enableBody: config.get('commit.enableBody', true),
            enableScope: config.get('commit.enableScope', true),
            language: config.get('commit.language', '简体中文')
        };
    }
}

const PROVIDER_DEFAULTS: Record<string, { endpoint?: string; model: string }> = {
    copilot: { model: 'gpt-4o' },
    ollama: { endpoint: 'http://localhost:11434', model: 'qwen2.5:7b' },
    qianwen: { model: 'qwen-plus' },
    wenxin: { model: 'ernie-3.5-8k' },
    zhipu: { model: 'glm-4' },
    custom: { model: 'gpt-3.5-turbo' }
};

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
        try {
            this.provider = await AIProviderFactory.createProvider(this.config);
        } catch (error) {
            console.error('创建 AI 提供商失败:', error);
            this.provider = null;
        }
    }

    getCurrentProvider(): AIProvider | null { return this.provider; }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        if (!this.provider) { await this.refreshProvider(); }
        if (!this.provider) throw new Error('未配置可用的 AI 提供商');

        if (!await this.provider.isAvailable()) {
            const fallback = await this.getFallbackProvider();
            if (fallback) return fallback.generateCommitMessage(diff, changedFiles);
            throw new Error(`AI 提供商 ${this.provider.name} 不可用`);
        }

        try {
            return await this.provider.generateCommitMessage(diff, changedFiles);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`[AI-Message] ${this.provider.name} 调用失败: ${errMsg}`);
            const fallback = await this.getFallbackProvider();
            if (fallback) { return fallback.generateCommitMessage(diff, changedFiles); }
            if (vscode.workspace.getConfiguration('aiMessage').get('enableFallback', true)) {
                return this.generateFallbackMessage(diff, changedFiles);
            }
            throw new Error(`${this.provider.name} 调用失败: ${errMsg}`);
        }
    }

    private async getFallbackProvider(): Promise<AIProvider | null> {
        const available = await AIProviderFactory.getAvailableProviders(this.config);
        // 若用户明确配置了非 Copilot 提供商，不把 Copilot 作为 fallback（避免 selectChatModels 挂起）
        const skipCopilot = this.config.provider !== 'copilot';
        const priorities = ['GitHub Copilot', 'Ollama', '通义千问', '文心一言', '智谱 AI', '自定义 API'];
        for (const name of priorities) {
            if (skipCopilot && name === 'GitHub Copilot') { continue; }
            const p = available.find(x => x.name === name);
            if (p && p !== this.provider) { return p; }
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
            try {
                status.push({ name: p.name, available: await p.isAvailable() });
            } catch (e) {
                status.push({ name: p.name, available: false, error: e instanceof Error ? e.message : '未知错误' });
            }
        }
        return status;
    }

    getCurrentProviderName(): string { return this.provider?.name || '未配置'; }
}

export function copyPaste(text: string): Thenable<string> {
    return vscode.env.clipboard.writeText(text).then(() => text);
}
