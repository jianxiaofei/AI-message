import * as vscode from 'vscode';
import { AIProvider } from '../aiInterface';
import { VcsFile } from '../vcsInterface';

export class CopilotProvider implements AIProvider {
    readonly name = 'GitHub Copilot';

    async isAvailable(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            return models.length > 0;
        } catch (error) {
            console.error('Copilot可用性检查失败:', error);
            return false;
        }
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        try {
            // 尝试获取 Copilot 模型
            const models = await vscode.lm.selectChatModels({ 
                vendor: 'copilot',
                family: 'gpt-4o' // 优先使用 GPT-4o
            });

            // 如果没有 GPT-4o，尝试其他模型
            let model = models[0];
            if (!model) {
                const fallbackModels = await vscode.lm.selectChatModels({ 
                    vendor: 'copilot' 
                });
                model = fallbackModels[0];
            }

            if (!model) {
                throw new Error('没有可用的 Copilot 模型。请确保已安装并登录 GitHub Copilot。');
            }

            const prompt = this.buildPrompt(diff, changedFiles);
            const messages = [
                vscode.LanguageModelChatMessage.User(prompt)
            ];

            const cts = new vscode.CancellationTokenSource();
            try {
                const response = await model.sendRequest(messages, {}, cts.token);
                
                let result = '';
                for await (const fragment of response.text) {
                    result += fragment;
                }

                return this.extractCommitMessage(result.trim());
            } finally {
                cts.dispose();
            }

        } catch (error) {
            console.error('Copilot API生成失败:', error);
            if (error instanceof vscode.LanguageModelError) {
                throw new Error(`Copilot 服务错误: ${error.message}`);
            }
            throw new Error(`AI生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    private buildPrompt(diff: string, changedFiles: VcsFile[]): string {
        // 分析文件类型和变更类型
        const fileAnalysis = this.analyzeChanges(changedFiles, diff);
        const filesDescription = changedFiles.map(file => 
            `${file.path} (${this.getStatusDescription(file.status)})`
        ).join('\n');

        // 构建详细的系统提示词
        return `# AI Message Generator

**CRITICAL INSTRUCTION: 您必须严格遵循以下要求**
1. 仅输出符合Conventional Commits规范的中文提交信息
2. 严格按照示例中显示的格式
3. 不包含任何解释或额外文本
4. 绝不使用英文（除非是技术术语和scope）
5. 最多16行，每行直接换行不要隔行
6. 使用单行换行(\\n)，不要双行换行(\\n\\n)

## 必须执行的操作 (MUST DO)

1. **深度分析变更意图**: 根据文件路径、文件名、内容和差异代码，确定这次提交的真实目的
2. **识别修改模块**: 明确标识被修改的模块/文件
3. **确定变更类型**: 基于实际变更内容选择最合适的提交类型
4. **评估影响范围**: 考虑对现有逻辑、数据结构或外部API的影响
5. **识别风险和依赖**: 确定是否需要额外的文档、测试或存在潜在风险

## 禁止操作 (MUST NOT DO)

1. 不要包含任何解释、问候或额外文本
2. 不要使用英文（技术术语和scope除外）
3. 不要添加格式说明或元数据
4. 不要在输出中包含三重反引号(\`\`\`)
5. 不要偏离要求的格式

## 格式模板

**标准格式**: \`<type>(<scope>): <subject>\`

**带详细说明的格式**:
\`\`\`
<type>(<scope>): <subject>

<body>
\`\`\`

## 类型检测指南

在生成提交信息时，始终考虑文件状态和内容变更：

### 文件状态分类
请分析文件变更——包括文件路径、文件名、文件内容和差异代码片段——并确定此次提交的目的。
然后，根据变更的实际意图从类型参考列表中选择最合适的提交类型（type），而不仅仅是基于文件扩展名或文件名。
提交类型必须反映变更的**真实目的**。

## 类型参考

| 类型     | 描述                 | 示例范围          |
| -------- | -------------------- | ----------------- |
| feat     | 新功能               | user, payment     |
| fix      | 错误修复             | auth, data        |
| docs     | 文档更新             | README, API       |
| style    | 代码格式化           | formatting        |
| refactor | 代码重构             | utils, helpers    |
| perf     | 性能优化             | query, cache      |
| test     | 测试相关             | unit, e2e         |
| build    | 构建系统             | webpack, npm      |
| ci       | CI配置               | Travis, Jenkins   |
| chore    | 其他变更             | scripts, config   |

## Emoji映射表
- feat: ✨ 新功能
- fix: 🐛 错误修复  
- docs: 📝 文档更新
- style: 💄 代码格式化
- refactor: ♻️ 代码重构
- perf: ⚡ 性能优化
- test: ✅ 测试相关
- build: 📦 构建系统
- ci: 👷 CI配置
- chore: 🔧 其他变更

## 变更文件信息 (${changedFiles.length}个文件):
${filesDescription}

## 变更分析:
${fileAnalysis}

## 代码差异:
\`\`\`diff
${diff}
\`\`\`

**重要指示**: 
- 每个提交类型前自动添加对应的emoji
- 为每个主要变更生成独立的提交信息
- 主体内容必须详细说明具体做了什么变更和为什么
- 直接输出提交信息，不要总结性描述

**输出格式 (最多16行，直接换行)：**
✨ feat(scope1): 具体功能描述
🐛 fix(scope2): 具体修复描述
♻️ refactor(scope3): 具体重构描述

现在请基于以上分析，输出完整的提交信息：`;
    }

    private extractCommitMessage(response: string): string {
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
                   !line.startsWith('#') &&
                   !line.startsWith('**') &&
                   !line.startsWith('*');
        });
        
        if (filteredLines.length === 0) {
            return '✨ feat: 更新代码';
        }
        
        // 处理提交信息
        const processedLines: string[] = [];
        
        for (let i = 0; i < filteredLines.length; i++) {
            const line = filteredLines[i];
            
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
    
    private addEmojiToCommitLine(line: string): string {
        const commitType = this.getCommitType(line);
        const emoji = this.getEmojiForType(commitType);
        
        // 如果已经有emoji，不重复添加
        if (line.match(/^[✨🐛📝💄♻️⚡✅📦👷🔧]/)) {
            return line;
        }
        
        return `${emoji} ${line}`;
    }
    
    private getCommitType(line: string): string {
        const match = line.match(/^(?:[✨🐛📝💄♻️⚡✅📦👷🔧]\s+)?(\w+)(?:\([^)]*\))?:/);
        return match ? match[1] : '';
    }
    
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

    private analyzeChanges(changedFiles: VcsFile[], diff: string): string {
        const analysis: string[] = [];
        
        // === 1. 文件类型和规模分析 ===
        const fileTypes: { [key: string]: VcsFile[] } = {};
        changedFiles.forEach(file => {
            const ext = file.path.split('.').pop()?.toLowerCase() || 'unknown';
            if (!fileTypes[ext]) {fileTypes[ext] = [];}
            fileTypes[ext].push(file);
        });
        
        const fileTypeAnalysis = Object.entries(fileTypes)
            .sort(([,a], [,b]) => b.length - a.length)
            .map(([ext, files]) => `${this.getFileTypeDescription(ext)}: ${files.length}个`)
            .join(', ');
        
        analysis.push(`**文件类型分布**: ${fileTypeAnalysis}`);
        
        // === 2. 变更操作统计 ===
        const statusCounts: { [key: string]: VcsFile[] } = {};
        changedFiles.forEach(file => {
            if (!statusCounts[file.status]) {statusCounts[file.status] = [];}
            statusCounts[file.status].push(file);
        });
        
        const statusAnalysis = Object.entries(statusCounts)
            .map(([status, files]) => `${this.getStatusDescription(status)}: ${files.length}个`)
            .join(', ');
        
        analysis.push(`**变更操作**: ${statusAnalysis}`);
        
        return analysis.join('\n');
    }
    
    private getFileTypeDescription(ext: string): string {
        const typeMap: { [key: string]: string } = {
            'ts': 'TypeScript',
            'js': 'JavaScript',
            'json': 'JSON配置',
            'md': '文档',
            'html': 'HTML',
            'css': '样式',
            'py': 'Python',
            'java': 'Java',
            'xml': 'XML',
            'unknown': '其他'
        };
        return typeMap[ext] || ext.toUpperCase();
    }
    
    private getStatusDescription(status: string): string {
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
}