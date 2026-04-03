import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';
import { buildPrompt } from '../commit/prompt';

export class ZhipuProvider implements AIProvider {
    readonly name = '智谱 AI';

    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> {
        return !!this.config.apiKey;
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const model = this.config.model || 'glm-4';
        const prompt = buildPrompt(diff, changedFiles, this.config.language);

        const response = await fetch('https://open.bigmodel.cn/api/paliv0/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(this.config.timeout || 30000)
        });

        if (!response.ok) {
            throw new Error(`智谱 AI API 错误：${response.statusText}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content || '';
    }
}
