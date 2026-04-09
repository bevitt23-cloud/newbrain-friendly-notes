import { useState, useRef, useCallback, useEffect } from "react";
import {
  Volume2, Timer, Music, ChevronDown, ChevronUp, GripVertical,
  Play, Pause, RotateCcw, Volume1, VolumeX, Settings2,
  Headphones, Waves, Radio, SkipForward, X, Sparkles, Youtube,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioMixer, ISOCHRONIC_OPTIONS } from "@/hooks/useAudioMixer";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

// ─── Focus Timer presets ────────────────────────────────────
const PRESETS = [
  { label: "25 / 5", work: 25, break: 5 },
  { label: "50 / 10", work: 50, break: 10 },
  { label: "Custom", work: 0, break: 0 },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Channel icons ──────────────────────────────────────────
const CHANNEL_ICONS = [Headphones, Waves];
const CHANNEL_COLORS = [
  { active: "bg-lavender-200 ring-lavender-300 dark:bg-lavender-500/20", inactive: "bg-lavender-100 dark:bg-lavender-500/10", text: "text-lavender-500", slider: "accent-lavender-500" },
  { active: "bg-sky-200 ring-sky-300 dark:bg-sky-300/20", inactive: "bg-sky-100 dark:bg-sky-300/10", text: "text-sky-300", slider: "accent-sky-300" },
];

// ─── Break messages ─────────────────────────────────────────
const BREAK_MESSAGES = [
  { emoji: "🌟", title: "Amazing focus session!", body: "You crushed it! Time to stand up, stretch your body, and let your brain breathe. Try recalling the key points you just studied — your memory will thank you." },
  { emoji: "🧠", title: "Your brain earned a rest!", body: "Great work staying locked in. Get up, move around, grab some water. While you stretch, mentally walk through what you just learned — active recall is a superpower." },
  { emoji: "🎯", title: "Focus session complete!", body: "You showed up and did the work — be proud of that. Take a break, look away from your screen, and see if you can summarize what you studied in your own words." },
  { emoji: "💪", title: "That was a solid session!", body: "Time to recharge. Move your body, take deep breaths, and quiz yourself on the material. The effort you put in now will pay off later." },
  { emoji: "✨", title: "Session done — well played!", body: "Rest isn't lazy, it's strategic. Stretch, hydrate, and try to teach what you just learned to an imaginary friend. If you can explain it, you know it." },
];

const FloatingStudyBar = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Timer state
  const [presetIdx, setPresetIdx] = useState(0);
  const [timerMode, setTimerMode] = useState<"work" | "break">("work");
  const [timeLeft, setTimeLeft] = useState(PRESETS[0].work * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Custom timer inputs
  const [customWork, setCustomWork] = useState("30");
  const [customBreak, setCustomBreak] = useState("5");

  // Break modal
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakMessage, setBreakMessage] = useState(BREAK_MESSAGES[0]);
  const [breakCountdownActive, setBreakCountdownActive] = useState(false);
  const [breakMinimized, setBreakMinimized] = useState(false);

  // Audio mixer (Gamma Beats + Isochronic only)
  const { channels, setVolume, toggleChannel, stopAll, isochronicHz, setIsochronicHz } = useAudioMixer();
  // YouTube lofi player
  const ytPlayer = useYouTubePlayer("https://www.youtube.com/watch?v=sF80I-TQiW0");
  const [lofiVolume, setLofiVolume] = useState(0.5);

  // Read aloud state
  const [isReading, setIsReading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>(() =>
    localStorage.getItem("bfn:tts-voice") || ""
  );
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [readSpeed, setReadSpeed] = useState<number>(() =>
    Number(localStorage.getItem("bfn:tts-speed")) || 0.9
  );

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prioritize natural/enhanced voices, then English voices
        const english = voices.filter((v) => v.lang.startsWith("en"));
        const sorted = english.sort((a, b) => {
          // Prefer voices with "Natural", "Enhanced", "Premium", "Google", or "Samantha" in the name
          const aScore = /natural|enhanced|premium|google|samantha|daniel|karen/i.test(a.name) ? 1 : 0;
          const bScore = /natural|enhanced|premium|google|samantha|daniel|karen/i.test(b.name) ? 1 : 0;
          return bScore - aScore;
        });
        setAvailableVoices(sorted);
        // Auto-select the best voice if user hasn't chosen one
        if (!selectedVoiceUri && sorted.length > 0) {
          setSelectedVoiceUri(sorted[0].voiceURI);
          localStorage.setItem("bfn:tts-voice", sorted[0].voiceURI);
        }
      }
    };
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("studybar-position");
    if (saved) {
      try {
        const { x, y } = JSON.parse(saved);
        setPosition({ x, y });
        return;
      } catch {}
    }
    setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 200 });
  }, []);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);

      if (timerMode === "work") {
        setSessions((s) => s + 1);
        // Show break modal with random message
        setBreakMessage(BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)]);
        setShowBreakModal(true);
        // Play gentle chime
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 528;
          osc.type = "sine";
          const g = ctx.createGain();
          g.gain.value = 0.3;
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
          osc.connect(g).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 1.5);
        } catch {}
        // Switch to break mode
        setTimerMode("break");
        const breakMins = presetIdx === 2 ? parseInt(customBreak) || 5 : PRESETS[presetIdx].break;
        setTimeLeft(breakMins * 60);
      } else {
        // Break finished — close modal and switch back to work
        setBreakCountdownActive(false);
        setBreakMinimized(false);
        setShowBreakModal(false);
        setTimerMode("work");
        const workMins = presetIdx === 2 ? parseInt(customWork) || 25 : PRESETS[presetIdx].work;
        setTimeLeft(workMins * 60);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timeLeft, timerMode, presetIdx, customWork, customBreak]);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerMode("work");
    const workMins = presetIdx === 2 ? parseInt(customWork) || 25 : PRESETS[presetIdx].work;
    setTimeLeft(workMins * 60);
  };

  const changePreset = (idx: number) => {
    setPresetIdx(idx);
    setTimerRunning(false);
    setTimerMode("work");
    if (idx === 2) {
      setTimeLeft((parseInt(customWork) || 25) * 60);
    } else {
      setTimeLeft(PRESETS[idx].work * 60);
    }
  };

  const applyCustom = () => {
    setTimerRunning(false);
    setTimerMode("work");
    setTimeLeft((parseInt(customWork) || 25) * 60);
  };

  // Read aloud with selected voice
  const handleReadAloud = () => {
    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      return;
    }
    const notes = document.querySelector(".generated-notes");
    if (!notes) return;
    const text = notes.textContent || "";
    if (!text.trim()) return;
    const utt = new SpeechSynthesisUtterance(text.slice(0, 5000));
    utt.rate = readSpeed;
    // Apply selected voice
    if (selectedVoiceUri) {
      const voice = availableVoices.find((v) => v.voiceURI === selectedVoiceUri);
      if (voice) utt.voice = voice;
    }
    utt.onend = () => setIsReading(false);
    setIsReading(true);
    speechSynthesis.speak(utt);
  };

  // Preview a voice with a short sample
  const previewVoice = (voiceUri: string) => {
    speechSynthesis.cancel();
    const voice = availableVoices.find((v) => v.voiceURI === voiceUri);
    if (!voice) return;
    const utt = new SpeechSynthesisUtterance("This is how your notes will sound with this voice.");
    utt.voice = voice;
    utt.rate = readSpeed;
    speechSynthesis.speak(utt);
  };

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const newX = dragStart.current.posX + dx;
    const newY = dragStart.current.posY + dy;
    // 10px buffer so the bar can't be dragged completely off-screen
    const clampedX = Math.max(-window.innerWidth + 10, Math.min(window.innerWidth - 10, newX));
    const clampedY = Math.max(-window.innerHeight + 10, Math.min(window.innerHeight - 10, newY));
    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    localStorage.setItem("studybar-position", JSON.stringify(position));
  }, [position]);

  // Timer progress
  const totalTime = (() => {
    if (presetIdx === 2) {
      return timerMode === "work" ? (parseInt(customWork) || 25) * 60 : (parseInt(customBreak) || 5) * 60;
    }
    return timerMode === "work" ? PRESETS[presetIdx].work * 60 : PRESETS[presetIdx].break * 60;
  })();
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  const toolButtons = [
    { id: "music", label: "Music Mixer", icon: Music, color: "text-peach-500", bg: "bg-peach-100 dark:bg-peach-500/10", activeBg: "bg-peach-200 ring-2 ring-peach-300 dark:bg-peach-500/20" },
    { id: "timer", label: "Focus Timer", icon: Timer, color: "text-lavender-500", bg: "bg-lavender-100 dark:bg-lavender-500/10", activeBg: "bg-lavender-200 ring-2 ring-lavender-300 dark:bg-lavender-500/20" },
    { id: "read", label: "Read Aloud", icon: Volume2, color: "text-sage-600", bg: "bg-sage-100 dark:bg-sage-700/20", activeBg: "bg-sage-200 ring-2 ring-sage-300 dark:bg-sage-700/30" },
  ];

  return (
    <>
      {/* ─── Break Notification Modal ─── */}
      {/* ─── Minimized Break Pill ─── */}
      <AnimatePresence>
        {breakMinimized && breakCountdownActive && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            onClick={() => { setBreakMinimized(false); setShowBreakModal(true); }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] flex items-center gap-2.5 rounded-full border border-border/60 bg-card/95 px-5 py-2.5 shadow-xl backdrop-blur-xl transition-transform"
          >
            <span className="text-lg">{breakMessage.emoji}</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{formatTime(timeLeft)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Break</span>
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Break Notification Modal ─── */}
      <AnimatePresence>
        {showBreakModal && !breakMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!breakCountdownActive) { setShowBreakModal(false); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 max-w-sm rounded-3xl border border-border/60 bg-card p-8 shadow-2xl text-center"
            >
              <div className="text-5xl mb-4">{breakMessage.emoji}</div>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Sparkles className="h-4 w-4 text-lavender-400" />
                <h2 className="text-lg font-bold text-foreground">{breakMessage.title}</h2>
                <Sparkles className="h-4 w-4 text-lavender-400" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {breakMessage.body}
              </p>

              {/* Break countdown */}
              {breakCountdownActive && (
                <div className="mb-4 rounded-2xl bg-muted/40 py-3 px-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Break Time Remaining</p>
                  <p className="text-2xl font-extrabold tabular-nums text-foreground">{formatTime(timeLeft)}</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {!breakCountdownActive ? (
                  <>
                    <button
                      onClick={() => {
                        setBreakCountdownActive(true);
                        setTimerRunning(true);
                      }}
                      className="w-full rounded-xl bg-lavender-200 py-2.5 text-sm font-semibold text-lavender-600 transition-colors hover:bg-lavender-300 dark:bg-lavender-500/20 dark:text-lavender-300 dark:hover:bg-lavender-500/30"
                    >
                      Start Break Timer
                    </button>
                    <button
                      onClick={() => { setShowBreakModal(false); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setBreakMinimized(true);
                        setShowBreakModal(false);
                      }}
                      className="w-full rounded-xl bg-muted/60 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Minimize
                    </button>
                    <button
                      onClick={() => {
                        setBreakCountdownActive(false);
                        setBreakMinimized(false);
                        setShowBreakModal(false);
                        setTimerRunning(false);
                        setTimerMode("work");
                        const workMins = presetIdx === 2 ? parseInt(customWork) || 25 : PRESETS[presetIdx].work;
                        setTimeLeft(workMins * 60);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      End Break Early
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Floating Bar ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ left: position.x, top: position.y, position: "fixed", zIndex: 50 }}
        className="select-none"
      >
        <div className="flex gap-2">
          {/* Main bar */}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-1">
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="flex flex-1 cursor-grab items-center justify-center rounded-lg py-1 text-muted-foreground/50 hover:bg-muted/50 hover:text-muted-foreground active:cursor-grabbing touch-none"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <button
                onClick={() => setMinimized(!minimized)}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50 hover:text-muted-foreground transition-colors"
              >
                {minimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            <AnimatePresence>
              {!minimized && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1.5 overflow-hidden"
                >
                  {toolButtons.map((tool) => (
                    <div key={tool.id} className="relative">
                      <button
                        onClick={() => {
                          if (tool.id === "read") {
                            handleReadAloud();
                          } else {
                            setActiveTool(activeTool === tool.id ? null : tool.id);
                          }
                        }}
                        title={tool.label}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                          (activeTool === tool.id || (tool.id === "read" && isReading))
                            ? tool.activeBg
                            : `${tool.bg}`
                        }`}
                      >
                        <tool.icon className={`h-4 w-4 ${tool.color}`} />
                      </button>
                      {tool.id === "read" && (
                        <button
                          onClick={() => setActiveTool(activeTool === "voice-settings" ? null : "voice-settings")}
                          title="Voice settings"
                          className={`absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-colors ${activeTool === "voice-settings" ? "ring-1 ring-primary" : ""}`}
                        >
                          <Settings2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Expanded panel */}
          <AnimatePresence>
            {activeTool && !minimized && (
              <motion.div
                initial={{ opacity: 0, x: -8, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-xl overflow-hidden"
                style={{ width: 240 }}
              >
                {/* ─── Timer Panel ─── */}
                {activeTool === "timer" && (
                  <div className="p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-lavender-500 mb-3">
                      Focus Timer
                    </div>

                    {/* Presets */}
                    <div className="flex gap-1.5 mb-3">
                      {PRESETS.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => changePreset(i)}
                          className={`flex-1 rounded-lg py-1 text-[10px] font-medium transition-colors ${
                            presetIdx === i
                              ? "bg-lavender-200 text-lavender-500 dark:bg-lavender-500/20"
                              : "bg-muted text-muted-foreground hover:bg-lavender-100 dark:hover:bg-lavender-500/10"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom inputs */}
                    {presetIdx === 2 && (
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1">
                          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Focus min</label>
                          <input
                            id="floating-timer-focus-min"
                            name="floatingTimerFocusMin"
                            type="number"
                            min="1"
                            max="120"
                            value={customWork}
                            onChange={(e) => setCustomWork(e.target.value)}
                            onBlur={applyCustom}
                            className="w-full mt-0.5 rounded-lg border border-border/60 bg-muted px-2 py-1 text-xs text-foreground text-center outline-none focus:ring-1 focus:ring-lavender-300"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Break min</label>
                          <input
                            id="floating-timer-break-min"
                            name="floatingTimerBreakMin"
                            type="number"
                            min="1"
                            max="30"
                            value={customBreak}
                            onChange={(e) => setCustomBreak(e.target.value)}
                            onBlur={applyCustom}
                            className="w-full mt-0.5 rounded-lg border border-border/60 bg-muted px-2 py-1 text-xs text-foreground text-center outline-none focus:ring-1 focus:ring-lavender-300"
                          />
                        </div>
                      </div>
                    )}

                    {/* Progress ring + time */}
                    <div className="relative flex items-center justify-center mb-3">
                      <svg width="100" height="100" className="rotate-[-90deg]">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke={timerMode === "work" ? "hsl(var(--lavender-400))" : "hsl(var(--sage-400))"}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 42}`}
                          strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <div className="text-2xl font-bold text-foreground tabular-nums">
                          {formatTime(timeLeft)}
                        </div>
                        <div className={`text-[9px] font-semibold uppercase tracking-wider ${
                          timerMode === "work" ? "text-lavender-400" : "text-sage-500"
                        }`}>
                          {timerMode === "work" ? "Focus" : "Break"}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setTimerRunning(!timerRunning)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-200 text-lavender-500 transition-colors hover:bg-lavender-300 dark:bg-lavender-500/20 dark:hover:bg-lavender-500/30"
                      >
                        {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                      </button>
                      <button
                        onClick={resetTimer}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {sessions > 0 && (
                      <div className="mt-3 text-center text-[10px] text-muted-foreground">
                        {sessions} session{sessions !== 1 ? "s" : ""} completed 🎯
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Read Aloud Voice Settings Panel ─── */}
                {activeTool === "voice-settings" && (
                  <div className="p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sage-500 mb-3">
                      Voice Settings
                    </div>

                    {/* Voice selector */}
                    {availableVoices.length > 0 && (
                      <div className="mb-3">
                        <label className="text-[11px] text-muted-foreground mb-1 block">Voice</label>
                        <select
                          value={selectedVoiceUri}
                          onChange={(e) => {
                            setSelectedVoiceUri(e.target.value);
                            localStorage.setItem("bfn:tts-voice", e.target.value);
                            previewVoice(e.target.value);
                          }}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                        >
                          {availableVoices.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              {v.name}{v.localService ? "" : " (online)"}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Speed slider */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">Speed</span>
                        <span className="text-[11px] font-medium text-foreground">{readSpeed.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range" min="0.5" max="2.0" step="0.1" value={readSpeed}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setReadSpeed(v);
                          localStorage.setItem("bfn:tts-speed", String(v));
                        }}
                        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-sage-500"
                      />
                    </div>

                    <button
                      onClick={handleReadAloud}
                      className="w-full rounded-lg bg-sage-100 dark:bg-sage-500/15 py-2 text-xs font-semibold text-sage-600 dark:text-sage-300 hover:bg-sage-200 transition-colors"
                    >
                      Start Reading
                    </button>
                  </div>
                )}

                {/* ─── Music Mixer Panel ─── */}
                {activeTool === "music" && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-peach-500">
                        Audio Mixer
                      </div>
                      {(channels.some((c) => c.playing) || ytPlayer.isPlaying) && (
                        <button
                          onClick={() => { stopAll(); ytPlayer.stop(); }}
                          className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                          Stop All
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* YouTube Lofi Channel */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => ytPlayer.isPlaying ? ytPlayer.pause() : ytPlayer.play()}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                                ytPlayer.isPlaying
                                  ? "bg-peach-200 ring-2 ring-peach-300 dark:bg-peach-500/20"
                                  : "bg-peach-100 dark:bg-peach-500/10"
                              }`}
                            >
                              <Youtube className="h-3.5 w-3.5 text-peach-500" />
                            </button>
                            <span className="text-xs font-medium text-foreground">Lofi Radio</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {ytPlayer.isPlaying && (
                              <button
                                onClick={() => ytPlayer.nextTrack()}
                                title="Next track"
                                className="mr-1 flex h-5 w-5 items-center justify-center rounded-md hover:bg-muted transition-colors"
                              >
                                <SkipForward className="h-3 w-3" />
                              </button>
                            )}
                            {lofiVolume === 0 ? <VolumeX className="h-3 w-3" /> : <Volume1 className="h-3 w-3" />}
                            <span className="text-[10px] tabular-nums w-6 text-right">{Math.round(lofiVolume * 100)}</span>
                          </div>
                        </div>
                        <input
                          id="floating-lofi-volume"
                          name="floatingLofiVolume"
                          type="range" min="0" max="1" step="0.01" value={lofiVolume}
                          onChange={(e) => { const v = parseFloat(e.target.value); setLofiVolume(v); ytPlayer.setVolume(v); }}
                          className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-current text-peach-500"
                        />
                      </div>

                      {/* Gamma Beats & Isochronic Channels */}
                      {channels.map((ch, i) => {
                        const Icon = CHANNEL_ICONS[i];
                        const colors = CHANNEL_COLORS[i];
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleChannel(i)}
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                                    ch.playing ? `${colors.active} ring-2` : `${colors.inactive}`
                                  }`}
                                >
                                  <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                                </button>
                                <span className="text-xs font-medium text-foreground">{ch.name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                {ch.volume === 0 ? <VolumeX className="h-3 w-3" /> : <Volume1 className="h-3 w-3" />}
                                <span className="text-[10px] tabular-nums w-6 text-right">{Math.round(ch.volume * 100)}</span>
                              </div>
                            </div>
                            <input
                              id={`floating-channel-volume-${i}`}
                              name={`floatingChannelVolume${i}`}
                              type="range" min="0" max="1" step="0.01" value={ch.volume}
                              onChange={(e) => setVolume(i, parseFloat(e.target.value))}
                              className={`w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-current ${colors.text}`}
                            />
                            {/* Isochronic Hz selector */}
                            {i === 1 && ch.playing && (
                              <div className="flex gap-1 mt-1">
                                {ISOCHRONIC_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.hz}
                                    onClick={() => setIsochronicHz(opt.hz)}
                                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                                      isochronicHz === opt.hz
                                        ? "bg-sky-200 text-sky-700 dark:bg-sky-300/20 dark:text-sky-200"
                                        : "bg-muted text-muted-foreground hover:bg-sky-100 dark:hover:bg-sky-300/10"
                                    }`}
                                    title={opt.description}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>



                    <div className="mt-3 pt-2 border-t border-border/60">
                      <p className="text-[9px] text-muted-foreground leading-relaxed">
                        🎧 Gamma Beats require headphones for the entrainment effect.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      <div ref={ytPlayer.containerRef} className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none" />
    </>
  );
};

export default FloatingStudyBar;
