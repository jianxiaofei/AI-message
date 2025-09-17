import { AIProvider } from '../aiInterface';
import { SvnFile } from '../svnService';

export abstract class BaseProvider implements AIProvider {
    abstract readonly name: string;
    abstract isAvailable(): Promise<boolean>;
    abstract generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string>;

    /**
     * 构建基础提示词的公共部分
     */
    protected buildBasePrompt(diff: string, changedFiles: SvnFile[]): string {
        const filesDescription = changedFiles.map(file => 
            `${file.path} (${this.getStatusDescription(file.status)})`
        ).join('\n');

        return `你是一个专业的代码提交信息生成助手。请根据以下SVN代码变更，生成符合Conventional Commits规范的中文提交信息。

## 要求：
1. 严格按照"<type>(<scope>): <subject>"格式
2. 使用中文描述（scope可以用英文）
3. 在每个提交类型前添加对应的emoji
4. 不要包含任何解释文字，只输出提交信息
5. 最多16行，直接换行

## 提交类型：
- feat: 新功能
- fix: 错误修复
- docs: 文档更新
- style: 代码格式化
- refactor: 代码重构
- perf: 性能优化
- test: 测试相关
- build: 构建系统
- ci: CI配置
- chore: 其他变更

## Emoji映射：
- feat: ✨
- fix: 🐛
- docs: 📝
- style: 💄
- refactor: ♻️
- perf: ⚡
- test: ✅
- build: 📦
- ci: 👷
- chore: 🔧

## 变更文件 (${changedFiles.length}个):
${filesDescription}

## 代码差异:
\`\`\`diff
${diff}
\`\`\`

请直接输出提交信息，不要包含任何解释：`;
    }

    /**
     * 提取和清理AI响应的提交信息
     */
    protected extractCommitMessage(response: string): string {
        // 清理响应，移除多余的空白和引号
        let cleaned = response.trim().replace(/^["']|["']$/g, '');
        
        // 移除markdown代码块标记
        cleaned = cleaned.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '');
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
        
        // 移除其他常见的格式标记
        cleaned = cleaned.replace(/^`/, '').replace(/`$/, '');
        
        // 按行分割并过滤
        const lines = cleaned.split('\n').map(line => line.trim()).filter(line => line);
        
        // 移除解释性文本和标题
        const filteredLines = lines.filter(line => {
            const lower = line.toLowerCase();
            return !lower.includes('提交信息') && 
                   !lower.includes('生成') &&
                   !lower.includes('基于') &&
                   !lower.includes('分析') &&
                   !lower.includes('示例') &&
                   !lower.includes('example') &&
                   !lower.includes('输出') &&
                   !lower.includes('格式') &&
                   !line.startsWith('#') &&
                   !line.startsWith('**') &&
                   !line.startsWith('*');
        });
        
        if (filteredLines.length === 0) {
            return '✨ feat: 更新代码';
        }
        
        // 处理提交信息
        const processedLines: string[] = [];
        
        for (const line of filteredLines) {
            if (line.includes(':') && this.getCommitType(line)) {
                // 提交格式行，添加emoji
                processedLines.push(this.addEmojiToCommitLine(line));
            } else if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
                // 主体内容（项目符号）
                processedLines.push(line.replace(/^[-•*]\s*/, '- '));
            } else if (line.trim() && !this.isDescriptiveSummary(line)) {
                // 其他内容（排除总结性描述）
                processedLines.push(line);
            }
        }
        
        // 如果没有有效的提交行，创建默认的
        if (processedLines.length === 0 || !processedLines.some(line => line.includes(':'))) {
            return '✨ feat: 更新代码';
        }
        
        // 使用单行换行
        return processedLines.join('\n').trim();
    }

    /**
     * 识别总结性描述行（应该被过滤掉）
     */
    private isDescriptiveSummary(line: string): boolean {
        const lower = line.toLowerCase();
        return lower.includes('本次提交') ||
               lower.includes('此次提交') || 
               lower.includes('本次更新') ||
               lower.includes('此次更新') ||
               lower.includes('包含') ||
               lower.includes('涉及') ||
               (lower.length > 20 && !line.includes(':'));
    }
    
    /**
     * 为提交行添加emoji
     */
    private addEmojiToCommitLine(line: string): string {
        const commitType = this.getCommitType(line);
        const emoji = this.getEmojiForType(commitType);
        
        // 如果已经有emoji，不重复添加
        if (line.match(/^[✨🐛📝💄♻️⚡✅📦👷🔧]/)) {
            return line;
        }
        
        return `${emoji} ${line}`;
    }
    
    /**
     * 从提交行中提取提交类型
     */
    private getCommitType(line: string): string {
        const match = line.match(/^(?:[✨🐛📝💄♻️⚡✅📦👷🔧]\s+)?(\w+)(?:\([^)]*\))?:/);
        return match ? match[1] : '';
    }
    
    /**
     * 根据提交类型获取对应的emoji
     */
    private getEmojiForType(type: string): string {
        const emojiMap: { [key: string]: string } = {
            'feat': '✨',
            'fix': '🐛', 
            'docs': '📝',
            'style': '💄',
            'refactor': '♻️',
            'perf': '⚡',
            'test': '✅',
            'build': '📦',
            'ci': '👷',
            'chore': '🔧',
            'i18n': '🌐'
        };
        return emojiMap[type] || '✨';
    }
    
    /**
     * 获取文件状态的中文描述
     */
    protected getStatusDescription(status: string): string {
        const statusMap: { [key: string]: string } = {
            'M': '修改',
            'A': '新增',
            'D': '删除',
            'R': '重命名',
            'C': '复制',
            '?': '未跟踪',
            '!': '缺失'
        };
        return statusMap[status] || status;
    }

    /**
     * 处理API错误的统一方法
     */
    protected handleApiError(error: any, providerName: string): never {
        console.error(`${providerName} API调用失败:`, error);
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`${providerName} API请求超时`);
            }
            throw new Error(`${providerName}生成失败: ${error.message}`);
        }
        throw new Error(`${providerName}生成失败: 未知错误`);
    }

    /**
     * 创建带超时的fetch请求
     */
    protected async fetchWithTimeout(url: string, options: RequestInit, timeout: number = 30000): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}