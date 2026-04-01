import { useState, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

const BAR_POS_KEY = "bfn:videobar-pos";
const PLAYER_POS_KEY = "bfn:videoplayer-pos";
const BAR_EXPANDED_KEY = "bfn:videobar-expanded";

function loadPos(key: string, fallback: Position): Position {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
    }
  } catch { /* ignore */ }
  return fallback;
}

export function useVideoBar() {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(() => {
    try { return localStorage.getItem(BAR_EXPANDED_KEY) === "true"; } catch { return false; }
  });
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [barPosition, setBarPosition] = useState<Position>(() => loadPos(BAR_POS_KEY, { x: 16, y: 72 }));
  const [playerPosition, setPlayerPosition] = useState<Position>(() => loadPos(PLAYER_POS_KEY, { x: 100, y: 100 }));

  // Persist bar position
  const saveBarPosition = useCallback((pos: Position) => {
    setBarPosition(pos);
    localStorage.setItem(BAR_POS_KEY, JSON.stringify(pos));
  }, []);

  // Persist player position
  const savePlayerPosition = useCallback((pos: Position) => {
    setPlayerPosition(pos);
    localStorage.setItem(PLAYER_POS_KEY, JSON.stringify(pos));
  }, []);

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem(BAR_EXPANDED_KEY, String(isExpanded));
  }, [isExpanded]);

  const playVideo = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
    setIsPlayerOpen(true);
  }, []);

  const closePlayer = useCallback(() => {
    setActiveVideoId(null);
    setIsPlayerOpen(false);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return {
    activeVideoId,
    isExpanded,
    isPlayerOpen,
    barPosition,
    playerPosition,
    saveBarPosition,
    savePlayerPosition,
    playVideo,
    closePlayer,
    toggleExpanded,
    setIsExpanded,
  };
}
