#!/usr/bin/env node
import assert from "node:assert/strict";
import { MOSS_TTS_MODEL, normalizeMosslandInput } from "../lib/mossland-tts-input.ts";

const normalize = (text, model = MOSS_TTS_MODEL) => normalizeMosslandInput(text, model);

assert.equal(normalize("你好[pause 0.1s]世界"), "你好[pause 0.1s]世界");
assert.equal(normalize("你好[pause 10.0s]世界"), "你好[pause 10.0s]世界");
assert.equal(normalize("你好 (laughs) 世界"), "你好 世界");
assert.equal(normalize("你好（叹气）世界"), "你好世界");
assert.equal(normalize("你好【laughs】世界"), "你好世界");
assert.equal(normalize("你好［呼吸］世界"), "你好世界");
assert.equal(normalize("你好 [笑] 世界"), "你好 世界");
assert.equal(normalize("你好 (笑) 世界"), "你好 世界");
assert.equal(normalize("你好（laughs）世界"), "你好世界");
assert.equal(normalize("你好 [pause 1.5s] 世界", "moss-tts-1.0-pro"), "你好 世界");
assert.equal(normalize("你好[pause 1.50s]世界"), "你好[pause 1.50s]世界");
assert.equal(normalize("你好[pause 0.0s]世界"), "你好世界");
assert.equal(normalize("你好[pause 10.1s]世界"), "你好世界");
assert.equal(normalize("你好[PAUSE 1.5s]世界"), "你好世界");
assert.equal(normalize("请读出（括号里的内容）"), "请读出（括号里的内容）");
assert.equal(normalize("中文 English\n[pause 1.5s]"), "中文 English\n[pause 1.5s]");

console.log("Mossland TTS input checks passed");
