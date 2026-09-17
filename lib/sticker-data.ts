/**
 * Built-in sticker pack data.
 * Each sticker has a name (for AI matching via [表情:name]) and a URL.
 * Built-in packs use emoji as the default display; stickerUrl can point to
 * packaged image assets when a pack provides dedicated files.
 */

import { loadCustomStickers, findCustomStickerByName, normalizeStickerName } from "./custom-sticker-storage";

export interface StickerItem {
    name: string;
    emoji: string;     // fallback emoji display
    stickerUrl?: string; // real sticker image path (optional)
}

export const STICKER_PACKS: { name: string; stickers: StickerItem[] }[] = [
    {
        name: "经典表情",
        stickers: [
            { name: "捂脸", emoji: "🤦" },
            { name: "偷笑", emoji: "🤭" },
            { name: "大哭", emoji: "😭" },
            { name: "害羞", emoji: "😊" },
            { name: "发呆", emoji: "😶" },
            { name: "得意", emoji: "😏" },
            { name: "汗", emoji: "😅" },
            { name: "亲亲", emoji: "😘" },
            { name: "爱心", emoji: "❤️" },
            { name: "心碎", emoji: "💔" },
            { name: "抱抱", emoji: "🤗" },
            { name: "叹气", emoji: "😮‍💨" },
            { name: "委屈", emoji: "🥺" },
            { name: "嘿嘿", emoji: "😁" },
            { name: "加油", emoji: "💪" },
            { name: "OK", emoji: "👌" },
            { name: "比心", emoji: "🫰" },
            { name: "鼓掌", emoji: "👏" },
            { name: "拳头", emoji: "✊" },
            { name: "玫瑰", emoji: "🌹" },
            { name: "再见", emoji: "👋" },
            { name: "太阳", emoji: "☀️" },
            { name: "月亮", emoji: "🌙" },
            { name: "蛋糕", emoji: "🎂" },
            { name: "礼物", emoji: "🎁" },
            { name: "咖啡", emoji: "☕" },
            { name: "啤酒", emoji: "🍺" },
            { name: "庆祝", emoji: "🎉" },
            { name: "火", emoji: "🔥" },
            { name: "闪电", emoji: "⚡" },
            { name: "思考", emoji: "🤔" },
            { name: "微笑", emoji: "😊" },
            { name: "笑哭", emoji: "😂" },
            { name: "坏笑", emoji: "😈" },
            { name: "翻白眼", emoji: "🙄" },
            { name: "无语", emoji: "😑" },
            { name: "生气", emoji: "😤" },
            { name: "惊讶", emoji: "😲" },
            { name: "恐惧", emoji: "😨" },
            { name: "撇嘴", emoji: "😒" },
            { name: "色", emoji: "😍" },
            { name: "呲牙", emoji: "😬" },
            { name: "吐舌", emoji: "😛" },
            { name: "尴尬", emoji: "😓" },
            { name: "睡觉", emoji: "😴" },
            { name: "酷", emoji: "😎" },
            { name: "衰", emoji: "😩" },
            { name: "吐", emoji: "🤮" },
            { name: "调皮", emoji: "😜" },
            { name: "大笑", emoji: "😆" },
            { name: "难过", emoji: "😢" },
            { name: "疑问", emoji: "❓" },
            { name: "嘘", emoji: "🤫" },
            { name: "晕", emoji: "😵" },
            { name: "奋斗", emoji: "💪" },
            { name: "可怜", emoji: "🥹" },
            { name: "强", emoji: "👍" },
            { name: "弱", emoji: "👎" },
            { name: "握手", emoji: "🤝" },
            { name: "胜利", emoji: "✌️" },
            { name: "抱拳", emoji: "🙏" },
            { name: "勾引", emoji: "😏" },
            { name: "嘴唇", emoji: "💋" },
            { name: "西瓜", emoji: "🍉" },
            { name: "饭", emoji: "🍚" },
            { name: "猪头", emoji: "🐷" },
            { name: "狗", emoji: "🐶" },
            { name: "猫", emoji: "🐱" },
            { name: "骷髅", emoji: "💀" },
            { name: "鬼", emoji: "👻" },
        ],
    },
];

const STICKER_ALIASES: Record<string, string> = {
    "笑": "微笑",
    "微笑脸": "微笑",
    "哭": "大哭",
    "痛哭": "大哭",
    "大哭脸": "大哭",
    "难过脸": "难过",
    "喜欢": "爱心",
    "爱": "爱心",
    "心": "爱心",
    "点赞": "强",
    "棒": "强",
    "强强": "强",
    "无聊": "发呆",
    "发呆中": "发呆",
    "晕倒": "晕",
    "睡觉觉": "睡觉",
    "抱": "抱抱",
    "拥抱": "抱抱",
    "亲": "亲亲",
    "偷笑脸": "偷笑",
    "坏笑脸": "坏笑",
    "白眼": "翻白眼",
};

/**
 * Find a sticker by name (for AI [表情:name] or [表情包:name] matching).
 * Returns the emoji fallback if no real stickerUrl.
 */
export function findStickerByName(name: string): StickerItem | undefined {
    const raw = (name || "").trim();
    if (!raw) return undefined;
    const clean = normalizeStickerName(raw);

    // 1. 精确匹配
    for (const pack of STICKER_PACKS) {
        const found = pack.stickers.find(s => s.name === raw);
        if (found) return found;
    }

    // 2. 别名匹配
    const alias = STICKER_ALIASES[clean] || STICKER_ALIASES[raw];
    if (alias) {
        for (const pack of STICKER_PACKS) {
            const found = pack.stickers.find(s => s.name === alias);
            if (found) return found;
        }
    }

    // 3. 规范化匹配（去扩展名/去空白/小写）
    for (const pack of STICKER_PACKS) {
        const found = pack.stickers.find(s => normalizeStickerName(s.name) === clean);
        if (found) return found;
    }

    return undefined;
}

/**
 * 校验表情包名称是否可用：内置表情或任一给定角色的自定义表情包中存在该名称。
 * 用于「丢弃角色输出的无效表情包」开关。
 */
export function isKnownStickerLabel(label: string, characterIds: (string | undefined)[]): boolean {
    const name = (label || "").trim();
    if (!name) return false;
    if (findStickerByName(name)) return true;
    for (const cid of characterIds) {
        if (findCustomStickerByName(cid, name)) return true;
    }
    return false;
}
