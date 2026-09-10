// lib/adventure/mascot-tools.ts
// 小卷冒险系统工具套件：读取/探索/操作冒险地图与跑团游戏

import type { ToolResult } from "../tool-executor";
import {
    loadMapWorlds,
    getMapWorld,
    loadSavesForWorld,
    getLatestSave,
    saveGame,
    loadAdventureSummary,
} from "../map-storage";
import { loadCharacters } from "../character-storage";
import type { GameSave } from "../map-types";

// ── 辅助格式化 ──

function getCharacterNameMap(): Map<string, string> {
    try {
        const chars = loadCharacters();
        return new Map(chars.map(c => [c.id, c.name || ""]));
    } catch {
        return new Map();
    }
}

// ── 工具 1：列出冒险世界 ──
export async function adventureToolListWorlds(): Promise<ToolResult> {
    try {
        const worlds = loadMapWorlds();
        if (worlds.length === 0) {
            return {
                name: "列出冒险世界",
                success: true,
                data: "目前还没有创建任何冒险世界。你可以去「冒险」应用中创建新世界哦！",
            };
        }

        const list = worlds.map(w => {
            const saves = loadSavesForWorld(w.id);
            return {
                worldId: w.id,
                name: w.skeleton?.world?.name || "未命名世界",
                lore: (w.skeleton?.world?.lore || "").slice(0, 80) + (w.skeleton?.world?.lore?.length > 80 ? "..." : ""),
                status: w.status || "ready",
                regionCount: w.skeleton?.richRegions?.length || 0,
                npcCount: w.skeleton?.npcs?.length || 0,
                hasSave: saves.length > 0,
                updatedAt: w.updatedAt,
            };
        });

        return {
            name: "列出冒险世界",
            success: true,
            data: list,
        };
    } catch (err) {
        return { name: "列出冒险世界", success: false, error: (err as Error).message };
    }
}

// ── 工具 2：读取冒险状态 ──
export async function adventureToolReadStatus(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const worldIdArg = typeof args.worldId === "string" ? args.worldId.trim() : "";
        const worlds = loadMapWorlds();
        if (worlds.length === 0) {
            return { name: "读取冒险状态", success: false, error: "系统中尚无任何冒险世界" };
        }

        let targetWorld = worldIdArg ? worlds.find(w => w.id === worldIdArg || w.skeleton?.world?.name.includes(worldIdArg)) : null;
        if (!targetWorld) {
            targetWorld = worlds[0]; // 默认取最近更新的世界
        }

        const save = getLatestSave(targetWorld.id);
        const nameMap = getCharacterNameMap();
        const summary = loadAdventureSummary(targetWorld.id);

        const worldInfo = {
            worldId: targetWorld.id,
            name: targetWorld.skeleton?.world?.name || "未命名世界",
            lore: targetWorld.skeleton?.world?.lore || "",
            mainQuest: targetWorld.skeleton?.mainQuest?.title || "未定义主线",
        };

        if (!save) {
            return {
                name: "读取冒险状态",
                success: true,
                data: {
                    world: worldInfo,
                    saveStatus: "暂无游戏存档或尚未开始游玩",
                },
            };
        }

        // 当前节点与区域
        const regions = targetWorld.skeleton?.richRegions || [];
        let currentNodeName = save.currentNodeId;
        for (const reg of regions) {
            const found = reg.nodes.find(n => n.id === save.currentNodeId);
            if (found) {
                currentNodeName = `${reg.name} · ${found.name}`;
                break;
            }
        }

        const companionInfo = save.agents.map(a => ({
            characterId: a.characterId,
            name: nameMap.get(a.characterId) || a.characterId,
            hp: `${a.hp}/${a.maxHp}`,
            affinity: a.affinity,
            currentNode: a.currentNodeId,
        }));

        const result = {
            world: worldInfo,
            gameState: {
                gameDay: `第 ${save.gameDay} 天 · ${save.gameTime}`,
                playerHp: `${save.hp}/${save.maxHp}`,
                playerStats: save.playerStats,
                currentLocation: currentNodeName,
                mainQuestStage: save.mainQuestStage,
                companions: companionInfo,
                visitedNodesCount: save.visitedNodes?.length || 0,
                recentJournal: (save.journal || []).slice(-3).map(j => `[${j.timestamp}] (${j.locationName}) ${j.text}`),
                inPendingEvent: !!save.pendingEvent?.inEvent,
                storySummary: summary?.text || null,
            },
        };

        return {
            name: "读取冒险状态",
            success: true,
            data: result,
        };
    } catch (err) {
        return { name: "读取冒险状态", success: false, error: (err as Error).message };
    }
}

// ── 工具 3：读取冒险日志 ──
export async function adventureToolReadJournal(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const worldIdArg = typeof args.worldId === "string" ? args.worldId.trim() : "";
        const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 50) : 10;
        const worlds = loadMapWorlds();
        if (worlds.length === 0) {
            return { name: "读取冒险日志", success: false, error: "系统中尚无任何冒险世界" };
        }

        let targetWorld = worldIdArg ? worlds.find(w => w.id === worldIdArg || w.skeleton?.world?.name.includes(worldIdArg)) : null;
        if (!targetWorld) {
            targetWorld = worlds[0];
        }

        const save = getLatestSave(targetWorld.id);
        if (!save) {
            return { name: "读取冒险日志", success: false, error: `世界「${targetWorld.skeleton?.world?.name}」尚无游玩存档` };
        }

        const recentEntries = (save.journal || []).slice(-limit).reverse();
        return {
            name: "读取冒险日志",
            success: true,
            data: {
                worldName: targetWorld.skeleton?.world?.name,
                totalEntries: save.journal?.length || 0,
                entries: recentEntries,
            },
        };
    } catch (err) {
        return { name: "读取冒险日志", success: false, error: (err as Error).message };
    }
}

// ── 工具 4：读取地图节点 ──
export async function adventureToolReadNodes(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const worldIdArg = typeof args.worldId === "string" ? args.worldId.trim() : "";
        const regionNameArg = typeof args.regionName === "string" ? args.regionName.trim() : "";
        const worlds = loadMapWorlds();
        if (worlds.length === 0) {
            return { name: "读取地图节点", success: false, error: "系统中尚无任何冒险世界" };
        }

        let targetWorld = worldIdArg ? worlds.find(w => w.id === worldIdArg || w.skeleton?.world?.name.includes(worldIdArg)) : null;
        if (!targetWorld) {
            targetWorld = worlds[0];
        }

        const regions = targetWorld.skeleton?.richRegions || [];
        const save = getLatestSave(targetWorld.id);
        const visitedSet = new Set(save?.visitedNodes || []);
        const discoveredSet = new Set(save?.discoveredNodes || []);

        const regionsData = regions
            .filter(r => !regionNameArg || r.name.includes(regionNameArg))
            .map(r => ({
                regionName: r.name,
                lore: r.lore,
                dangerLevel: r.dangerLevel,
                nodes: r.nodes.map(n => ({
                    id: n.id,
                    name: n.name,
                    description: n.description,
                    type: n.type,
                    isCurrent: save?.currentNodeId === n.id,
                    visited: visitedSet.has(n.id),
                    discovered: discoveredSet.has(n.id),
                })),
            }));

        return {
            name: "读取地图节点",
            success: true,
            data: {
                worldName: targetWorld.skeleton?.world?.name,
                regions: regionsData,
            },
        };
    } catch (err) {
        return { name: "读取地图节点", success: false, error: (err as Error).message };
    }
}

// ── 工具 5：记录冒险手记 ──
export async function adventureToolAddJournalEntry(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const note = typeof args.note === "string" ? args.note.trim() : "";
        if (!note) {
            return { name: "记录冒险手记", success: false, error: "手记内容 note 不能为空" };
        }

        const worldIdArg = typeof args.worldId === "string" ? args.worldId.trim() : "";
        const worlds = loadMapWorlds();
        if (worlds.length === 0) {
            return { name: "记录冒险手记", success: false, error: "系统中尚无任何冒险世界" };
        }

        let targetWorld = worldIdArg ? worlds.find(w => w.id === worldIdArg || w.skeleton?.world?.name.includes(worldIdArg)) : null;
        if (!targetWorld) {
            targetWorld = worlds[0];
        }

        const save = getLatestSave(targetWorld.id);
        if (!save) {
            return { name: "记录冒险手记", success: false, error: `世界「${targetWorld.skeleton?.world?.name}」尚无游玩存档` };
        }

        const newEntry = {
            id: `j_${Date.now()}_mascot`,
            timestamp: `第 ${save.gameDay} 天 · ${save.gameTime}`,
            realTime: new Date().toISOString(),
            locationName: "小卷随笔",
            text: `[小卷手记] ${note}`,
            type: "choice" as const,
        };

        const updatedSave: GameSave = {
            ...save,
            journal: [...(save.journal || []), newEntry],
        };

        saveGame(updatedSave);

        return {
            name: "记录冒险手记",
            success: true,
            data: `已成功为世界「${targetWorld.skeleton?.world?.name}」添加随行手记：${note}`,
        };
    } catch (err) {
        return { name: "记录冒险手记", success: false, error: (err as Error).message };
    }
}
