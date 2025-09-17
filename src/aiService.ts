import * as vscode from 'vscode';
import { SvnFile } from './svnService';

export class AIService {
    
    constructor() {
    }

    async generateCommitMessage(diff: string, changedFiles: SvnFile[]): Promise<string> {
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

            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }

            return this.extractCommitMessage(result.trim());

        } catch (error) {
            console.error('Copilot API生成失败:', error);
            if (error instanceof vscode.LanguageModelError) {
                throw new Error(`Copilot 服务错误: ${error.message}`);
            }
            throw new Error(`AI生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    private buildPrompt(diff: string, changedFiles: SvnFile[]): string {
        // 分析文件类型和变更类型
        const fileAnalysis = this.analyzeChanges(changedFiles, diff);
        const filesDescription = changedFiles.map(file => 
            `${file.path} (${this.getStatusDescription(file.status)})`
        ).join('\n');

        // 构建详细的系统提示词，参考Dish AI Commit的专业架构
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

## 编写规则

### 主题行
- 重大变更使用 !：\`feat(auth)!: ...\`
- scope必须使用英文
- 使用祈使语气
- 不要首字母大写
- 结尾不要句号
- 最多50个字符
- 主体内容必须使用中文（scope除外）
- 主体内容必须在描述后留一个空行

### 主体内容（详细说明）
- 重大变更必须包含详细的影响描述
- 使用"-"作为项目符号
- 每行最多72个字符
- 解释做了什么和为什么
- 必须使用中文
- 使用【】对不同类型的变更进行分类

## 示例输出

### SVN示例 - 多文件多变更：
**输入**:
\`\`\`
Index: feature.js
===================================================================
--- feature.js    (revision 0)
+++ feature.js    (working copy)
@@ -0,0 +1 @@
+console.log('新功能实现');

Index: bugfix.js
===================================================================
--- bugfix.js    (revision 123)  
+++ bugfix.js    (working copy)
@@ -1,3 +1,3 @@
 const x = 1;
-const y = x + 1;
+const y = x + 2;
\`\`\`

**生成的提交信息**:
\`\`\`
本次提交包含新功能实现和计算逻辑修复

✨ feat(feature): 实现新功能模块

🐛 fix(bugfix): 修正计算逻辑错误

♻️ refactor(utils): 重构工具函数

🔧 chore(config): 更新构建配置
\`\`\`

## 自我验证检查清单

在最终确定输出之前，请验证：
1. **语言检查**: 是否100%使用中文（scope和技术术语除外）？
2. **格式检查**: 是否严格遵循"<type>(<scope>): <subject>"格式？
3. **内容检查**: 是否只包含提交信息而没有额外文本？
4. **一致性检查**: 对于多个文件，格式是否一致？
5. **完整性检查**: 是否包含所有必要信息？
6. **主体检查**: 主体是否解释了变更内容和原因？
7. **影响检查**: 是否考虑了对现有逻辑、数据结构或外部API的影响？
8. **文档检查**: 是否识别了额外文档或测试的需求？
9. **风险检查**: 是否识别了潜在风险或不确定性及其缓解措施？

## 变更文件信息 (${changedFiles.length}个文件):
${filesDescription}

## 变更分析:
${fileAnalysis}

## SVN代码差异:
\`\`\`diff
${diff}
\`\`\`

**重要指示**: 
- 每个提交类型前自动添加对应的emoji
- 为每个主要变更生成独立的提交信息
- 主体内容必须详细说明具体做了什么变更和为什么
- 直接输出提交信息，不要总结性描述

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

**输出格式 (最多16行，直接换行)：**
✨ feat(scope1): 具体功能描述
🐛 fix(scope2): 具体修复描述
♻️ refactor(scope3): 具体重构描述

**重要提示：**
- 每行之间直接换行，不要空行
- 最多输出16行
- 不要使用双换行(\\n\\n)，只用单换行(\\n)

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
    
    // 识别总结性描述行（应该被过滤掉）
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
    
    private cleanCommitLine(line: string): string {
        // 移除项目符号、粗体标记等
        let cleaned = line.replace(/^[*\-•\s]+/, '');
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
        cleaned = cleaned.replace(/\[(.+?)\]/g, '$1');
        return cleaned.trim();
    }

    private analyzeChanges(changedFiles: SvnFile[], diff: string): string {
        const analysis: string[] = [];
        
        // === 1. 文件类型和规模分析 ===
        const fileTypes: { [key: string]: SvnFile[] } = {};
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
        const statusCounts: { [key: string]: SvnFile[] } = {};
        changedFiles.forEach(file => {
            if (!statusCounts[file.status]) {statusCounts[file.status] = [];}
            statusCounts[file.status].push(file);
        });
        
        const statusAnalysis = Object.entries(statusCounts)
            .map(([status, files]) => `${this.getStatusDescription(status)}: ${files.length}个`)
            .join(', ');
        
        analysis.push(`**变更操作**: ${statusAnalysis}`);
        
        // === 3. 模块和功能区域分析 ===
        const modules = this.identifyModules(changedFiles);
        if (modules.length > 0) {
            analysis.push(`**影响模块**: ${modules.join(', ')}`);
        }
        
        // === 4. 代码变更深度分析 ===
        const codePatterns = this.analyzeCodePatterns(diff);
        if (codePatterns.length > 0) {
            analysis.push(`**代码特征**: ${codePatterns.join(', ')}`);
        }
        
        // === 5. 变更规模评估 ===
        const scale = this.assessChangeScale(diff, changedFiles.length);
        analysis.push(`**变更规模**: ${scale}`);
        
        // === 6. 潜在影响评估 ===
        const impacts = this.assessPotentialImpacts(changedFiles, diff);
        if (impacts.length > 0) {
            analysis.push(`**潜在影响**: ${impacts.join(', ')}`);
        }
        
        // === 7. 建议的提交类型 ===
        const suggestedType = this.suggestCommitType(changedFiles, diff);
        const confidence = this.calculateTypeConfidence(changedFiles, diff, suggestedType);
        analysis.push(`**建议类型**: ${suggestedType} (置信度: ${confidence})`);
        
        return analysis.join('\n');
    }

    private getFileTypeDescription(ext: string): string {
        const typeMap: { [key: string]: string } = {
            'ts': 'TypeScript',
            'js': 'JavaScript',
            'tsx': 'React组件',
            'jsx': 'React组件',
            'vue': 'Vue组件',
            'py': 'Python',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C语言',
            'cs': 'C#',
            'go': 'Go',
            'rs': 'Rust',
            'php': 'PHP',
            'rb': 'Ruby',
            'swift': 'Swift',
            'kt': 'Kotlin',
            'css': '样式文件',
            'scss': 'Sass样式',
            'less': 'Less样式',
            'html': 'HTML',
            'json': 'JSON配置',
            'xml': 'XML配置',
            'yml': 'YAML配置',
            'yaml': 'YAML配置',
            'md': 'Markdown文档',
            'txt': '文本文档',
            'sql': 'SQL脚本',
            'sh': 'Shell脚本',
            'bat': '批处理脚本',
            'ps1': 'PowerShell脚本'
        };
        return typeMap[ext] || `${ext.toUpperCase()}文件`;
    }

    private identifyModules(changedFiles: SvnFile[]): string[] {
        const modules = new Set<string>();
        
        changedFiles.forEach(file => {
            const pathParts = file.path.split(/[/\\]/);
            
            // 识别常见的模块结构
            if (pathParts.includes('src') || pathParts.includes('lib')) {
                const srcIndex = pathParts.findIndex(p => p === 'src' || p === 'lib');
                if (srcIndex < pathParts.length - 1) {
                    modules.add(pathParts[srcIndex + 1]);
                }
            }
            
            // 识别功能模块关键词
            const moduleKeywords = ['auth', 'user', 'admin', 'api', 'service', 'component', 'util', 'helper', 'model', 'view', 'controller', 'middleware', 'config', 'test', 'spec'];
            pathParts.forEach(part => {
                if (moduleKeywords.some(keyword => part.toLowerCase().includes(keyword))) {
                    modules.add(part);
                }
            });
        });
        
        return Array.from(modules).slice(0, 5); // 限制最多显示5个模块
    }

    private analyzeCodePatterns(diff: string): string[] {
        const patterns: string[] = [];
        
        // API相关
        if (diff.includes('api') || diff.includes('endpoint') || diff.includes('route')) {
            patterns.push('API接口变更');
        }
        
        // 数据库相关
        if (diff.includes('sql') || diff.includes('database') || diff.includes('query') || diff.includes('table')) {
            patterns.push('数据库操作');
        }
        
        // 用户界面相关
        if (diff.includes('component') || diff.includes('render') || diff.includes('jsx') || diff.includes('tsx')) {
            patterns.push('UI组件更新');
        }
        
        // 业务逻辑
        if (diff.includes('class ') || diff.includes('function ') || diff.includes('method') || diff.includes('def ')) {
            patterns.push('核心逻辑修改');
        }
        
        // 配置和设置
        if (diff.includes('config') || diff.includes('setting') || diff.includes('option')) {
            patterns.push('配置更新');
        }
        
        // 依赖管理
        if (diff.includes('import ') || diff.includes('require(') || diff.includes('from ')) {
            patterns.push('依赖调整');
        }
        
        // 错误处理
        if (diff.includes('try') || diff.includes('catch') || diff.includes('error') || diff.includes('exception')) {
            patterns.push('异常处理');
        }
        
        // 性能优化
        if (diff.includes('cache') || diff.includes('optimize') || diff.includes('performance')) {
            patterns.push('性能优化');
        }
        
        // 安全相关
        if (diff.includes('auth') || diff.includes('security') || diff.includes('token') || diff.includes('password')) {
            patterns.push('安全功能');
        }
        
        // 测试相关
        if (diff.includes('test') || diff.includes('spec') || diff.includes('mock') || diff.includes('jest')) {
            patterns.push('测试代码');
        }
        
        return patterns;
    }

    private assessChangeScale(diff: string, fileCount: number): string {
        const lines = diff.split('\n').length;
        const additionsCount = (diff.match(/^\+/gm) || []).length;
        const deletionsCount = (diff.match(/^\-/gm) || []).length;
        
        let scale = '';
        if (fileCount <= 2 && lines <= 50) {
            scale = '小型';
        } else if (fileCount <= 10 && lines <= 200) {
            scale = '中型';
        } else {
            scale = '大型';
        }
        
        return `${scale}变更 (${fileCount}文件, +${additionsCount}/-${deletionsCount}行)`;
    }

    private assessPotentialImpacts(changedFiles: SvnFile[], diff: string): string[] {
        const impacts: string[] = [];
        
        // API破坏性变更
        if (diff.includes('breaking') || diff.includes('BREAKING')) {
            impacts.push('可能存在破坏性变更');
        }
        
        // 数据库迁移需求
        if (diff.includes('migration') || diff.includes('schema') || diff.includes('table')) {
            impacts.push('可能需要数据库迁移');
        }
        
        // 依赖更新影响
        if (changedFiles.some(f => f.path.includes('package.json') || f.path.includes('requirements'))) {
            impacts.push('依赖变更可能影响其他模块');
        }
        
        // 配置文件变更
        if (changedFiles.some(f => f.path.includes('config') || f.path.includes('.env'))) {
            impacts.push('配置变更可能需要环境更新');
        }
        
        // 核心功能变更
        if (diff.includes('core') || diff.includes('main') || diff.includes('index')) {
            impacts.push('核心功能变更需要全面测试');
        }
        
        return impacts;
    }

    private calculateTypeConfidence(changedFiles: SvnFile[], diff: string, suggestedType: string): string {
        let confidence = 0;
        let maxConfidence = 0;
        
        // 基于文件路径的置信度
        const paths = changedFiles.map(f => f.path.toLowerCase());
        maxConfidence += 20;
        
        switch (suggestedType) {
            case 'docs':
                if (paths.some(p => p.includes('readme') || p.includes('doc') || p.endsWith('.md'))) {
                    confidence += 20;
                }
                break;
            case 'test':
                if (paths.some(p => p.includes('test') || p.includes('spec'))) {
                    confidence += 20;
                }
                break;
            case 'feat':
                if (changedFiles.some(f => f.status === 'A')) {
                    confidence += 15;
                }
                break;
            case 'fix':
                if (diff.includes('fix') || diff.includes('bug')) {
                    confidence += 15;
                }
                break;
        }
        
        // 基于内容的置信度
        maxConfidence += 30;
        if (diff.includes(suggestedType) || diff.includes(suggestedType.toUpperCase())) {
            confidence += 15;
        }
        
        // 基于文件状态的置信度
        maxConfidence += 20;
        const statusScore = this.getStatusScore(changedFiles, suggestedType);
        confidence += statusScore;
        
        const percentage = Math.round((confidence / maxConfidence) * 100);
        
        if (percentage >= 80) {return '高';}
        if (percentage >= 60) {return '中等';}
        return '低';
    }

    private getStatusScore(changedFiles: SvnFile[], suggestedType: string): number {
        const statuses = changedFiles.map(f => f.status);
        
        if (suggestedType === 'feat' && statuses.includes('A')) {return 20;}
        if (suggestedType === 'fix' && statuses.includes('M')) {return 15;}
        if (suggestedType === 'chore' && statuses.some(s => ['M', 'A'].includes(s))) {return 10;}
        
        return 5;
    }

    private suggestCommitType(changedFiles: SvnFile[], diff: string): string {
        // 基于文件名和路径推断类型
        const paths = changedFiles.map(f => f.path.toLowerCase());
        
        // 检查是否是文档相关
        if (paths.some(p => p.includes('readme') || p.includes('doc') || p.includes('.md'))) {
            return 'docs';
        }
        
        // 检查是否是测试相关
        if (paths.some(p => p.includes('test') || p.includes('spec')) || 
            diff.includes('test') || diff.includes('jest') || diff.includes('mocha')) {
            return 'test';
        }
        
        // 检查是否是配置相关
        if (paths.some(p => p.includes('config') || p.includes('.json') || p.includes('.yml') || p.includes('.yaml'))) {
            return 'chore';
        }
        
        // 检查是否是构建相关
        if (paths.some(p => p.includes('package.json') || p.includes('webpack') || p.includes('gulpfile') || p.includes('dockerfile'))) {
            return 'build';
        }
        
        // 基于代码内容推断
        if (diff.includes('fix') || diff.includes('bug') || diff.includes('error') || diff.includes('issue')) {
            return 'fix';
        }
        
        // 检查是否包含新功能关键词
        if (diff.includes('add') || diff.includes('new') || diff.includes('create') || 
            changedFiles.some(f => f.status === 'A')) {
            return 'feat';
        }
        
        // 检查是否是重构
        if (diff.includes('refactor') || diff.includes('restructure') || diff.includes('reorganize')) {
            return 'refactor';
        }
        
        // 检查是否是性能优化
        if (diff.includes('optimize') || diff.includes('performance') || diff.includes('speed')) {
            return 'perf';
        }
        
        // 检查是否只是样式修改
        if (paths.every(p => p.includes('.css') || p.includes('.scss') || p.includes('.less')) ||
            diff.includes('style') || diff.includes('format')) {
            return 'style';
        }
        
        // 默认返回feat（新功能）
        return 'feat';
    }

    private getTypeExamples(suggestedType: string): string {
        const examples: { [key: string]: string[] } = {
            'feat': [
                'feat(auth): 添加用户登录功能',
                'feat(ui): 实现新的导航组件',
                'feat: 支持多语言切换'
            ],
            'fix': [
                'fix(login): 修复用户登录失败问题',
                'fix(api): 解决数据获取错误',
                'fix: 修复页面渲染异常'
            ],
            'docs': [
                'docs: 更新README文档',
                'docs(api): 补充接口说明',
                'docs: 添加安装指南'
            ],
            'style': [
                'style: 统一代码格式',
                'style(ui): 调整按钮样式',
                'style: 修复代码缩进'
            ],
            'refactor': [
                'refactor(core): 重构数据处理逻辑',
                'refactor: 优化组件结构',
                'refactor(api): 简化接口调用'
            ],
            'test': [
                'test: 添加单元测试',
                'test(auth): 完善登录测试用例',
                'test: 修复测试用例'
            ],
            'chore': [
                'chore: 更新依赖版本',
                'chore(config): 调整构建配置',
                'chore: 清理无用代码'
            ],
            'build': [
                'build: 升级webpack配置',
                'build(deps): 更新依赖包',
                'build: 优化打包流程'
            ]
        };
        
        const typeExamples = examples[suggestedType] || examples['feat'];
        return `参考示例:\n${typeExamples.join('\n')}`;
    }

    private getStatusDescription(status: string): string {
        const statusMap: { [key: string]: string } = {
            'A': '添加',
            'D': '删除',
            'M': '修改',
            'R': '替换',
            'C': '冲突',
            '?': '未跟踪',
            '!': '丢失',
            '~': '类型变更'
        };

        return statusMap[status] || '未知状态';
    }

    // 生成简单的基于规则的提交信息作为后备方案
    generateFallbackMessage(changedFiles: SvnFile[]): string {
        if (changedFiles.length === 0) {
            return '更新代码';
        }

        const addedFiles = changedFiles.filter(f => f.status === 'A').length;
        const modifiedFiles = changedFiles.filter(f => f.status === 'M').length;
        const deletedFiles = changedFiles.filter(f => f.status === 'D').length;

        const actions: string[] = [];
        if (addedFiles > 0) { actions.push(`添加${addedFiles}个文件`); }
        if (modifiedFiles > 0) { actions.push(`修改${modifiedFiles}个文件`); }
        if (deletedFiles > 0) { actions.push(`删除${deletedFiles}个文件`); }

        return actions.length > 0 ? actions.join('，') : '更新代码';
    }

    // 检查 Copilot 是否可用
    async isCopilotAvailable(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            return models.length > 0;
        } catch (error) {
            return false;
        }
    }
}