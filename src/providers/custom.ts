import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';
import { buildPrompt } from '../commit/prompt';

export class CustomProvider implements AIProvider {
    readonly name = '自定义 API';

    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> {
        return !!(this.config.endpoint && this.config.apiKey);
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const endpoint = this.config.endpoint;
        const model = this.config.model;
        const apiKey = this.config.apiKey;
        const prompt = buildPrompt(diff, changedFiles, this.config.language);

        // Try OpenAI-compatible format
        const response = await fetch(endpoint.endsWith('/v1/chat/completions')
            ? endpoint
            : endpoint + '/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7
                }),
                signal: AbortSignal.timeout(this.config.timeout || 30000)
            });

        if (!response.ok) {
            throw new Error(`自定义 API 错误：${response.statusText}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content || '';
    }
}
