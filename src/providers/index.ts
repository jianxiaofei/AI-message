import { AIProvider, AIConfig } from '../aiInterface';
import { CopilotProvider } from './copilot';
import { OllamaProvider } from './ollama';
import { QianwenProvider } from './qianwen';
import { WenxinProvider } from './wenxin';
import { ZhipuProvider } from './zhipu';
import { CustomProvider } from './custom';

// 各提供商默认端点和模型
export const PROVIDER_DEFAULTS: Record<string, { endpoint?: string; model: string }> = {
    copilot: { model: 'gpt-4o' },
    ollama: { endpoint: 'http://localhost:11434', model: 'qwen2.5:7b' },
    qianwen: { model: 'qwen-plus' },
    wenxin: { model: 'ernie-3.5-8k' },
    zhipu: { model: 'glm-4' },
    custom: { model: 'gpt-3.5-turbo' }
};

export function createProvider(config: AIConfig): AIProvider {
    switch (config.provider) {
        case 'copilot': return new CopilotProvider();
        case 'ollama': return new OllamaProvider(config);
        case 'qianwen': return new QianwenProvider(config);
        case 'wenxin': return new WenxinProvider(config);
        case 'zhipu': return new ZhipuProvider(config);
        case 'custom': return new CustomProvider(config);
        default: throw new Error(`不支持的 AI 提供商：${config.provider}`);
    }
}

// Re-exports
export { CopilotProvider } from './copilot';
export { OllamaProvider } from './ollama';
export { QianwenProvider } from './qianwen';
export { WenxinProvider } from './wenxin';
export { ZhipuProvider } from './zhipu';
export { CustomProvider } from './custom';
