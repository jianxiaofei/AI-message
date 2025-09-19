import { AIConfig } from '../aiInterface';
import { SvnFile } from '../svnService';
import { BaseProvider } from './baseProvider';

export class CustomProvider extends BaseProvider {
    readonly name = '自定义API';

    constructor(config: AIConfig) {
        super(config);
    }

    async isAvailable(): Promise<boolean> {
        return !!(this.config?.customEndpoint && this.config?.customApiKey);
    }

    async generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string> {
        if (!this.config?.customEndpoint) {
            throw new Error('请配置自定义API接口地址');
        }

        if (!this.config?.customApiKey) {
            throw new Error('请配置自定义API Key');
        }

        const model = this.config?.customModel || 'gpt-3.5-turbo';
        const prompt = this.buildBasePrompt(diff, changedFiles);
        
        try {
            const response = await this.fetchWithTimeout(this.config.customEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.customApiKey}`,
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
                    max_tokens: 2000
                })
            }, this.config?.timeout || 30000);

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`自定义API错误: ${response.status} ${errorData}`);
            }

            const data = await response.json() as {
                choices?: Array<{
                    message?: {
                        content?: string;
                    };
                    text?: string;
                }>;
                error?: {
                    message?: string;
                    type?: string;
                };
                result?: string;
                response?: string;
            };
            
            if (data.error) {
                throw new Error(`自定义API错误: ${data.error.message || data.error.type || '未知错误'}`);
            }

            let content = '';
            if (data.choices?.[0]?.message?.content) {
                content = data.choices[0].message.content;
            } else if (data.choices?.[0]?.text) {
                content = data.choices[0].text;
            } else if (data.result) {
                content = data.result;
            } else if (data.response) {
                content = data.response;
            }

            if (!content) {
                throw new Error('自定义API返回了空响应');
            }

            return this.extractCommitMessage(content.trim());

        } catch (error) {
            this.handleApiError(error, '自定义API');
        }
    }
}
