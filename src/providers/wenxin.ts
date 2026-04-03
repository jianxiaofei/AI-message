import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';
import { buildPrompt } from '../commit/prompt';

export class WenxinProvider implements AIProvider {
    readonly name = '文心一言';

    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> {
        return !!(this.config.apiKey && (this.config.endpoint || '').includes('baidu'));
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const model = this.config.model || 'ernie-3.5-8k';
        const prompt = buildPrompt(diff, changedFiles, this.config.language);

        // 文心一言需要先获取 token
        const tokenResp = await fetch(
            'https://aip.baidubce.com/rpc/2.0/token?grant_type=client_credentials&client_id=' +
            (this.config.apiKey || '') +
            '&client_secret=' +
            (this.config.endpoint || ''),
            { method: 'POST' }
        );

        const tokenData = await tokenResp.json() as { access_token?: string };
        const accessToken = tokenData.access_token || '';

        const response = await fetch(
            `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${accessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
                signal: AbortSignal.timeout(this.config.timeout || 30000)
            }
        );

        if (!response.ok) {
            throw new Error(`文心一言 API 错误：${response.statusText}`);
        }

        const data = await response.json() as { result?: string };
        return data.result || '';
    }
}
