import * as cp from 'child_process';

interface CurlRequestOptions {
    url: string;
    headers: Record<string, string>;
    body: string;
    timeoutMs: number;
    providerName: string;
    noProxy?: boolean;
}

export async function postJsonWithCurl(options: CurlRequestOptions): Promise<string> {
    const { url, headers, body, timeoutMs, providerName, noProxy = false } = options;

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        const args = [
            '--silent',
            '--show-error',
            '--fail-with-body',
            '--max-time', String(Math.ceil(timeoutMs / 1000)),
            '-X', 'POST',
            url
        ];

        if (noProxy) {
            args.push('--noproxy', '*');
        }

        for (const [key, value] of Object.entries(headers)) {
            args.push('-H', `${key}: ${value}`);
        }

        args.push('--data-binary', '@-');

        const child = cp.spawn('curl', args, {
            env: {
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                USERPROFILE: process.env.USERPROFILE,
                TMPDIR: process.env.TMPDIR,
                TMP: process.env.TMP,
                TEMP: process.env.TEMP,
                LANG: process.env.LANG,
                SystemRoot: process.env.SystemRoot,
                COMSPEC: process.env.COMSPEC
            }
        });

        child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        child.stdin.write(body);
        child.stdin.end();
        child.on('close', (code) => {
            const errorText = stderr.trim();
            console.log(`[AI-Message] ${providerName} curl退出 code=${code}, stderr=${errorText || '(empty)'}, stdout长度=${stdout.length}`);
            if (code !== 0) {
                reject(new Error(`${providerName}请求失败: ${errorText || `curl exit ${code}`}`));
                return;
            }
            resolve(stdout);
        });
        child.on('error', reject);
    });
}
