import { VcsFile } from './vcsInterface';

export interface AIProvider {
    readonly name: string;
    isAvailable(): Promise<boolean>;
    generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string>;
}

export interface AIConfig {
    provider: 'copilot' | 'ollama' | 'qianwen' | 'wenxin' | 'zhipu' | 'custom';
    apiKey: string;
    model: string;
    endpoint: string;
    timeout: number;
    
    // 提交信息格式配置
    enableEmoji?: boolean;
    enableBody?: boolean;
    enableScope?: boolean;
    language?: string;
}
