import { Slider } from "@/components/ui/slider";
import { Settings2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DyslexiaSettingsValues {
  lineSpacing: number;
  fontSize: number;
  letterSpacing: number;
  wordSpacing: number;
}

interface DyslexiaSettingsProps {
  settings: DyslexiaSettingsValues;
  onChange: (settings: DyslexiaSettingsValues) => void;
}

const DyslexiaSettings = ({ settings, onChange }: DyslexiaSettingsProps) => {
  const update = (key: keyof DyslexiaSettingsValues, value: number) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-lavender-300 hover:text-foreground transition-all">
          <Settings2 className="h-3.5 w-3.5" />
          Settings
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4" align="start">
        <h4 className="text-sm font-semibold text-foreground">Reading Comfort Settings</h4>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Line Spacing</label>
              <span className="text-xs text-foreground font-mono">{settings.lineSpacing.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.lineSpacing]}
              onValueChange={([v]) => update("lineSpacing", v)}
              min={1.2}
              max={2.5}
              step={0.1}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Font Size</label>
              <span className="text-xs text-foreground font-mono">{settings.fontSize.toFixed(1)}rem</span>
            </div>
            <Slider
              value={[settings.fontSize]}
              onValueChange={([v]) => update("fontSize", v)}
              min={0.9}
              max={1.6}
              step={0.05}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Letter Spacing</label>
              <span className="text-xs text-foreground font-mono">{settings.letterSpacing.toFixed(2)}em</span>
            </div>
            <Slider
              value={[settings.letterSpacing]}
              onValueChange={([v]) => update("letterSpacing", v)}
              min={0}
              max={0.12}
              step={0.01}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Word Spacing</label>
              <span className="text-xs text-foreground font-mono">{settings.wordSpacing.toFixed(2)}em</span>
            </div>
            <Slider
              value={[settings.wordSpacing]}
              onValueChange={([v]) => update("wordSpacing", v)}
              min={0}
              max={0.5}
              step={0.02}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DyslexiaSettings;
