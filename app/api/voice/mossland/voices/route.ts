import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy-fetch";

export const runtime = "nodejs";
export const maxDuration = 25;

const DEFAULT_MOSSLAND_BASE_URL = "https://api.mosi.cn";
const MAX_PAGES = 5; // 每页上限 150,5 页足够覆盖个人音色列表

// 官方契约:GET /v1/audio/voices → { object:"list", data:[{id,object:"audio.voice",name,created_at}], has_more, next_cursor }

type VoiceItem = { id: string; name: string; createdAt?: number };

function normalizeBaseUrl(value: unknown): string {
    const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_MOSSLAND_BASE_URL;
    return raw.replace(/\/+$/, "");
}

function extractVoices(payload: unknown): VoiceItem[] {
    if (!payload || typeof payload !== "object") return [];
    const data = (payload as Record<string, unknown>).data;
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id.trim() : "";
        if (!id) return [];
        const name = typeof record.name === "string" ? record.name.trim() : "";
        return [{
            id,
            name: name || `音色 ${id.slice(0, 8)}`,
            createdAt: typeof record.created_at === "number" ? record.created_at : undefined,
        }];
    });
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
        // 非 JSON 错误体
    }
    return text.trim().slice(0, 300) || `同步音色列表失败 (HTTP ${response.status})`;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrl = normalizeBaseUrl(body.baseUrl);

    if (!apiKey) return NextResponse.json({ error: "missing_api_key", message: "Mossland API Key 未配置" }, { status: 400 });

    const voices: VoiceItem[] = [];
    let after = "";
    try {
        for (let page = 0; page < MAX_PAGES; page++) {
            const query = new URLSearchParams({ limit: "150", status: "ready" });
            if (after) query.set("after", after);
            const response = await proxyFetch(`${baseUrl}/v1/audio/voices?${query.toString()}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${apiKey}` },
            });

            const text = await response.text();
            if (!response.ok) {
                let message = `同步音色列表失败 (HTTP ${response.status})`;
                try {
                    const payload = JSON.parse(text) as Record<string, unknown>;
                    const err = payload.error;
                    if (err && typeof err === "object") {
                        const msg = (err as Record<string, unknown>).message;
                        if (typeof msg === "string" && msg.trim()) message = msg;
                    } else if (typeof payload.message === "string" && payload.message.trim()) {
                        message = payload.message;
                    }
                } catch {
                    if (text.trim()) message = text.trim().slice(0, 300);
                }
                return NextResponse.json({ error: "list_voices_failed", message }, { status: 502 });
            }

            let payload: unknown;
            try {
                payload = JSON.parse(text);
            } catch {
                return NextResponse.json({ error: "upstream_not_json", message: text.slice(0, 300) }, { status: 502 });
            }

            voices.push(...extractVoices(payload));
            const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
            if (root.has_more !== true || typeof root.next_cursor !== "string" || !root.next_cursor) break;
            after = root.next_cursor;
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "list_voices_failed", message: `无法连接 Mossland API:${message.slice(0, 300)}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, voices });
}
