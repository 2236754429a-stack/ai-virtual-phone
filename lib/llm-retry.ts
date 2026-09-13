// lib/llm-retry.ts
// LLM 请求自动重试。429（限速）/ 404 / 5xx / 网络抖动时按退避等待后重发，
// 让小卷和后台任务（世界生成、总结等）不会因为 API 限速（如每分钟 5 次）直接失败。
// 只在拿到 Response 之前重试——流式响应一旦开始读 body 就不再重试。

const RETRYABLE_STATUS = new Set([429, 404, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 5;
// 限速窗口常见为 1 分钟：前期短等（突发限流很快恢复），后期等满一个窗口。
const BACKOFF_MS = [12_000, 20_000, 35_000, 60_000, 60_000];

export function isRetryableLLMStatus(status: number): boolean {
    return RETRYABLE_STATUS.has(status);
}

export function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal?.addEventListener("abort", onAbort);
    });
}

function extractRetryAfterMs(res: Response): number | null {
    const raw = res.headers.get("retry-after");
    if (!raw) return null;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 90_000);
    const date = Date.parse(raw);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), 90_000);
    return null;
}

/**
 * 带重试的 LLM fetch。doFetch 每次重试都会重新调用（body 需是可重复发送的字符串）。
 * 返回的 Response 保证要么成功、要么是不可重试的状态码（或重试次数耗尽），
 * 调用方照常走原有的 !res.ok 错误处理。
 */
export async function fetchWithLLMRetry(
    doFetch: () => Promise<Response>,
    options?: { signal?: AbortSignal; label?: string; maxRetries?: number },
): Promise<Response> {
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const label = options?.label || "LLM";
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let res: Response;
        try {
            res = await doFetch();
        } catch (err) {
            // 用户主动中断不重试；网络抖动按退避重试
            if ((err as Error)?.name === "AbortError" || attempt >= maxRetries) throw err;
            const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
            console.warn(`[LLM-Retry] ${label} 网络错误：${(err as Error)?.message || err}，${Math.round(delay / 1000)}s 后重试（第 ${attempt + 1}/${maxRetries} 次）`);
            await sleepWithAbort(delay, options?.signal);
            continue;
        }
        if (!RETRYABLE_STATUS.has(res.status) || attempt >= maxRetries) return res;
        const delay = extractRetryAfterMs(res) ?? BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        console.warn(`[LLM-Retry] ${label} HTTP ${res.status}，${Math.round(delay / 1000)}s 后重试（第 ${attempt + 1}/${maxRetries} 次）`);
        // 释放未读的 body，避免连接泄漏
        try { await res.arrayBuffer(); } catch { /* ignore */ }
        await sleepWithAbort(delay, options?.signal);
    }
    // 循环里最后一次要么 return 要么 throw，实际到不了这里
    throw new Error("[LLM-Retry] unreachable");
}
