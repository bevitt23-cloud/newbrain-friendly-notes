import { useRef, useState, useCallback, useEffect } from "react";

// Isochronic tone frequency options
export const ISOCHRONIC_OPTIONS = [
  { hz: 12, label: "12 Hz", description: "Alpha-low beta — relaxed focus" },
  { hz: 15, label: "15 Hz", description: "Beta — active concentration" },
  { hz: 18, label: "18 Hz", description: "Beta — deep focus" },
  { hz: 20, label: "20 Hz", description: "High beta — peak alertness" },
];

export interface Channel {
  name: string;
  volume: number;
  playing: boolean;
}

export interface UseAudioMixerReturn {
  channels: Channel[];
  setVolume: (idx: number, vol: number) => void;
  toggleChannel: (idx: number) => void;
  stopAll: () => void;
  isochronicHz: number;
  setIsochronicHz: (hz: number) => void;
  isReady: boolean;
}

export function useAudioMixer(): UseAudioMixerReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainsRef = useRef<GainNode[]>([]);
  const sourcesRef = useRef<(OscillatorNode | null)[]>([null, null]);
  const [isochronicHz, setIsochronicHzState] = useState(15);
  const [isReady, setIsReady] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([
    { name: "Gamma Beats", volume: 0.4, playing: false },
    { name: "Isochronic", volume: 0.3, playing: false },
  ]);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      for (let i = 0; i < 2; i++) {
        const gain = ctx.createGain();
        gain.gain.value = channels[i].volume;
        gain.connect(ctx.destination);
        gainsRef.current.push(gain);
      }
      setIsReady(true);
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // Gamma beats: 40Hz gamma (200Hz left, 240Hz right)
  const startGammaBeats = useCallback((ctx: AudioContext, gain: GainNode) => {
    const merger = ctx.createChannelMerger(2);
    const oscL = ctx.createOscillator();
    oscL.type = "sine";
    oscL.frequency.value = 200;
    const gainL = ctx.createGain();
    gainL.gain.value = 0.5;
    oscL.connect(gainL);
    gainL.connect(merger, 0, 0);

    const oscR = ctx.createOscillator();
    oscR.type = "sine";
    oscR.frequency.value = 240;
    const gainR = ctx.createGain();
    gainR.gain.value = 0.5;
    oscR.connect(gainR);
    gainR.connect(merger, 0, 1);

    merger.connect(gain);
    oscL.start();
    oscR.start();

    const wrapper = oscL;
    const origStop = oscL.stop.bind(oscL);
    wrapper.stop = function (when?: number) {
      origStop(when);
      try { oscR.stop(when); } catch {}
    };
    return wrapper;
  }, []);

  // Isochronic tones with configurable Hz
  const startIsochronic = useCallback((ctx: AudioContext, gain: GainNode, hz: number) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 300;

    const modGain = ctx.createGain();
    modGain.gain.value = 0.5;

    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = hz;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;

    lfo.connect(lfoGain);
    lfoGain.connect(modGain.gain);
    osc.connect(modGain);
    modGain.connect(gain);

    osc.start();
    lfo.start();

    const origStop = osc.stop.bind(osc);
    osc.stop = function (when?: number) {
      origStop(when);
      try { lfo.stop(when); } catch {}
    };
    return osc;
  }, []);

  const setIsochronicHz = useCallback((hz: number) => {
    setIsochronicHzState(hz);
    // If isochronic is playing, restart with new Hz
    if (channels[1].playing && ctxRef.current) {
      try { sourcesRef.current[1]?.stop(); } catch {}
      const source = startIsochronic(ctxRef.current, gainsRef.current[1], hz);
      sourcesRef.current[1] = source;
    }
  }, [channels, startIsochronic]);

  const toggleChannel = useCallback((idx: number) => {
    const ctx = ensureContext();
    setChannels((prev) => {
      const next = [...prev];
      const ch = { ...next[idx] };
      if (ch.playing) {
        try { sourcesRef.current[idx]?.stop(); } catch {}
        sourcesRef.current[idx] = null;
        ch.playing = false;
      } else {
        const source = idx === 0
          ? startGammaBeats(ctx, gainsRef.current[idx])
          : startIsochronic(ctx, gainsRef.current[idx], isochronicHz);
        sourcesRef.current[idx] = source;
        ch.playing = true;
      }
      next[idx] = ch;
      return next;
    });
  }, [ensureContext, startGammaBeats, startIsochronic, isochronicHz]);

  const setVolume = useCallback((idx: number, vol: number) => {
    if (gainsRef.current[idx]) {
      gainsRef.current[idx].gain.value = vol;
    }
    setChannels((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], volume: vol };
      return next;
    });
  }, []);

  const stopAll = useCallback(() => {
    sourcesRef.current.forEach((s, i) => {
      try { s?.stop(); } catch {}
      sourcesRef.current[i] = null;
    });
    setChannels((prev) => prev.map((ch) => ({ ...ch, playing: false })));
  }, []);

  useEffect(() => {
    return () => {
      sourcesRef.current.forEach((s) => { try { s?.stop(); } catch {} });
      ctxRef.current?.close();
    };
  }, []);

  return { channels, setVolume, toggleChannel, stopAll, isochronicHz, setIsochronicHz, isReady };
}
