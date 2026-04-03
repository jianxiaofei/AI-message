import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';
import { buildPrompt } from '../commit/prompt';
import { postJsonWithCurl } from './curlClient';

export class ZhipuProvider implements AIProvider {
    readonly name = '智谱 AI';

    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> {
        return !!this.config.apiKey;
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const model = this.config.model || 'glm-4';
        const prompt = buildPrompt(diff, changedFiles, this.config.language);
        const timeoutMs = this.config.timeout || 30000;
        const body = JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        });

        console.log(`[AI-Message] 智谱 AI 请求开始，model=${model}, promptLength=${prompt.length}, timeout=${timeoutMs}`);

        const stdout = await postJsonWithCurl({
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body,
            timeoutMs,
            providerName: this.name
        });

        try {
            const data = JSON.parse(stdout) as { choices?: Array<{ message?: { content?: string } }> };
            return data.choices?.[0]?.message?.content || '';
        } catch {
            throw new Error(`响应解析失败: ${stdout.slice(0, 100)}`);
        }
    }
}
