import { AIConfig } from '../aiInterface';
import { SvnFile } from '../svnService';
import { BaseProvider } from './baseProvider';

export class ZhipuProvider extends BaseProvider {
    readonly name = '智谱AI';
    private config: AIConfig;

    constructor(config: AIConfig) {
        super();
        this.config = config;
    }

    async isAvailable(): Promise<boolean> {
        return !!this.config.zhipuApiKey;
    }

    async generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string> {
        if (!this.config.zhipuApiKey) {
            throw new Error('请配置智谱AI API Key');
        }

        const model = this.config.zhipuModel || 'glm-4';
        const prompt = this.buildBasePrompt(diff, changedFiles);
        
        try {
            const response = await this.fetchWithTimeout('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.zhipuApiKey}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    top_p: 0.9,
                    max_tokens: 2000
                })
            }, this.config.timeout || 30000);

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`智谱AI API错误: ${response.status} ${errorData}`);
            }

            const data = await response.json() as {
                choices?: Array<{
                    message?: {
                        content?: string;
                    };
                }>;
                error?: {
                    code?: string;
                    message?: string;
                };
            };
            
            if (data.error) {
                throw new Error(`智谱AI API错误: ${data.error.message || data.error.code || '未知错误'}`);
            }

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('智谱AI返回了空响应');
            }

            return this.extractCommitMessage(content.trim());

        } catch (error) {
            this.handleApiError(error, '智谱AI');
        }
    }
}