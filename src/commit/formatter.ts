import { VcsFile } from '../vcsInterface';

/**
 * 提交类型到表情符号的映射
 */
export const EMOJI_MAP: Record<string, string> = {
    feat: '✨',
    fix: '🐛',
    docs: '📝',
    style: '💄',
    refactor: '♻️',
    perf: '⚡',
    test: '✅',
    build: '📦',
    ci: '🤖',
    chore: '🔧',
    revert: '↩️'
};

/**
 * 提交消息类型
 */
export interface ParsedCommit {
    type: string;
    scope: string;
    subject: string;
    body: string;
    raw: string;
}

/**
 * 解析为 Conventional Commit 格式
 * 格式：type(scope): subject
 */
export function parseConventionalCommit(raw: string): ParsedCommit {
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
        return { type: 'chore', scope: '', subject: '更新代码', body: '', raw: '' };
    }

    const header = lines[0];
    const body = lines.slice(1).join('\n');

    // 匹配 type(scope): subject 或 type: subject 或 subject
    const match = header.match(/^(\w+)(?:\(([^)]+)\))?:?\s*(.+)?$/);

    if (!match) {
        return { type: 'chore', scope: '', subject: header, body, raw };
    }

    const type = match[1].toLowerCase();
    const scope = match[2] || '';
    let subject = match[3] || header;

    // 限制 subject 长度
    if (subject.length > 50) {
        subject = subject.slice(0, 47) + '...';
    }

    return { type, scope, subject, body, raw };
}

/**
 * 格式化提交消息
 */
export function formatCommitMessage(
    parsed: ParsedCommit,
    options: {
        enableEmoji: boolean;
        enableBody: boolean;
        enableScope: boolean;
    }
): string {
    const { type, scope, subject, body } = parsed;
    const emoji = options.enableEmoji ? (EMOJI_MAP[type] || '✨') : '';
    const scopePart = options.enableScope && scope ? `(${scope})` : '';

    const header = `${emoji}${type}${scopePart}: ${subject}`.trim();

    if (!options.enableBody) {
        return header;
    }

    // 如果没有 body，根据文件类型生成默认描述
    if (!body.trim()) {
        return header; // 暂时返回 header，后续可以从文件信息生成 body
    }

    return `${header}\n\n${body}`;
}

/**
 * 从文件变更生成默认 body
 */
export function generateBodyFromFiles(files: VcsFile[]): string {
    const additions = files.filter(f => f.status === 'A');
    const modifications = files.filter(f => f.status === 'M');
    const deletions = files.filter(f => f.status === 'D');

    const lines: string[] = [];

    if (additions.length > 0) {
        lines.push(`- 新增文件：${additions.map(f => f.path).join(', ')}`);
    }
    if (modifications.length > 0) {
        lines.push(`- 修改文件：${modifications.map(f => f.path).join(', ')}`);
    }
    if (deletions.length > 0) {
        lines.push(`- 删除文件：${deletions.map(f => f.path).join(', ')}`);
    }

    return lines.join('\n');
}
