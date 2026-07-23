/**
 * Preset editor — edit the 4 zone patterns, fan, motor, screen, and idle timer
 * for each of the 3 lever positions (NSAR / SCHMERZ / OPIAT) and the IDLE preset.
 *
 * Data model (post hardware rework):
 *   Each preset stores ZonePattern objects (type + primaryColor + secondaryColor +
 *   brightness + speed + enabled) instead of raw RGBA values.
 */

import { useState, useEffect } from 'react';
import {
  useGetDmxState,
  useGetPresets,
  useUpdatePreset,
  useCapturePreset,
  useApplyPreset,
  useUpdatePresetTimer,
  getGetPresetsQueryKey,
  getGetDmxStateQueryKey,
} from '@workspace/api-client-react';
import type { ZonePattern, PatternType, FaderPreset } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wind, Lightbulb, Monitor, ChevronsUpDown, Clock, Waves } from 'lucide-react';
import { toast } from 'sonner';

// ─── Pattern types ────────────────────────────────────────────────────────────

const PATTERN_TYPES: PatternType[] = ['solid', 'pulse', 'chase', 'wave', 'sparkle'];
const PATTERN_ICONS: Record<string, React.ReactNode> = {
  solid:   <span className="text-[8px]">■</span>,
  pulse:   <span className="text-[8px]">◐</span>,
  chase:   <span className="text-[8px]">►</span>,
  wave:    <Waves className="w-2.5 h-2.5" />,
  sparkle: <span className="text-[8px]">✦</span>,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ZoneName = 'haube' | 'schmerz' | 'nsar' | 'opiat';

interface PresetValues {
  name: string;
  fan: { speed: number; enabled: boolean };
  haube:   ZonePattern;
  schmerz: ZonePattern;
  nsar:    ZonePattern;
  opiat:   ZonePattern;
  motor: { position: 'up' | 'down' | 'stop'; speed: number; enabled: boolean };
  screen: { videoFile: string; enabled: boolean };
}

const DEFAULT_ZONE: ZonePattern = {
  type: 'solid',
  primaryColor:   { r: 0, g: 0, b: 0 },
  secondaryColor: { r: 0, g: 0, b: 0 },
  brightness: 0,
  speed: 64,
  enabled: false,
};

const DEFAULT_PRESET: PresetValues = {
  name: '',
  fan:    { speed: 0, enabled: false },
  haube:   { ...DEFAULT_ZONE },
  schmerz: { ...DEFAULT_ZONE },
  nsar:    { ...DEFAULT_ZONE },
  opiat:   { ...DEFAULT_ZONE },
  motor:  { position: 'stop', speed: 3000, enabled: false },
  screen: { videoFile: 'idle.mp4', enabled: false },
};

function mergePreset(raw: unknown): PresetValues {
  const p = (raw ?? {}) as Partial<PresetValues>;
  return {
    ...DEFAULT_PRESET,
    ...p,
    haube:   { ...DEFAULT_ZONE, ...(p.haube   ?? {}) },
    schmerz: { ...DEFAULT_ZONE, ...(p.schmerz ?? {}) },
    nsar:    { ...DEFAULT_ZONE, ...(p.nsar    ?? {}) },
    opiat:   { ...DEFAULT_ZONE, ...(p.opiat   ?? {}) },
    motor:  { ...DEFAULT_PRESET.motor,  ...(p.motor  ?? {}) },
    screen: { ...DEFAULT_PRESET.screen, ...(p.screen ?? {}) },
  };
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const LEVER_POSITIONS = [
  { key: '-1', label: 'NSAR',    shortLabel: 'N',  idx: 0 },
  { key: '0',  label: 'SCHMERZ', shortLabel: '0',  idx: 1 },
  { key: '1',  label: 'OPIAT',   shortLabel: 'O',  idx: 2 },
] as const;

const POS_COLORS: Record<string, string> = {
  '-1': 'border-blue-800 text-blue-400 data-[state=active]:bg-blue-950/30 data-[state=active]:border-blue-600',
  '0':  'border-orange-800 text-orange-400 data-[state=active]:bg-orange-950/30 data-[state=active]:border-orange-600',
  '1':  'border-teal-800 text-teal-400 data-[state=active]:bg-teal-950/30 data-[state=active]:border-teal-600',
  'idle': 'border-zinc-700 text-zinc-400 data-[state=active]:bg-zinc-900 data-[state=active]:border-zinc-500',
};

// ─── Zone pattern editor ──────────────────────────────────────────────────────

function ZoneEditor({
  label,
  pattern,
  onChange,
}: {
  label: string;
  pattern: ZonePattern;
  onChange: (p: ZonePattern) => void;
}) {
  const { primaryColor: pc, secondaryColor: sc } = pattern;
  const isAnimated = pattern.type !== 'solid';

  return (
    <div className="space-y-2 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3" /> {label}
        </span>
        <Switch checked={pattern.enabled} onCheckedChange={(v) => onChange({ ...pattern, enabled: v })} className="scale-75" />
      </div>

      {/* Pattern type */}
      <div className="flex flex-wrap gap-1">
        {PATTERN_TYPES.map((t) => (
          <button key={t}
            onClick={() => onChange({ ...pattern, type: t })}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[8px] font-mono uppercase tracking-wider border ${
              pattern.type === t
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-black border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'
            }`}>
            {PATTERN_ICONS[t]} {t}
          </button>
        ))}
      </div>

      {/* Primary color */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border border-zinc-700" style={{ backgroundColor: `rgb(${pc.r},${pc.g},${pc.b})` }} />
          <span className="text-[8px] font-mono text-zinc-500">PRIMARY</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(['r','g','b'] as const).map((ch) => (
            <div key={ch}>
              <div className="flex justify-between mb-0.5">
                <span className={`text-[8px] font-mono font-bold ${ch==='r'?'text-red-500':ch==='g'?'text-green-500':'text-blue-500'}`}>{ch.toUpperCase()}</span>
                <span className="text-[8px] font-mono text-zinc-600">{pc[ch]}</span>
              </div>
              <Slider value={[pc[ch]]} min={0} max={255} step={1}
                onValueChange={([v]) => onChange({ ...pattern, primaryColor: { ...pc, [ch]: v } })} />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary color (animated patterns only) */}
      {isAnimated && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-zinc-700" style={{ backgroundColor: `rgb(${sc.r},${sc.g},${sc.b})` }} />
            <span className="text-[8px] font-mono text-zinc-500">SECONDARY</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['r','g','b'] as const).map((ch) => (
              <div key={ch}>
                <div className="flex justify-between mb-0.5">
                  <span className={`text-[8px] font-mono font-bold ${ch==='r'?'text-red-500':ch==='g'?'text-green-500':'text-blue-500'}`}>{ch.toUpperCase()}</span>
                  <span className="text-[8px] font-mono text-zinc-600">{sc[ch]}</span>
                </div>
                <Slider value={[sc[ch]]} min={0} max={255} step={1}
                  onValueChange={([v]) => onChange({ ...pattern, secondaryColor: { ...sc, [ch]: v } })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brightness + Speed */}
      <div className={`grid gap-2 ${isAnimated ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <div className="flex justify-between mb-0.5">
            <span className="text-[8px] font-mono text-zinc-500">BRIGHTNESS</span>
            <span className="text-[8px] font-mono text-primary">{pattern.brightness}</span>
          </div>
          <Slider value={[pattern.brightness]} min={0} max={255} step={1}
            onValueChange={([v]) => onChange({ ...pattern, brightness: v })} />
        </div>
        {isAnimated && (
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-[8px] font-mono text-zinc-500">SPEED</span>
              <span className="text-[8px] font-mono text-accent">{pattern.speed}</span>
            </div>
            <Slider value={[pattern.speed]} min={0} max={255} step={1}
              onValueChange={([v]) => onChange({ ...pattern, speed: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preset card ──────────────────────────────────────────────────────────────

function PresetCard({
  positionKey, preset, onSave, onCapture, onApply, isSaving, isCapturing,
}: {
  positionKey: string;
  preset: PresetValues;
  onSave: (v: PresetValues) => void;
  onCapture: () => void;
  onApply: () => void;
  isSaving: boolean;
  isCapturing: boolean;
}) {
  const [local, setLocal] = useState<PresetValues>(preset);
  useEffect(() => { setLocal(preset); }, [preset]);

  const updFan    = (k: keyof PresetValues['fan'],    v: number | boolean) => setLocal((p) => ({ ...p, fan:    { ...p.fan,    [k]: v } }));
  const updMotor  = (k: keyof PresetValues['motor'],  v: string | number | boolean) => setLocal((p) => ({ ...p, motor:  { ...p.motor,  [k]: v } }));
  const updScreen = (k: keyof PresetValues['screen'], v: string | boolean) => setLocal((p) => ({ ...p, screen: { ...p.screen, [k]: v } }));
  const updZone   = (zone: ZoneName, pattern: ZonePattern) => setLocal((p) => ({ ...p, [zone]: pattern }));

  const zones: { key: ZoneName; label: string }[] = [
    { key: 'haube',   label: 'HAUBE (Gledopto #1 OUT1)' },
    { key: 'schmerz', label: 'SCHMERZ-BAND (Gledopto #1 OUT2)' },
    { key: 'nsar',    label: 'NSAR-BAND (Gledopto #2 OUT1)' },
    { key: 'opiat',   label: 'OPIAT-BAND (Gledopto #2 OUT2)' },
  ];

  const isDirty = JSON.stringify(local) !== JSON.stringify(preset);

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="flex items-center gap-3">
        <Label className="text-[10px] font-mono text-zinc-500 shrink-0">NAME</Label>
        <Input value={local.name} onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
          className="h-7 text-xs font-mono bg-black border-zinc-800" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Fan */}
        <div className="space-y-2 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5"><Wind className="w-3 h-3" /> VENTILATOR</span>
            <Switch checked={local.fan.enabled} onCheckedChange={(v) => updFan('enabled', v)} className="scale-75" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-mono text-zinc-500">SPEED</span>
              <span className="text-[9px] font-mono text-zinc-400">{local.fan.speed}</span>
            </div>
            <Slider value={[local.fan.speed]} min={0} max={255} step={1}
              onValueChange={([v]) => updFan('speed', v)} />
          </div>
        </div>

        {/* Motor */}
        <div className="space-y-2 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                <ChevronsUpDown className="w-3 h-3 text-primary" /> OPIAT-SCHILD MOTOR
              </span>
              <div className="text-[9px] font-mono text-zinc-600 mt-0.5">AUF = sichtbar · AB = versteckt</div>
            </div>
            <Switch checked={local.motor.enabled} onCheckedChange={(v) => updMotor('enabled', v)} className="scale-75" />
          </div>
          <div className="flex gap-1">
            {(['up','stop','down'] as const).map((d) => (
              <Button key={d} size="sm" variant="outline"
                onClick={() => updMotor('position', d)}
                className={`flex-1 h-6 text-[9px] font-mono tracking-widest rounded-sm ${
                  local.motor.position === d
                    ? d === 'stop' ? 'bg-red-600 text-white border-red-600'
                      : d === 'up' ? 'bg-teal-700 text-white border-teal-600'
                      : 'bg-zinc-700 text-white border-zinc-600'
                    : 'bg-black border-zinc-800 text-zinc-600 hover:text-zinc-300'
                }`}>
                {d === 'up' ? '▲ AUF' : d === 'stop' ? '■ STOP' : '▼ AB'}
              </Button>
            ))}
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-mono text-zinc-500">SPEED (mm/min)</span>
              <span className="text-[9px] font-mono text-zinc-400">{local.motor.speed}</span>
            </div>
            <Slider value={[Math.min(local.motor.speed, 10000)]} min={0} max={10000} step={100}
              onValueChange={([v]) => updMotor('speed', v)} />
          </div>
        </div>

        {/* Screen */}
        <div className="space-y-2 bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5"><Monitor className="w-3 h-3 text-accent" /> SCREEN / VIDEO</span>
            <Switch checked={local.screen.enabled} onCheckedChange={(v) => updScreen('enabled', v)} className="scale-75" />
          </div>
          <Input value={local.screen.videoFile} onChange={(e) => updScreen('videoFile', e.target.value)}
            placeholder="schmerz.mp4" className="h-7 text-xs font-mono bg-black border-zinc-800 rounded-sm" />
          <div className="flex flex-wrap gap-1">
            {['idle.mp4','schmerz.mp4','opiat.mp4','nsar.mp4'].map((f) => (
              <button key={f} onClick={() => updScreen('videoFile', f)}
                className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                  local.screen.videoFile === f
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'
                }`}>{f}</button>
            ))}
          </div>
        </div>

      </div>

      {/* LED zones — 2 columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {zones.map(({ key, label }) => (
          <ZoneEditor key={key} label={label} pattern={local[key]}
            onChange={(p) => updZone(key, p)} />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
        <Button size="sm" variant="secondary" disabled={!isDirty || isSaving}
          className="font-mono text-[10px] tracking-widest bg-zinc-800 hover:bg-zinc-700 rounded-sm h-7"
          onClick={() => onSave(local)}>
          {isSaving ? 'SPEICHERN...' : isDirty ? '● SPEICHERN' : 'GESPEICHERT'}
        </Button>
        <Button size="sm" variant="outline"
          className="font-mono text-[10px] tracking-widest border-zinc-700 text-zinc-500 hover:text-zinc-300 rounded-sm h-7"
          disabled={isCapturing} onClick={onCapture}>
          {isCapturing ? 'CAPTURING...' : '⊙ CAPTURE LIVE'}
        </Button>
        <Button size="sm" variant="outline"
          className="font-mono text-[10px] tracking-widest border-primary/40 text-primary hover:bg-primary/10 rounded-sm h-7"
          onClick={onApply}>
          ▶ APPLY
        </Button>
      </div>
    </div>
  );
}

// ─── Main PresetEditor ────────────────────────────────────────────────────────

export default function PresetEditor() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('0');
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [timerEnabled, setTimerEnabled] = useState(true);

  const { data: presetsState } = useGetPresets({ query: { queryKey: getGetPresetsQueryKey() } });
  const { data: dmxState }     = useGetDmxState({ query: { queryKey: getGetDmxStateQueryKey(), refetchInterval: 500 } });

  const updatePreset  = useUpdatePreset();
  const capturePreset = useCapturePreset();
  const applyPreset   = useApplyPreset();
  const updateTimer   = useUpdatePresetTimer();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetPresetsQueryKey() });

  useEffect(() => {
    if (presetsState) {
      setTimerSeconds(presetsState.idleTimerSeconds ?? 30);
      setTimerEnabled(presetsState.idleTimerEnabled ?? true);
    }
  }, [presetsState?.idleTimerSeconds, presetsState?.idleTimerEnabled]);

  const activePosition = dmxState?.painFader?.position;
  const isIdleActive   = dmxState?.mode === 'idle';

  const handleSave = (position: string, values: PresetValues) => {
    updatePreset.mutate({ position, data: values as any }, {
      onSuccess: () => { toast.success(`Preset ${position} gespeichert`); invalidate(); },
    });
  };

  const handleCapture = (position: string) => {
    capturePreset.mutate({ position }, {
      onSuccess: () => { toast.success(`Live-State als Preset ${position} gespeichert`); invalidate(); },
    });
  };

  const handleApply = (position: string) => {
    applyPreset.mutate({ position }, {
      onSuccess: () => toast.info(`Preset ${position} angewendet`),
    });
  };

  const handleSaveTimer = () => {
    updateTimer.mutate({ data: { timerSeconds, enabled: timerEnabled } },
      { onSuccess: () => { toast.success('Timer-Konfiguration gespeichert'); invalidate(); } }
    );
  };

  if (!presetsState?.positions?.[0]?.haube) {
    return (
      <div className="flex items-center justify-center h-64 font-mono text-[10px] text-zinc-600 tracking-widest">
        LOADING PRESETS...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono text-zinc-500 tracking-widest">
        FADER PRESETS — jede Position lädt: Licht (Art-Net Pixel), Lüfter (OpenDMX), Motor (USB-TTL), Screen
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-black border border-zinc-800 rounded-sm p-1 h-auto flex-wrap gap-1 w-full justify-start">
          {LEVER_POSITIONS.map(({ key, label, shortLabel, idx }) => {
            const posNum = parseInt(key, 10);
            const isLive = activePosition === posNum && dmxState?.mode === 'experience';
            return (
              <TabsTrigger key={key} value={key}
                className={`font-mono text-[10px] tracking-widest rounded-sm px-3 py-1.5 border ${POS_COLORS[key]} ${isLive ? 'ring-1 ring-inset ring-current' : ''}`}>
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse shrink-0" />}
                <span className="font-black mr-1.5">{shortLabel}</span>
                {label}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="idle"
            className={`font-mono text-[10px] tracking-widest rounded-sm px-3 py-1.5 border ${POS_COLORS['idle']} ${isIdleActive ? 'ring-1 ring-inset ring-current' : ''}`}>
            {isIdleActive && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse shrink-0" />}
            <Clock className="w-3 h-3 mr-1.5" /> IDLE (TIMER)
          </TabsTrigger>
        </TabsList>

        {/* Position preset tabs */}
        {LEVER_POSITIONS.map(({ key, label, shortLabel, idx }) => {
          const preset = presetsState.positions[idx];
          if (!preset) return null;
          const posColor = key === '-1' ? 'text-blue-400' : key === '0' ? 'text-orange-400' : 'text-teal-400';
          return (
            <TabsContent key={key} value={key} className="mt-4">
              <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] py-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-2xl font-mono ${posColor}`}>{shortLabel}</span>
                    <div>
                      <div className={`text-xs font-mono font-bold tracking-widest ${posColor}`}>{label}</div>
                      <div className="text-[9px] font-mono text-zinc-600">Hebel-Position {key}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <PresetCard positionKey={key} preset={mergePreset(preset)}
                    onSave={(v) => handleSave(key, v)}
                    onCapture={() => handleCapture(key)}
                    onApply={() => handleApply(key)}
                    isSaving={updatePreset.isPending}
                    isCapturing={capturePreset.isPending} />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* IDLE tab */}
        <TabsContent value="idle" className="mt-4 space-y-4">
          <Card className="bg-[#111113] border-zinc-800 rounded-sm">
            <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] py-3">
              <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                <Clock className="w-4 h-4" /> IDLE PRESET + TIMER
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="bg-[#0a0a0c] border border-zinc-800 rounded-sm p-3 text-xs font-mono text-zinc-500 leading-relaxed">
                Wenn der Hebel in Position <span className="text-primary font-bold">0 (SCHMERZ)</span> zurückfedert,
                startet der Timer. Nach <span className="text-primary">{timerSeconds}s</span> ohne Bewegung wird das IDLE-Preset geladen.
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm">
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono text-zinc-500">TIMER DAUER (Sekunden)</Label>
                  <Input type="number" min={1} max={3600} value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 font-mono text-sm bg-black border-zinc-800" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono text-zinc-500">TIMER AKTIV</Label>
                  <div className="flex items-center gap-3 h-8">
                    <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                    <span className={`text-[10px] font-mono ${timerEnabled ? 'text-primary' : 'text-zinc-600'}`}>
                      {timerEnabled ? 'EIN' : 'AUS'}
                    </span>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveTimer} variant="secondary" size="sm"
                disabled={updateTimer.isPending}
                className="font-mono text-[10px] tracking-widest bg-zinc-800 hover:bg-zinc-700 rounded-sm h-7">
                {updateTimer.isPending ? 'SPEICHERN...' : 'TIMER SPEICHERN'}
              </Button>

              <div className="border-t border-zinc-800 pt-4">
                <PresetCard positionKey="idle" preset={mergePreset(presetsState.idlePreset)}
                  onSave={(v) => handleSave('idle', v)}
                  onCapture={() => handleCapture('idle')}
                  onApply={() => handleApply('idle')}
                  isSaving={updatePreset.isPending}
                  isCapturing={capturePreset.isPending} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
