"use client";

// 小红书卡片诊断页:用户手机上打开 /xhs-debug,一键收集本地浏览器里
// 与小红书链接相关的渲染环境信息(页面版本/聊天消息原文片段)并上传到
// notes.emberroom.cn,供服务器端排查"卡片不渲染"这类只在特定设备出现的问题。
// 只上传含 xiaohongshu/xhslink 的消息片段(各截 300 字符,最多 30 条),不传 API Key。
import { useEffect, useState } from "react";

type DebugReport = {
  collectedAt: string;
  page: { href: string; ua: string; viewport: string; language: string };
  bundle: { pageChunks: string[] };
  storage: {
    localStorageKeys: string[];
    localExcerpts: string[];
    indexedDbDbs: string[];
    indexedDbExcerpts: string[];
    errors: string[];
  };
};

const XHS_RE = /(xiaohongshu\.com|xhslink\.com)/i;

function collectExcerpts(raw: string, sink: string[], label: string) {
  if (!raw || sink.length >= 30) return;
  const lower = raw.toLowerCase();
  let idx = lower.indexOf("xiaohongshu.com");
  if (idx < 0) idx = lower.indexOf("xhslink.com");
  if (idx < 0) return;
  const start = Math.max(0, idx - 200);
  sink.push(`[${label}] …${raw.slice(start, idx + 300)}…`);
}

function scanLocalStorage(sink: string[]): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      keys.push(key);
      if (!key.startsWith("ai_phone")) continue;
      const raw = localStorage.getItem(key) || "";
      if (raw.length > 2_000_000) continue; // 超大值跳过,避免卡顿
      collectExcerpts(raw, sink, `ls:${key}`);
    }
  } catch (err) {
    sink.push(`[ls-error] ${String(err).slice(0, 200)}`);
  }
  return keys;
}

async function scanIndexedDb(dbs: string[], excerpts: string[], errors: string[]) {
  if (!("databases" in indexedDB)) {
    errors.push("indexedDB.databases() 不可用");
    return;
  }
  const list = await indexedDB.databases();
  for (const info of list) {
    const name = info.name || "(unnamed)";
    dbs.push(`${name} (v${info.version ?? "?"})`);
    if (excerpts.length >= 30) continue;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const storeName of Array.from(db.objectStoreNames)) {
        if (excerpts.length >= 30) break;
        try {
          const records: unknown[] = await new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve((req.result || []).slice(0, 800));
            req.onerror = () => reject(req.error);
          });
          for (const record of records) {
            if (excerpts.length >= 30) break;
            let raw = "";
            try { raw = typeof record === "string" ? record : JSON.stringify(record); } catch { continue; }
            if (!raw || raw.length > 500_000) continue;
            collectExcerpts(raw, excerpts, `idb:${name}/${storeName}`);
          }
        } catch (err) {
          errors.push(`idb ${name}/${storeName}: ${String(err).slice(0, 150)}`);
        }
      }
      db.close();
    } catch (err) {
      errors.push(`idb ${name}: ${String(err).slice(0, 150)}`);
    }
  }
}

export default function XhsDebugPage() {
  const [report, setReport] = useState<DebugReport | null>(null);
  const [status, setStatus] = useState("收集中…");
  const [uploadState, setUploadState] = useState("");

  useEffect(() => {
    (async () => {
      const errors: string[] = [];
      const localExcerpts: string[] = [];
      const lsKeys = scanLocalStorage(localExcerpts);
      const dbs: string[] = [];
      const idbExcerpts: string[] = [];
      await scanIndexedDb(dbs, idbExcerpts, errors);
      const pageChunks = performance.getEntriesByType("resource")
        .map(e => e.name)
        .filter(n => n.includes("/_next/static/chunks/app/page-"))
        .map(n => n.slice(n.lastIndexOf("/") + 1));
      const data: DebugReport = {
        collectedAt: new Date().toISOString(),
        page: {
          href: location.href,
          ua: navigator.userAgent,
          viewport: `${innerWidth}x${innerHeight} @${devicePixelRatio}`,
          language: navigator.language,
        },
        bundle: { pageChunks },
        storage: {
          localStorageKeys: lsKeys,
          localExcerpts,
          indexedDbDbs: dbs,
          indexedDbExcerpts: idbExcerpts,
          errors,
        },
      };
      setReport(data);
      setStatus("收集完成");
    })().catch(err => setStatus("收集失败:" + String(err)));
  }, []);

  const upload = async () => {
    if (!report) return;
    setUploadState("上传中…");
    try {
      const res = await fetch("https://notes.emberroom.cn/xhs-meta/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      const data = await res.json().catch(() => ({}));
      setUploadState(res.ok ? `已上传 ✓（编号 ${data.file}，把这个编号告诉助手即可）` : `上传失败 (${res.status})`);
    } catch (err) {
      setUploadState("上传失败:" + String(err).slice(0, 150));
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      <h2 style={{ fontSize: 16 }}>小红书卡片诊断</h2>
      <p>{status}</p>
      {report && (
        <>
          <button onClick={upload} style={{ padding: "10px 18px", margin: "8px 0", fontSize: 15 }}>
            上传诊断信息到服务器
          </button>
          <p style={{ color: "#0a7d38" }}>{uploadState}</p>
          <p style={{ color: "#888" }}>
            仅上传页面版本信息与包含小红书链接的消息片段（每条截 300 字符，最多 30 条），不上传 API Key。
          </p>
          <textarea
            readOnly
            value={JSON.stringify(report, null, 1)}
            style={{ width: "100%", height: 400, fontSize: 11 }}
          />
        </>
      )}
    </div>
  );
}
