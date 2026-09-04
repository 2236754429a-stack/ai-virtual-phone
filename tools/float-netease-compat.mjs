import http from "node:http";
import { URL } from "node:url";

const HOST = process.env.MUSIC_COMPAT_HOST || "127.0.0.1";
const PORT = Number(process.env.MUSIC_COMPAT_PORT || 3012);
const UPSTREAM = (process.env.MUSIC_UPSTREAM || "http://100.93.157.70:3000").replace(/\/$/, "");
const cache = new Map();

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

async function upstream(path) {
  const response = await fetch(`${UPSTREAM}${path}`, { signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
  return body;
}

function songDetail(id) {
  const song = cache.get(id);
  if (!song) return null;
  return {
    id: Number(song.id),
    name: song.name || "",
    ar: Array.isArray(song.artists) ? song.artists : [],
    al: { id: 0, name: typeof song.album === "object" ? song.album?.name || "" : song.album || "", picUrl: typeof song.album === "object" ? song.album?.picUrl || "" : song.coverUrl || song.cover || "" },
    dt: Number(song.duration || song.dt || 0),
  };
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
    return res.end();
  }
  if (req.method !== "GET") return send(res, 405, { code: 405, message: "GET only" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true, service: "float-netease-compat", upstream: UPSTREAM });
    if (url.pathname === "/cloudsearch" || url.pathname === "/search") {
      const params = new URLSearchParams({ keywords: url.searchParams.get("keywords") || "", limit: url.searchParams.get("limit") || "20" });
      const data = await upstream(`/search?${params}`);
      const songs = Array.isArray(data.result?.songs) ? data.result.songs : [];
      for (const song of songs) cache.set(String(song.id), song);
      return send(res, 200, { code: 200, result: { songs } });
    }
    if (url.pathname === "/song/detail") {
      const ids = (url.searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean);
      const songs = ids.map(songDetail).filter(Boolean);
      return send(res, 200, { code: 200, songs });
    }
    if (url.pathname === "/song/url" || url.pathname === "/song/url/v1" || url.pathname === "/lyric") {
      const id = url.searchParams.get("id") || "";
      if (!id) return send(res, 400, { code: 400, message: "id required" });
      return send(res, 200, await upstream(`${url.pathname}?${url.searchParams.toString()}`));
    }
    return send(res, 404, { code: 404, message: "unsupported endpoint" });
  } catch {
    return send(res, 502, { code: 502, message: "music upstream unavailable" });
  }
}

http.createServer((req, res) => { void handle(req, res); }).listen(PORT, HOST, () => {
  console.log(`float-netease-compat listening on ${HOST}:${PORT}`);
});
