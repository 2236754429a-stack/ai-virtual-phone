import Dexie from "dexie";
import { formatChatTimestamp } from "./llm-prompt-assembler";

export type StoryUiPrefs = {
  hideBubble?: boolean;
  hideAvatar?: boolean;
  hideTimestamp?: boolean;
  theme?: string;
};

export type StorySession = {
  id: string;
  characterId: string;
  title?: string;
  updatedAt: string;
  customCSS?: string;
  foldTags?: string;            // Comma-separated tag names to fold for this session.
  contextExcludedTags?: string; // Comma-separated tag names stripped before sending story history to the LLM.
  uiPrefs?: StoryUiPrefs;
  lastMessageId?: string;
  lastMessagePreview?: string;
};

export type StoryMessageRole = "user" | "assistant" | "system";

export type StoryMessage = {
  id: string;
  sessionId: string;
  role: StoryMessageRole;
  rawContent: string;
  renderedContent?: string;
  storySummary?: string;
  regexSignature?: string;
  parserVersion?: number;
  createdAt: string;
};

export type StoryProjectionEntry = {
  id: string;
  timestamp: string;
  content: string;
};

class StoryDatabase extends Dexie {
  sessions!: Dexie.Table<StorySession, string>;
  messages!: Dexie.Table<StoryMessage, string>;

  constructor() {
    super("AiPhoneStoryDB");
    this.version(1).stores({
      sessions: "id, characterId, updatedAt",
      messages: "id, sessionId, createdAt",
    });
  }
}

const storyDb = new StoryDatabase();

let _hydrated = false;
let _sessionsCache: StorySession[] = [];
let _messagesCache: StoryMessage[] = [];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 剧情多开：同一角色允许并存多条剧情线，只清理缺 id/characterId 的脏数据，
// 不再按 characterId 去重（旧版会把多余会话整条丢弃）。
function normalizeStorySessions(sessions: StorySession[]): { items: StorySession[]; changed: boolean } {
  const normalized: StorySession[] = [];
  let changed = false;

  for (const session of sessions) {
    const id = session.id?.trim();
    const characterId = session.characterId?.trim();
    if (!id || !characterId) {
      changed = true;
      continue;
    }
    const item = id === session.id && characterId === session.characterId
      ? session
      : { ...session, id, characterId };
    normalized.push(item);
    if (item !== session) changed = true;
  }

  return { items: normalized, changed };
}

function persistStorySessionsSnapshot(sessions: StorySession[]): void {
  storyDb.transaction("rw", storyDb.sessions, async () => {
    await storyDb.sessions.clear();
    await storyDb.sessions.bulkPut(sessions);
  }).catch(() => undefined);
}

export async function hydrateStoryStorage(): Promise<void> {
  if (_hydrated || typeof window === "undefined") return;
  const [sessions, messages] = await Promise.all([
    storyDb.sessions.toArray().catch(() => []),
    storyDb.messages.toArray().catch(() => []),
  ]);
  _messagesCache = messages;
  const normalized = normalizeStorySessions(sessions);
  _sessionsCache = normalized.items;
  if (normalized.changed) persistStorySessionsSnapshot(normalized.items);
  _hydrated = true;
}

export function loadStorySessions(): StorySession[] {
  const normalized = normalizeStorySessions(_sessionsCache);
  if (normalized.changed) _sessionsCache = normalized.items;
  // 空值安全：旧版本/异常导入的数据可能缺 updatedAt，排序不能让页面崩溃
  return [..._sessionsCache].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function loadStoryMessages(sessionId: string): StoryMessage[] {
  return _messagesCache
    .filter((message) => message.sessionId === sessionId)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

function findLatestStorySessionForCharacter(characterId: string): StorySession | undefined {
  return _sessionsCache
    .filter((session) => session.characterId === characterId)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
}

export function createOrGetStorySession(characterId: string): StorySession {
  const normalized = normalizeStorySessions(_sessionsCache);
  if (normalized.changed) {
    _sessionsCache = normalized.items;
    persistStorySessionsSnapshot(normalized.items);
  }
  const existing = findLatestStorySessionForCharacter(characterId);
  if (existing) return existing;
  return createStorySession(characterId);
}

/** 剧情多开：无条件新建一条剧情会话（可选自带标题）。 */
export function createStorySession(characterId: string, title?: string): StorySession {
  const session: StorySession = {
    id: generateId("story_sess"),
    characterId,
    ...(title ? { title } : {}),
    updatedAt: new Date().toISOString(),
    uiPrefs: {},
  };
  _sessionsCache.unshift(session);
  storyDb.sessions.put(session).catch(() => undefined);
  return session;
}

/** 删除一条剧情会话及其全部消息。 */
export function deleteStorySession(sessionId: string): void {
  _sessionsCache = _sessionsCache.filter((session) => session.id !== sessionId);
  storyDb.transaction("rw", storyDb.sessions, storyDb.messages, async () => {
    await storyDb.sessions.delete(sessionId);
    await storyDb.messages.where("sessionId").equals(sessionId).delete();
  }).catch(() => undefined);
}

export function updateStorySession(sessionId: string, updates: Partial<StorySession>): StorySession | null {
  const idx = _sessionsCache.findIndex((session) => session.id === sessionId);
  if (idx === -1) return null;
  const next: StorySession = {
    ..._sessionsCache[idx],
    ...updates,
    uiPrefs: { ..._sessionsCache[idx].uiPrefs, ...updates.uiPrefs },
    updatedAt: updates.updatedAt || new Date().toISOString(),
  };
  _sessionsCache[idx] = next;
  storyDb.sessions.put(next).catch(() => undefined);
  return next;
}

export function pushStoryMessage(
  input: Omit<StoryMessage, "id" | "createdAt">
): StoryMessage {
  const message: StoryMessage = {
    ...input,
    id: generateId("story_msg"),
    createdAt: new Date().toISOString(),
  };
  _messagesCache.push(message);
  storyDb.messages.put(message).catch(() => undefined);

  const previewSource = message.renderedContent || message.rawContent;
  const preview = previewSource.replace(/\s+/g, " ").trim().slice(0, 64);
  updateStorySession(message.sessionId, {
    lastMessageId: message.id,
    lastMessagePreview: preview,
    updatedAt: message.createdAt,
  });

  return message;
}

/** Delete a single story message */
export function deleteStoryMessage(messageId: string): void {
    _messagesCache = _messagesCache.filter(m => m.id !== messageId);
    storyDb.messages.delete(messageId).catch(() => undefined);
}

/** Delete a message and all messages after it (by createdAt in same session) */
export function deleteStoryMessagesFrom(sessionId: string, messageId: string): void {
    const msg = _messagesCache.find(m => m.id === messageId);
    if (!msg) return;
    const idsToDelete = _messagesCache
        .filter(m => m.sessionId === sessionId && m.createdAt >= msg.createdAt)
        .map(m => m.id);
    _messagesCache = _messagesCache.filter(m => !idsToDelete.includes(m.id));
    storyDb.messages.bulkDelete(idsToDelete).catch(() => undefined);
}

/** Edit a story message's rawContent (renderedContent will be rebuilt by cache invalidation) */
export function editStoryMessage(messageId: string, newRawContent: string): void {
    const idx = _messagesCache.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    _messagesCache[idx] = {
        ..._messagesCache[idx],
        rawContent: newRawContent,
        renderedContent: undefined,
        regexSignature: undefined,
        parserVersion: undefined,
    };
    storyDb.messages.put(_messagesCache[idx]).catch(() => undefined);
}

export function replaceStoryMessages(sessionId: string, messages: StoryMessage[]): void {
  _messagesCache = _messagesCache.filter((message) => message.sessionId !== sessionId);
  _messagesCache.push(...messages);
  storyDb.messages.where("sessionId").equals(sessionId).delete()
    .then(() => storyDb.messages.bulkPut(messages))
    .catch(() => undefined);
}

function compactProjectionText(text: string, maxLen = 160): string {
  const plain = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}...` : plain;
}

export function loadStoryProjectionEntries(
  characterId: string,
  options?: { afterTimestamp?: string; userName?: string; charName?: string }
): StoryProjectionEntry[] {
  // 剧情多开：同一角色可能有多条线，投影取最近更新的那条，保持旧行为（一条线的内容）
  const session = findLatestStorySessionForCharacter(characterId);
  if (!session) return [];
  const messages = loadStoryMessages(session.id);
  const projections: StoryProjectionEntry[] = [];

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    if (current.role !== "assistant") continue;
    if (options?.afterTimestamp && current.createdAt <= options.afterTimestamp) continue;

    if (!current.storySummary) continue;
    const summaryText = compactProjectionText(current.storySummary, 500);
    if (!summaryText) continue;

    const ts = formatChatTimestamp(current.createdAt);
    projections.push({
      id: `story_projection_${current.id}`,
      timestamp: current.createdAt,
      content: `[事件 ${ts}] ${summaryText}`,
    });
  }

  return projections;
}
