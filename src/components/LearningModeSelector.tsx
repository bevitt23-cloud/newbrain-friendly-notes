import { Glasses } from "lucide-react";

interface LearningModeSelectorProps {
  selectedMode: string;
  onModeChange: (mode: string) => void;
  bionicEnabled: boolean;
  onBionicChange: (enabled: boolean) => void;
}

const FONT_OPTIONS = [
  {
    mode: "adhd",
    label: "abc",
    font: "'Lexend', sans-serif",
    activeClass: "bg-sage-100 text-sage-700 shadow-sm ring-1 ring-sage-300/50 dark:bg-sage-500/20 dark:text-sage-300 dark:ring-sage-400/30",
  },
  {
    mode: "dyslexia",
    label: "abc",
    font: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
    activeClass: "bg-lavender-100 text-lavender-600 shadow-sm ring-1 ring-lavender-300/50 dark:bg-lavender-500/20 dark:text-lavender-300 dark:ring-lavender-400/30",
  },
  {
    mode: "neurotypical",
    label: "abc",
    font: "'Arial', 'Helvetica Neue', sans-serif",
    activeClass: "bg-sky-100 text-sky-700 shadow-sm ring-1 ring-sky-300/50 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-400/30",
  },
] as const;

const LearningModeSelector = ({ selectedMode, onModeChange, bionicEnabled, onBionicChange }: LearningModeSelectorProps) => {
  return (
    <div className="flex items-center gap-3">
      {/* Font style toggle */}
      <div className="flex rounded-xl bg-muted/60 p-1 ring-1 ring-border/40">
        {FONT_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => onModeChange(opt.mode)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              selectedMode === opt.mode
                ? opt.activeClass
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: opt.font }}
            title={opt.mode === "adhd" ? "Lexend" : opt.mode === "dyslexia" ? "OpenDyslexic" : "Arial"}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Bionic toggle — can be combined with any font */}
      <button
        onClick={() => onBionicChange(!bionicEnabled)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
          bionicEnabled
            ? "border-peach-300 bg-peach-100 text-peach-600 shadow-sm ring-1 ring-peach-300/40 dark:border-peach-300/30 dark:bg-peach-500/15 dark:text-peach-300"
            : "border-border bg-card text-muted-foreground hover:border-peach-200 hover:text-foreground"
        }`}
      >
        <Glasses className="h-3.5 w-3.5" />
        Bionic
      </button>
    </div>
  );
};

export default LearningModeSelector;
