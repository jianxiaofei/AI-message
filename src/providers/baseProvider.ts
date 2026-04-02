import { AIProvider, AIConfig } from '../aiInterface';
import { VcsFile } from '../vcsInterface';

export abstract class BaseProvider implements AIProvider {
    abstract readonly name: string;
    protected config?: AIConfig;

    constructor(config?: AIConfig) {
        this.config = config;
    }

    abstract isAvailable(): Promise<boolean>;
    abstract generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string>;

    /**
     * 构建基础提示词的公共部分
     */
    protected buildBasePrompt(diff: string, changedFiles: VcsFile[]): string {
        const filesDescription = changedFiles.map(file => 
            `${file.path} (${this.getStatusDescription(file.status)})`
        ).join('\n');

        return `# Commit Message Guide

**CRITICAL INSTRUCTION: YOU MUST FOLLOW THESE EXACT REQUIREMENTS**
1. OUTPUT ONLY THE COMMIT MESSAGE IN 简体中文
2. FOLLOW THE FORMAT EXACTLY AS SHOWN IN EXAMPLES
3. INCLUDE NO EXPLANATIONS OR ADDITIONAL TEXT
4. NEVER USE ENGLISH UNLESS SPECIFIED

## REQUIRED ACTIONS (MUST DO)

1. Determine the true intention of this commit based on the actual changes (including path, file name, content, and diff code), and choose the commit type that best suits the purpose.
2. Identify the modules/files that have been modified.
3. Determine the type of modification.
4. WRITE ALL CONTENT IN 简体中文 (except for technical terms and scope)
5. FOLLOW THE EXACT FORMAT TEMPLATE shown in examples
6. USE ENGLISH ONLY FOR SCOPE and technical terms
7. INCLUDE APPROPRIATE EMOJI when enabled (ENABLED)
8. CREATE SEPARATE commit messages for each file

## PROHIBITED ACTIONS (MUST NOT DO)

1. DO NOT include any explanations, greetings, or additional text
2. DO NOT write in English (except for technical terms and scope)
3. DO NOT add any formatting instructions or metadata
4. DO NOT include triple backticks (\`\`\`) in your output
5. DO NOT add any comments or questions
6. DO NOT deviate from the required format

## FORMAT TEMPLATE

Each commit message should follow this exact format:
<emoji> <type>(<scope>): <subject>

<body>

## TYPE REFERENCE

| Type     | Emoji | Description          | Example Scopes      |
| -------- | ----- | -------------------- | ------------------- |
| feat     | ✨    | New feature          | user, payment       |
| fix      | 🐛    | Bug fix              | auth, data          |
| docs     | 📝    | Documentation        | README, API         |
| style    | 💄    | Code style           | formatting          |
| refactor | ♻️    | Code refactoring     | utils, helpers      |
| perf     | ⚡    | Performance          | query, cache        |
| test     | ✅    | Testing              | unit, e2e           |
| build    | 📦    | Build system         | webpack, npm        |
| ci       | 👷    | CI config            | Travis, Jenkins     |
| chore    | 🔧    | Other changes        | scripts, config     |
| i18n     | 🌐    | Internationalization | locale, translation |

## WRITING RULES

### Subject Line
- Use ! for Breaking Changes: \`feat(auth)!: ...\`
- Scope must be in English
- Use imperative mood
- No capitalization
- No period at end
- Maximum 50 characters
- Must be in 简体中文 (except scope)
- The body MUST begin one blank line after the description
> If you cannot clearly classify a specific module or function, you can use \`core\` or \`misc\` as the default scope

### Body
- Breaking Changes must include detailed impact description
- Use bullet points with "-"
- Maximum 72 characters per line
- Explain what and why
- Must be in 简体中文
- Use【】for categorizing different types of changes

## EXAMPLES OF CORRECT OUTPUT

### Example: Feature Implementation with Body (SVN)
\`\`\`
✨ feat(auth): 实现JWT用户认证系统

- 替换传统token认证为JWT认证
-【Breaking Change】旧token格式不再支持
-【迁移】客户端需要更新认证逻辑
- 实现token刷新机制
\`\`\`

### Example: Bug Fix with Detailed Explanation (SVN)
\`\`\`
� fix(billing): 修复折扣计算逻辑错误

- 修正了百分比折扣计算中的舍入错误
- 确保折扣金额不超过订单总额
- 添加边界值检查防止负数折扣
\`\`\`

### Example: Refactoring Code (SVN)
\`\`\`
♻️ refactor(user): 重构用户配置模块提高可读性

- 重构了用户配置模块代码以提高可读性和可维护性
- 将通用逻辑提取为辅助函数
\`\`\`

## SELF-VERIFICATION CHECKLIST

Before finalizing your output, verify:
1. LANGUAGE CHECK: Is it 100% in 简体中文 (except for scope and technical terms)?
2. FORMAT CHECK: Does it strictly follow the "<emoji> <type>(<scope>): <subject>" format?
3. CONTENT CHECK: Does it contain ONLY the commit message with no extra text?
4. CONSISTENCY CHECK: For multiple files, is the format consistent?
5. COMPLETENESS CHECK: Does it include all necessary information?
6. BODY CHECK: Does the body explain what was changed and why?
7. IMPACT CHECK: Does it consider the impact on existing logic, data structures, or external APIs?
8. DOCUMENTATION CHECK: Does it identify the need for additional documentation or testing?
9. RISK CHECK: Does it address potential risks or uncertainties and how to mitigate them?

## 变更文件 (${changedFiles.length}个):
${filesDescription}

## 代码差异:
\`\`\`diff
${diff}
\`\`\`

---
REMINDER:
- Now generate commit messages that describe the CODE CHANGES.
- ONLY return commit messages, NO OTHER PROSE!
- Follow the exact format shown in examples above.`;
    }

    /**
     * 提取和清理AI响应的提交信息
     */
    protected extractCommitMessage(response: string): string {
        // 清理响应 - 移除引号和多余空格
        let cleaned = response.trim().replace(/^["']|["']$/g, '');
        
        // 移除markdown代码块标记
        cleaned = cleaned.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '');
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
        
        // 移除其他常见的格式标记
        cleaned = cleaned.replace(/^`/, '').replace(/`$/, '');
        
        // 移除解释性前缀文本，保留实际的提交信息
        cleaned = cleaned.replace(/^.*?(?=✨|🐛|📝|💄|♻️|⚡|✅|📦|👷|🔧|🌐|feat|fix|docs|style|refactor|perf|test|build|ci|chore|i18n)/s, '');
        
        // 按行分割并过滤空行
        const lines = cleaned.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) {
            return '✨ feat(misc): 更新代码';
        }
        
        // 移除解释性文本和标题，但保留提交信息和body内容
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
                   !lower.includes('以下是') &&
                   !lower.includes('根据') &&
                   !line.startsWith('#') &&
                   !line.startsWith('**') &&
                   !line.startsWith('*') &&
                   !line.startsWith('Note:') &&
                   !line.startsWith('注:') &&
                   line.length > 0;
        });
        
        if (filteredLines.length === 0) {
            return '✨ feat(misc): 更新代码';
        }
        
        const processedLines: string[] = [];
        
        for (const line of filteredLines) {
            // 检查是否为有效的提交信息行（包含emoji或type）
            if (this.isValidCommitLine(line)) {
                // 确保有正确的emoji
                const processedLine = this.ensureCorrectEmoji(line);
                processedLines.push(processedLine);
            } else if (this.isBodyContent(line)) {
                // 这是body内容
                processedLines.push(this.formatBodyLine(line));
            }
        }
        
        // 如果没有有效的提交行，创建默认的
        if (processedLines.length === 0 || !processedLines.some(line => this.isValidCommitLine(line))) {
            return '✨ feat(misc): 更新代码';
        }
        
        return processedLines.join('\n').trim();
    }

    /**
     * 检查是否为有效的提交信息行
     */
    private isValidCommitLine(line: string): boolean {
        // 检查是否包含emoji开头或者直接以type开头
        const emojiPattern = /^[✨🐛📝💄♻️⚡✅📦👷🔧🌐]/;
        const typePattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|i18n)(\([^)]*\))?:/;
        
        return emojiPattern.test(line) || typePattern.test(line);
    }

    /**
     * 检查是否为body内容
     */
    private isBodyContent(line: string): boolean {
        // body内容通常以-开头或者包含【】标记，或者是较长的描述性文本
        return line.startsWith('-') || 
               line.startsWith('•') || 
               line.startsWith('*') || 
               line.includes('【') || 
               line.includes('】') ||
               (!this.isValidCommitLine(line) && line.length > 10 && !this.isDescriptiveSummary(line));
    }

    /**
     * 格式化body行
     */
    private formatBodyLine(line: string): string {
        // 统一使用-作为项目符号
        return line.replace(/^[•*]\s*/, '- ');
    }

    /**
     * 确保提交信息有正确的emoji
     */
    private ensureCorrectEmoji(line: string): string {
        // 如果已经有emoji，直接返回
        if (line.match(/^[✨🐛📝💄♻️⚡✅📦👷🔧🌐]/)) {
            return line;
        }
        
        // 提取commit type并添加对应的emoji
        const typeMatch = line.match(/^(\w+)(?:\([^)]*\))?:/);
        if (typeMatch) {
            const type = typeMatch[1];
            const emoji = this.getEmojiForType(type);
            return `${emoji} ${line}`;
        }
        
        return line;
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
               lower.includes('总结') ||
               lower.includes('概述') ||
               (lower.length > 30 && !line.includes(':') && !line.startsWith('-'));
    }
    
    /**
     * 从提交行中提取提交类型
     */
    private getCommitType(line: string): string {
        const match = line.match(/^(?:[✨🐛📝💄♻️⚡✅📦👷🔧🌐]\s+)?(\w+)(?:\([^)]*\))?:/);
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