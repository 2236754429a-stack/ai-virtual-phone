"use client";

// SW/缓存重置页:只清理 Service Worker 注册与 Cache Storage(旧代码快照),
// 不碰 IndexedDB / localStorage(聊天记录、配置都在那里)。
// 用途:手机上 SW 卡在旧部署快照(Netlify 国内可达性不稳定导致长期离线兜底)时,
// 打开本页一键重置,下次加载强制从网络拉最新版本。
import { useEffect, useState } from "react";

export default function ResetSwPage() {
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const push = (line: string) => setLog(prev => [...prev, line]);
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
            push(`已注销 Service Worker:${reg.scope}`);
          }
          if (regs.length === 0) push("没有找到已注册的 Service Worker");
        } else {
          push("此浏览器不支持 Service Worker");
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
            push(`已删除缓存:${key}`);
          }
          if (keys.length === 0) push("没有找到缓存存储");
        }
        push("完成。聊天记录(IndexedDB)未受影响。");
        push("页面将在 3 秒后自动刷新,请确保此刻网络能打开本站。");
        setDone(true);
        setTimeout(() => { location.reload(); }, 3000);
      } catch (err) {
        push("出错:" + String(err).slice(0, 200));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "monospace", fontSize: 14, lineHeight: 1.7 }}>
      <h2 style={{ fontSize: 17 }}>重置代码缓存（不动聊天数据）</h2>
      {log.map((line, i) => <p key={i} style={{ margin: "4px 0", color: "#0a7d38" }}>✓ {line}</p>)}
      {done && <button onClick={() => location.reload()} style={{ padding: "10px 18px", fontSize: 15, marginTop: 8 }}>立即刷新</button>}
    </div>
  );
}
