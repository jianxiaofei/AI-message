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
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "生成提交信息",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "检查版本控制仓库..." });
            
            const vcs = await validateVcsRepository();
            if (!vcs) {
                return;
            }
            
            progress.report({ increment: 30, message: "获取变更信息..." });
            
            const changes = await getVcsChanges();
            if (!changes) {
                return;
            }
            
            progress.report({ increment: 60, message: "生成提交信息..." });
            
            // 先设置Loading状态到输入框
            const success = await setScmInputBoxValue("🤖 AI正在生成提交信息...");
            if (success) {
                progress.report({ increment: 70, message: "正在流式生成..." });
                
                // 实时生成并更新提交信息
                await generateCommitMessageStreaming(changes, progress);
                
                progress.report({ increment: 100, message: "完成！" });
                vscode.window.showInformationMessage('✅ 提交信息已生成并实时显示在输入框中！');
            } else {
                // 回退到一次性生成
                const commitMessage = await generateCommitMessage(changes);
                if (!commitMessage) {
                    return;
                }
                
                progress.report({ increment: 90, message: "设置提交信息..." });
                console.log('正在尝试设置SCM输入框...');
                const fallbackSuccess = await setScmInputBoxValue(commitMessage);
                console.log('SCM输入框设置结果:', fallbackSuccess);
                
                if (fallbackSuccess) {
                    progress.report({ increment: 100, message: "提交信息已设置到输入框！" });
                    vscode.window.showInformationMessage(
                        '✅ 提交信息已生成并填充到Source Control输入框！',
                        '查看信息'
                    ).then(action => {
                        if (action === '查看信息') {
                            showCommitMessagePreview(commitMessage);
                        }
                    });
                } else {
                    progress.report({ increment: 100, message: "已复制到剪贴板" });
                    console.log('设置SCM输入框失败，回退到剪贴板方式');
                    await handleCommitMessageGenerated(commitMessage);
                }
            }
        });
    } catch (error) {
        await handleError('生成提交信息时发生错误', error);
    }
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
async function generateCommitMessageStreaming(changes: string, progress: vscode.Progress<{ increment?: number; message?: string }>): Promise<void> {
    try {
        if (!vcsService) {
            throw new Error('版本控制服务未初始化');
        }
        
        // 获取变更文件列表
        const status = await vcsService.getCommitReadyChanges();
        
        // 分阶段生成，直接显示有用的信息，去掉套话
        const stages = [
            { 
                message: "📝 正在构建提交信息结构...\n\n分析文件类型和变更模式\n生成规范的提交格式", 
                progress: 80 
            },
            { 
                message: "✨ 正在优化提交信息内容...\n\n完善描述信息\n确保符合最佳实践\n即将完成...", 
                progress: 90 
            }
        ];
        
        for (const stage of stages) {
            await setScmInputBoxValue(stage.message);
            progress.report({ increment: stage.progress, message: stage.message.split('\n')[0].replace(/🤖|📝|✨/g, '') });
            await new Promise(resolve => setTimeout(resolve, 1000)); // 增加到1秒让用户能看清
        }
        
        // 实际生成提交信息
        const message = await aiService.generateCommitMessage(changes, status.changedFiles);
        
        if (!message || message.trim().length === 0) {
            const errorMsg = "❌ 提交信息生成失败\n\n请检查：\n• GitHub Copilot 是否已安装\n• 是否已正确登录\n• 网络连接是否正常";
            await setScmInputBoxValue(errorMsg);
            throw new Error('无法生成提交信息，请检查GitHub Copilot是否已安装并登录');
        }
        
        // 最终设置完整的提交信息
        await setScmInputBoxValue(message.trim());
        
    } catch (error) {
        await setScmInputBoxValue("❌ 生成失败，请重试\n\n如果问题持续出现，请检查扩展设置");
        throw error;
    }
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
                    console.log('通过Git API成功设置提交信息:', message.substring(0, 50) + '...');
                    
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

        // 方法3：尝试通过命令和剪贴板的组合方式
        try {
            await vscode.env.clipboard.writeText(message);
            await vscode.commands.executeCommand('workbench.scm.focus');
            
            // 尝试模拟粘贴操作（在某些情况下可能工作）
            setTimeout(async () => {
                try {
                    await vscode.commands.executeCommand('editor.action.selectAll');
                    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                } catch (pasteError) {
                    console.log('模拟粘贴失败:', pasteError);
                }
            }, 100);
            
            console.log('使用剪贴板+焦点方式设置提交信息');
            return true;
        } catch (commandError) {
            console.log('命令执行失败:', commandError);
        }
        
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