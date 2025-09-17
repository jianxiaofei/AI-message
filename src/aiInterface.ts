import { SvnFile } from './svnService';

export interface AIProvider {
    readonly name: string;
    isAvailable(): Promise<boolean>;
    generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string>;
}

export interface AIConfig {
    provider: 'copilot' | 'ollama' | 'qianwen' | 'wenxin' | 'zhipu' | 'custom';
    timeout: number;
    
    // Ollama配置
    ollamaEndpoint?: string;
    ollamaModel?: string;
    
    // 通义千问配置
    qianwenApiKey?: string;
    qianwenModel?: string;
    
    // 文心一言配置
    wenxinApiKey?: string;
    wenxinSecretKey?: string;
    wenxinModel?: string;
    
    // 智谱AI配置
    zhipuApiKey?: string;
    zhipuModel?: string;
    
    // 自定义配置
    customEndpoint?: string;
    customApiKey?: string;
    customModel?: string;
}

export interface APIResponse {
    success: boolean;
    data?: string;
    error?: string;
}