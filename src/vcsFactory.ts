import * as vscode from 'vscode';
import { SvnService } from './svnService';
import { GitService } from './gitService';
import { IVersionControlService } from './vcsInterface';

export class VcsFactory {
    /**
     * 自动检测版本控制系统类型并返回相应的服务
     */
    static async createService(): Promise<IVersionControlService | null> {
        // 优先检测Git（更常见）
        const gitService = new GitService();
        if (await gitService.isInRepository()) {
            console.log('检测到Git仓库');
            return gitService;
        }

        // 检测SVN
        const svnService = new SvnService();
        if (await svnService.isInRepository()) {
            console.log('检测到SVN仓库');
            return svnService;
        }

        console.log('未检测到支持的版本控制系统');
        return null;
    }

    /**
     * 获取当前工作区的版本控制系统类型
     */
    static async detectVcsType(): Promise<'git' | 'svn' | 'none'> {
        const service = await VcsFactory.createService();
        if (!service) {
            return 'none';
        }
        return service.getVcsType();
    }
}