"use client";
import { useState, useCallback, useEffect } from "react";
import MapLobby from "./map-lobby";
import MapView from "./map-view";
import type { MapWorld, GameSave } from "@/lib/map-types";
import { notifyMascotPageContext } from "@/lib/mascot-events";

type View = "lobby" | "playing";

export default function MapApp({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("lobby");
  const [activeWorld, setActiveWorld] = useState<MapWorld | null>(null);
  const [activeSave, setActiveSave] = useState<GameSave | null>(null);

  useEffect(() => {
    notifyMascotPageContext({
      page: "adventure",
      mode: view === "playing" ? "playing" : "lobby",
      label: activeWorld ? `冒险 · ${activeWorld.skeleton.world.name || "未命名世界"}` : "冒险大厅",
      fields: activeWorld ? { worldId: activeWorld.id, worldName: activeWorld.skeleton.world.name || "" } : {},
    });
  }, [activeWorld, view]);

  useEffect(() => () => {
    notifyMascotPageContext({ page: "desktop", mode: "idle", label: "桌面", fields: {} });
  }, []);

  const handleStartGame = useCallback((world: MapWorld, save: GameSave) => {
    setActiveWorld(world);
    setActiveSave(save);
    setView("playing");
  }, []);

  const handleBackToLobby = useCallback(() => {
    setView("lobby");
    setActiveWorld(null);
    setActiveSave(null);
  }, []);

  if (view === "playing" && activeWorld && activeSave) {
    return (
      <MapView
        world={activeWorld}
        save={activeSave}
        onSaveUpdate={setActiveSave}
        onBack={handleBackToLobby}
      />
    );
  }

  return <MapLobby onClose={onClose} onStartGame={handleStartGame} />;
}
