import React, { useState, useEffect } from 'react';
import {
  useGetPresets,
  useGetDmxState,
  useUpdatePreset,
  useCapturePreset,
  useUpdatePresetTimer,
  useHardwareFaderInput,
  useLoadScene,
  getGetPresetsQueryKey,
  getGetDmxStateQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wind, Lightbulb, Disc, Clock, Download, Play, Save } from 'lucide-react';
import { toast } from 'sonner';

const POSITION_LABELS = ['SCHMERZ MAX', 'OPIOID LOW', 'OPIOID HIGH', 'NSAR LOW', 'NSAR HIGH'];
const POSITION_COLORS = [
  'text-red-400 border-red-900 data-[state=active]:bg-red-950 data-[state=active]:text-red-300',
  'text-purple-400 border-purple-900 data-[state=active]:bg-purple-950 data-[state=active]:text-purple-300',
  'text-blue-400 border-blue-900 data-[state=active]:bg-blue-950 data-[state=active]:text-blue-300',
  'text-emerald-400 border-emerald-900 data-[state=active]:bg-emerald-950 data-[state=active]:text-emerald-300',
  'text-green-400 border-green-900 data-[state=active]:bg-green-950 data-[state=active]:text-green-300',
  'text-zinc-400 border-zinc-700 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200',
];

interface PresetValues {
  name: string;
  fan: { speed: number; enabled: boolean };
  ledMatrix: { r: number; g: number; b: number; brightness: number; pattern: number; enabled: boolean };
  ledStrip1: { r: number; g: number; b: number; brightness: number; enabled: boolean };
  ledStrip2: { r: number; g: number; b: number; brightness: number; enabled: boolean };
  disc: { speed: number; direction: 'cw' | 'ccw' | 'stop'; enabled: boolean };
}

function ColorSwatch({ r, g, b, enabled }: { r: number; g: number; b: number; enabled: boolean }) {
  return (
    <div
      className="w-6 h-6 rounded-sm border border-zinc-700 shrink-0"
      style={{
        backgroundColor: enabled ? `rgb(${r},${g},${b})` : 'transparent',
        opacity: enabled ? 0.9 : 0.2,
      }}
    />
  );
}

function CompactSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-mono w-7 shrink-0 ${color ?? 'text-zinc-500'}`}>{label}</span>
      <Slider value={[value]} min={0} max={255} step={1} onValueChange={([v]) => onChange(v)} className="flex-1" />
      <span className="font-mono text-[10px] w-7 text-right text-zinc-500">{value}</span>
    </div>
  );
}

function PresetCard({
  positionKey,
  label,
  preset,
  onSave,
  onCapture,
  onApply,
  isSaving,
  isCapturing,
}: {
  positionKey: string;
  label: string;
  preset: PresetValues;
  onSave: (v: PresetValues) => void;
  onCapture: () => void;
  onApply: () => void;
  isSaving: boolean;
  isCapturing: boolean;
}) {
  const [local, setLocal] = useState<PresetValues>(preset);
  const [syncStrips, setSyncStrips] = useState(false);

  useEffect(() => {
    setLocal(preset);
  }, [preset]);

  const updateFan = (k: keyof typeof local.fan, v: number | boolean) =>
    setLocal((p) => ({ ...p, fan: { ...p.fan, [k]: v } }));

  const updateMatrix = (k: keyof typeof local.ledMatrix, v: number | boolean) =>
    setLocal((p) => ({ ...p, ledMatrix: { ...p.ledMatrix, [k]: v } }));

  const updateStrip1 = (k: keyof typeof local.ledStrip1, v: number | boolean) => {
    setLocal((p) => {
      const s1 = { ...p.ledStrip1, [k]: v };
      return { ...p, ledStrip1: s1, ledStrip2: syncStrips ? { ...p.ledStrip2, ...s1 } : p.ledStrip2 };
    });
  };

  const updateStrip2 = (k: keyof typeof local.ledStrip2, v: number | boolean) =>
    setLocal((p) => ({ ...p, ledStrip2: { ...p.ledStrip2, [k]: v } }));

  const updateDisc = (k: keyof typeof local.disc, v: number | boolean | string) =>
    setLocal((p) => ({ ...p, disc: { ...p.disc, [k]: v } }));

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="flex items-center gap-3">
        <Label className="text-[10px] font-mono text-zinc-500 shrink-0">NAME</Label>
        <Input
          value={local.name}
          onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
          className="h-7 text-xs font-mono bg-black border-zinc-800"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Fan */}
        <div className="space-y-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
              <Wind className="w-3 h-3" /> FAN
            </span>
            <Switch
              checked={local.fan.enabled}
              onCheckedChange={(v) => updateFan('enabled', v)}
              className="scale-75"
            />
          </div>
          <CompactSlider
            label="SPD"
            value={local.fan.speed}
            onChange={(v) => updateFan('speed', v)}
            color="text-zinc-400"
          />
        </div>

        {/* Disc */}
        <div className="space-y-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
              <Disc className="w-3 h-3" /> DISC DRIVE
            </span>
            <Switch
              checked={local.disc.enabled}
              onCheckedChange={(v) => updateDisc('enabled', v)}
              className="scale-75"
            />
          </div>
          <CompactSlider
            label="SPD"
            value={local.disc.speed}
            onChange={(v) => updateDisc('speed', v)}
            color="text-zinc-400"
          />
          <div className="flex gap-1">
            {(['ccw', 'stop', 'cw'] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                onClick={() => updateDisc('direction', d)}
                className={`flex-1 h-6 text-[9px] font-mono tracking-widest rounded-sm ${
                  local.disc.direction === d
                    ? d === 'stop'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-primary text-black border-primary'
                    : 'bg-black border-zinc-800 text-zinc-600 hover:text-zinc-300'
                }`}
                variant="outline"
              >
                {d.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* LED Matrix */}
        <div className="space-y-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3" /> LED MATRIX
              </span>
              <ColorSwatch r={local.ledMatrix.r} g={local.ledMatrix.g} b={local.ledMatrix.b} enabled={local.ledMatrix.enabled} />
            </div>
            <Switch
              checked={local.ledMatrix.enabled}
              onCheckedChange={(v) => updateMatrix('enabled', v)}
              className="scale-75"
            />
          </div>
          <CompactSlider label="R" value={local.ledMatrix.r} onChange={(v) => updateMatrix('r', v)} color="text-red-500" />
          <CompactSlider label="G" value={local.ledMatrix.g} onChange={(v) => updateMatrix('g', v)} color="text-green-500" />
          <CompactSlider label="B" value={local.ledMatrix.b} onChange={(v) => updateMatrix('b', v)} color="text-blue-500" />
          <CompactSlider label="LUM" value={local.ledMatrix.brightness} onChange={(v) => updateMatrix('brightness', v)} color="text-zinc-400" />
          <CompactSlider label="PAT" value={local.ledMatrix.pattern} onChange={(v) => updateMatrix('pattern', v)} color="text-zinc-500" />
        </div>

        {/* LED Strips */}
        <div className="space-y-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3" /> LED STRIPS
              </span>
              <ColorSwatch r={local.ledStrip1.r} g={local.ledStrip1.g} b={local.ledStrip1.b} enabled={local.ledStrip1.enabled} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSyncStrips((v) => !v)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  syncStrips ? 'border-primary text-primary bg-primary/10' : 'border-zinc-700 text-zinc-600'
                }`}
              >
                SYNC
              </button>
              <Switch
                checked={local.ledStrip1.enabled}
                onCheckedChange={(v) => {
                  updateStrip1('enabled', v);
                  if (syncStrips) updateStrip2('enabled', v);
                }}
                className="scale-75"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono text-zinc-600">STRIP 1</span>
              <CompactSlider label="R" value={local.ledStrip1.r} onChange={(v) => updateStrip1('r', v)} color="text-red-500" />
              <CompactSlider label="G" value={local.ledStrip1.g} onChange={(v) => updateStrip1('g', v)} color="text-green-500" />
              <CompactSlider label="B" value={local.ledStrip1.b} onChange={(v) => updateStrip1('b', v)} color="text-blue-500" />
              <CompactSlider label="LUM" value={local.ledStrip1.brightness} onChange={(v) => updateStrip1('brightness', v)} color="text-zinc-400" />
            </div>
            <div className={`space-y-1.5 ${syncStrips ? 'opacity-30 pointer-events-none' : ''}`}>
              <span className="text-[9px] font-mono text-zinc-600">STRIP 2</span>
              <CompactSlider label="R" value={local.ledStrip2.r} onChange={(v) => updateStrip2('r', v)} color="text-red-500" />
              <CompactSlider label="G" value={local.ledStrip2.g} onChange={(v) => updateStrip2('g', v)} color="text-green-500" />
              <CompactSlider label="B" value={local.ledStrip2.b} onChange={(v) => updateStrip2('b', v)} color="text-blue-500" />
              <CompactSlider label="LUM" value={local.ledStrip2.brightness} onChange={(v) => updateStrip2('brightness', v)} color="text-zinc-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 font-mono text-[10px] tracking-widest border-zinc-700 bg-black text-zinc-400 hover:bg-zinc-900 hover:text-white rounded-sm h-8"
          onClick={onCapture}
          disabled={isCapturing}
        >
          <Download className="w-3 h-3 mr-1.5" />
          {isCapturing ? 'CAPTURING...' : 'CAPTURE FROM LIVE'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 font-mono text-[10px] tracking-widest border-zinc-700 bg-black text-zinc-400 hover:bg-zinc-900 hover:text-white rounded-sm h-8"
          onClick={() => onSave(local)}
          disabled={isSaving}
        >
          <Save className="w-3 h-3 mr-1.5" />
          {isSaving ? 'SAVING...' : 'SAVE PRESET'}
        </Button>
        <Button
          size="sm"
          className="flex-1 font-mono text-[10px] tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm h-8 font-bold"
          onClick={onApply}
        >
          <Play className="w-3 h-3 mr-1.5" />
          APPLY TO LIVE
        </Button>
      </div>
    </div>
  );
}

export default function PresetEditor() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('0');
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [timerEnabled, setTimerEnabled] = useState(true);

  const { data: presetsState } = useGetPresets({ query: { queryKey: getGetPresetsQueryKey(), refetchInterval: 2000 } });
  const { data: dmxState } = useGetDmxState({ query: { queryKey: getGetDmxStateQueryKey(), refetchInterval: 500 } });
  const activePosition = dmxState?.painFader.position ?? -1;
  const isIdleActive = dmxState?.mode === 'idle';

  const updatePreset = useUpdatePreset();
  const capturePreset = useCapturePreset();
  const updateTimer = useUpdatePresetTimer();
  const applyFader = useHardwareFaderInput();
  const loadScene = useLoadScene();

  useEffect(() => {
    if (presetsState) {
      setTimerSeconds(presetsState.idleTimerSeconds);
      setTimerEnabled(presetsState.idleTimerEnabled);
    }
  }, [presetsState?.idleTimerSeconds, presetsState?.idleTimerEnabled]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetPresetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDmxStateQueryKey() });
  };

  const handleSave = (position: string, values: PresetValues) => {
    updatePreset.mutate(
      { position, data: values },
      {
        onSuccess: () => {
          toast.success(`Preset ${position.toUpperCase()} saved`);
          invalidate();
        },
        onError: () => toast.error('Failed to save preset'),
      }
    );
  };

  const handleCapture = (position: string) => {
    capturePreset.mutate(
      { position },
      {
        onSuccess: () => {
          toast.success(`Live state captured as preset ${position.toUpperCase()}`);
          invalidate();
        },
        onError: () => toast.error('Capture failed'),
      }
    );
  };

  const handleApply = (position: string) => {
    if (position === 'idle') {
      loadScene.mutate({ data: { scene: 'idle' } }, { onSuccess: invalidate });
    } else {
      applyFader.mutate(
        { data: { position: parseInt(position, 10) } },
        { onSuccess: invalidate }
      );
    }
    toast.success(`Preset ${position.toUpperCase()} applied to live`);
  };

  const handleSaveTimer = () => {
    updateTimer.mutate(
      { data: { timerSeconds, enabled: timerEnabled } },
      {
        onSuccess: () => {
          toast.success('Timer config saved');
          invalidate();
        },
      }
    );
  };

  if (!presetsState) {
    return (
      <div className="flex items-center justify-center h-64 font-mono text-[10px] text-zinc-600 tracking-widest">
        LOADING PRESETS...
      </div>
    );
  }

  const SCENE_MAP: Record<string, 'warmup' | 'experience_low' | 'experience_mid' | 'experience_high'> = {
    '1': 'warmup',
    '2': 'experience_low',
    '3': 'experience_mid',
    '4': 'experience_high',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-zinc-500 tracking-widest">
          FADER POSITION PRESETS — each position fires automatically when hardware fader is pushed
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-black border border-zinc-800 rounded-sm p-1 h-auto flex-wrap gap-1 w-full justify-start">
          {[0, 1, 2, 3, 4].map((pos) => {
            const isLive = activePosition === pos;
            return (
              <TabsTrigger
                key={pos}
                value={String(pos)}
                className={`font-mono text-[10px] tracking-widest rounded-sm px-3 py-1.5 border ${POSITION_COLORS[pos]} ${isLive ? 'ring-1 ring-inset ring-current' : ''}`}
              >
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse shrink-0" />}
                <span className="font-black mr-1.5">{pos}</span>
                {POSITION_LABELS[pos]}
              </TabsTrigger>
            );
          })}
          <TabsTrigger
            value="idle"
            className={`font-mono text-[10px] tracking-widest rounded-sm px-3 py-1.5 border ${POSITION_COLORS[5]} ${isIdleActive ? 'ring-1 ring-inset ring-current' : ''}`}
          >
            {isIdleActive && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse shrink-0" />}
            <Clock className="w-3 h-3 mr-1.5" />
            IDLE (TIMER)
          </TabsTrigger>
        </TabsList>

        {[0, 1, 2, 3, 4].map((pos) => {
          const preset = presetsState.positions[pos];
          if (!preset) return null;
          return (
            <TabsContent key={pos} value={String(pos)} className="mt-4">
              <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] py-3">
                  <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                    <span className={`font-black text-sm ${POSITION_COLORS[pos].split(' ')[0]}`}>{pos}</span>
                    {POSITION_LABELS[pos]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <PresetCard
                    positionKey={String(pos)}
                    label={POSITION_LABELS[pos]}
                    preset={preset as PresetValues}
                    onSave={(v) => handleSave(String(pos), v)}
                    onCapture={() => handleCapture(String(pos))}
                    onApply={() => handleApply(String(pos))}
                    isSaving={updatePreset.isPending}
                    isCapturing={capturePreset.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        <TabsContent value="idle" className="mt-4 space-y-4">
          <Card className="bg-[#111113] border-zinc-800 rounded-sm">
            <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] py-3">
              <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                <Clock className="w-4 h-4" /> IDLE PRESET + TIMER CONFIG
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="bg-[#0a0a0c] border border-zinc-800 rounded-sm p-3 text-xs font-mono text-zinc-500 leading-relaxed">
                When the spring returns the fader to <span className="text-primary">position 0</span>, the idle timer starts counting down.
                After <span className="text-primary">{timerSeconds}s</span> of inactivity at position 0, this idle preset fires automatically.
              </div>

              {/* Timer config */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm">
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono text-zinc-500">TIMER DURATION (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 font-mono text-sm bg-black border-zinc-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono text-zinc-500">TIMER ENABLED</Label>
                  <div className="flex items-center gap-3 h-8">
                    <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                    <span className={`text-[10px] font-mono ${timerEnabled ? 'text-primary' : 'text-zinc-600'}`}>
                      {timerEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveTimer}
                variant="secondary"
                size="sm"
                disabled={updateTimer.isPending}
                className="font-mono text-[10px] tracking-widest bg-zinc-800 hover:bg-zinc-700 rounded-sm h-7"
              >
                {updateTimer.isPending ? 'SAVING...' : 'SAVE TIMER CONFIG'}
              </Button>

              <div className="border-t border-zinc-800 pt-4">
                <PresetCard
                  positionKey="idle"
                  label="IDLE"
                  preset={presetsState.idlePreset as PresetValues}
                  onSave={(v) => handleSave('idle', v)}
                  onCapture={() => handleCapture('idle')}
                  onApply={() => handleApply('idle')}
                  isSaving={updatePreset.isPending}
                  isCapturing={capturePreset.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
