export interface VcsFile {
    status: string;
    path: string;
    fullPath: string;
}

export interface VcsStatus {
    isRepository: boolean;
    changedFiles: VcsFile[];
    workingDirectory: string;
    vcsType: 'git' | 'svn';
}

export interface IVersionControlService {
    /**
     * 检查是否在版本控制仓库中
     */
    isInRepository(): Promise<boolean>;

    /**
     * 获取仓库状态和变更文件
     */
    getStatus(): Promise<VcsStatus>;

    /**
     * 获取Source Control中的变更（过滤忽略文件）
     */
    getSourceControlChanges(): Promise<VcsStatus>;

    /**
     * 获取准备提交的变更
     */
    getCommitReadyChanges(): Promise<VcsStatus>;

    /**
     * 获取差异内容
     * @param filePath 可选的特定文件路径
     */
    getDiff(filePath?: string): Promise<string>;

    /**
     * 获取版本控制系统类型
     */
    getVcsType(): 'git' | 'svn';
}