import * as vscode from 'vscode';
import { VcsFactory } from './vcsFactory';
import { IVersionControlService } from './vcsInterface';
import { AIService } from './aiProviderFactory';

let vcsService: IVersionControlService | null = null;
let aiService: AIService;

export function activate(context: vscode.ExtensionContext) {
    console.log('AI-message is now active!');
    
    initializeServices();
    registerCommands(context);
}

function initializeServices() {
    aiService = new AIService();
}

function registerCommands(context: vscode.ExtensionContext) {
    const generateCommand = vscode.commands.registerCommand(
        'ai-message.generateCommitMessage',
        handleGenerateCommitMessage
    );
    
    const quickCommand = vscode.commands.registerCommand(
        'ai-message.quickCommit',
        handleQuickCommit
    );
    
    const configureCommand = vscode.commands.registerCommand(
        'ai-message.configureAI',
        handleConfigureAI
    );
    
    context.subscriptions.push(generateCommand, quickCommand, configureCommand);
}

async function handleGenerateCommitMessage() {
    try {
        await unifiedGenerateCommit();
    } catch (error) {
        await handleError('生成提交信息时发生错误', error);
    }
}

// 统一的提交信息生成流程（带流式 & 回退 & 格式化）
async function unifiedGenerateCommit() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '生成提交信息',
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: '检查仓库...' });
        const vcs = await validateVcsRepository();
        if (!vcs) {return;}

        progress.report({ increment: 20, message: '收集变更...' });
        const changes = await getVcsChanges();
        if (!changes) {return;}

        // 获取待提交文件列表（排除ignore）
        const status = await vcsService!.getCommitReadyChanges();
        const changedFiles = status.changedFiles;
        const vcsType = status.vcsType;

        progress.report({ increment: 40, message: '准备流式...' });
        const initMsg = '🤖 正在分析 ' + changedFiles.length + ' 个文件变更...';
        const scmWritable = await setScmInputBoxValue(initMsg);
        const debug = vscode.workspace.getConfiguration('aiMessage').get<boolean>('debug.enableStreamingLog', false);
        if (!scmWritable && debug) {
            console.log('[AI-Message] SCM输入框不可写，将使用输出通道');
        }

        progress.report({ increment: 55, message: '模型流式生成中...' });
        // 重用已有流式函数：需要一个封装新增参数（此处直接调用现有 generateWithCopilotStreaming）
        try {
            await generateWithCopilotStreaming(changes, changedFiles, progress, { fallbackToOutput: !scmWritable });
            progress.report({ increment: 100, message: '完成' });
            vscode.window.showInformationMessage('✅ 提交信息已生成');
        } catch (e) {
            if (debug) {console.error('[AI-Message] 流式生成失败，尝试普通生成', e);}
            const msg = await aiService.generateCommitMessage(changes, changedFiles);
            if (msg) {
                const formatted = enforceConventionalCommit(extractCommitMessage(msg), changedFiles, changes);
                await setScmInputBoxValue(formatted) || vscode.env.clipboard.writeText(formatted);
                vscode.window.showInformationMessage('⚠️ 已使用非流式方式生成提交信息');
            } else {
                vscode.window.showErrorMessage('无法生成提交信息');
            }
        }
    });
}

async function handleQuickCommit() {
    try {
        vscode.window.showInformationMessage('正在快速生成提交信息...');
        
        const vcs = await validateVcsRepository();
        if (!vcs) {
            return;
        }
        
        const changes = await getVcsChanges();
        if (!changes) {
            return;
        }
        
        const commitMessage = await generateCommitMessage(changes);
        if (!commitMessage) {
            return;
        }
        
        // 尝试填充到SCM输入框，否则复制到剪贴板
        const success = await setScmInputBoxValue(commitMessage);
        
        if (success) {
            vscode.window.showInformationMessage('✅ 提交信息已快速生成并填充到Source Control！', '查看').then(selection => {
                if (selection === '查看') {
                    showCommitMessagePreview(commitMessage);
                }
            });
        } else {
            await vscode.env.clipboard.writeText(commitMessage);
            vscode.window.showInformationMessage('提交信息已复制到剪贴板！', '查看').then(selection => {
                if (selection === '查看') {
                    showCommitMessagePreview(commitMessage);
                }
            });
        }
        
    } catch (error) {
        await handleError('快速生成提交信息时发生错误', error);
    }
}

async function validateVcsRepository(): Promise<IVersionControlService | null> {
    try {
        vcsService = await VcsFactory.createService();
        if (!vcsService) {
            vscode.window.showErrorMessage(
                '当前工作区不是Git或SVN仓库，或版本控制工具不可用', 
                '了解更多'
            ).then(selection => {
                if (selection === '了解更多') {
                    vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/'));
                }
            });
            return null;
        }
        
        const vcsType = vcsService.getVcsType();
        console.log(`检测到${vcsType.toUpperCase()}仓库`);
        return vcsService;
    } catch (error) {
        await handleError('验证版本控制仓库时发生错误', error);
        return null;
    }
}

async function getVcsChanges(): Promise<string | null> {
    try {
        if (!vcsService) {
            throw new Error('版本控制服务未初始化');
        }
        
        const diff = await vcsService.getDiff();
        
        if (!diff || diff.trim().length === 0) {
            vscode.window.showWarningMessage('当前没有需要提交的更改');
            return null;
        }
        
        return diff;
    } catch (error) {
        await handleError('获取版本控制变更信息时发生错误', error);
        return null;
    }
}

/**
 * 流式生成提交信息并实时更新到SCM输入框
 */
const outputChannel = vscode.window.createOutputChannel('AI Commit Stream');

interface StreamOptions {
    fallbackToOutput?: boolean;
}

// generateCommitMessageStreaming 已被 unifiedGenerateCommit + generateWithCopilotStreaming 取代

/**
 * 使用Copilot流式生成提交信息
 */
async function generateWithCopilotStreaming(
    changes: string,
    changedFiles: any[],
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    options: StreamOptions = {}
): Promise<void> {
    try {
        // 获取 Copilot 模型
        const models = await vscode.lm.selectChatModels({ 
            vendor: 'copilot',
            family: 'gpt-4o' 
        });

        let model = models[0];
        if (!model) {
            const fallbackModels = await vscode.lm.selectChatModels({ 
                vendor: 'copilot' 
            });
            model = fallbackModels[0];
        }

        if (!model) {
            throw new Error('没有可用的 Copilot 模型');
        }

        // 构建提示信息
    const vcsType = vcsService?.getVcsType?.() || 'git';
    const prompt = buildCopilotPrompt(changes, changedFiles, vcsType);
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];

        // 开始流式请求
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        const debug = vscode.workspace.getConfiguration('aiMessage').get<boolean>('debug.enableStreamingLog', false);
        if (debug) {
            console.log('[AI-Message][Stream] 启动流式，会话模型:', model.id);
        }

        let result = '';
        let lastUpdateTime = Date.now();
        const updateInterval = 200; // 每200ms更新一次界面
        let fragmentCount = 0;
        let firstChunkTime: number | null = null;
        const startTime = Date.now();
        
        for await (const fragment of response.text) {
            fragmentCount++;
            if (firstChunkTime === null) {firstChunkTime = Date.now();}
            result += fragment;
            if (debug) {
                console.log(`[AI-Message][Stream] 片段#${fragmentCount} 长度=${fragment.length} 累计=${result.length}`);
            }
            
            // 定期更新输入框，避免过于频繁的UI更新
            const now = Date.now();
            if (now - lastUpdateTime > updateInterval) {
                const displayText = result.length > 10 ? 
                    `🤖 AI正在生成...\n\n${result}${result.endsWith('\n') ? '' : '...'}`
                    : "🤖 AI正在思考...";
                    
                const ok = await setScmInputBoxValue(displayText);
                if (debug && !ok && !options.fallbackToOutput) {
                    console.log('[AI-Message][Stream] SCM写入失败但未启用fallbackToOutput');
                }
                if (!ok && options.fallbackToOutput) {
                    outputChannel.show(true);
                    outputChannel.replace ? outputChannel.replace(displayText) : (function(){
                        // 没有replace方法时简单清屏再写
                        outputChannel.clear();
                        outputChannel.append(displayText);
                    })();
                    if (debug) {
                        console.log('[AI-Message][Stream] 已写入OutputChannel (fallback)');
                    }
                }
                lastUpdateTime = now;
                
                // 更新进度
                const progressIncrement = Math.min(85 + (result.length / 10), 95);
                progress.report({ increment: progressIncrement, message: "实时生成中..." });
            }
        }

        // 最终处理和设置完整结果
        if (result.trim()) {
            // 提取提交信息（去掉可能的前缀和格式）
            const cleanMessage = extractCommitMessage(result.trim());
            if (debug) {
                const totalMs = Date.now() - startTime;
                const ttfb = firstChunkTime ? (firstChunkTime - startTime) : -1;
                console.log(`[AI-Message][Stream] 完成，总片段=${fragmentCount}, 总长度=${result.length}, 首字节(ms)=${ttfb}, 总耗时(ms)=${totalMs}`);
            }
            const formatted = enforceConventionalCommit(cleanMessage, changedFiles, changes);
            const finalOk = await setScmInputBoxValue(formatted);
            if (!finalOk && options.fallbackToOutput) {
                outputChannel.show(true);
                outputChannel.appendLine('\n=== 最终提交信息 ===');
                outputChannel.appendLine(formatted);
                if (debug) {
                    console.log('[AI-Message][Stream] 最终结果写入OutputChannel');
                }
            }
            progress.report({ increment: 100, message: "完成！" });
        } else {
            throw new Error('生成的内容为空');
        }
        
    } catch (error) {
        console.error('Copilot流式生成失败:', error);
        // 回退到普通生成
        const message = await aiService.generateCommitMessage(changes, changedFiles);
        if (message && message.trim().length > 0) {
            await setScmInputBoxValue(message.trim());
        } else {
            throw error;
        }
    }
}

/**
 * 构建Copilot提示信息
 */
function buildCopilotPrompt(diff: string, changedFiles: any[], vcsType: string): string {
    const config = vscode.workspace.getConfiguration('aiMessage');
    // 统一使用 commit.* 新键名；兼容旧键名（如果用户还未升级 settings）
    const enableEmoji = config.get('commit.enableEmoji', config.get('commitFormat.enableEmoji', true));
    const enableBody = config.get('commit.enableBody', config.get('commitFormat.enableBody', true));
    const enableScope = config.get('commit.enableScope', config.get('commitFormat.enableScope', true));
    const language = config.get('commit.language', config.get('commitFormat.language', 'zh-CN'));

    // 语言归一化：支持多种中文表示方式
    function normalizeLanguage(lang: string | undefined): string {
        if (!lang) {return 'en';}
        const l = lang.toLowerCase();
        // 常见中文写法映射
        if (['zh', 'zh-cn', 'zh_cn', 'zh-hans', '简体中文', 'chinese', '中文', 'cn'].includes(l)) {return 'zh-cn';}
        if (['zh-tw', 'zh_tw', '繁體中文', '繁体中文', 'traditional chinese'].includes(l)) {return 'zh-tw';}
        if (['en', 'english'].includes(l)) {return 'en';}
        if (['ja', 'jp', '日本語'].includes(l)) {return 'ja';}
        if (['ko', 'kr', '한국어'].includes(l)) {return 'ko';}
        return l;
    }
    const normLang = normalizeLanguage(language as string);
    const isZhCN = normLang === 'zh-cn';
    
    let prompt = isZhCN ? 
        `你是一个专业的代码提交信息生成专家。请根据以下代码变更生成一条符合 Conventional Commits 规范的提交信息。

**核心要求:**
1. 使用标准的 \`<type>(<scope>): <subject>\` 格式
2. type必须是: feat, fix, docs, style, refactor, test, chore, build, ci, perf 之一
3. subject必须简洁明了，不超过50个字符
4. 必须用中文描述` :
        `You are a professional commit message generator. Please generate a commit message that follows the Conventional Commits specification based on the following code changes.

**Core Requirements:**
1. Use the standard \`<type>(<scope>): <subject>\` format
2. type must be one of: feat, fix, docs, style, refactor, test, chore, build, ci, perf
3. subject must be concise and clear, within 50 characters
4. Use English for description`;

    if (enableEmoji) {
        prompt += isZhCN ? '\n5. 在type前添加合适的emoji图标' : '\n5. Add appropriate emoji icon before type';
    }
    
    if (enableScope && changedFiles.length > 0) {
        const scopes = changedFiles.map(f => f.path?.split('/')[0] || 'root').slice(0, 3);
        prompt += isZhCN ? 
            `\n6. scope从这些路径中选择: ${scopes.join(', ')}` :
            `\n6. Choose scope from these paths: ${scopes.join(', ')}`;
    }

    if (enableBody) {
        prompt += isZhCN ? 
            '\n7. **必须包含正文部分**：在标题行后空一行，添加详细说明变更内容和原因，使用项目符号列表格式' :
            '\n7. **Must include body section**: Add blank line after subject, then detailed explanation of what changed and why, using bullet point format';
    }

    // 增强上下文：提供文件统计与VCS类型
    const added = changedFiles.filter(f => f.status === 'A').length;
    const modified = changedFiles.filter(f => f.status === 'M').length;
    const deleted = changedFiles.filter(f => f.status === 'D' || f.status === '!').length;
    const renamed = changedFiles.filter(f => f.status === 'R').length;
    const statsLine = isZhCN ? `文件统计: 新增 ${added} 修改 ${modified} 删除 ${deleted} 重命名 ${renamed} (VCS: ${vcsType})` : `File stats: added ${added} modified ${modified} deleted ${deleted} renamed ${renamed} (VCS: ${vcsType})`;

    prompt += isZhCN ? 
        `\n\n${statsLine}\n\n**代码变更:**\n` + diff :
        `\n\n${statsLine}\n\n**Code Changes:**\n` + diff;

    prompt += isZhCN ? 
        '\n\n请直接输出最终的提交信息，不要添加任何解释或前缀。' :
        '\n\nPlease output the final commit message directly without any explanation or prefix.';

    // 添加示例格式（当启用body时）
    if (enableBody) {
        const exampleTitle = isZhCN ? '**格式示例:**' : '**Format Example:**';
        const example = isZhCN ? 
            `${exampleTitle}
feat(auth): 实现用户JWT认证功能

- 新增JWT token生成和验证逻辑
- 集成用户登录状态管理
- 添加token过期时间配置
- 更新API安全中间件` :
            `${exampleTitle}
feat(auth): implement JWT authentication system

- Add JWT token generation and validation logic  
- Integrate user session management
- Add configurable token expiration
- Update API security middleware`;
        
        prompt += '\n\n' + example;
    }

    return prompt;
}

/**
 * 从生成的内容中提取清洁的提交信息
 */
function extractCommitMessage(content: string): string {
    // 移除可能的markdown格式
    content = content.replace(/```[\s\S]*?```/g, '');
    content = content.replace(/`([^`]+)`/g, '$1');
    
    // 移除可能的前缀
    content = content.replace(/^(提交信息[:：]?\s*|commit message[:：]?\s*)/i, '');
    
    // 清理多余的空行
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return content.trim();
}

/**
 * 智能分析diff内容生成详细的body描述
 */
function generateIntelligentBody(diff: string, changedFiles: any[], isZh: boolean = true): string {
    const bodyLines: string[] = [];
    
    // 分析diff内容
    const diffAnalysis = analyzeDiffContent(diff);
    const fileAnalysis = analyzeFileChanges(changedFiles);
    
    // 根据分析结果生成不同类型的body内容
    if (diffAnalysis.newFunctions.length > 0) {
        const funcs = diffAnalysis.newFunctions.slice(0, 3);
        bodyLines.push(isZh ? `- 新增函数: ${funcs.join(', ')}` : `- Add functions: ${funcs.join(', ')}`);
    }
    
    if (diffAnalysis.modifiedFunctions.length > 0) {
        const funcs = diffAnalysis.modifiedFunctions.slice(0, 3);
        bodyLines.push(isZh ? `- 修改函数: ${funcs.join(', ')}` : `- Modify functions: ${funcs.join(', ')}`);
    }
    
    if (diffAnalysis.hasImportChanges) {
        bodyLines.push(isZh ? '- 更新依赖导入关系' : '- Update import dependencies');
    }
    
    if (diffAnalysis.hasConfigChanges) {
        bodyLines.push(isZh ? '- 调整配置参数' : '- Adjust configuration parameters');
    }
    
    if (diffAnalysis.hasDocChanges) {
        bodyLines.push(isZh ? '- 更新文档和注释' : '- Update documentation and comments');
    }
    
    // 添加代码量统计
    if (diffAnalysis.linesAdded > 0 || diffAnalysis.linesDeleted > 0) {
        const statsText = isZh 
            ? `- 代码变更: +${diffAnalysis.linesAdded} -${diffAnalysis.linesDeleted} 行`
            : `- Code changes: +${diffAnalysis.linesAdded} -${diffAnalysis.linesDeleted} lines`;
        bodyLines.push(statsText);
    }
    
    // 添加影响范围分析
    if (fileAnalysis.affectedModules.length > 0) {
        const modules = fileAnalysis.affectedModules.slice(0, 3);
        bodyLines.push(isZh ? `- 影响模块: ${modules.join(', ')}` : `- Affected modules: ${modules.join(', ')}`);
    }
    
    // 如果没有生成任何内容，使用基础文件变更信息
    if (bodyLines.length === 0) {
        return generateBasicBody(changedFiles, isZh);
    }
    
    return bodyLines.join('\n');
}

/**
 * 分析diff内容，提取关键信息
 */
function analyzeDiffContent(diff: string) {
    const analysis = {
        linesAdded: 0,
        linesDeleted: 0,
        newFunctions: [] as string[],
        modifiedFunctions: [] as string[],
        hasImportChanges: false,
        hasConfigChanges: false,
        hasDocChanges: false
    };
    
    const lines = diff.split('\n');
    
    for (const line of lines) {
        // 统计新增和删除行数
        if (line.startsWith('+') && !line.startsWith('+++')) {
            analysis.linesAdded++;
            
            // 检测新增函数
            const funcMatch = line.match(/^\+.*(?:function|def|const|let|var)\s+(\w+)/);
            if (funcMatch && funcMatch[1]) {
                analysis.newFunctions.push(funcMatch[1]);
            }
            
            // 检测导入变更
            if (line.match(/^\+.*(?:import|require|from)/)) {
                analysis.hasImportChanges = true;
            }
            
            // 检测配置变更
            if (line.match(/^\+.*(?:config|settings|options|parameters)/i)) {
                analysis.hasConfigChanges = true;
            }
            
            // 检测文档变更
            if (line.match(/^\+.*(?:\/\*|\/\/|#|<!--|"""|\*)/)) {
                analysis.hasDocChanges = true;
            }
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            analysis.linesDeleted++;
            
            // 检测修改的函数（删除+新增同一函数名）
            const funcMatch = line.match(/^-.*(?:function|def|const|let|var)\s+(\w+)/);
            if (funcMatch && funcMatch[1]) {
                analysis.modifiedFunctions.push(funcMatch[1]);
            }
        }
    }
    
    // 去重
    analysis.newFunctions = [...new Set(analysis.newFunctions)];
    analysis.modifiedFunctions = [...new Set(analysis.modifiedFunctions)];
    
    return analysis;
}

/**
 * 分析文件变更，提取模块信息
 */
function analyzeFileChanges(changedFiles: any[]) {
    const analysis = {
        affectedModules: [] as string[]
    };
    
    for (const file of changedFiles) {
        const path = file.path || file;
        const pathParts = path.split('/');
        
        // 提取模块名
        if (pathParts.length > 1) {
            const module = pathParts[0];
            if (!analysis.affectedModules.includes(module)) {
                analysis.affectedModules.push(module);
            }
        }
        
        // 特殊文件类型识别
        if (path.includes('package.json')) {
            analysis.affectedModules.push('dependencies');
        } else if (path.includes('config') || path.includes('.config.')) {
            analysis.affectedModules.push('config');
        } else if (path.includes('test') || path.includes('.test.') || path.includes('.spec.')) {
            analysis.affectedModules.push('tests');
        }
    }
    
    return analysis;
}

/**
 * 生成基础body内容（回退方案）
 */
function generateBasicBody(changedFiles: any[], isZh: boolean = true): string {
    const filesByType = changedFiles.reduce((acc: any, file: any) => {
        const status = file.status || 'M';
        if (!acc[status]) {acc[status] = [];}
        acc[status].push(file.path || file);
        return acc;
    }, {});
    
    const bodyLines: string[] = [];
    if (filesByType['A']) {bodyLines.push(isZh ? `- 新增文件: ${filesByType['A'].slice(0,3).join(', ')}` : `- Add files: ${filesByType['A'].slice(0,3).join(', ')}`);}
    if (filesByType['M']) {bodyLines.push(isZh ? `- 修改文件: ${filesByType['M'].slice(0,3).join(', ')}` : `- Modify files: ${filesByType['M'].slice(0,3).join(', ')}`);}
    if (filesByType['D']) {bodyLines.push(isZh ? `- 删除文件: ${filesByType['D'].slice(0,3).join(', ')}` : `- Delete files: ${filesByType['D'].slice(0,3).join(', ')}`);}
    
    return bodyLines.join('\n');
}

/**
 * Body质量检查和优化
 */
function validateAndOptimizeBody(body: string, isZh: boolean = true): { body: string; warnings: string[] } {
    const warnings: string[] = [];
    let optimizedBody = body;
    
    // 长度检查
    const lines = body.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        warnings.push(isZh ? 'Body内容为空' : 'Body content is empty');
        return { body: optimizedBody, warnings };
    }
    
    if (lines.length > 10) {
        warnings.push(isZh ? 'Body内容过长，建议简化' : 'Body content too long, consider simplifying');
        optimizedBody = lines.slice(0, 10).join('\n');
    }
    
    // 每行长度检查（Conventional Commits建议每行不超过72字符）
    const longLines = lines.filter(line => line.length > 72);
    if (longLines.length > 0) {
        warnings.push(isZh ? `${longLines.length}行超过72字符` : `${longLines.length} lines exceed 72 characters`);
    }
    
    // 重复内容检查
    const uniqueLines = [...new Set(lines)];
    if (uniqueLines.length !== lines.length) {
        warnings.push(isZh ? '检测到重复内容' : 'Duplicate content detected');
        optimizedBody = uniqueLines.join('\n');
    }
    
    // 格式标准化
    optimizedBody = optimizedBody
        .split('\n')
        .map(line => {
            const trimmed = line.trim();
            // 确保项目符号格式统一
            if (trimmed && !trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.startsWith('•')) {
                return `- ${trimmed}`;
            }
            return trimmed.startsWith('-') ? trimmed : `- ${trimmed.substring(1).trim()}`;
        })
        .filter(line => line.trim())
        .join('\n');
    
    // 内容质量检查
    const hasOnlyFileList = lines.every(line => 
        line.includes('新增文件') || line.includes('修改文件') || line.includes('删除文件') ||
        line.includes('Add files') || line.includes('Modify files') || line.includes('Delete files')
    );
    
    if (hasOnlyFileList && lines.length === 1) {
        warnings.push(isZh ? '建议添加更详细的变更说明' : 'Consider adding more detailed change descriptions');
    }
    
    return { body: optimizedBody, warnings };
}

// 规范化提交信息，强制符合 Conventional Commits 基础格式
function enforceConventionalCommit(raw: string, changedFiles?: any[], diff?: string): string {
    const config = vscode.workspace.getConfiguration('aiMessage');
    const enableEmoji = config.get('commit.enableEmoji', config.get('commitFormat.enableEmoji', true));
    const enableBody = config.get('commit.enableBody', config.get('commitFormat.enableBody', true));
    const enableIntelligentBody = config.get('commit.intelligentBody', true);
    const enableBodyQualityCheck = config.get('commit.bodyQualityCheck', true);
    const language = config.get('commit.language', config.get('commitFormat.language', 'zh-CN'));
    
    // 语言归一化
    function normalizeLanguage(lang: string | undefined): string {
        if (!lang) {return 'en';}
        const l = lang.toLowerCase();
        if (['zh', 'zh-cn', 'zh_cn', 'zh-hans', '简体中文', 'chinese', '中文', 'cn'].includes(l)) {return 'zh-cn';}
        return 'en';
    }
    const isZh = normalizeLanguage(language as string) === 'zh-cn';

    const typeMap: Record<string,string> = {
        feat: 'feat', feature: 'feat', 新功能: 'feat', 功能: 'feat',
        fix: 'fix', bug: 'fix', 修复: 'fix', 修正: 'fix',
        docs: 'docs', 文档: 'docs',
        style: 'style', 样式: 'style', 格式: 'style',
        refactor: 'refactor', 重构: 'refactor', 优化: 'refactor',
        test: 'test', 测试: 'test',
        chore: 'chore', 杂务: 'chore', 其他: 'chore',
        build: 'build', ci: 'ci', perf: 'perf'
    };

    const emojiMap: Record<string,string> = {
        feat: '✨', fix: '🐛', docs: '📝', style: '🎨', refactor: '♻️', test: '✅', chore: '🔧', build: '🏗️', ci: '⚙️', perf: '⚡'
    };

    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {return raw;}
    let header = lines[0];
    let body = lines.slice(1).join('\n');

    // 尝试解析已有格式
    let type = 'chore';
    let scope: string | undefined;
    let subject = header.trim();

    const headerMatch = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})?\s*([a-zA-Z\u4e00-\u9fa5]+)(?:\(([^)]+)\))?:\s*(.+)$/u.exec(header);
    if (headerMatch) {
        const maybeType = headerMatch[2].toLowerCase();
        const mapped = typeMap[maybeType];
        if (mapped) {type = mapped;}
        if (headerMatch[3]) {scope = headerMatch[3].trim();}
        subject = headerMatch[4].trim();
    } else {
        // 没有匹配格式，从subject中推断type
        for (const k of Object.keys(typeMap)) {
            if (subject.startsWith(k) || subject.includes(k)) { type = typeMap[k]; break; }
        }
    }

    // 限制subject长度
    if (subject.length > 50) {subject = subject.slice(0, 47).trim() + '...';}

    const emoji = enableEmoji ? (emojiMap[type] || '') : '';
    const finalHeader = `${emoji ? emoji + ' ' : ''}${type}${scope ? '(' + scope + ')' : ''}: ${subject}`.trim();

    // 处理或生成body
    if (enableBody) {
        if (!body || body.trim().length === 0) {
            // 使用智能body生成（如果启用）
            if (enableIntelligentBody && diff && changedFiles) {
                body = generateIntelligentBody(diff, changedFiles, isZh);
            } else if (changedFiles && changedFiles.length > 0) {
                // 回退到基础body生成
                body = generateBasicBody(changedFiles, isZh);
            }
        } else {
            // 对现有body进行格式标准化
            body = body
                .replace(/^#+\s*/gm, '')
                .replace(/^[*-]\s*/gm, '- ')
                .trim();
        }
        
        // 对生成的body进行质量检查和优化（如果启用）
        if (body && enableBodyQualityCheck) {
            const validation = validateAndOptimizeBody(body, isZh);
            body = validation.body;
            
            // 如果有警告且开启调试模式，输出到控制台
            if (validation.warnings.length > 0) {
                const debug = config.get<boolean>('debug.enableStreamingLog', false);
                if (debug) {
                    console.log('[AI-Message][Body-Quality] 质量检查警告:', validation.warnings);
                }
            }
        }
    }

    return (enableBody && body) ? `${finalHeader}\n\n${body}` : finalHeader;
}

async function generateCommitMessage(changes: string): Promise<string | null> {
    try {
        if (!vcsService) {
            throw new Error('版本控制服务未初始化');
        }
        
        // 需要获取变更文件列表
        const status = await vcsService.getCommitReadyChanges();
        const message = await aiService.generateCommitMessage(changes, status.changedFiles);
        
        if (!message || message.trim().length === 0) {
            vscode.window.showErrorMessage('无法生成提交信息，请检查GitHub Copilot是否已安装并登录');
            return null;
        }
        
        return message.trim();
    } catch (error) {
        await handleError('使用AI生成提交信息时发生错误', error);
        return null;
    }
}

async function handleCommitMessageGenerated(commitMessage: string) {
    try {
        // 优先尝试填充到SCM输入框
        const success = await setScmInputBoxValue(commitMessage);
        
        if (success) {
            vscode.window.showInformationMessage(
                '✅ 提交信息已生成并填充到Source Control输入框！',
                '查看信息'
            ).then(action => {
                if (action === '查看信息') {
                    showCommitMessagePreview(commitMessage);
                }
            });
        } else {
            // 回退到剪贴板方式
            await vscode.env.clipboard.writeText(commitMessage);
            
            const action = await vscode.window.showInformationMessage(
                '提交信息已生成并复制到剪贴板！',
                { modal: false },
                '查看信息',
                '编辑信息',
                '提交说明'
            );
            
            switch (action) {
                case '查看信息':
                    await showCommitMessagePreview(commitMessage);
                    break;
                case '编辑信息':
                    await editCommitMessage(commitMessage);
                    break;
                case '提交说明':
                    await showCommitHelp();
                    break;
            }
        }
    } catch (error) {
        await handleError('处理生成的提交信息时发生错误', error);
    }
}

/**
 * 尝试将提交信息设置到SCM输入框中
 */
async function setScmInputBoxValue(message: string): Promise<boolean> {
    try {
        // 方法1：尝试Git扩展API
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        
        if (gitExtension && gitExtension.getAPI) {
            const git = gitExtension.getAPI(1);
            if (git && git.repositories.length > 0) {
                const repo = git.repositories[0];
                if (repo.inputBox) {
                    repo.inputBox.value = message;
                    console.log('通过Git API成功设置提交信息');
                    
                    // 尝试聚焦到SCM面板以确保可见性
                    try {
                        await vscode.commands.executeCommand('workbench.scm.focus');
                    } catch (focusError) {
                        console.log('聚焦SCM面板失败:', focusError);
                    }
                    
                    return true;
                }
            }
        }

        // 方法2：尝试SVN扩展API
        const svnExtension = vscode.extensions.getExtension('johnstoncode.svn-scm')?.exports;
        if (svnExtension && svnExtension.getAPI) {
            try {
                const svn = svnExtension.getAPI();
                if (svn && svn.repositories && svn.repositories.length > 0) {
                    const repo = svn.repositories[0];
                    if (repo.inputBox) {
                        repo.inputBox.value = message;
                        console.log('通过SVN API成功设置提交信息');
                        
                        // 聚焦到SCM面板
                        try {
                            await vscode.commands.executeCommand('workbench.scm.focus');
                        } catch (focusError) {
                            console.log('聚焦SCM面板失败:', focusError);
                        }
                        
                        return true;
                    }
                }
            } catch (svnError) {
                console.log('SVN API调用失败:', svnError);
            }
        }

        // 方法3：尝试通用SCM API
        try {
            const scm = vscode.scm;
            if (scm && scm.inputBox) {
                scm.inputBox.value = message;
                console.log('通过通用SCM API成功设置提交信息');
                
                // 聚焦到SCM面板
                try {
                    await vscode.commands.executeCommand('workbench.scm.focus');
                } catch (focusError) {
                    console.log('聚焦SCM面板失败:', focusError);
                }
                
                return true;
            }
        } catch (genericError) {
            console.log('通用SCM API调用失败:', genericError);
        }

        console.log('未能通过API直接设置SCM提交信息');
        return false;
    } catch (error) {
        console.log('设置SCM输入框失败:', error);
        return false;
    }
}

async function showCommitMessagePreview(commitMessage: string) {
    try {
        const document = await vscode.workspace.openTextDocument({
            content: commitMessage,
            language: 'plaintext'
        });
        
        await vscode.window.showTextDocument(document, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside
        });
    } catch (error) {
        console.error('显示提交信息预览时发生错误:', error);
        vscode.window.showInformationMessage(
            `生成的提交信息：\n\n${commitMessage}`,
            { modal: true }
        );
    }
}

async function editCommitMessage(commitMessage: string) {
    try {
        const editedMessage = await vscode.window.showInputBox({
            title: '编辑提交信息',
            value: commitMessage,
            prompt: '修改提交信息后按回车确认',
            ignoreFocusOut: true
        });
        
        if (editedMessage !== undefined && editedMessage.trim().length > 0) {
            await vscode.env.clipboard.writeText(editedMessage.trim());
            vscode.window.showInformationMessage('编辑后的提交信息已复制到剪贴板！');
        }
    } catch (error) {
        await handleError('编辑提交信息时发生错误', error);
    }
}

async function showCommitHelp() {
    const helpMessage = `## 如何使用生成的提交信息

1. **已复制到剪贴板** - 提交信息已自动复制，可直接粘贴使用

2. **SVN提交步骤**:
   - 打开终端或SVN客户端
   - 使用 \`svn commit -m "粘贴提交信息"\`
   - 或在SVN GUI中粘贴到提交信息框

3. **提交信息格式** - 遵循 Conventional Commits 规范:
   - \`feat: 新功能\`
   - \`fix: 错误修复\`
   - \`docs: 文档更新\`
   - \`style: 代码格式化\`
   - \`refactor: 代码重构\`

4. **快捷键**:
   - Cmd+Alt+G: 生成提交信息
   - Cmd+Alt+Q: 快速生成`;
    
    try {
        const document = await vscode.workspace.openTextDocument({
            content: helpMessage.trim(),
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(document, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside
        });
    } catch (error) {
        console.error('显示帮助信息时发生错误:', error);
        vscode.window.showInformationMessage('请参考扩展说明或联系支持');
    }
}

async function handleConfigureAI() {
    try {
        const status = await aiService.getProviderStatus();
        const currentProvider = aiService.getCurrentProviderName();
        
        interface ProviderQuickPickItem extends vscode.QuickPickItem {
            provider: string;
        }
        
        const items: ProviderQuickPickItem[] = [
            {
                label: '$(gear) 查看当前AI提供商状态',
                description: `当前: ${currentProvider}`,
                provider: 'status'
            },
            {
                label: '$(settings) 打开AI设置',
                description: '配置AI提供商和参数',
                provider: 'settings'
            },
            {
                label: '$(refresh) 测试AI连接',
                description: '检查所有AI提供商的可用性',
                provider: 'test'
            }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: '选择AI配置操作'
        });

        if (!selection) {
            return;
        }

        switch (selection.provider) {
            case 'status':
                await showProviderStatus(status, currentProvider);
                break;
            case 'settings':
                await vscode.commands.executeCommand('workbench.action.openSettings', 'aiMessage.ai');
                break;
            case 'test':
                await testAIConnection();
                break;
        }
    } catch (error) {
        await handleError('配置AI设置时发生错误', error);
    }
}

async function showProviderStatus(status: { name: string; available: boolean; error?: string }[], currentProvider: string) {
    const statusText = status.map(s => {
        const icon = s.available ? '✅' : '❌';
        const current = s.name === currentProvider ? ' (当前)' : '';
        const error = s.error ? ` - ${s.error}` : '';
        return `${icon} ${s.name}${current}${error}`;
    }).join('\n');

    await vscode.window.showInformationMessage(
        `AI提供商状态:\n\n${statusText}`,
        { modal: true },
        '确定'
    );
}

async function testAIConnection() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "测试AI连接",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: "正在检查AI提供商..." });
        
        const status = await aiService.getProviderStatus();
        const available = status.filter(s => s.available);
        const unavailable = status.filter(s => !s.available);
        
        progress.report({ increment: 100, message: "测试完成" });
        
        let message = `测试完成!\n\n可用的AI提供商 (${available.length}个):\n`;
        message += available.map(s => `✅ ${s.name}`).join('\n');
        
        if (unavailable.length > 0) {
            message += `\n\n不可用的AI提供商 (${unavailable.length}个):\n`;
            message += unavailable.map(s => `❌ ${s.name}${s.error ? ` - ${s.error}` : ''}`).join('\n');
        }
        
        await vscode.window.showInformationMessage(message, { modal: true }, '确定');
    });
}

async function handleError(context: string, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`${context}:`, error);
    
    const action = await vscode.window.showErrorMessage(
        `${context}: ${errorMessage}`,
        '重试',
        '报告问题'
    );
    
    if (action === '重试') {
        vscode.commands.executeCommand('ai-message.generateCommitMessage');
    } else if (action === '报告问题') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/jianxiaofei/AI-message/issues'));
    }
}

export function deactivate() {
    console.log('AI-message is now deactivated');
}