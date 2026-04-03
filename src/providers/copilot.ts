import * as vscode from 'vscode';
import { AIProvider } from '../aiInterface';
import { VcsFile } from '../vcs';
import { buildPrompt } from '../commit/prompt';

export class CopilotProvider implements AIProvider {
    readonly name = 'GitHub Copilot';

    async isAvailable(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            return models.length > 0;
        } catch {
            return false;
        }
    }

    async generateCommitMessage(diff: string, changedFiles: VcsFile[]): Promise<string> {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        const model = models[0] || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];

        if (!model) {
            throw new Error('GitHub Copilot 未安装或未登录');
        }

        const prompt = buildPrompt(diff, changedFiles);
        const response = await model.sendRequest([
            vscode.LanguageModelChatMessage.User(prompt)
        ]);

        let result = '';
        for await (const fragment of response.text) {
            result += fragment;
        }
        return result;
    }
}
