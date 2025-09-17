import { AIConfig } from '../aiInterface';
import { SvnFile } from '../svnService';
import { BaseProvider } from './baseProvider';

export class QianwenProvider extends BaseProvider {
    readonly name = '通义千问';
    private config: AIConfig;

    constructor(config: AIConfig) {
        super();
        this.config = config;
    }

    async isAvailable(): Promise<boolean> {
        return !!this.config.qianwenApiKey;
    }

    async generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string> {
        if (!this.config.qianwenApiKey) {
            throw new Error('请配置通义千问API Key');
        }

        const model = this.config.qianwenModel || 'qwen-plus';
        const prompt = this.buildBasePrompt(diff, changedFiles);
        
        try {
            const response = await this.fetchWithTimeout('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.qianwenApiKey}`,
                },
                body: JSON.stringify({
                    model: model,
                    input: {
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    },
                    parameters: {
                        temperature: 0.3,
                        top_p: 0.9,
                        max_tokens: 2000
                    }
                })
            }, this.config.timeout || 30000);

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`通义千问API错误: ${response.status} ${errorData}`);
            }

            const data = await response.json() as {
                output?: {
                    text?: string;
                    choices?: Array<{ message?: { content?: string } }>;
                };
                code?: string;
                message?: string;
            };
            
            if (data.code && data.code !== '200') {
                throw new Error(`通义千问API错误: ${data.message || '未知错误'}`);
            }

            let content = '';
            if (data.output?.text) {
                content = data.output.text;
            } else if (data.output?.choices && data.output.choices[0]?.message?.content) {
                content = data.output.choices[0].message.content;
            }

            if (!content) {
                throw new Error('通义千问返回了空响应');
            }

            return this.extractCommitMessage(content.trim());

        } catch (error) {
            this.handleApiError(error, '通义千问');
        }
    }
}