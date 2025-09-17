import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IVersionControlService, VcsStatus, VcsFile } from './vcsInterface';

const execAsync = promisify(exec);

export class GitService implements IVersionControlService {
    private workspaceRoot: string;
    private gitPath: string;

    constructor() {
        this.workspaceRoot = this.resolveWorkspaceRoot();
        this.gitPath = this.resolveGitPath();
        console.log('GitService 初始化: 工作区根目录 =', this.workspaceRoot);
        console.log('GitService 初始化: 使用的 git 可执行文件 =', this.gitPath);
    }

    private resolveWorkspaceRoot(): string {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return '';
        }
        const active = vscode.window.activeTextEditor?.document.uri;
        if (active) {
            const f = vscode.workspace.getWorkspaceFolder(active);
            if (f) {
                return f.uri.fsPath;
            }
        }
        return folders[0].uri.fsPath;
    }
    
    private resolveGitPath(): string {
        // 允许用户在设置中指定 git 可执行文件路径
        const cfg = vscode.workspace.getConfiguration('aiMessage');
        const userPath = (cfg.get<string>('git.path', '') || '').trim();
        if (userPath && fs.existsSync(userPath)) {
            return userPath;
        }

        // 常见安装路径（macOS/Homebrew、常规路径）
        const commonPaths = [
            '/usr/bin/git',
            '/usr/local/bin/git',
            '/opt/homebrew/bin/git',
            'git'  // 依赖系统PATH
        ];

        for (const candidatePath of commonPaths) {
            try {
                if (candidatePath === 'git') {
                    // 测试系统PATH中的git
                    execSync('which git', { stdio: 'ignore' });
                    return candidatePath;
                } else if (fs.existsSync(candidatePath)) {
                    return candidatePath;
                }
            } catch {
                // 继续尝试下一个路径
            }
        }

        // 默认依赖系统PATH
        return 'git';
    }

    getVcsType(): 'git' | 'svn' {
        return 'git';
    }

    async isInRepository(): Promise<boolean> {
        if (!this.workspaceRoot) {
            console.log('Git检测: 没有工作区');
            return false;
        }

        console.log(`Git检测: 检查目录 ${this.workspaceRoot}`);

        try {
            const { stdout } = await execAsync(`"${this.gitPath}" rev-parse --is-inside-work-tree`, { cwd: this.workspaceRoot });
            const isGitRepo = stdout.trim() === 'true';
            console.log('Git检测: git rev-parse 结果:', isGitRepo);
            return isGitRepo;
        } catch (error) {
            console.log('Git检测: 不是Git仓库或 git 命令不可用:', error);
            return false;
        }
    }

    async getStatus(): Promise<VcsStatus> {
        if (!await this.isInRepository()) {
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        }

        try {
            const { stdout } = await execAsync(`"${this.gitPath}" status --porcelain`, { cwd: this.workspaceRoot });
            const changedFiles = this.parseGitStatus(stdout);
            
            return {
                isRepository: true,
                changedFiles,
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        } catch (error) {
            console.error('Error getting Git status:', error);
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        }
    }

    /**
     * 获取VS Code Source Control中的变更（不包括ignore-on-commit的文件）
     */
    async getSourceControlChanges(): Promise<VcsStatus> {
        if (!await this.isInRepository()) {
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        }

        try {
            const gitStatus = await this.getStatus();
            const filteredFiles = await this.filterIgnoreOnCommitFiles(gitStatus.changedFiles);
            
            console.log(`原始变更文件: ${gitStatus.changedFiles.length}个`);
            console.log(`过滤后文件: ${filteredFiles.length}个`);
            
            return {
                isRepository: true,
                changedFiles: filteredFiles,
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
            
        } catch (error) {
            console.error('Error getting Git source control changes:', error);
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        }
    }

    private async filterIgnoreOnCommitFiles(allFiles: VcsFile[]): Promise<VcsFile[]> {
        if (!allFiles.length) {
            return [];
        }

        try {
            const ignorePatterns = await this.loadIgnorePatterns();
            if (!ignorePatterns.length) {
                return allFiles;
            }

            const filteredFiles: VcsFile[] = [];
            
            for (const file of allFiles) {
                const shouldIgnore = ignorePatterns.some(pattern => {
                    try {
                        // 简单的glob模式匹配（支持*和**）
                        const regexPattern = pattern
                            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则特殊字符
                            .replace(/\\\*\\\*/g, '.*') // ** 匹配任意深度路径
                            .replace(/\\\*/g, '[^/]*'); // * 匹配单级路径

                        const regex = new RegExp(`^${regexPattern}$`);
                        return regex.test(file.path);
                    } catch {
                        return false;
                    }
                });

                if (!shouldIgnore) {
                    filteredFiles.push(file);
                }
            }

            console.log(`忽略模式: ${ignorePatterns.join(', ')}`);
            console.log(`过滤前: ${allFiles.length}个文件`);
            console.log(`过滤后: ${filteredFiles.length}个文件`);

            return filteredFiles;
        } catch (error) {
            console.warn('过滤ignore-on-commit文件时发生错误，返回所有文件:', error);
            return allFiles;
        }
    }

    private async loadIgnorePatterns(): Promise<string[]> {
        const patterns: string[] = [];

        try {
            // 1. 从VS Code设置读取忽略模式
            const config = vscode.workspace.getConfiguration('git');
            const vscodePatterns = config.get<string[]>('ignoreOnCommit', []);
            if (vscodePatterns && vscodePatterns.length > 0) {
                patterns.push(...vscodePatterns);
                console.log('从VS Code设置加载了ignore-on-commit模式:', vscodePatterns);
            }

            // 2. 从.gitignore文件读取（可选）
            const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
            if (fs.existsSync(gitignorePath)) {
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
                const gitignorePatterns = gitignoreContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                patterns.push(...gitignorePatterns);
                console.log('从.gitignore加载了模式:', gitignorePatterns);
            }

        } catch (error) {
            console.warn('加载忽略模式时发生错误:', error);
        }

        return [...new Set(patterns)]; // 去重
    }

    async getCommitReadyChanges(): Promise<VcsStatus> {
        // 对于Git，获取暂存区的文件（准备提交的文件）
        // 如果暂存区为空，则获取工作区变更但排除忽略的文件
        const stagedChanges = await this.getStagedChanges();
        if (stagedChanges.changedFiles.length > 0) {
            console.log(`Git: 使用暂存区文件 (${stagedChanges.changedFiles.length}个)`);
            return stagedChanges;
        }
        
        // 如果没有暂存的文件，返回工作区变更
        const workingChanges = await this.getSourceControlChanges();
        console.log(`Git: 使用工作区变更 (${workingChanges.changedFiles.length}个)`);
        return workingChanges;
    }

    /**
     * 获取暂存区的变更（已经准备提交的文件）
     */
    private async getStagedChanges(): Promise<VcsStatus> {
        if (!await this.isInRepository()) {
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        }

        try {
            // 获取暂存区状态
            const { stdout } = await execAsync(`"${this.gitPath}" diff --cached --name-status`, { cwd: this.workspaceRoot });
            const stagedFiles = this.parseStagedStatus(stdout);
            
            return {
                isRepository: true,
                changedFiles: stagedFiles,
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        } catch (error) {
            console.error('Error getting staged changes:', error);
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'git'
            };
        }
    }

    async getDiff(filePath?: string): Promise<string> {
        if (!await this.isInRepository()) {
            throw new Error('当前目录不是Git仓库');
        }

        try {
            let command: string;
            if (filePath) {
                // 获取特定文件的差异
                command = `"${this.gitPath}" diff HEAD -- "${filePath}"`;
            } else {
                // 获取所有暂存和未暂存的变更
                command = `"${this.gitPath}" diff HEAD`;
            }

            const result = await this.execWithEncoding(command);
            return result.stdout || '';
        } catch (error) {
            console.error('Git diff 错误:', error);
            throw new Error(`Git diff 失败: ${error}`);
        }
    }

    private parseGitStatus(statusOutput: string): VcsFile[] {
        if (!statusOutput.trim()) {
            return [];
        }

        const files: VcsFile[] = [];
        const lines = statusOutput.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.length >= 3) {
                const status = line.substring(0, 2);
                const filePath = line.substring(3);
                const fullPath = path.join(this.workspaceRoot, filePath);

                files.push({
                    status: this.translateGitStatus(status),
                    path: filePath,
                    fullPath: fullPath
                });
            }
        }

        return files;
    }

    private translateGitStatus(status: string): string {
        // Git状态码到描述的映射
        const statusMap: { [key: string]: string } = {
            'A ': 'added',      // 新增文件（已暂存）
            'M ': 'modified',   // 修改文件（已暂存）
            'D ': 'deleted',    // 删除文件（已暂存）
            'R ': 'renamed',    // 重命名文件（已暂存）
            'C ': 'copied',     // 复制文件（已暂存）
            ' M': 'modified',   // 修改文件（未暂存）
            ' D': 'deleted',    // 删除文件（未暂存）
            '??': 'untracked',  // 未跟踪文件
            'AM': 'added',      // 新增后修改
            'MM': 'modified',   // 暂存后再修改
            'AD': 'added',      // 新增后删除
            'MD': 'modified',   // 修改后删除
            'UU': 'conflict'    // 冲突文件
        };

        return statusMap[status] || `unknown(${status})`;
    }

    private async execWithEncoding(command: string): Promise<{ stdout: string }> {
        try {
            console.log('执行Git命令:', command);
        
            return await execAsync(command, { 
                cwd: this.workspaceRoot,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
        } catch (error: any) {
            console.error('Git命令执行失败:', error);
            throw error;
        }
    }

    private parseStagedStatus(statusOutput: string): VcsFile[] {
        if (!statusOutput.trim()) {
            return [];
        }

        const files: VcsFile[] = [];
        const lines = statusOutput.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const status = parts[0];
                const filePath = parts[1];
                const fullPath = path.join(this.workspaceRoot, filePath);

                files.push({
                    status: this.translateStagedStatus(status),
                    path: filePath,
                    fullPath
                });
            }
        }

        return files;
    }

    private translateStagedStatus(status: string): string {
        // Git diff --cached 状态码映射
        const statusMap: { [key: string]: string } = {
            'A': 'added',      // 新增文件
            'M': 'modified',   // 修改文件
            'D': 'deleted',    // 删除文件
            'R': 'renamed',    // 重命名文件
            'C': 'copied',     // 复制文件
        };

        return statusMap[status] || `staged(${status})`;
    }
}