import { AIConfig } from '../aiInterface';
import { SvnFile } from '../svnService';
import { BaseProvider } from './baseProvider';

export class OllamaProvider extends BaseProvider {
    readonly name = 'Ollama';

    constructor(config: AIConfig) {
        super(config);
    }

    async isAvailable(): Promise<boolean> {
        try {
            const endpoint = this.config?.ollamaEndpoint || 'http://localhost:11434';
            const response = await this.fetchWithTimeout(`${endpoint}/api/tags`, {
                method: 'GET',
            }, 5000);
            return response.ok;
        } catch (error) {
            console.error('Ollama可用性检查失败:', error);
            return false;
        }
    }

    async generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string> {
        const endpoint = this.config?.ollamaEndpoint || 'http://localhost:11434';
        const model = this.config?.ollamaModel || 'qwen2.5:7b';
        
        const prompt = this.buildBasePrompt(diff, changedFiles);
        
        try {
            const response = await this.fetchWithTimeout(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        top_p: 0.9,
                        top_k: 40
                    }
                })
            }, this.config?.timeout || 30000);

            if (!response.ok) {
                throw new Error(`Ollama API错误: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as { response?: string };
            
            if (!data.response) {
                throw new Error('Ollama返回了空响应');
            }

            return this.extractCommitMessage(data.response.trim());

        } catch (error) {
            this.handleApiError(error, 'Ollama');
        }
    }
}