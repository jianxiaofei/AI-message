import * as vscode from 'vscode';
import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';

// 各提供商默认端点和模型
const PROVIDER_DEFAULTS: Record<string, { endpoint?: string; model: string }> = {
    copilot: { model: 'gpt-4o' },
    ollama: { endpoint: 'http://localhost:11434', model: 'qwen2.5:7b' },
    qianwen: { model: 'qwen-plus' },
    wenxin: { model: 'ernie-3.5-8k' },
    zhipu: { model: 'glm-4' },
    custom: { model: 'gpt-3.5-turbo' }
};

const EMOJI_MAP: Record<string, string> = {
    feat: '✨', fix: '🐛', docs: '📝', style: '💄',
    refactor: '♻️', perf: '⚡', test: '✅', build: '📦', ci: '👷', chore: '🔧'
};

function buildPrompt(diff: string, changedFiles: VcsFile[]): string {
    const filesDesc = changedFiles.map(f => `${f.path} (${f.status})`).join('\n');
    const fileTypes = changedFiles.map(f => f.path.split('.').pop()?.toLowerCase()).join(', ');
    const ops = [...new Set(changedFiles.map(f => f.status))].join(', ');
    
    return `# AI Message Generator

## 要求
1. 仅输出符合Conventional Commits规范的中文提交信息
2. 不包含任何解释或额外文本
3. 格式: <type>(<scope>): <subject>

## 类型参考
- feat: 新功能, fix: 错误修复, docs: 文档更新
- style: 代码格式化, refactor: 代码重构, perf: 性能优化
- test: 测试相关, build: 构建系统, chore: 其他变更

## Emoji
✨ feat, 🐛 fix, 📝 docs, 💄 style, ♻️ refactor, ⚡ perf, ✅ test, 📦 build, 🔧 chore

## 变更文件 (${changedFiles.length}个):
${filesDesc}

## 文件类型: ${fileTypes}
## 操作: ${ops}

## 代码差异:
\`\`\`diff
${diff}
\`\`\`

输出提交信息：`;
}

function extractCommitMessage(response: string): string {
    let cleaned = response.trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '')
        .replace(/^`/, '').replace(/`$/, '');
    
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l);
    const filtered = lines.filter(l => {
        const lower = l.toLowerCase();
        return !lower.includes('提交信息') && !lower.includes('生成') && 
               !lower.includes('示例') && !l.startsWith('#') && !l.startsWith('**');
    });
    
    if (filtered.length === 0) return '✨ feat: 更新代码';
    
    const processed: string[] = [];
    for (const line of filtered) {
        if (line.includes(':')) {
            const type = line.match(/^(\w+)/)?.[1] || 'feat';
            const emoji = EMOJI_MAP[type] || '✨';
            processed.push(emoji + ' ' + line);
        } else if (line.startsWith('-') || line.startsWith('*')) {
            processed.push(line);
        } else if (line.trim()) {
            processed.push(line);
        }
    }
    
    return processed.length > 0 ? processed.join('\n').trim() : '✨ feat: 更新代码';
}

export class CopilotProvider implements AIProvider {
    readonly name = 'GitHub Copilot';

    async isAvailable(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            return models.length > 0;
        } catch { return false; }
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        const model = models[0] || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];
        if (!model) throw new Error('没有可用的 Copilot 模型');

        const prompt = buildPrompt(diff, changedFiles);
        const cts = new vscode.CancellationTokenSource();
        try {
            const response = await model.sendRequest(
                [vscode.LanguageModelChatMessage.User(prompt)],
                {},
                cts.token
            );
            let result = '';
            for await (const fragment of response.text) { result += fragment; }
            return extractCommitMessage(result.trim());
        } finally { cts.dispose(); }
    }
}

export class OllamaProvider implements AIProvider {
    readonly name = 'Ollama';
    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> {
        try {
            const endpoint = this.config.endpoint || 'http://localhost:11434';
            const res = await fetch(`${endpoint}/api/tags`, { method: 'GET' });
            return res.ok;
        } catch { return false; }
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const endpoint = this.config.endpoint || 'http://localhost:11434';
        const model = this.config.model || 'qwen2.5:7b';
        const prompt = buildPrompt(diff, changedFiles);

        const res = await fetch(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.3 } })
        });

        if (!res.ok) throw new Error(`Ollama API错误: ${res.status}`);
        const data = await res.json() as { response?: string };
        if (!data.response) throw new Error('Ollama返回空响应');
        return extractCommitMessage(data.response.trim());
    }
}

export class QianwenProvider implements AIProvider {
    readonly name = '通义千问';
    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> { return !!this.config.apiKey; }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        if (!this.config.apiKey) throw new Error('请配置 API Key');
        const model = this.config.model || 'qwen-plus';
        const prompt = buildPrompt(diff, changedFiles);

        const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model,
                input: { messages: [{ role: 'user', content: prompt }] },
                parameters: { temperature: 0.3, max_tokens: 2000 }
            })
        });

        if (!res.ok) throw new Error(`通义千问API错误: ${res.status}`);
        const data = await res.json() as { output?: { text?: string; choices?: Array<{ message?: { content?: string } }> } };
        const content = data.output?.text || data.output?.choices?.[0]?.message?.content || '';
        if (!content) throw new Error('通义千问返回空响应');
        return extractCommitMessage(content.trim());
    }
}

export class WenxinProvider implements AIProvider {
    readonly name = '文心一言';
    private accessToken = '';
    private tokenExpire = 0;
    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> { return !!this.config.apiKey; }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        if (!this.config.apiKey) throw new Error('请配置 API Key');
        
        const keys = this.config.apiKey.split(':');
        if (keys.length < 2) throw new Error('文心一言需要两个Key，用冒号分隔: "API_KEY:SECRET_KEY"');
        
        const token = await this.getToken(keys[0], keys[1]);
        const model = this.config.model || 'ernie-3.5-8k';
        const endpoint = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model.includes('4.0') ? 'completions_pro' : 'completions'}?access_token=${token}`;
        const prompt = buildPrompt(diff, changedFiles);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
        });

        if (!res.ok) throw new Error(`文心一言API错误: ${res.status}`);
        const data = await res.json() as { result?: string; error_msg?: string };
        if (data.error_msg) throw new Error(`文心一言API错误: ${data.error_msg}`);
        if (!data.result) throw new Error('文心一言返回空响应');
        return extractCommitMessage(data.result.trim());
    }

    private async getToken(apiKey: string, secretKey: string): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpire) return this.accessToken;
        
        const res = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        if (!res.ok) throw new Error(`获取token失败: ${res.status}`);
        const data = await res.json() as { access_token?: string; expires_in?: number };
        if (!data.access_token) throw new Error('未获取到access token');
        
        this.accessToken = data.access_token;
        this.tokenExpire = Date.now() + (data.expires_in || 3600) * 1000 - 5 * 60 * 1000;
        return this.accessToken;
    }
}

export class ZhipuProvider implements AIProvider {
    readonly name = '智谱AI';
    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> { return !!this.config.apiKey; }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        if (!this.config.apiKey) throw new Error('请配置 API Key');
        const model = this.config.model || 'glm-4';
        const prompt = buildPrompt(diff, changedFiles);

        const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!res.ok) throw new Error(`智谱AI API错误: ${res.status}`);
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
        if (data.error) throw new Error(`智谱AI API错误: ${data.error.message}`);
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('智谱AI返回空响应');
        return extractCommitMessage(content.trim());
    }
}

export class CustomProvider implements AIProvider {
    readonly name = '自定义API';
    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> { return !!(this.config.endpoint && this.config.apiKey); }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        if (!this.config.endpoint) throw new Error('请配置 API 端点');
        if (!this.config.apiKey) throw new Error('请配置 API Key');
        
        const model = this.config.model || 'gpt-3.5-turbo';
        const prompt = buildPrompt(diff, changedFiles);

        const res = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!res.ok) throw new Error(`自定义API错误: ${res.status}`);
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
        if (data.error) throw new Error(`自定义API错误: ${data.error.message}`);
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('自定义API返回空响应');
        return extractCommitMessage(content.trim());
    }
}

export function createProvider(config: AIConfig): AIProvider {
    switch (config.provider) {
        case 'copilot': return new CopilotProvider();
        case 'ollama': return new OllamaProvider(config);
        case 'qianwen': return new QianwenProvider(config);
        case 'wenxin': return new WenxinProvider(config);
        case 'zhipu': return new ZhipuProvider(config);
        case 'custom': return new CustomProvider(config);
        default: throw new Error(`不支持的AI提供商: ${config.provider}`);
    }
}

export { PROVIDER_DEFAULTS, EMOJI_MAP };
