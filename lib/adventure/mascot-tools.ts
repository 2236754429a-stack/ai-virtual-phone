// lib/adventure/mascot-tools.ts
// 小卷冒险系统工具套件：读取/探索/操作冒险地图与跑团游戏

import type { ToolResult } from "../tool-executor";
import {
    loadMapWorlds,
    getMapWorld,
    loadSavesForWorld,
    getLatestSave,
    saveGame,
    saveMapWorld,
    deleteMapWorld,
    createInitialSave,
    addAgentToSave,
    generateWorldId,
    loadAdventureSummary,
} from "../map-storage";
import { loadCharacters } from "../character-storage";
import { loadApiConfigs, loadBindingConfig, resolveBinding } from "../settings-storage";
import { generateWorldSkeleton } from "../map-rpg-engine";
import { generateMap, type GeoJSONData } from "../map-engine";
import type { GameSave, MapWorld, NodeContent, QuestStage, WorldSkeleton } from "../map-types";

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

// ── 世界查找辅助 ──

function findTargetWorld(worldIdArg: string): { world: import("../map-types").MapWorld | null; error?: string } {
    const worlds = loadMapWorlds();
    if (worlds.length === 0) return { world: null, error: "系统中尚无任何冒险世界" };
    if (!worldIdArg) return { world: worlds[0] };
    const target = worlds.find(w => w.id === worldIdArg || w.skeleton?.world?.name.includes(worldIdArg));
    if (!target) return { world: null, error: `找不到世界「${worldIdArg}」，可先用「列出冒险世界」查看可用世界` };
    return { world: target };
}

// ── 工具 6：创建冒险世界 ──
// 与「冒险」App 大厅同一条生成管线：LLM 按 worldGen 提示词设计世界 → 渲染地图 → 写入世界与初始存档
export async function adventureToolCreateWorld(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const description = typeof args.description === "string" ? args.description.trim() : "";
        if (!description) {
            return { name: "创建冒险世界", success: false, error: "世界设计描述 description 不能为空——请把你设计的世界观、风格、区域与主线构想完整写进去" };
        }

        const tone = typeof args.tone === "string" ? args.tone.trim() : "";
        const mainQuestType = typeof args.mainQuestType === "string" ? args.mainQuestType.trim() : "";
        const difficulty = typeof args.difficulty === "string" ? args.difficulty.trim() : "";
        const regionCount = numberArg(args.regionCount, 4);
        const npcCount = numberArg(args.npcCount, 4);
        const companionIds = Array.isArray(args.companionCharacterIds)
            ? args.companionCharacterIds.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
            : [];

        // API 配置：与冒险 App 大厅一致的解析顺序（首选角色绑定 → 任一有 key 的配置）
        const apiConfigs = loadApiConfigs();
        const bindings = loadBindingConfig();
        const characters = loadCharacters();
        const firstChar = characters[0];
        const slot = firstChar ? resolveBinding(bindings, firstChar.id, "chat") : null;
        const apiConfig = (slot?.apiConfigId ? apiConfigs.find(c => c.id === slot.apiConfigId) : null) || apiConfigs.find(c => c.apiKey) || apiConfigs[0];
        if (!apiConfig?.apiKey) {
            return { name: "创建冒险世界", success: false, error: "未找到有效的 API 配置，请先在设置中配置 API" };
        }

        // 1. 先落一个占位世界（冒险大厅里立即可见「生成中」）
        const now = new Date().toISOString();
        const worldId = generateWorldId();
        const placeholder: MapWorld = {
            id: worldId,
            skeleton: { world: { name: description.slice(0, 20) + "...", lore: "" }, mapInput: { map_settings: { header: "", title: "" }, regions: [] }, richRegions: [], mainQuest: { id: "", title: "", type: "main", synopsis: "", triggerRegion: "", stages: [] }, sideQuests: [], npcs: [], encounterPool: [], partyStats: {} },
            renderedMap: { l1Nodes: [], l2Nodes: [], l3Nodes: [], rivers: [], regionBoundaries: [], mapSettings: { header: "", title: "" } } as unknown as MapWorld["renderedMap"],
            createdAt: now,
            updatedAt: now,
            status: "generating",
            statusMessage: "小卷正在设计这个世界…",
        };
        saveMapWorld(placeholder);

        // 2. 生成骨架 → 渲染地图 → 回写真实数据
        const vars = {
            world_desc: description,
            tone: tone || "自由发挥",
            region_count: String(regionCount),
            main_quest_type: mainQuestType || "自由发挥",
            npc_count: String(npcCount),
            difficulty: difficulty || "适中",
        };
        const skeleton = await generateWorldSkeleton(description, [], apiConfig, vars);

        const resp = await fetch("/countries.geo.json");
        const geoData: GeoJSONData = await resp.json();
        const renderedMap = generateMap(skeleton.mapInput, geoData);

        const world: MapWorld = {
            id: worldId,
            skeleton,
            renderedMap,
            createdAt: now,
            updatedAt: new Date().toISOString(),
        };
        saveMapWorld(world);

        // 3. 初始存档 + 随行伙伴
        const startNode = renderedMap.l1Nodes[0]?.id || "l1_0";
        let save = createInitialSave(world.id, startNode);
        const companionNames: string[] = [];
        for (const cid of companionIds) {
            const ch = characters.find(c => c.id === cid || c.name === cid);
            if (ch) {
                save = addAgentToSave(save, ch.id, ch.personality || "");
                companionNames.push(ch.name || ch.id);
            }
        }
        const startRegionIdx = 0;
        const discovered: string[] = [startNode];
        renderedMap.l2Nodes.forEach((n, i) => { if (n.regionIdx === startRegionIdx) discovered.push(`l2_${i}`); });
        renderedMap.l3Nodes.forEach((n, i) => { if (n.regionIdx === startRegionIdx) discovered.push(`l3_${i}`); });
        renderedMap.l1Nodes.forEach((n) => { if (!discovered.includes(n.id)) discovered.push(n.id); });
        save.discoveredNodes = discovered;
        save.journal[0].locationName = renderedMap.l1Nodes[0]?.nameCn || "起点";
        if (companionNames.length > 0) {
            save.journal.push({
                id: `j_${Date.now()}_mascot_create`,
                timestamp: "第 1 天 · 清晨",
                realTime: new Date().toISOString(),
                locationName: "小卷随笔",
                text: `[小卷手记] 这个世界是我为你们设计的，同行的伙伴：${companionNames.join("、")}。旅途愉快！`,
                type: "choice",
            });
        }
        saveGame(save);

        return {
            name: "创建冒险世界",
            success: true,
            data: {
                message: `世界「${skeleton.world.name}」已创建完成，可以直接进入「冒险」应用开始游玩`,
                worldId: world.id,
                worldName: skeleton.world.name,
                lore: skeleton.world.lore,
                mainQuest: skeleton.mainQuest?.title || "",
                regionCount: renderedMap.l1Nodes.length,
                nodeCount: renderedMap.l2Nodes.length + renderedMap.l3Nodes.length,
                companions: companionNames,
            },
        };
    } catch (err) {
        // 生成失败：像大厅一样把世界标记为 failed，附带原因
        try {
            const reason = (err as Error).message || String(err);
            const worlds = loadMapWorlds();
            const generating = worlds.find(w => w.status === "generating");
            if (generating) {
                const failed: MapWorld = {
                    ...generating,
                    status: "failed",
                    statusMessage: reason,
                    failureRaw: (err as { rawOutput?: string })?.rawOutput || "",
                    updatedAt: new Date().toISOString(),
                };
                saveMapWorld(failed);
            }
            return { name: "创建冒险世界", success: false, error: `世界生成失败：${reason}（已在大厅中标记为失败，可重试或删除）` };
        } catch {
            return { name: "创建冒险世界", success: false, error: (err as Error).message };
        }
    }
}

// ── 工具 7：写入世界设定 ──
// 对已存在世界的设定做文本层修改：世界名/背景/主线（含阶段）/支线/区域背景/节点描述。
// 不改区域与节点的结构（名称、拓扑），那会影响已渲染地图，需要走重建。
export async function adventureToolWriteWorldSettings(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const worldIdArg = typeof args.worldId === "string" ? args.worldId.trim() : "";
        const found = findTargetWorld(worldIdArg);
        if (found.error || !found.world) {
            return { name: "写入世界设定", success: false, error: found.error || "找不到目标世界" };
        }
        const world = found.world;
        const skeleton: WorldSkeleton = JSON.parse(JSON.stringify(world.skeleton));
        const changes: string[] = [];

        // 世界名与背景
        const worldName = typeof args.worldName === "string" ? args.worldName.trim() : "";
        if (worldName && worldName !== skeleton.world.name) {
            changes.push(`世界名「${skeleton.world.name}」→「${worldName}」`);
            skeleton.world.name = worldName;
        }
        const lore = typeof args.lore === "string" ? args.lore.trim() : "";
        if (lore) {
            changes.push("更新了世界观背景设定");
            skeleton.world.lore = lore;
        }

        // 主线
        const mainQuestTitle = typeof args.mainQuestTitle === "string" ? args.mainQuestTitle.trim() : "";
        if (mainQuestTitle && skeleton.mainQuest) {
            changes.push(`主线任务标题 →「${mainQuestTitle}」`);
            skeleton.mainQuest.title = mainQuestTitle;
        }
        const mainQuestSynopsis = typeof args.mainQuestSynopsis === "string" ? args.mainQuestSynopsis.trim() : "";
        if (mainQuestSynopsis && skeleton.mainQuest) {
            changes.push("更新了主线剧情概要");
            skeleton.mainQuest.synopsis = mainQuestSynopsis;
        }
        if (Array.isArray(args.mainQuestStages) && skeleton.mainQuest) {
            const stages = parseStages(args.mainQuestStages);
            if (stages.length > 0) {
                changes.push(`重写了主线阶段（${stages.length} 个阶段）`);
                skeleton.mainQuest.stages = stages;
            }
        }

        // 新增支线
        if (Array.isArray(args.newSideQuests)) {
            let added = 0;
            for (const sq of args.newSideQuests) {
                if (!sq || typeof sq !== "object") continue;
                const obj = sq as Record<string, unknown>;
                const title = typeof obj.title === "string" ? obj.title.trim() : "";
                if (!title) continue;
                const triggerArg = typeof obj.triggerRegion === "string" ? obj.triggerRegion.trim() : "";
                const triggerRegion = triggerArg
                    ? (skeleton.richRegions || []).find(r => r.l1_name_cn === triggerArg || r.l1_name_cn.includes(triggerArg))?.id
                      || triggerArg
                    : (skeleton.richRegions?.[0]?.id || "");
                skeleton.sideQuests = skeleton.sideQuests || [];
                skeleton.sideQuests.push({
                    id: `sq_mascot_${Date.now()}_${added}`,
                    title,
                    type: "side",
                    synopsis: typeof obj.synopsis === "string" ? obj.synopsis : "",
                    triggerRegion,
                    stages: obj.stages && Array.isArray(obj.stages) ? parseStages(obj.stages) : [],
                });
                added++;
            }
            if (added > 0) changes.push(`新增了 ${added} 条支线任务`);
        }

        // 区域背景
        if (Array.isArray(args.regionLore)) {
            let updated = 0;
            for (const rl of args.regionLore) {
                if (!rl || typeof rl !== "object") continue;
                const obj = rl as Record<string, unknown>;
                const regionName = typeof obj.regionName === "string" ? obj.regionName.trim() : "";
                const regionLore = typeof obj.lore === "string" ? obj.lore.trim() : "";
                if (!regionName || !regionLore) continue;
                const region = (skeleton.richRegions || []).find(r => r.l1_name_cn === regionName || r.l1_name_cn.includes(regionName));
                if (region) { (region as Record<string, unknown>).lore = regionLore; updated++; }
            }
            if (updated > 0) changes.push(`更新了 ${updated} 个区域的背景设定`);
        }

        // 节点描述（按区域名+节点名定位，不改结构）
        if (Array.isArray(args.nodeDescriptions)) {
            let updated = 0;
            for (const nd of args.nodeDescriptions) {
                if (!nd || typeof nd !== "object") continue;
                const obj = nd as Record<string, unknown>;
                const regionName = typeof obj.regionName === "string" ? obj.regionName.trim() : "";
                const nodeName = typeof obj.nodeName === "string" ? obj.nodeName.trim() : "";
                const nodeDesc = typeof obj.description === "string" ? obj.description.trim() : "";
                if (!nodeName || !nodeDesc) continue;
                const region = (skeleton.richRegions || []).find(r =>
                    !regionName || r.l1_name_cn === regionName || r.l1_name_cn.includes(regionName));
                if (!region) continue;
                const hit = (nodes: NodeContent[] | undefined): boolean => {
                    if (!nodes) return false;
                    const node = nodes.find(n => n.name === nodeName || n.name.includes(nodeName));
                    if (!node) return false;
                    (node as Record<string, unknown>).description = nodeDesc;
                    return true;
                };
                if (hit(region.l2_nodes) || hit(region.l3_nodes)) updated++;
            }
            if (updated > 0) changes.push(`更新了 ${updated} 个节点的描述`);
        }

        if (changes.length === 0) {
            return { name: "写入世界设定", success: false, error: "没有识别到任何要写入的设定字段（可写：worldName / lore / mainQuestTitle / mainQuestSynopsis / mainQuestStages / newSideQuests / regionLore / nodeDescriptions）" };
        }

        const updatedWorld: MapWorld = {
            ...world,
            skeleton,
            updatedAt: new Date().toISOString(),
        };
        saveMapWorld(updatedWorld);

        return {
            name: "写入世界设定",
            success: true,
            data: {
                message: `已将你设计的设定写入世界「${skeleton.world.name}」`,
                worldId: updatedWorld.id,
                changes,
            },
        };
    } catch (err) {
        return { name: "写入世界设定", success: false, error: (err as Error).message };
    }
}

// ── 工具 8：删除冒险世界 ──
export async function adventureToolDeleteWorld(args: Record<string, unknown>): Promise<ToolResult> {
    try {
        const worldIdArg = typeof args.worldId === "string" ? args.worldId.trim() : "";
        if (!worldIdArg) {
            return { name: "删除冒险世界", success: false, error: "必须指定要删除的世界 worldId（可先用「列出冒险世界」查询）" };
        }
        const found = findTargetWorld(worldIdArg);
        if (found.error || !found.world) {
            return { name: "删除冒险世界", success: false, error: found.error || "找不到目标世界" };
        }
        const world = found.world;
        if (args.confirm !== true) {
            return { name: "删除冒险世界", success: false, error: `删除不可恢复。世界「${world.skeleton?.world?.name}」及其全部存档都会被清除；确认删除请把 confirm 设为 true` };
        }
        const name = world.skeleton?.world?.name || world.id;
        deleteMapWorld(world.id);
        return { name: "删除冒险世界", success: true, data: `已删除世界「${name}」及其全部游玩存档` };
    } catch (err) {
        return { name: "删除冒险世界", success: false, error: (err as Error).message };
    }
}

// ── 参数解析辅助 ──

function numberArg(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
    if (typeof value === "string" && value.trim()) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
}

function parseStages(raw: unknown[]): QuestStage[] {
    const stages: QuestStage[] = [];
    for (const s of raw) {
        if (!s || typeof s !== "object") continue;
        const obj = s as Record<string, unknown>;
        const brief = typeof obj.brief === "string" ? obj.brief.trim() : "";
        if (!brief) continue;
        stages.push({
            locationHint: typeof obj.locationHint === "string" ? obj.locationHint : "",
            brief,
            unlockHint: typeof obj.unlockHint === "string" ? obj.unlockHint : undefined,
        });
    }
    return stages;
}
