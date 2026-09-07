#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const tools = read("lib/mascot-tools.ts");
const creator = read("lib/adventure-world-creation.ts");
const lobby = read("components/map/map-lobby.tsx");
const app = read("components/map/map-app.tsx");

assert.match(tools, /id: "adventure_pack"/);
assert.match(tools, /name: "列出冒险世界"/);
assert.match(tools, /name: "创建冒险世界"/);
assert.match(tools, /"列出冒险世界": "mascot_list_adventure_worlds"/);
assert.match(tools, /"创建冒险世界": "mascot_create_adventure_world"/);
assert.match(tools, /adventure_pack: "mascot_load_adventure_pack"/);
assert.match(tools, /case "列出冒险世界": return await handleListAdventureWorlds\(\)/);
assert.match(tools, /case "创建冒险世界": return await handleCreateAdventureWorld\(call\.args\)/);
assert.match(tools, /"mapmode"/);
assert.match(tools, /\["adventure", "map", "冒险"\]/);
assert.match(creator, /export async function createAdventureWorld/);
assert.match(creator, /generateWorldSkeleton/);
assert.match(creator, /generateMap/);
assert.match(creator, /createInitialSave/);
assert.match(creator, /saveMapWorld/);
assert.match(lobby, /resolveBinding\(bindings, firstChar\.id, "adventure"\)/);
assert.match(lobby, /createAdventureWorld\(/);
assert.match(app, /page: "adventure"/);

console.log("Mascot adventure integration checks passed");
