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

  // Update mascot context based on adventure page state
  useEffect(() => {
    if (view === "playing" && activeWorld && activeSave) {
      notifyMascotPageContext({
        page: "mapmode",
        mode: "playing",
        label: `冒险 · ${activeWorld.skeleton?.world?.name || "冒险世界"}`,
        fields: {
          worldId: activeWorld.id,
          worldName: activeWorld.skeleton?.world?.name || "",
          currentNodeId: activeSave.currentNodeId || "",
          gameDay: String(activeSave.gameDay || 1),
          gameTime: activeSave.gameTime || "morning",
          playerHp: `${activeSave.hp}/${activeSave.maxHp}`,
        },
      });
    } else {
      notifyMascotPageContext({
        page: "mapmode",
        mode: "viewing",
        label: "冒险大厅",
        fields: {},
      });
    }
  }, [view, activeWorld, activeSave]);

  // Reset context on unmount
  useEffect(() => {
    return () => {
      notifyMascotPageContext({ page: "desktop", mode: "idle", label: "桌面", fields: {} });
    };
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
