import { useRef, useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) { resolve(); return; }
    readyCallbacks.push(resolve);
    if (apiLoaded) return;
    apiLoaded = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      readyCallbacks.forEach((cb) => cb());
      readyCallbacks.length = 0;
    };
  });
}

export interface UseYouTubePlayerReturn {
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  setPlaylistUrl: (url: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}

export function useYouTubePlayer(defaultPlaylistUrl: string): UseYouTubePlayerReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playlistUrlRef = useRef(defaultPlaylistUrl);
  const volumeRef = useRef(50);
  const playerDivId = useRef(`yt-player-${Math.random().toString(36).slice(2, 8)}`);

  const initPlayer = useCallback(async () => {
    await loadYouTubeAPI();
    if (!containerRef.current) return;

    let el = document.getElementById(playerDivId.current);
    if (!el) {
      el = document.createElement("div");
      el.id = playerDivId.current;
      containerRef.current.appendChild(el);
    }

    const listId = extractPlaylistId(playlistUrlRef.current);
    const videoId = extractVideoId(playlistUrlRef.current);

    const playerVars: any = {
      autoplay: 0,
      controls: 0,
      loop: 1,
      modestbranding: 1,
    };

    if (listId) {
      playerVars.listType = "playlist";
      playerVars.list = listId;
    }

    playerRef.current = new window.YT.Player(playerDivId.current, {
      height: "1",
      width: "1",
      videoId: videoId || undefined,
      playerVars,
      events: {
        onReady: (e: any) => {
          e.target.setVolume(volumeRef.current);
        },
        onStateChange: (e: any) => {
          setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
        },
      },
    });
  }, []);

  useEffect(() => {
    initPlayer();
    return () => {
      try { playerRef.current?.destroy(); } catch {}
    };
  }, [initPlayer]);

  const play = useCallback(() => {
    try { playerRef.current?.playVideo(); } catch {}
  }, []);

  const pause = useCallback(() => {
    try { playerRef.current?.pauseVideo(); } catch {}
  }, []);

  const stop = useCallback(() => {
    try { playerRef.current?.stopVideo(); } catch {}
    setIsPlaying(false);
  }, []);

  const setVolume = useCallback((vol: number) => {
    volumeRef.current = Math.round(vol * 100);
    try { playerRef.current?.setVolume(volumeRef.current); } catch {}
  }, []);

  const nextTrack = useCallback(() => {
    try { playerRef.current?.nextVideo(); } catch {}
  }, []);

  const setPlaylistUrl = useCallback((url: string) => {
    playlistUrlRef.current = url;
    const listId = extractPlaylistId(url);
    const videoId = extractVideoId(url);

    if (listId && playerRef.current?.loadPlaylist) {
      try {
        playerRef.current.loadPlaylist({ listType: "playlist", list: listId });
      } catch {}
    } else if (videoId && playerRef.current?.loadVideoById) {
      try {
        playerRef.current.loadVideoById(videoId);
      } catch {}
    }
  }, []);

  return { isPlaying, play, pause, stop, setVolume, nextTrack, setPlaylistUrl, containerRef };
}
