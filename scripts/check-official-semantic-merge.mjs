#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const types = read("lib/mixology/types.ts");
const assembler = read("lib/mixology/assembler.ts");
const engine = read("lib/mixology/engine.ts");
const protocol = read("lib/mixology/mechanism-protocol.ts");
const mascotPrompts = read("lib/mascot-prompts.ts");
const mascotTools = read("lib/mascot-tools.ts");
const chatStorage = read("lib/chat-storage.ts");
const chatEngine = read("lib/chat-engine.ts");
const groupChatEngine = read("lib/group-chat-engine.ts");
const game = read("components/mixology/mixology-game.tsx");

assert.match(types, /"checklist"/);
assert.match(assembler, /checklistText/);
assert.match(protocol, /rawReply/);
assert.match(protocol, /lastReply/);
assert.match(protocol, /MixHookSection/);
assert.match(engine, /runMechanismHooks\(working, "rawReply"/);
assert.match(engine, /lastReplyOverride/);
assert.match(engine, /rerunMixFilters/);
assert.match(game, /MIX_INITIAL_TURNS = 12/);
assert.match(game, /查看更早/);
assert.match(chatStorage, /offlineSummaryRetry/);
assert.match(chatEngine, /session\.offlineSummaryRetry === false \? 0 : 2/);
assert.match(groupChatEngine, /session\.offlineSummaryRetry === false \? 0 : 2/);
assert.match(mascotPrompts, /ADVENTURE_PROMPT/);
assert.match(mascotPrompts, /材料十三类/);
assert.match(mascotPrompts, /onRawReply/);
assert.match(mascotTools, /adventure_pack/);
assert.match(mascotTools, /checklist/);

console.log("Official semantic merge checks passed");
