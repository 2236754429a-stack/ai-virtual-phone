// lib/llm-http.ts
// LLM 请求的统一 fetch 出口。所有走 buildProviderRequest 的调用点统一经它发请求：
//  - 普通 provider：浏览器直连（现状不变）；
//  - serverProxy 标记（OpenCode 网关）：改发本站 /api/llm-proxy，由服务端转发，
//    绕过 opencode.ai 未开放浏览器 CORS 的问题。
// 429/404/5xx/网络抖动自动按退避重试（见 llm-retry.ts）。

import type { LlmRequestPayload } from "./llm-provider-adapter";
import { fetchWithLLMRetry } from "./llm-retry";

export type FetchLlmPayloadOptions = {
    signal?: AbortSignal;
    label?: string;
};

export async function fetchLlmPayload(
    payload: LlmRequestPayload,
    options: FetchLlmPayloadOptions = {},
): Promise<Response> {
    return fetchWithLLMRetry(() => {
        const bodyText = JSON.stringify(payload.body);
        if (payload.serverProxy) {
            return fetch("/api/llm-proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: payload.url,
                    headers: payload.headers,
                    body: bodyText,
                }),
                signal: options.signal,
            });
        }
        return fetch(payload.url, {
            method: "POST",
            headers: payload.headers,
            body: bodyText,
            signal: options.signal,
        });
    }, { signal: options.signal, label: options.label || payload.url.slice(0, 60) });
}
