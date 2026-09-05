from __future__ import annotations

import base64
import sys
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio
import httpx

ALLOWED_ORIGINS = {
    item.strip().rstrip("/")
    for item in __import__("os").environ.get(
        "FLOAT_ALLOWED_ORIGINS",
        "https://reliable-crostata-64d935.netlify.app,https://main--reliable-crostata-64d935.netlify.app",
    ).split(",")
    if item.strip()
}

class CorsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "").rstrip("/")
        if request.method == "OPTIONS":
            response = Response(status_code=204)
        else:
            response = await call_next(request)
        if origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, HEAD, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Expose-Headers"] = "Content-Range, Accept-Ranges, Content-Length"
            response.headers["Vary"] = "Origin"
        response.headers["Cache-Control"] = "no-store"
        return response

sys.path.insert(0, "/opt/float-netease-full/vendor")
from music import (  # noqa: E402
    _ensure_login,
    check_netease_qr,
    get_audio_url,
    get_song_detail,
    get_song_lyrics,
    search_songs,
    start_netease_qr,
)
from config import SETTINGS, save_settings  # noqa: E402
from pyncm.apis.login import GetCurrentSession  # noqa: E402

app = FastAPI(title="Float NetEase Music API", version="1.0")
app.add_middleware(CorsMiddleware)


def public_status(status: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": {"waiting": 801, "scanned": 802, "success": 803, "expired": 800}.get(status.get("status"), 801),
        "message": status.get("message", ""),
        "data": {"profile": {"nickname": status.get("nickname", "")}} if status.get("nickname") else {},
    }


@app.exception_handler(RuntimeError)
async def runtime_error(_request: Request, exc: RuntimeError) -> JSONResponse:
    return JSONResponse({"code": 502, "message": str(exc)}, status_code=502)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "float-netease-full"}


@app.get("/login/qr/key")
async def qr_key() -> dict[str, Any]:
    payload = await asyncio.to_thread(start_netease_qr)
    # The internal service creates the QR image and session together. The key
    # endpoint returns an opaque session id understood by the compatibility routes.
    return {"code": 200, "data": {"unikey": payload["sessionId"]}}


@app.get("/login/qr/create")
async def qr_create(key: str = Query(...), qrimg: str | None = None) -> dict[str, Any]:
    # The key is the internal QR session id. The PNG is regenerated from the
    # stored session only through the service's in-memory QR state.
    from music import _qr_sessions, _qr_lock  # noqa: E402
    with _qr_lock:
        session = _qr_sessions.get(key)
    if not session:
        return {"code": 800, "data": {}}
    # start_netease_qr already generated the image; use a new QR only if needed
    # by calling the underlying start helper would create a second session, so
    # this endpoint is backed by the service-local image cache below.
    image = _qr_images.get(key)
    if not image:
        return {"code": 800, "data": {}}
    return {"code": 200, "data": {"qrimg": image}}


@app.get("/login/qr/check")
async def qr_check(key: str = Query(...)) -> dict[str, Any]:
    status = await asyncio.to_thread(check_netease_qr, key)
    return public_status(status)


@app.get("/login/status")
async def login_status() -> dict[str, Any]:
    try:
        await asyncio.to_thread(_ensure_login)
        session = GetCurrentSession()
        profile = session.login_info.get("content", {}).get("profile", {})
        nickname = profile.get("nickname") if isinstance(profile, dict) else ""
        if nickname:
            return {"code": 200, "data": {"profile": {"nickname": nickname}}}
    except Exception:
        pass
    return {"code": 200, "data": {"profile": None}}


@app.post("/logout")
async def logout() -> dict[str, Any]:
    SETTINGS.pop("netease_music_u", None)
    save_settings(SETTINGS)
    import music as music_module
    music_module._inited = False
    music_module._last_login_time = 0.0
    with music_module._qr_lock:
        music_module._qr_sessions.clear()
        _qr_images.clear()
    return {"code": 200, "data": {"loggedOut": True}}



async def cloudsearch(keywords: str = Query(...), limit: int = Query(20, ge=1, le=50)) -> dict[str, Any]:
    return {"code": 200, "result": {"songs": await asyncio.to_thread(search_songs, keywords.strip(), limit)}}


@app.get("/search")
async def search(keywords: str = Query(...), limit: int = Query(20, ge=1, le=50)) -> dict[str, Any]:
    return await cloudsearch(keywords, limit)


@app.get("/song/detail")
async def song_detail(ids: str = Query(...)) -> dict[str, Any]:
    songs = []
    for raw in ids.split(","):
        try:
            item = await asyncio.to_thread(get_song_detail, int(raw))
        except (TypeError, ValueError):
            item = None
        if item:
            songs.append(item)
    return {"code": 200, "songs": songs}


@app.get("/song/url")
@app.get("/song/url/v1")
async def song_url(id: int = Query(...)) -> dict[str, Any]:
    url = await asyncio.to_thread(get_audio_url, id)
    return {"code": 200, "data": [{"id": id, "url": url}] if url else []}


@app.get("/lyric")
async def lyric(id: int = Query(...)) -> dict[str, Any]:
    payload = await asyncio.to_thread(get_song_lyrics, id)
    return {"code": 200, "lrc": {"lyric": payload.get("text", "")}, "tlyric": {"lyric": payload.get("translatedText", "")}}


@app.get("/api/music/search")
async def music_search(q: str = Query(..., min_length=1, max_length=200), limit: int = Query(20, ge=1, le=20)) -> dict[str, Any]:
    return {"songs": await asyncio.to_thread(search_songs, q.strip(), limit)}


@app.get("/api/music/detail/{song_id}")
async def music_detail(song_id: int) -> dict[str, Any]:
    info = await asyncio.to_thread(get_song_detail, song_id)
    if not info:
        return {"error": "歌曲不存在"}
    info["audio_url"] = await asyncio.to_thread(get_audio_url, song_id)
    return info


@app.get("/api/music/lyrics/{song_id}")
async def music_lyrics(song_id: int) -> dict[str, Any]:
    return await asyncio.to_thread(get_song_lyrics, song_id)


@app.post("/api/music/netease/qr/start")
async def legacy_qr_start() -> dict[str, Any]:
    return await asyncio.to_thread(start_netease_qr)


@app.get("/api/music/netease/qr/status/{session_id}")
async def legacy_qr_status(session_id: str) -> dict[str, Any]:
    return await asyncio.to_thread(check_netease_qr, session_id)


@app.get("/api/music/stream/{song_id}")
async def music_stream(song_id: int, request: Request) -> Any:
    audio_url = await asyncio.to_thread(get_audio_url, song_id)
    if not audio_url:
        return Response(content='{"error":"无法获取播放地址，可能是 VIP 歌曲且未登录"}', status_code=404, media_type="application/json")
    headers = {"Referer": "https://music.163.com/", "User-Agent": "Mozilla/5.0", "Accept": "audio/*,*/*;q=0.8"}
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]
    client = httpx.AsyncClient(timeout=60, follow_redirects=True)
    upstream_response = await client.send(client.build_request("GET", audio_url, headers=headers), stream=True)
    if upstream_response.status_code >= 400:
        await upstream_response.aclose(); await client.aclose()
        return Response(content='{"error":"上游音频地址不可用"}', status_code=upstream_response.status_code, media_type="application/json")
    async def body():
        try:
            async for chunk in upstream_response.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await upstream_response.aclose(); await client.aclose()
    out_headers = {"Accept-Ranges": upstream_response.headers.get("accept-ranges", "bytes"), "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"}
    for key in ("content-length", "content-range", "etag", "last-modified"):
        if upstream_response.headers.get(key): out_headers[key.title()] = upstream_response.headers[key]
    return StreamingResponse(body(), status_code=upstream_response.status_code, media_type=upstream_response.headers.get("content-type", "audio/mpeg"), headers=out_headers)


_qr_images: dict[str, str] = {}
_original_start = start_netease_qr

def _start_with_image() -> dict[str, Any]:
    payload = _original_start()
    _qr_images[payload["sessionId"]] = payload["imageDataUrl"]
    return payload

# Keep both legacy and compatibility QR start flows backed by one internal implementation.
start_netease_qr = _start_with_image
