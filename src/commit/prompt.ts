import { VcsFile } from '../vcsInterface';

/**
 * 构建 AI 提示词
 */
export function buildPrompt(diff: string, changedFiles: VcsFile[], language: string = '简体中文'): string {
    const fileCount = changedFiles.length;
    const fileList = changedFiles
        .map(f => `  - ${f.path} (${f.status})`)
        .join('\n');

    const fileTypes = [...new Set(changedFiles.map(f => f.path.split('.').pop()?.toLowerCase() || 'unknown'))];

    const prompt = `
<instruction>
你是一个专业的软件工程师。请根据以下代码变更，生成一条符合 Conventional Commit 规范的提交信息。

**变更文件清单** (${fileCount} 个文件):
${fileList}

**文件类型**: ${fileTypes.join(', ')}

**代码变更详情**:
${diff}

**生成要求**:
1. 遵循 Conventional Commit 规范：type(scope): subject
2. 提交类型包括：feat, fix, docs, style, refactor, perf, test, build, ci, chore
3. ${language === '简体中文'
    ? '使用简体中文描述，简洁准确'
    : 'Use English, be concise and accurate'}
4. subject 行不超过 50 字符
5. 如果有多个文件的变更，请生成清晰的 body 描述每个文件的变更内容
6. 不要添加不必要的表情符号（我会在格式化时自动添加）

**输出格式示例**:
feat(auth): add JWT token authentication

- Add JWT token generation and verification
- Implement token refresh mechanism
- Add password hashing with bcrypt

</instruction>
`;

    return prompt.trim();
}
