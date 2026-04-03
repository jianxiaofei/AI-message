import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';
import { buildPrompt } from '../commit/prompt';

export class OllamaProvider implements AIProvider {
    readonly name = 'Ollama';

    constructor(private config: AIConfig) {}

    async isAvailable(): Promise<boolean> {
        try {
            const endpoint = this.config.endpoint || 'http://localhost:11434';
            const response = await fetch(endpoint + '/api/tags');
            return response.ok;
        } catch {
            return false;
        }
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const endpoint = this.config.endpoint || 'http://localhost:11434';
        const model = this.config.model || 'qwen2.5:7b';
        const prompt = buildPrompt(diff, changedFiles, this.config.language);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout || 30000);
        try {
            const response = await fetch(endpoint + '/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
                signal: controller.signal
            });
            if (!response.ok) { throw new Error(`Ollama API 错误：${response.statusText}`); }
            const data = await response.json() as { message?: { content?: string } };
            return data.message?.content || '';
        } finally { clearTimeout(timer); }
    }
}
