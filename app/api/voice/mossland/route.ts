import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MOSSLAND_BASE_URL = "https://api.mosi.cn";

// api.mosi.cn 拒绝浏览器 CORS 预检,所以由同源路由转发;
// 用户提供的 API Key 只在本次请求内使用,不落盘、不写日志。

function normalizeBaseUrl(value: unknown): string {
    const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_MOSSLAND_BASE_URL;
    return raw.replace(/\/+$/, "");
}

async function upstreamErrorMessage(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    try {
        const payload = JSON.parse(text) as Record<string, unknown>;
        const err = payload.error;
        if (err && typeof err === "object") {
            const msg = (err as Record<string, unknown>).message;
            if (typeof msg === "string" && msg.trim()) return msg;
        }
        if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    } catch {
        // 非 JSON 错误体,直接截断展示
    }
    return text.trim().slice(0, 300) || `Mossland TTS 请求失败 (HTTP ${response.status})`;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const input = typeof body.input === "string" ? body.input : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "moss-tts-1.5-flash";
    const responseFormat = body.responseFormat === "wav" ? "wav" : "mp3";
    const baseUrl = normalizeBaseUrl(body.baseUrl);

    if (!apiKey) return NextResponse.json({ message: "Mossland API Key 未配置" }, { status: 400 });
    if (!voiceId) return NextResponse.json({ message: "请填写 Mossland voice_id" }, { status: 400 });
    if (!input.trim()) return NextResponse.json({ message: "语音内容为空" }, { status: 400 });

    let upstream: Response;
    try {
        upstream = await proxyFetch(`${baseUrl}/v1/audio/speech`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                input,
                voice_id: voiceId,
                response_format: responseFormat,
                // 直接返回音频二进制,前端按 blob() 读取
                delivery_method: "audio",
            }),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ message: `无法连接 Mossland API:${message.slice(0, 300)}` }, { status: 502 });
    }

    if (!upstream.ok) {
        return NextResponse.json({ message: await upstreamErrorMessage(upstream) }, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "";

    // 正常路径:音频二进制直接透传
    if (!contentType.includes("application/json")) {
        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": responseFormat === "wav" ? "audio/wav" : "audio/mpeg",
                "Cache-Control": "no-store",
            },
        });
    }

    // 兜底:上游按 delivery_method=url 返回了 JSON({url:...} 或 base64 audio_data)
    const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
    if (payload) {
        const url = typeof payload.url === "string" ? payload.url : typeof (payload.data as Record<string, unknown> | undefined)?.url === "string"
            ? (payload.data as Record<string, unknown>).url as string : "";
        if (url) {
            try {
                const audio = await proxyFetch(url);
                if (audio.ok) {
                    return new Response(audio.body, {
                        status: 200,
                        headers: {
                            "Content-Type": responseFormat === "wav" ? "audio/wav" : "audio/mpeg",
                            "Cache-Control": "no-store",
                        },
                    });
                }
            } catch {
                // 下载结果音频失败,继续走错误返回
            }
        }
        const audioData = typeof payload.audio_data === "string" ? payload.audio_data : "";
        if (audioData) {
            const buffer = Buffer.from(audioData, "base64");
            return new Response(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    "Content-Type": responseFormat === "wav" ? "audio/wav" : "audio/mpeg",
                    "Cache-Control": "no-store",
                },
            });
        }
        const message = typeof payload.message === "string" ? payload.message : JSON.stringify(payload).slice(0, 300);
        return NextResponse.json({ message: message || "Mossland 返回了未知的响应格式" }, { status: 502 });
    }

    return NextResponse.json({ message: "Mossland 返回了无法解析的响应" }, { status: 502 });
}
