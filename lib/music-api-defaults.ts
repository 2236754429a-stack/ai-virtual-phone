// 默认地址指向腾讯云上已验证的 HTTPS 入口；用户仍可在音乐设置中覆盖。
export const DEFAULT_NETEASE_API_BASE =
    (process.env.NEXT_PUBLIC_DEFAULT_NETEASE_API_BASE || "https://notes.emberroom.cn/netease-api").replace(/\/+$/, "");

// Bases that used to be the built-in default. Treated as "default" so devices
// that stored an old default get auto-migrated to the current upstream.
// 逗号分隔，由部署方通过环境变量提供。
const LEGACY_DEFAULT_NETEASE_API_BASES = new Set(
    (process.env.NEXT_PUBLIC_LEGACY_NETEASE_API_BASES || "")
        .split(",")
        .map((s) => s.trim().replace(/\/+$/, ""))
        .filter(Boolean),
);

export function normalizeMusicApiBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, "");
}

export function isDefaultNeteaseApiBase(baseUrl: string): boolean {
    const normalized = normalizeMusicApiBaseUrl(baseUrl);
    if (!normalized) return false;
    return normalized === DEFAULT_NETEASE_API_BASE || LEGACY_DEFAULT_NETEASE_API_BASES.has(normalized);
}
