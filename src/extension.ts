import * as vscode from 'vscode';
import { VcsFactory, IVersionControlService, VcsFile } from './vcs';
import { AIService } from './aiProviderFactory';
import { buildPrompt } from './commit/prompt';
import { parseConventionalCommit, formatCommitMessage, generateBodyFromFiles } from './commit/formatter';

let vcsService: IVersionControlService | null = null;
let aiService: AIService;

export function activate(context: vscode.ExtensionContext) {
    console.log('AI-message is now active!');
    aiService = new AIService();
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-message.generateCommitMessage', handleGenerate),
        vscode.commands.registerCommand('ai-message.quickCommit', handleQuick),
        vscode.commands.registerCommand('ai-message.configureAI', handleConfig)
    );
}

async function handleGenerate() {
    try { await generate(); }
    catch (e) { showError('生成提交信息时发生错误', e); }
}

async function handleQuick() {
    try {
        vscode.window.showInformationMessage('正在快速生成提交信息...');
        const vcs = await getVcs();
        if (!vcs) return;
        const diff = await vcs.getDiff();
        if (!diff) { vscode.window.showWarningMessage('当前没有需要提交的更改'); return; }
        const status = await vcs.getCommitReadyChanges();
        const msg = await aiService.generateCommitMessage(diff, status.changedFiles);
        if (msg) await setScmInputBox(formatFinalCommit(msg, status.changedFiles));
    } catch (e) { showError('快速生成提交信息时发生错误', e); }
}

async function handleConfig() {
    const status = await aiService.getProviderStatus();
    const current = aiService.getCurrentProviderName();
    const items = [
        { label: '$(gear) 查看当前 AI 提供商状态', provider: 'status' },
        { label: '$(settings) 打开 AI 设置', provider: 'settings' },
        { label: '$(refresh) 测试 AI 连接', provider: 'test' }
    ];
    const sel = await vscode.window.showQuickPick(items, { placeHolder: '选择 AI 配置操作' });
    if (!sel) return;
    if (sel.provider === 'status') {
        const text = status.map(s => `${s.available ? '✅' : '❌'} ${s.name}${s.name === current ? ' (当前)' : ''}${s.error ? ` - ${s.error}` : ''}`).join('\n');
        vscode.window.showInformationMessage(`AI 提供商状态:\n\n${text}`, { modal: true }, '确定');
    } else if (sel.provider === 'settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'aiMessage.ai');
    } else {
        vscode.window.showInformationMessage(`可用的 AI: ${status.filter(s => s.available).map(s => s.name).join(', ')}`, { modal: true }, '确定');
    }
}

async function generate() {
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '生成提交信息', cancellable: false },
        async (progress) => {
            progress.report({ increment: 0, message: '检查仓库...' });
            const vcs = await getVcs();
            if (!vcs) return;

            progress.report({ increment: 20, message: '收集变更...' });
            const diff = await vcs.getDiff();
            if (!diff) { vscode.window.showWarningMessage('当前没有需要提交的更改'); return; }

            const status = await vcs.getCommitReadyChanges();
            const files = status.changedFiles;

            progress.report({ increment: 40, message: '准备流式...' });
            await setScmInputBox(`🤖 正在分析 ${files.length} 个文件变更...`, true);

            try {
                progress.report({ increment: 55, message: '模型流式生成中...' });
                await streamGenerate(diff, files, progress);
                progress.report({ increment: 100, message: '完成' });
                vscode.window.showInformationMessage('✅ 提交信息已生成');
            } catch (e) {
                console.error('[AI-Message] 流式生成失败', e);
                const msg = await aiService.generateCommitMessage(diff, files);
                if (msg) {
                    await setScmInputBox(formatFinalCommit(msg, files));
                    vscode.window.showInformationMessage('⚠️ 已使用非流式方式生成提交信息');
                } else {
                    vscode.window.showErrorMessage('无法生成提交信息');
                }
            }
        }
    );
}

async function streamGenerate(diff: string, files: VcsFile[], progress: vscode.Progress<{ increment?: number; message?: string }>) {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
    const model = models[0] || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];
    if (!model) throw new Error('没有可用的 Copilot 模型');

    const prompt = buildPrompt(diff, files);
    const cts = new vscode.CancellationTokenSource();
    try {
        const response = await model.sendRequest(
            [vscode.LanguageModelChatMessage.User(prompt)],
            {},
            cts.token
        );
        let result = '';
        let lastTime = Date.now();

        for await (const fragment of response.text) {
            result += fragment;
            if (Date.now() - lastTime > 200) {
                await setScmInputBox(result.length > 10 ? `🤖 AI 正在生成...\n\n${result}...` : '🤖 AI 正在思考...', true);
                progress.report({ increment: Math.min(85 + result.length / 10, 95), message: '实时生成中...' });
                lastTime = Date.now();
            }
        }

        if (result.trim()) {
            await setScmInputBox(formatFinalCommit(result.trim(), files));
        } else {
            throw new Error('生成的内容为空');
        }
    } finally { cts.dispose(); }
}

function formatFinalCommit(raw: string, files: VcsFile[]): string {
    const parsed = parseConventionalCommit(raw);
    const config = vscode.workspace.getConfiguration('aiMessage');

    return formatCommitMessage(parsed, {
        enableEmoji: config.get('commit.enableEmoji', true),
        enableBody: config.get('commit.enableBody', true),
        enableScope: config.get('commit.enableScope', true)
    });
}

async function getVcs(): Promise<IVersionControlService | null> {
    vcsService = await VcsFactory.createService();
    if (!vcsService) {
        vscode.window.showErrorMessage('当前工作区不是 Git 或 SVN 仓库', '了解更多').then(s => {
            if (s === '了解更多') vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/'));
        });
        return null;
    }
    console.log(`检测到${vcsService.getVcsType().toUpperCase()}仓库`);
    return vcsService;
}

async function setScmInputBox(msg: string, silent = false): Promise<boolean> {
    try {
        // Git API
        const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
        if (gitExt?.getAPI) {
            const git = gitExt.getAPI(1);
            if (git?.repositories?.[0]?.inputBox) {
                git.repositories[0].inputBox.value = msg;
                await vscode.commands.executeCommand('workbench.view.scm');
                return true;
            }
        }
        // SVN API
        const svnExt = vscode.extensions.getExtension('johnstoncode.svn-scm')?.exports;
        if (svnExt?.getAPI) {
            const svn = svnExt.getAPI();
            if (svn?.repositories?.[0]?.inputBox) {
                svn.repositories[0].inputBox.value = msg;
                await vscode.commands.executeCommand('workbench.view.scm');
                return true;
            }
        }
        // Fallback
        if (silent) { return false; }
        await vscode.env.clipboard.writeText(msg);
        vscode.window.showInformationMessage('✅ 提交信息已复制到剪贴板', '查看').then(action => {
            if (action === '查看') {
                vscode.workspace.openTextDocument({ content: msg, language: 'plaintext' }).then(doc => {
                    vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                });
            }
        });
        return false;
    } catch (e) { console.log('[SCM]', e); return false; }
}

async function showError(ctx: string, error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(ctx, error);
    const action = await vscode.window.showErrorMessage(`${ctx}: ${msg}`, '重试', '报告问题');
    if (action === '重试') vscode.commands.executeCommand('ai-message.generateCommitMessage');
    else if (action === '报告问题') vscode.env.openExternal(vscode.Uri.parse('https://github.com/jianxiaofei/AI-message/issues'));
}

export function deactivate() { console.log('AI-message deactivated'); }
