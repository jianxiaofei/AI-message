import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IVersionControlService, VcsStatus, VcsFile } from './vcsInterface';

const execAsync = promisify(exec);

export interface SvnStatus extends VcsStatus {
    // SVN特定的扩展属性可以在这里添加
}

export interface SvnFile extends VcsFile {
    // SVN特定的扩展属性可以在这里添加
}

export class SvnService implements IVersionControlService {
    private workspaceRoot: string;
    private svnPath: string;

    constructor() {
        this.workspaceRoot = this.resolveWorkspaceRoot();
        this.svnPath = this.resolveSvnPath();
        console.log('SvnService 初始化: 工作区根目录 =', this.workspaceRoot);
        console.log('SvnService 初始化: 使用的 svn 可执行文件 =', this.svnPath);
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
    
    private resolveSvnPath(): string {
        // 允许用户在设置中指定 svn 可执行文件路径
        const cfg = vscode.workspace.getConfiguration('aiMessage');
        const userPath = (cfg.get<string>('svn.path', '') || '').trim();
        if (userPath && fs.existsSync(userPath)) {
            return userPath;
        }

        // 常见安装路径（macOS/Homebrew、常规路径）
        const candidates = [
            '/opt/homebrew/bin/svn',
            '/usr/local/bin/svn',
            '/usr/bin/svn'
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        // 回退为通过 PATH 解析
        return 'svn';
    }

    getVcsType(): 'git' | 'svn' {
        return 'svn';
    }

    async isInRepository(): Promise<boolean> {
        return this.isInSvnRepository();
    }

    async isInSvnRepository(): Promise<boolean> {
        // 每次调用时刷新工作区根路径
        this.workspaceRoot = this.resolveWorkspaceRoot();

        if (!this.workspaceRoot) {
            console.log('SVN检测: 工作区根目录为空');
            return false;
        }

        console.log(`SVN检测: 检查目录 ${this.workspaceRoot}`);

        try {
            // 只要命令成功（无异常）即认为是 SVN 工作副本，不再因 stderr（警告）误判
            const { stdout } = await execAsync(`"${this.svnPath}" info`, { cwd: this.workspaceRoot });
            console.log('SVN检测: svn info 输出:', stdout);
            return true;
        } catch (error) {
            console.log('SVN检测: 不是SVN仓库或 svn 命令不可用:', error);
            return false;
        }
    }

    async getStatus(): Promise<SvnStatus> {
        if (!await this.isInSvnRepository()) {
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
        }

        try {
            const { stdout } = await execAsync(`"${this.svnPath}" status`, { cwd: this.workspaceRoot });
            const changedFiles = this.parseSvnStatus(stdout);
            
            return {
                isRepository: true,
                changedFiles,
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
        } catch (error) {
            console.error('Error getting SVN status:', error);
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
        }
    }

    /**
     * 获取VS Code Source Control中的变更（不包括ignore-on-commit的文件）
     */
    async getSourceControlChanges(): Promise<SvnStatus> {
        if (!await this.isInSvnRepository()) {
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
        }

        try {
            // 由于VS Code SCM API限制，我们采用更实用的方法：
            // 1. 获取所有SVN变更
            // 2. 通过配置过滤ignore-on-commit的文件
            
            const svnStatus = await this.getStatus();
            const filteredFiles = await this.filterIgnoreOnCommitFiles(svnStatus.changedFiles);
            
            console.log(`原始变更文件: ${svnStatus.changedFiles.length}个`);
            console.log(`过滤后文件: ${filteredFiles.length}个`);
            
            return {
                isRepository: true,
                changedFiles: filteredFiles,
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
            
        } catch (error) {
            console.error('Error getting Source Control changes:', error);
            // 回退到普通的SVN status
            return await this.getStatus();
        }
    }

    /**
     * 过滤掉ignore-on-commit的文件
     */
    private async filterIgnoreOnCommitFiles(allFiles: SvnFile[]): Promise<SvnFile[]> {
        try {
            // 方法1: 通过VS Code工作区配置
            const workspaceConfig = vscode.workspace.getConfiguration('svn');
            const ignorePatterns = workspaceConfig.get<string[]>('ignoreOnCommit') || [];
            
            // 方法2: 检查是否有.gitignore或.svnignore文件（作为参考）
            const additionalIgnorePatterns = await this.loadIgnorePatterns();
            
            const allIgnorePatterns = [...ignorePatterns, ...additionalIgnorePatterns];
            
            if (allIgnorePatterns.length > 0) {
                const filteredFiles = allFiles.filter(file => {
                    return !allIgnorePatterns.some(pattern => {
                        // 将glob模式转换为正则表达式
                        const regex = new RegExp(
                            pattern
                                .replace(/\./g, '\\.')
                                .replace(/\*/g, '.*')
                                .replace(/\?/g, '.')
                        );
                        return regex.test(file.path);
                    });
                });
                
                console.log(`应用忽略模式过滤: ${allFiles.length} -> ${filteredFiles.length}`);
                return filteredFiles;
            }
        } catch (error) {
            console.log('无法应用ignore配置，返回所有文件:', error);
        }
        
        return allFiles;
    }

    /**
     * 加载忽略模式文件
     */
    private async loadIgnorePatterns(): Promise<string[]> {
        const patterns: string[] = [];
        
        try {
            // 检查 .svnignore 文件
            const svnIgnorePath = path.join(this.workspaceRoot, '.svnignore');
            if (fs.existsSync(svnIgnorePath)) {
                const content = fs.readFileSync(svnIgnorePath, 'utf8');
                const lines = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                patterns.push(...lines);
            }
            
            // 也可以参考 .gitignore（如果存在）
            const gitIgnorePath = path.join(this.workspaceRoot, '.gitignore');
            if (fs.existsSync(gitIgnorePath)) {
                const content = fs.readFileSync(gitIgnorePath, 'utf8');
                const lines = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                patterns.push(...lines);
            }
        } catch (error) {
            console.log('加载ignore文件时出错:', error);
        }
        
        return patterns;
    }

    /**
     * 获取准备提交的变更（只包含Changes列表，排除ignore-on-commit等其他列表）
     */
    async getCommitReadyChanges(): Promise<SvnStatus> {
        if (!await this.isInSvnRepository()) {
            return {
                isRepository: false,
                changedFiles: [],
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
        }

        try {
            // 获取SVN状态，并过滤出真正准备提交的文件
            const { stdout } = await execAsync(`"${this.svnPath}" status`, { cwd: this.workspaceRoot });
            
            // 获取changelist信息，排除ignore-on-commit列表中的文件
            const changelistInfo = await this.getChangelistInfo();
            const ignoreOnCommitFiles = new Set(changelistInfo.ignoreOnCommitFiles || []);
            
            const allFiles = this.parseSvnStatus(stdout);
            
            // 过滤掉ignore-on-commit列表中的文件
            const commitReadyFiles = allFiles.filter(file => {
                // 排除ignore-on-commit列表中的文件
                if (ignoreOnCommitFiles.has(file.path)) {
                    console.log(`过滤ignore-on-commit文件: ${file.path}`);
                    return false;
                }
                
                // 只包含真正的变更状态（修改、添加、删除等）
                const validStatuses = ['M', 'A', 'D', 'R', 'C'];
                return validStatuses.includes(file.status);
            });
            
            console.log(`提交准备变更: ${allFiles.length}个文件 -> ${commitReadyFiles.length}个文件（排除ignore-on-commit）`);
            
            return {
                isRepository: true,
                changedFiles: commitReadyFiles,
                workingDirectory: this.workspaceRoot,
                vcsType: 'svn'
            };
        } catch (error) {
            console.error('Error getting commit-ready changes:', error);
            // 回退到基础的status检查
            return await this.getStatus();
        }
    }

    /**
     * 获取changelist信息，识别ignore-on-commit列表
     */
    private async getChangelistInfo(): Promise<{ ignoreOnCommitFiles?: string[] }> {
        try {
            // 方案1：使用 svn status 获取完整状态信息，包括changelist
            const { stdout } = await execAsync(`"${this.svnPath}" status`, { cwd: this.workspaceRoot });
            const ignoreOnCommitFiles: string[] = [];
            
            if (!stdout.trim()) {
                console.log('没有发现任何文件变更');
                return {};
            }
            
            // 添加详细的调试信息
            console.log('=== SVN Status 完整输出 ===');
            console.log(stdout);
            console.log('=== 输出结束 ===');
            
            const lines = stdout.trim().split('\n');
            let inIgnoreOnCommit = false;
            
            console.log(`处理 ${lines.length} 行输出:`);
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                console.log(`第${i+1}行: "${line}" (trimmed: "${trimmedLine}")`);
                
                if (!trimmedLine) {
                    console.log('  -> 跳过空行');
                    continue;
                }
                
                // SVN status 输出中changelist的格式：
                // --- Changelist 'ignore-on-commit':
                // M       file1.txt
                // A       file2.txt
                // --- Changelist 'other-list':
                // ...
                
                if (trimmedLine.startsWith('--- Changelist \'ignore-on-commit\'') || 
                    trimmedLine.startsWith('--- 修改列表 \'ignore-on-commit\'') ||
                    trimmedLine.includes('ignore-on-commit\'')) {
                    inIgnoreOnCommit = true;
                    console.log('  -> 发现 ignore-on-commit changelist 开始');
                    continue;
                } else if (trimmedLine.startsWith('--- Changelist \'') || 
                          trimmedLine.startsWith('--- 修改列表 \'')) {
                    // 其他changelist，停止收集ignore-on-commit的文件
                    inIgnoreOnCommit = false;
                    console.log('  -> 发现其他 changelist，停止收集 ignore-on-commit');
                    continue;
                } else if (inIgnoreOnCommit && trimmedLine.length > 8) {
                    // 在ignore-on-commit changelist内的文件
                    const status = trimmedLine.substring(0, 8).trim();
                    const filePath = trimmedLine.substring(8).trim();
                    console.log(`  -> 在ignore-on-commit内，状态: "${status}", 文件: "${filePath}"`);
                    if (status && filePath) {
                        ignoreOnCommitFiles.push(filePath);
                        console.log(`  -> 添加到ignore列表: ${filePath}`);
                    }
                } else if (inIgnoreOnCommit) {
                    console.log('  -> 在ignore-on-commit内但行太短，跳过');
                } else {
                    console.log('  -> 不在ignore-on-commit内，跳过');
                }
            }
            
            console.log(`发现ignore-on-commit文件: ${ignoreOnCommitFiles.length}个`);
            if (ignoreOnCommitFiles.length > 0) {
                console.log('ignore-on-commit文件列表:', ignoreOnCommitFiles);
            } else {
                console.log('未在svn status输出中发现ignore-on-commit changelist');
            }
            return { ignoreOnCommitFiles };
            
        } catch (error) {
            // 如果命令失败，尝试替代方案
            console.log('SVN status命令失败，尝试替代方案:', error);
            return await this.getChangelistInfoFallback();
        }
    }

    /**
     * 获取changelist信息的备用方案
     */
    private async getChangelistInfoFallback(): Promise<{ ignoreOnCommitFiles?: string[] }> {
        try {
            // 方案1：通过svn status查看是否有changelist标记
            const { stdout } = await execAsync(`"${this.svnPath}" status`, { cwd: this.workspaceRoot });
            const ignoreOnCommitFiles: string[] = [];
            
            // 解析状态输出，查找可能的changelist信息
            // 注意：这种方法可能不完美，因为标准svn status不显示changelist信息
            
            console.log('使用备用方案检查changelist，将处理所有变更文件');
            return {};
        } catch (error) {
            console.log('所有changelist检测方案都失败，将处理所有变更文件');
            return {};
        }
    }

    async getDiff(filePath?: string): Promise<string> {
        try {
            // 刷新根路径
            this.workspaceRoot = this.resolveWorkspaceRoot();
            
            // 获取准备提交的变更文件（排除ignore-on-commit列表）
            const status = await this.getCommitReadyChanges();
            const changedFiles = status.changedFiles;
            
            if (changedFiles.length === 0) {
                return '没有检测到准备提交的文件变更';
            }
            
            let diffResult = '';
            
            // 如果指定了特定文件，只获取该文件的diff
            if (filePath) {
                const command = `"${this.svnPath}" diff "${filePath}"`;
                const { stdout } = await this.execWithEncoding(command);
                return stdout;
            }
            
            // 获取整体差异概述
            diffResult += `=== SVN差异分析 (仅包含Changes列表) ===\n`;
            diffResult += `准备提交的文件: ${changedFiles.length}个\n`;
            
            // 按状态分组统计
            const statusGroups: { [key: string]: SvnFile[] } = {};
            changedFiles.forEach(file => {
                if (!statusGroups[file.status]) {
                    statusGroups[file.status] = [];
                }
                statusGroups[file.status].push(file);
            });
            
            diffResult += `文件状态统计:\n`;
            Object.entries(statusGroups).forEach(([status, files]) => {
                diffResult += `  ${this.getStatusDescription(status)}: ${files.length}个文件\n`;
                // 列出前5个文件路径
                files.slice(0, 5).forEach(file => {
                    diffResult += `    - ${file.path}\n`;
                });
                if (files.length > 5) {
                    diffResult += `    ... 还有${files.length - 5}个文件\n`;
                }
            });
            
            diffResult += `\n=== 详细代码差异 ===\n`;
            
            // 获取修改文件的详细差异（限制数量避免内容过长）
            const modifiedFiles = changedFiles.filter(f => f.status === 'M').slice(0, 10);
            
            for (const file of modifiedFiles) {
                try {
                    const command = `"${this.svnPath}" diff "${file.path}"`;
                    const { stdout } = await this.execWithEncoding(command);
                    
                    if (stdout.trim()) {
                        diffResult += `\n--- ${file.path} ---\n`;
                        // 只取每个文件差异的前1000字符
                        const fileDiff = stdout.substring(0, 1000);
                        diffResult += fileDiff;
                        if (stdout.length > 1000) {
                            diffResult += '\n... (内容截断) ...\n';
                        }
                    }
                } catch (error) {
                    console.log(`无法获取文件 ${file.path} 的差异:`, error);
                    diffResult += `\n--- ${file.path} ---\n[无法获取差异内容]\n`;
                }
            }
            
            // 对于新增文件，提供文件类型信息
            const addedFiles = changedFiles.filter(f => f.status === 'A');
            if (addedFiles.length > 0) {
                diffResult += `\n=== 新增文件 ===\n`;
                addedFiles.forEach(file => {
                    const ext = file.path.split('.').pop()?.toLowerCase() || 'unknown';
                    diffResult += `+ ${file.path} (${ext}文件)\n`;
                });
            }
            
            // 对于删除文件，提供简要信息
            const deletedFiles = changedFiles.filter(f => f.status === 'D');
            if (deletedFiles.length > 0) {
                diffResult += `\n=== 删除文件 ===\n`;
                deletedFiles.forEach(file => {
                    diffResult += `- ${file.path}\n`;
                });
            }
            
            return diffResult;
            
        } catch (error: any) {
            console.error('Error getting SVN diff:', error);
            
            // 如果是编码错误，尝试不获取diff，只返回文件列表信息
            if (error.message && error.message.includes('UTF-8')) {
                console.log('SVN diff编码错误，返回基于文件状态的信息');
                const status = await this.getStatus();
                const fileList = status.changedFiles.map(f => 
                    `${this.getStatusDescription(f.status)}: ${f.path}`
                ).join('\n');
                return `文件变更列表:\n${fileList}`;
            }
            
            return '';
        }
    }
    
    private async execWithEncoding(command: string): Promise<{ stdout: string }> {
        const env = {
            ...process.env,
            LC_ALL: 'en_US.UTF-8',
            LANG: 'en_US.UTF-8'
        };
        
        return await execAsync(command, { 
            cwd: this.workspaceRoot,
            env: env,
            encoding: 'utf8'
        });
    }

    private parseSvnStatus(statusOutput: string): SvnFile[] {
        const files: SvnFile[] = [];
        const lines = statusOutput.trim().split('\n');

        for (const line of lines) {
            if (line.trim()) {
                const status = line.substring(0, 1);
                const filePath = line.substring(8); // Skip status flags and whitespace
                const fullPath = path.join(this.workspaceRoot, filePath);

                files.push({
                    status,
                    path: filePath,
                    fullPath
                });
            }
        }

        return files;
    }

    getStatusDescription(status: string): string {
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
}