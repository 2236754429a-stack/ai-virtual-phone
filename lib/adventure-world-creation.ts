import type { ApiConfig } from "./settings-types";
import type { GameSave, MapWorld } from "./map-types";
import { loadCharacters } from "./character-storage";
import { generateMap, type GeoJSONData } from "./map-engine";
import { generateWorldSkeleton } from "./map-rpg-engine";
import {
  addAgentToSave,
  createInitialSave,
  generateWorldId,
  hydrateMapStorage,
  saveGame,
  saveMapWorld,
} from "./map-storage";

type AdventureWorldOptions = {
  description: string;
  tone?: string;
  regionCount?: number;
  mainQuestType?: string;
  npcCount?: number;
  difficulty?: string;
  companionNames?: string[];
  /** Reuse a pre-created placeholder id when the UI starts background generation. */
  worldId?: string;
  apiConfig: ApiConfig;
  geoData: GeoJSONData;
};

export type AdventureWorldCreationResult = {
  world: MapWorld;
  save: GameSave;
};

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value as number)));
}

/** Create and persist an adventure world using the same format as MapLobby. */
export async function createAdventureWorld(options: AdventureWorldOptions): Promise<AdventureWorldCreationResult> {
  const description = options.description.trim();
  if (!description) throw new Error("冒险世界描述不能为空");
  if (!options.apiConfig.apiKey) throw new Error("小卷助手使用的 API 配置没有 API Key");

  await hydrateMapStorage();
  const characters = loadCharacters();
  const requestedNames = (options.companionNames || []).map(name => name.trim()).filter(Boolean);
  const companions = requestedNames.map(name => {
    const character = characters.find(item => item.name.trim() === name);
    if (!character) throw new Error(`找不到同伴角色：${name}。请先用「读取角色」确认角色名。`);
    return { id: character.id, name: character.name, description: character.personality || character.persona || "" };
  });

  const skeleton = await generateWorldSkeleton(
    description,
    companions.map(companion => `${companion.name}：${companion.description}`),
    options.apiConfig,
    {
      world_desc: description,
      tone: options.tone?.trim() || "自由发挥",
      region_count: String(clampInteger(options.regionCount, 6, 1, 12)),
      main_quest_type: options.mainQuestType?.trim() || "自由发挥",
      npc_count: String(clampInteger(options.npcCount, 12, 1, 40)),
      difficulty: options.difficulty?.trim() || "适中",
    },
  );

  const renderedMap = generateMap(skeleton.mapInput, options.geoData);
  const now = new Date().toISOString();
  const world: MapWorld = {
    id: options.worldId || generateWorldId(),
    skeleton,
    renderedMap,
    createdAt: now,
    updatedAt: now,
  };
  saveMapWorld(world);

  const startNode = renderedMap.l1Nodes[0]?.id || "l1_0";
  let save = createInitialSave(world.id, startNode);
  for (const companion of companions) {
    const character = characters.find(item => item.id === companion.id);
    save = addAgentToSave(save, companion.id, character?.personality || "");
  }

  const discovered = [startNode];
  renderedMap.l2Nodes.forEach((node, index) => { if (node.regionIdx === 0) discovered.push(`l2_${index}`); });
  renderedMap.l3Nodes.forEach((node, index) => { if (node.regionIdx === 0) discovered.push(`l3_${index}`); });
  renderedMap.l1Nodes.forEach(node => { if (!discovered.includes(node.id)) discovered.push(node.id); });
  save = {
    ...save,
    discoveredNodes: discovered,
    journal: save.journal.map((entry, index) => index === 0
      ? { ...entry, locationName: renderedMap.l1Nodes[0]?.nameCn || "起点" }
      : entry),
  };
  saveGame(save);

  return { world, save };
}
