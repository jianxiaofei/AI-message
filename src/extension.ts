import * as vscode from 'vscode';
import { VcsFactory, IVersionControlService, VcsFile } from './vcs';
import { AIService } from './aiProviderFactory';
import { buildPrompt, extractCommitMessage, EMOJI_MAP } from './providers';

let vcsService: IVersionControlService | null = null;
let aiService: AIService;
const outputChannel = vscode.window.createOutputChannel('AI Commit Stream');

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
        if (msg) await setScmInputBox(extractAndFormat(msg, status.changedFiles, diff));
    } catch (e) { showError('快速生成提交信息时发生错误', e); }
}

async function handleConfig() {
    const status = await aiService.getProviderStatus();
    const current = aiService.getCurrentProviderName();
    const items = [
        { label: '$(gear) 查看当前AI提供商状态', provider: 'status' },
        { label: '$(settings) 打开AI设置', provider: 'settings' },
        { label: '$(refresh) 测试AI连接', provider: 'test' }
    ];
    const sel = await vscode.window.showQuickPick(items, { placeHolder: '选择AI配置操作' });
    if (!sel) return;
    if (sel.provider === 'status') {
        const text = status.map(s => `${s.available ? '✅' : '❌'} ${s.name}${s.name === current ? ' (当前)' : ''}${s.error ? ` - ${s.error}` : ''}`).join('\n');
        vscode.window.showInformationMessage(`AI提供商状态:\n\n${text}`, { modal: true }, '确定');
    } else if (sel.provider === 'settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'aiMessage.ai');
    } else {
        vscode.window.showInformationMessage(`可用的AI: ${status.filter(s => s.available).map(s => s.name).join(', ')}`, { modal: true }, '确定');
    }
}

async function generate() {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: '生成提交信息', cancellable: false }, async (progress) => {
        progress.report({ increment: 0, message: '检查仓库...' });
        const vcs = await getVcs();
        if (!vcs) return;

        progress.report({ increment: 20, message: '收集变更...' });
        const diff = await vcs.getDiff();
        if (!diff) { vscode.window.showWarningMessage('当前没有需要提交的更改'); return; }

        const status = await vcs.getCommitReadyChanges();
        const files = status.changedFiles;
        const vcsType = status.vcsType;

        progress.report({ increment: 40, message: '准备流式...' });
        await setScmInputBox(`🤖 正在分析 ${files.length} 个文件变更...`);

        try {
            progress.report({ increment: 55, message: '模型流式生成中...' });
            await streamGenerate(diff, files, progress);
            progress.report({ increment: 100, message: '完成' });
            vscode.window.showInformationMessage('✅ 提交信息已生成');
        } catch (e) {
            console.error('[AI-Message] 流式生成失败', e);
            const msg = await aiService.generateCommitMessage(diff, files);
            if (msg) {
                await setScmInputBox(extractAndFormat(msg, files, diff));
                vscode.window.showInformationMessage('⚠️ 已使用非流式方式生成提交信息');
            } else {
                vscode.window.showErrorMessage('无法生成提交信息');
            }
        }
    });
}

async function streamGenerate(diff: string, files: VcsFile[], progress: vscode.Progress<{ increment?: number; message?: string }>) {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
    const model = models[0] || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];
    if (!model) throw new Error('没有可用的 Copilot 模型');

    const prompt = buildPrompt(diff, files);
    const cts = new vscode.CancellationTokenSource();
    try {
        const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)], {}, cts.token);
        let result = '';
        let lastTime = Date.now();

        for await (const fragment of response.text) {
            result += fragment;
            if (Date.now() - lastTime > 200) {
                await setScmInputBox(result.length > 10 ? `🤖 AI正在生成...\n\n${result}...` : '🤖 AI正在思考...');
                progress.report({ increment: Math.min(85 + result.length / 10, 95), message: '实时生成中...' });
                lastTime = Date.now();
            }
        }

        if (result.trim()) {
            await setScmInputBox(extractAndFormat(result.trim(), files, diff));
        } else {
            throw new Error('生成的内容为空');
        }
    } finally { cts.dispose(); }
}

function extractAndFormat(msg: string, files: VcsFile[], diff: string): string {
    const cleaned = extractCommitMessage(msg);
    return formatCommit(cleaned, files, diff);
}

function formatCommit(raw: string, files: VcsFile[], diff: string): string {
    const config = vscode.workspace.getConfiguration('aiMessage');
    const enableEmoji = config.get('commit.enableEmoji', true);
    const enableBody = config.get('commit.enableBody', true);
    const isZh = config.get('commit.language', '简体中文').toLowerCase().includes('zh');

    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length === 0) return '✨ feat: 更新代码';

    let header = lines[0];
    let body = lines.slice(1).join('\n');

    // 解析 type
    const match = header.match(/^(\p{Emoji_Presentation})?\s*(\w+)(?:\(([^)]+)\))?:?\s*(.+)$/u);
    let type = 'chore', scope = '', subject = header;
    if (match) {
        type = match[2].toLowerCase();
        scope = match[3] || '';
        subject = match[4] || header;
    }
    if (subject.length > 50) subject = subject.slice(0, 47) + '...';

    const emoji = enableEmoji ? (EMOJI_MAP[type] || '✨') : '';
    const finalHeader = `${emoji}${type}${scope ? '(' + scope + ')' : ''}: ${subject}`.trim();

    if (!enableBody) return finalHeader;

    if (!body.trim()) {
        const fileTypes = [...new Set(files.map(f => f.path.split('.').pop()))];
        if (fileTypes.includes('md')) { type = 'docs'; body = '- 更新文档'; }
        else if (files.some(f => f.status === 'A')) { type = 'feat'; body = '- 新增文件: ' + files.filter(f => f.status === 'A').map(f => f.path).join(', '); }
        else if (files.some(f => f.status === 'M')) { body = '- 修改文件: ' + files.filter(f => f.status === 'M').map(f => f.path).join(', '); }
    }

    return body ? `${finalHeader}\n\n${body}` : finalHeader;
}

async function getVcs(): Promise<IVersionControlService | null> {
    vcsService = await VcsFactory.createService();
    if (!vcsService) {
        vscode.window.showErrorMessage('当前工作区不是Git或SVN仓库', '了解更多').then(s => {
            if (s === '了解更多') vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/'));
        });
        return null;
    }
    console.log(`检测到${vcsService.getVcsType().toUpperCase()}仓库`);
    return vcsService;
}

async function setScmInputBox(msg: string): Promise<boolean> {
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
        await vscode.env.clipboard.writeText(msg);
        const action = await vscode.window.showInformationMessage('✅ 提交信息已复制到剪贴板', '查看');
        if (action === '查看') {
            const doc = await vscode.workspace.openTextDocument({ content: msg, language: 'plaintext' });
            await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
        }
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
