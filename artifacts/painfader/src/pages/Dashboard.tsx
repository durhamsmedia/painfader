import React, { useState, useEffect, useRef } from 'react';
import {
  useGetDmxState,
  useGetHardwareConfig,
  useUpdateHardwareConfig,
  useSetMode,
  useSetFan,
  useSetZone,
  useSetMotor,
  useSetScreen,
  useLoadScene,
  useBlackout,
  useHardwareFaderInput,
  getGetDmxStateQueryKey,
} from '@workspace/api-client-react';
import type { ZonePattern, PatternType } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Activity, Settings2, Wind, Lightbulb, Zap, Clock, Cpu, HelpCircle,
  Monitor, ChevronsUpDown, Radio, Waves, PlayCircle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import PresetEditor from '@/components/PresetEditor';
import HelpModal from '@/components/HelpModal';

// ─── Position constants ──────────────────────────────────────────────────────
type Pos = -1 | 0 | 1;

const POS_LABEL: Record<number, string> = { [-1]: 'N – NSAR', 0: 'SCHMERZ', 1: 'O – OPIAT' };
const POS_COLOR: Record<number, string> = { [-1]: '#3b82f6', 0: '#EC6602', 1: '#009999' };
const POS_ACTIVE_STYLE: Record<number, string> = {
  [-1]: 'border-blue-600 bg-blue-950/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]',
  0:   'border-orange-600 bg-orange-950/30 text-orange-400 shadow-[0_0_10px_rgba(236,102,2,0.4)]',
  1:   'border-teal-600 bg-teal-950/30 text-teal-400 shadow-[0_0_10px_rgba(0,153,153,0.4)]',
};
const POS_INACTIVE = 'border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white';

type ZoneName = 'haube' | 'haube2' | 'schmerz' | 'nsar' | 'opiat';

const PATTERN_TYPES: PatternType[] = ['solid', 'pulse', 'chase', 'wave', 'sparkle'];
const PATTERN_ICONS: Record<string, React.ReactNode> = {
  solid:   <span className="text-[8px]">■</span>,
  pulse:   <span className="text-[8px]">◐</span>,
  chase:   <span className="text-[8px]">►</span>,
  wave:    <Waves className="w-2.5 h-2.5" />,
  sparkle: <span className="text-[8px]">✦</span>,
};

// ─── ZonePatternCard ──────────────────────────────────────────────────────────
function ZonePatternCard({
  zone, label, sublabel, pattern, pixelCount, onUpdate,
}: {
  zone: ZoneName;
  label: string;
  sublabel: string;
  pattern: ZonePattern;
  pixelCount: number;
  onUpdate: (updates: Partial<ZonePattern>) => void;
}) {
  const { primaryColor: pc, secondaryColor: sc } = pattern;
  const isAnimated = pattern.type !== 'solid';
  const swatchColor = pattern.enabled
    ? `rgb(${Math.round(pc.r * pattern.brightness / 255)},${Math.round(pc.g * pattern.brightness / 255)},${Math.round(pc.b * pattern.brightness / 255)})`
    : 'transparent';

  return (
    <Card className="bg-[#111113] border-zinc-800 rounded-sm">
      <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between py-3">
        <div>
          <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
            <Lightbulb className="w-3.5 h-3.5" /> {label}
          </CardTitle>
          <div className="text-[9px] font-mono text-zinc-600 mt-0.5">{sublabel} · {pixelCount} px</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm border border-zinc-700 shrink-0"
            style={{ backgroundColor: swatchColor }} />
          <Switch checked={pattern.enabled} onCheckedChange={(v) => onUpdate({ enabled: v })} />
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3 transition-opacity" style={{ opacity: pattern.enabled ? 1 : 0.45 }}>
        {/* Pattern type */}
        <div className="flex flex-wrap gap-1">
          {PATTERN_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => onUpdate({ type: t })}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                pattern.type === t
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-black border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {PATTERN_ICONS[t]} {t}
            </button>
          ))}
        </div>

        {/* Primary color */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border border-zinc-700"
              style={{ backgroundColor: `rgb(${pc.r},${pc.g},${pc.b})` }} />
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Primary</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['r','g','b'] as const).map((ch) => (
              <div key={ch} className="space-y-0.5">
                <div className="flex justify-between">
                  <span className={`text-[8px] font-mono font-bold ${ch==='r'?'text-red-500':ch==='g'?'text-green-500':'text-blue-500'}`}>{ch.toUpperCase()}</span>
                  <span className="text-[8px] font-mono text-zinc-600">{pc[ch]}</span>
                </div>
                <Slider value={[pc[ch]]} min={0} max={255} step={1}
                  onValueChange={([v]) => onUpdate({ primaryColor: { ...pc, [ch]: v } })} />
              </div>
            ))}
          </div>
        </div>

        {/* Secondary color — only for animated patterns */}
        {isAnimated && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm border border-zinc-700"
                style={{ backgroundColor: `rgb(${sc.r},${sc.g},${sc.b})` }} />
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Secondary</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['r','g','b'] as const).map((ch) => (
                <div key={ch} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className={`text-[8px] font-mono font-bold ${ch==='r'?'text-red-500':ch==='g'?'text-green-500':'text-blue-500'}`}>{ch.toUpperCase()}</span>
                    <span className="text-[8px] font-mono text-zinc-600">{sc[ch]}</span>
                  </div>
                  <Slider value={[sc[ch]]} min={0} max={255} step={1}
                    onValueChange={([v]) => onUpdate({ secondaryColor: { ...sc, [ch]: v } })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brightness + Speed */}
        <div className={`grid gap-1.5 ${isAnimated ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] font-mono text-zinc-500">BRIGHTNESS</span>
              <span className="text-[9px] font-mono text-primary">{pattern.brightness}</span>
            </div>
            <Slider value={[pattern.brightness]} min={0} max={255} step={1}
              onValueChange={([v]) => onUpdate({ brightness: v })} />
          </div>
          {isAnimated && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[9px] font-mono text-zinc-500">SPEED</span>
                <span className="text-[9px] font-mono text-accent">{pattern.speed}</span>
              </div>
              <Slider value={[pattern.speed]} min={0} max={255} step={1}
                onValueChange={([v]) => onUpdate({ speed: v })} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState('live');
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: dmxState } = useGetDmxState({
    query: { queryKey: getGetDmxStateQueryKey(), refetchInterval: 500 },
  });
  const { data: hwConfig } = useGetHardwareConfig();

  const updateHwConfig = useUpdateHardwareConfig();
  const setMode         = useSetMode();
  const setFan          = useSetFan();
  const setZone         = useSetZone();
  const setMotor        = useSetMotor();
  const setScreen       = useSetScreen();
  const loadScene       = useLoadScene();
  const blackout        = useBlackout();
  const applyPosition   = useHardwareFaderInput();

  const inv = () => queryClient.invalidateQueries({ queryKey: getGetDmxStateQueryKey() });

  const onSetMode = (mode: 'idle' | 'experience') =>
    setMode.mutate({ data: { mode } }, { onSuccess: inv });

  const onSetFan = (speed: number, enabled: boolean) =>
    setFan.mutate({ data: { speed, enabled } }, { onSuccess: inv });

  const onSetZone = (zone: ZoneName, updates: Partial<ZonePattern>) => {
    if (!dmxState) return;
    const current = dmxState[zone].pattern;
    setZone.mutate({ name: zone, data: { ...current, ...updates } }, { onSuccess: inv });
  };

  const onSetMotor = (position: 'up' | 'down' | 'stop', speed: number, enabled: boolean) =>
    setMotor.mutate({ data: { position, speed, enabled } }, { onSuccess: inv });

  const onSetScreen = (videoFile: string, enabled: boolean, loop: boolean) =>
    setScreen.mutate({ data: { videoFile, enabled, loop } }, { onSuccess: inv });

  const onLoadScene = (scene: 'idle' | 'schmerz' | 'opiat' | 'nsar' | 'blackout') =>
    loadScene.mutate({ data: { scene } }, { onSuccess: inv });

  const onApplyPosition = (p: number) =>
    applyPosition.mutate({ data: { position: p } }, { onSuccess: inv });

  const onBlackout = () =>
    blackout.mutate(undefined, {
      onSuccess: () => { inv(); toast.error('BLACKOUT', { description: 'All outputs zeroed' }); },
    });

  // ── Start button (physical or simulated) ──────────────────────────────────
  const [btnFlash, setBtnFlash] = useState(false);
  const onStartButton = async () => {
    await fetch(`${import.meta.env.BASE_URL}api/dmx/start-button`, { method: 'POST' });
    inv();
    setBtnFlash(true);
    setTimeout(() => setBtnFlash(false), 600);
    toast.success('START', { description: 'Button pressed — mode toggled' });
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const [lastKey, setLastKey] = useState<string | null>(null);
  const lastKeyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HOLD_MS = 1000;
  const [blackoutHoldPct, setBlackoutHoldPct] = useState(0);
  const holdStartRef = useRef<number | null>(null);
  const holdRafRef   = useRef<number | null>(null);
  const bKeyHeld     = useRef(false);

  const startBlackoutHold = () => {
    holdStartRef.current = performance.now();
    const tick = () => {
      if (holdStartRef.current === null) return;
      const elapsed = performance.now() - holdStartRef.current;
      const pct = Math.min((elapsed / HOLD_MS) * 100, 100);
      setBlackoutHoldPct(pct);
      if (pct < 100) { holdRafRef.current = requestAnimationFrame(tick); }
      else { cancelBlackoutHold(); onBlackout(); }
    };
    holdRafRef.current = requestAnimationFrame(tick);
  };

  const cancelBlackoutHold = () => {
    holdStartRef.current = null;
    if (holdRafRef.current !== null) cancelAnimationFrame(holdRafRef.current);
    holdRafRef.current = null;
    setBlackoutHoldPct(0);
  };

  const flashKey = (k: string) => {
    setLastKey(k);
    if (lastKeyTimer.current) clearTimeout(lastKeyTimer.current);
    lastKeyTimer.current = setTimeout(() => setLastKey(null), 800);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'n') { onApplyPosition(-1); flashKey('N'); }
      else if (k === '0') { onApplyPosition(0); flashKey('0'); }
      else if (k === 'o') { onApplyPosition(1); flashKey('O'); }
      else if (k === 'b' && !bKeyHeld.current) { bKeyHeld.current = true; flashKey('B'); startBlackoutHold(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'b') { bKeyHeld.current = false; cancelBlackoutHold(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); cancelBlackoutHold(); };
  }, []);

  // ── Guard — wait for new API shape ────────────────────────────────────────
  if (!dmxState || !dmxState.haube || !dmxState.haube2 || !dmxState.schmerz || !dmxState.nsar || !dmxState.opiat) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-zinc-600 text-sm uppercase tracking-widest bg-[#050505]">
        INITIALIZING CONTROLLER...
      </div>
    );
  }

  const timer   = dmxState.idleTimer ?? { enabled: false, timerSeconds: 30, remaining: null, triggered: false };
  const timerPct = timer.remaining !== null && timer.timerSeconds > 0
    ? (timer.remaining / timer.timerSeconds) * 100 : null;
  const pos     = dmxState.painFader.position as Pos;
  const gpio    = dmxState.gpio;

  const ZONES: { key: ZoneName; label: string; sublabel: string }[] = [
    { key: 'haube',   label: 'HAUBE 1',      sublabel: 'Matrix 1 · GPIO16' },
    { key: 'haube2',  label: 'HAUBE 2',      sublabel: 'Matrix 2 · GPIO12' },
    { key: 'schmerz', label: 'SCHMERZ-BAND', sublabel: '5 × 16×16 Matrix' },
    { key: 'nsar',    label: 'NSAR-BAND',    sublabel: 'WS2812b Strip' },
    { key: 'opiat',   label: 'OPIAT-BAND',   sublabel: 'WS2812b Strip' },
  ];

  return (
    <TooltipProvider delayDuration={400}>
    <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#0d0d0f] border-b border-zinc-800 px-4 md:px-6 py-3 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 xl:gap-5">

          <h1 className="text-lg font-black tracking-widest text-white flex items-center gap-2.5 shrink-0">
            <Zap className="w-4 h-4 text-accent" />
            <span style={{ color: '#EC6602' }}>PAIN</span><span style={{ color: '#009999' }}>FADER</span>
          </h1>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          {/* IDLE / EXPERIENCE */}
          <div className="flex gap-1 bg-black p-1 rounded border border-zinc-800 shrink-0">
            <Button variant="ghost" className={`h-7 px-4 uppercase tracking-widest font-bold text-xs rounded-sm ${dmxState.mode === 'idle' ? 'bg-primary text-white hover:bg-primary/90' : 'text-zinc-500 hover:text-white'}`}
              onClick={() => onSetMode('idle')}>IDLE</Button>
            <Button variant="ghost" className={`h-7 px-4 uppercase tracking-widest font-bold text-xs rounded-sm ${dmxState.mode === 'experience' ? 'bg-accent text-white hover:bg-accent/90' : 'text-zinc-500 hover:text-white'}`}
              onClick={() => onSetMode('experience')}>EXPERIENCE</Button>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          {/* 3-position buttons */}
          <div className="flex gap-2 shrink-0">
            {([-1, 0, 1] as const).map((p) => {
              const kbd = p === -1 ? 'N' : p === 0 ? '0' : 'O';
              return (
                <Tooltip key={p}>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm"
                      className={`font-mono text-[11px] h-8 px-3 rounded-sm transition-all flex items-center gap-1.5 font-bold ${pos === p ? POS_ACTIVE_STYLE[p] : POS_INACTIVE}`}
                      onClick={() => onApplyPosition(p)}>
                      {kbd}
                      <kbd className={`text-[8px] px-1 rounded border font-mono leading-tight ${lastKey === kbd ? 'border-current bg-current/20' : 'border-zinc-700 bg-zinc-900 text-zinc-600'}`}>{kbd}</kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="font-mono text-[10px]">
                    Press <kbd className="px-1 border border-zinc-600 rounded text-[9px]">{kbd}</kbd> — {POS_LABEL[p]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 justify-between xl:justify-end">
          {/* GPIO status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[10px] font-mono cursor-default">
                <div className={`w-2 h-2 rounded-full ${gpio.simulated ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} />
                <span className={gpio.simulated ? 'text-yellow-500' : 'text-green-500'}>
                  GPIO {gpio.simulated ? 'SIM' : 'HW'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-[10px]">
              {gpio.simulated
                ? 'GPIO not available — use UI / keyboard shortcuts'
                : `Reed contacts: N=${gpio.raw.nsar} 0=${gpio.raw.schmerz} O=${gpio.raw.opiat}`}
            </TooltipContent>
          </Tooltip>

          {/* Art-Net TX */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider cursor-default">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary">ART-NET TX</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-[10px]">
              Pixel streaming to Gledopto controllers at {dmxState.hardwareConfig.artnetRefreshRate} Hz
            </TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="sm"
            className="h-8 w-8 p-0 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-sm"
            onClick={() => setHelpOpen(true)}>
            <HelpCircle className="w-4 h-4" />
          </Button>

          {/* BLACKOUT hold */}
          <button
            className="relative overflow-hidden uppercase tracking-widest font-black shrink-0 px-4 h-8 bg-red-900 hover:bg-red-800 border border-red-700 text-white text-xs rounded-sm flex items-center gap-2 select-none cursor-pointer"
            onMouseDown={startBlackoutHold} onMouseUp={cancelBlackoutHold} onMouseLeave={cancelBlackoutHold}
            onTouchStart={startBlackoutHold} onTouchEnd={cancelBlackoutHold}>
            <span className="absolute inset-0 bg-red-600 origin-left" style={{ transform: `scaleX(${blackoutHoldPct / 100})`, transformOrigin: 'left' }} />
            <span className="relative z-10">BLACKOUT</span>
            <kbd className={`relative z-10 text-[8px] px-1 rounded border font-mono leading-tight ${blackoutHoldPct > 0 || lastKey === 'B' ? 'border-white bg-white/20 text-white' : 'border-red-400/40 bg-red-900/40 text-red-300'}`}>B</kbd>
          </button>
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-6">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="bg-black border border-zinc-800 rounded-sm p-1 mb-5 h-auto">
            {(['live', 'presets', 'hardware'] as const).map((t) => (
              <TabsTrigger key={t} value={t}
                className="font-mono text-[11px] tracking-widest rounded-sm px-5 h-7 data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500">
                {t === 'live' ? 'LIVE CONTROL' : t === 'presets' ? 'PRESETS' : 'HARDWARE'}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── LIVE ─────────────────────────────────────────────────────────── */}
          <TabsContent value="live">
            <div className="max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* LEFT: Lever + Fan + Motor + Screen */}
                <div className="lg:col-span-3 space-y-4">

                  {/* KIPHEBEL */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Activity className="w-4 h-4 text-accent" /> KIPHEBEL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-[10px] font-mono text-zinc-500">
                          POS: <span style={{ color: POS_COLOR[pos] }} className="font-black text-sm">{pos === -1 ? 'N' : pos === 0 ? '0' : 'O'}</span>
                          {' — '}<span style={{ color: POS_COLOR[pos] }} className="font-bold">{POS_LABEL[pos]}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {([-1, 0, 1] as const).map((p) => (
                          <button key={p} onClick={() => onApplyPosition(p)}
                            className={`flex flex-col items-center justify-center py-5 rounded border-2 transition-all ${
                              pos === p
                                ? p === -1 ? 'border-blue-600 bg-blue-950/30 text-blue-400'
                                  : p === 0 ? 'border-orange-600 bg-orange-950/30 text-orange-400'
                                  : 'border-teal-600 bg-teal-950/30 text-teal-400'
                                : 'border-zinc-800 bg-black text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                            } ${p === 0 ? 'ring-1 ring-zinc-700' : ''}`}>
                            <span className="text-2xl font-black mb-1 font-mono">{p === -1 ? 'N' : p === 0 ? '0' : 'O'}</span>
                            <span className="text-[8px] uppercase tracking-widest leading-tight opacity-80">{p === -1 ? 'NSAR' : p === 0 ? 'SCHMERZ' : 'OPIAT'}</span>
                          </button>
                        ))}
                      </div>

                      {/* GPIO raw state */}
                      {!gpio.simulated && (
                        <div className="grid grid-cols-3 gap-1 mb-3">
                          {(['nsar','schmerz','opiat'] as const).map((k) => (
                            <div key={k} className={`text-center text-[8px] font-mono py-1 rounded border ${
                              gpio.raw[k] ? 'border-green-700 bg-green-950/20 text-green-400' : 'border-zinc-800 text-zinc-700'
                            }`}>
                              {k.toUpperCase()}<br/>
                              <span className="font-bold">{gpio.raw[k] ? 'CLOSED' : 'OPEN'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Idle timer */}
                      {timer.enabled && pos === 0 && timerPct !== null && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-zinc-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> IDLE TIMER</span>
                            <span className={timer.remaining !== null && timer.remaining < 5 ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}>
                              {timer.remaining !== null ? `${timer.remaining.toFixed(1)}s` : 'STANDBY'}
                            </span>
                          </div>
                          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${timerPct}%`, backgroundColor: timerPct > 40 ? '#22c55e' : timerPct > 15 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                        </div>
                      )}
                      {timer.triggered && pos === 0 && (
                        <div className="mt-2 text-[10px] font-mono text-primary text-center tracking-widest animate-pulse">IDLE ACTIVE</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* START BUTTON */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <PlayCircle className="w-4 h-4 text-green-500" /> START BUTTON
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${dmxState.startButton?.simulated ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} />
                        <span className={`text-[9px] font-mono ${dmxState.startButton?.simulated ? 'text-yellow-500' : 'text-green-400'}`}>
                          {dmxState.startButton?.simulated ? 'SIM' : 'HW'}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <button
                        onClick={onStartButton}
                        className={`w-full h-16 rounded-sm border-2 font-black tracking-widest text-sm uppercase transition-all flex items-center justify-center gap-2 select-none
                          ${btnFlash
                            ? 'border-green-400 bg-green-900/60 text-green-300 shadow-[0_0_20px_rgba(74,222,128,0.5)]'
                            : 'border-zinc-700 bg-black text-zinc-300 hover:border-green-600 hover:bg-green-950/30 hover:text-green-300'
                          }`}>
                        <PlayCircle className={`w-5 h-5 ${btnFlash ? 'text-green-300' : 'text-zinc-500'}`} />
                        START
                      </button>
                      <div className="text-[9px] font-mono text-zinc-700 flex justify-between">
                        <span>{dmxState.startButton?.port ?? '/dev/ttyUSB2'}</span>
                        <span>{dmxState.mode === 'idle' ? '→ EXPERIENCE' : '→ restart timer'}</span>
                      </div>
                      {!dmxState.startButton?.simulated && (
                        <div className="text-[9px] font-mono text-green-600 text-center">
                          Physischer Taster aktiv
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* FAN */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Wind className="w-4 h-4" /> VENTILATOR
                      </CardTitle>
                      <Switch checked={dmxState.fan.enabled} onCheckedChange={(c) => onSetFan(dmxState.fan.speed, c)} />
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 transition-opacity" style={{ opacity: dmxState.fan.enabled ? 1 : 0.45 }}>
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] text-zinc-500 font-mono">SPEED</Label>
                        <span className="font-mono text-sm text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 min-w-[3rem] text-center">{dmxState.fan.speed}</span>
                      </div>
                      <Slider value={[dmxState.fan.speed]} min={0} max={255} step={1}
                        onValueChange={([v]) => onSetFan(v, dmxState.fan.enabled)} />
                      <div className="text-[10px] font-mono text-zinc-700">
                        OpenDMX USB · CH {dmxState.fan.dmxChannel}
                      </div>
                    </CardContent>
                  </Card>

                  {/* MOTOR */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <ChevronsUpDown className="w-4 h-4 text-primary" /> OPIAT-SCHILD
                      </CardTitle>
                      <Switch checked={dmxState.motor.enabled}
                        onCheckedChange={(c) => onSetMotor(dmxState.motor.position, dmxState.motor.speed, c)} />
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 transition-opacity" style={{ opacity: dmxState.motor.enabled ? 1 : 0.45 }}>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['up', 'stop', 'down'] as const).map((d) => (
                          <Button key={d} size="sm" variant="outline"
                            className={`font-mono text-[10px] tracking-widest rounded-sm ${
                              dmxState.motor.position === d
                                ? d === 'stop' ? 'bg-red-600 text-white border-red-600'
                                  : d === 'up' ? 'bg-teal-700 text-white border-teal-600'
                                  : 'bg-zinc-700 text-white border-zinc-600'
                                : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600'
                            }`}
                            onClick={() => onSetMotor(d, dmxState.motor.speed, dmxState.motor.enabled)}>
                            {d === 'up' ? '▲ AUF' : d === 'stop' ? '■ STOP' : '▼ AB'}
                          </Button>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] text-zinc-500 font-mono">SPEED</Label>
                          <span className="font-mono text-sm text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 min-w-[3rem] text-center">{dmxState.motor.speed}</span>
                        </div>
                        <Slider value={[Math.min(dmxState.motor.speed, 10000)]} min={0} max={10000} step={100}
                          onValueChange={([v]) => onSetMotor(dmxState.motor.position, v, dmxState.motor.enabled)} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-zinc-700">
                        <span className={dmxState.motor.simulated ? 'text-yellow-600' : 'text-zinc-600'}>
                          {dmxState.motor.simulated ? 'USB-TTL (SIM)' : 'USB-TTL HW'}
                        </span>
                        <span className={`font-bold ${dmxState.motor.position === 'up' ? 'text-teal-400' : dmxState.motor.position === 'stop' ? 'text-red-400' : 'text-zinc-500'}`}>
                          {dmxState.motor.position === 'up' ? 'SICHTBAR' : dmxState.motor.position === 'down' ? 'VERSTECKT' : 'STOP'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SCREEN */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Monitor className="w-4 h-4 text-accent" /> SCREEN
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono text-zinc-600">LOOP</span>
                          <Switch checked={!!dmxState.screen.loop}
                            onCheckedChange={(c) => onSetScreen(dmxState.screen.videoFile, dmxState.screen.enabled, c)} />
                        </div>
                        <Switch checked={dmxState.screen.enabled}
                          onCheckedChange={(c) => onSetScreen(dmxState.screen.videoFile, c, !!dmxState.screen.loop)} />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 transition-opacity" style={{ opacity: dmxState.screen.enabled ? 1 : 0.45 }}>
                      <Input value={dmxState.screen.videoFile}
                        onChange={(e) => onSetScreen(e.target.value, dmxState.screen.enabled, !!dmxState.screen.loop)}
                        placeholder="Screen-Video_01.mp4"
                        className="h-7 text-xs font-mono bg-black border-zinc-800 rounded-sm" />
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 10 }, (_, i) => `Screen-Video_${String(i + 1).padStart(2, '0')}.mp4`).map((f) => (
                          <Button key={f} size="sm" variant="outline"
                            className={`font-mono text-[9px] h-6 rounded-sm ${dmxState.screen.videoFile === f ? 'border-accent bg-accent/10 text-accent' : 'border-zinc-800 bg-black text-zinc-600 hover:border-zinc-600'}`}
                            onClick={() => onSetScreen(f, dmxState.screen.enabled, !!dmxState.screen.loop)}>
                            {f.replace('Screen-Video_', 'V').replace('.mp4', '')}
                          </Button>
                        ))}
                      </div>
                      {dmxState.screen.enabled && dmxState.screen.videoFile && (
                        <div className="text-[10px] font-mono text-accent font-bold flex items-center gap-2">
                          ▶ {dmxState.screen.videoFile}
                          {dmxState.screen.loop && <span className="text-zinc-500">∞ LOOP</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* CENTER: LED Zones */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                    <Lightbulb className="w-3 h-3" />
                    LED ZONEN — Art-Net pixel streaming → Gledopto 2D-EXMU
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {ZONES.map(({ key, label, sublabel }) => (
                      <ZonePatternCard
                        key={key}
                        zone={key}
                        label={label}
                        sublabel={sublabel}
                        pattern={dmxState[key].pattern}
                        pixelCount={dmxState[key].pixelCount}
                        onUpdate={(updates) => onSetZone(key, updates)}
                      />
                    ))}
                  </div>
                </div>

                {/* RIGHT: Scene shortcuts + Hardware status */}
                <div className="lg:col-span-3 space-y-4">

                  {/* Scene shortcuts */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Zap className="w-4 h-4" /> SZENEN
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-2 gap-2">
                      {(['nsar','schmerz','opiat','idle','blackout'] as const).map((s) => (
                        <button key={s}
                          onClick={() => s === 'blackout' ? onBlackout() : onLoadScene(s)}
                          className={`font-mono text-[10px] tracking-widest font-bold h-9 rounded-sm border uppercase transition-colors ${
                            s === 'blackout' ? 'border-red-700 bg-red-950/30 text-red-400 hover:bg-red-950/50 col-span-2'
                            : s === 'nsar' ? 'border-blue-800 bg-blue-950/20 text-blue-400 hover:bg-blue-950/40'
                            : s === 'schmerz' ? 'border-orange-800 bg-orange-950/20 text-orange-400 hover:bg-orange-950/40'
                            : s === 'opiat' ? 'border-teal-800 bg-teal-950/20 text-teal-400 hover:bg-teal-950/40'
                            : 'border-zinc-700 bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40'
                          }`}>
                          {s}
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Hardware status */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Cpu className="w-4 h-4" /> HARDWARE STATUS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-2">
                      {[
                        { label: 'Gledopto #1', value: dmxState.hardwareConfig.gledopto1.host, ok: true },
                        { label: 'Gledopto #2', value: dmxState.hardwareConfig.gledopto2.host, ok: true },
                        { label: 'OpenDMX USB', value: dmxState.hardwareConfig.openDmxPort, ok: !dmxState.motor.simulated },
                        { label: 'Motor serial', value: `${dmxState.hardwareConfig.motorPort} (${dmxState.hardwareConfig.motorDriverType})`, ok: !dmxState.motor.simulated },
                        { label: 'GPIO', value: gpio.simulated ? 'simulation' : `/dev/gpiochip${dmxState.hardwareConfig.gpioChip}`, ok: !gpio.simulated },
                        { label: 'Start Button', value: dmxState.startButton?.port ?? '—', ok: !dmxState.startButton?.simulated },
                      ].map(({ label, value, ok }) => (
                        <div key={label} className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-mono text-zinc-600 shrink-0">{label}</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span className="text-[9px] font-mono text-zinc-500 truncate">{value}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Art-Net pixel config */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Radio className="w-4 h-4" /> ART-NET PIXEL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 text-[9px] font-mono text-zinc-500">
                      <div className="space-y-1.5">
                        <div className="flex justify-between"><span className="text-zinc-600">Gledopto #1 IP</span><span>{dmxState.hardwareConfig.gledopto1.host}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Universe start #1</span><span>{dmxState.hardwareConfig.gledopto1.universeStart}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Haube 1 pixels</span><span>{dmxState.hardwareConfig.gledopto1.haube1PixelCount}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Haube 2 pixels</span><span>{dmxState.hardwareConfig.gledopto1.haube2PixelCount}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Schmerz pixels</span><span>{dmxState.hardwareConfig.gledopto1.schmerzPixelCount}</span></div>
                      </div>
                      <div className="border-t border-zinc-800 pt-2 space-y-1.5">
                        <div className="flex justify-between"><span className="text-zinc-600">Gledopto #2 IP</span><span>{dmxState.hardwareConfig.gledopto2.host}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Universe start #2</span><span>{dmxState.hardwareConfig.gledopto2.universeStart}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">NSAR pixels</span><span>{dmxState.hardwareConfig.gledopto2.nsarPixelCount}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Opiat pixels</span><span>{dmxState.hardwareConfig.gledopto2.opiatPixelCount}</span></div>
                      </div>
                      <div className="border-t border-zinc-800 pt-2 flex justify-between">
                        <span className="text-zinc-600">Refresh rate</span><span>{dmxState.hardwareConfig.artnetRefreshRate} Hz</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── PRESETS ───────────────────────────────────────────────────────── */}
          <TabsContent value="presets">
            <div className="max-w-[1400px] mx-auto">
              <PresetEditor />
            </div>
          </TabsContent>

          {/* ── HARDWARE ─────────────────────────────────────────────────────── */}
          <TabsContent value="hardware">
            <div className="max-w-[900px] mx-auto space-y-4">

              {/* GPIO / Reed contacts */}
              <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                  <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" /> GPIO REED CONTACTS — KIPHEBEL
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="bg-[#0a0a0c] border border-zinc-800 rounded-sm p-3 text-xs font-mono text-zinc-500 leading-relaxed space-y-1">
                    <div>GPIO chip: <span className="text-primary">/dev/gpiochip{dmxState.hardwareConfig.gpioChip}</span></div>
                    <div>GPI1 (line {dmxState.hardwareConfig.gpioPinNsar}) → N/NSAR (position −1)</div>
                    <div>GPI2 (line {dmxState.hardwareConfig.gpioPinSchmerz}) → SCHMERZ / center (position 0)</div>
                    <div>GPI3 (line {dmxState.hardwareConfig.gpioPinOpiat}) → O/OPIAT (position +1)</div>
                    <div>Poll: {dmxState.hardwareConfig.gpioPollIntervalMs} ms · Debounce: {dmxState.hardwareConfig.gpioDebounceMs} ms</div>
                    <div className={`font-bold mt-2 ${gpio.simulated ? 'text-yellow-400' : 'text-green-400'}`}>
                      {gpio.simulated ? '⚠ GPIO not detected on this host — reed contacts inactive' : '✓ GPIO hardware active'}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {([-1, 0, 1] as const).map((p) => (
                      <div key={p} className="bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3 text-center">
                        <div className="text-2xl font-black font-mono mb-1" style={{ color: POS_COLOR[p] }}>{p === -1 ? 'N' : p === 0 ? '0' : 'O'}</div>
                        <div className="text-[9px] font-mono text-zinc-500">{POS_LABEL[p]}</div>
                        <div className="text-[9px] font-mono text-zinc-700 mt-1">position: {p}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-zinc-600 mb-3">SIMULATE — test without physical hardware</div>
                    <div className="grid grid-cols-3 gap-3">
                      {([-1, 0, 1] as const).map((p) => (
                        <Button key={p} variant="outline"
                          className={`font-mono text-xs font-bold tracking-wider rounded-sm h-10 border-2 ${
                            pos === p
                              ? p === -1 ? 'border-blue-600 bg-blue-950/30 text-blue-400'
                                : p === 0 ? 'border-orange-600 bg-orange-950/30 text-orange-400'
                                : 'border-teal-600 bg-teal-950/30 text-teal-400'
                              : 'border-zinc-700 bg-black text-zinc-500 hover:border-zinc-500'
                          }`}
                          onClick={() => fetch('/api/dmx/hardware-fader', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ position: p }),
                          }).then(() => inv())}>
                          {p === -1 ? 'N — NSAR' : p === 0 ? '0 — SCHMERZ' : 'O — OPIAT'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hardware config form */}
              {hwConfig && (
                <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                  <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                    <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                      <Settings2 className="w-4 h-4" /> HARDWARE KONFIGURATION
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const g = (k: string) => f.get(k) as string;
                      const n = (k: string) => Number(f.get(k));
                      updateHwConfig.mutate({ data: {
                        ...hwConfig,
                        gledopto1: { ...hwConfig.gledopto1, host: g('g1host'), universeStart: n('g1uni'), haube1PixelCount: n('haube1Pixels'), haube2PixelCount: n('haube2Pixels'), schmerzPixelCount: n('schmerzPixels') },
                        gledopto2: { ...hwConfig.gledopto2, host: g('g2host'), universeStart: n('g2uni'), nsarPixelCount: n('nsarPixels'), opiatPixelCount: n('opiatPixels') },
                        artnetRefreshRate: n('fps'),
                        openDmxPort: g('openDmxPort'),
                        motorPort: g('motorPort'),
                        motorDriverType: g('motorDriverType') as 'grbl' | 'tic' | 'simulated',
                        motorUpPosition: n('motorUp'),
                        motorDownPosition: n('motorDown'),
                        motorMaxSpeed: n('motorSpeed'),
                        gpioChip: n('gpioChip'),
                        gpioPinNsar: n('gpioPinNsar'),
                        gpioPinSchmerz: n('gpioPinSchmerz'),
                        gpioPinOpiat: n('gpioPinOpiat'),
                        gpioPollIntervalMs: n('gpioPoll'),
                        gpioDebounceMs: n('gpioDebounce'),
                      }}, { onSuccess: () => toast.success('Hardware config saved') });
                    }} className="space-y-4">

                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Gledopto #1 — Haube + Schmerz</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">IP Gledopto #1</Label><Input name="g1host" defaultValue={hwConfig.gledopto1.host} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Universe start #1</Label><Input name="g1uni" type="number" defaultValue={hwConfig.gledopto1.universeStart} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Haube 1 pixels</Label><Input name="haube1Pixels" type="number" defaultValue={hwConfig.gledopto1.haube1PixelCount} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Haube 2 pixels</Label><Input name="haube2Pixels" type="number" defaultValue={hwConfig.gledopto1.haube2PixelCount} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Schmerz pixels</Label><Input name="schmerzPixels" type="number" defaultValue={hwConfig.gledopto1.schmerzPixelCount} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                      </div>

                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest border-t border-zinc-800 pt-3">Gledopto #2 — NSAR + Opiat</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">IP Gledopto #2</Label><Input name="g2host" defaultValue={hwConfig.gledopto2.host} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Universe start #2</Label><Input name="g2uni" type="number" defaultValue={hwConfig.gledopto2.universeStart} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">NSAR pixels</Label><Input name="nsarPixels" type="number" defaultValue={hwConfig.gledopto2.nsarPixelCount} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Opiat pixels</Label><Input name="opiatPixels" type="number" defaultValue={hwConfig.gledopto2.opiatPixelCount} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Refresh rate (Hz)</Label><Input name="fps" type="number" defaultValue={hwConfig.artnetRefreshRate} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">OpenDMX port</Label><Input name="openDmxPort" defaultValue={hwConfig.openDmxPort} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                      </div>

                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest border-t border-zinc-800 pt-3">Stepper Motor (USB-TTL)</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Serial port</Label><Input name="motorPort" defaultValue={hwConfig.motorPort} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono text-zinc-600">Driver type</Label>
                          <select name="motorDriverType" defaultValue={hwConfig.motorDriverType}
                            className="h-7 w-full font-mono text-xs bg-black border border-zinc-800 rounded-sm text-zinc-300 px-2">
                            <option value="grbl">GRBL</option>
                            <option value="tic">Pololu Tic</option>
                            <option value="simulated">Simulated</option>
                          </select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">UP position (mm)</Label><Input name="motorUp" type="number" defaultValue={hwConfig.motorUpPosition} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">DOWN position (mm)</Label><Input name="motorDown" type="number" defaultValue={hwConfig.motorDownPosition} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1 col-span-2"><Label className="text-[10px] font-mono text-zinc-600">Max speed (mm/min)</Label><Input name="motorSpeed" type="number" defaultValue={hwConfig.motorMaxSpeed} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                      </div>

                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest border-t border-zinc-800 pt-3">GPIO (Giada AF208-N97)</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">GPIO chip</Label><Input name="gpioChip" type="number" defaultValue={hwConfig.gpioChip} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">GPI1 pin (N/NSAR)</Label><Input name="gpioPinNsar" type="number" defaultValue={hwConfig.gpioPinNsar} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">GPI2 pin (SCHMERZ)</Label><Input name="gpioPinSchmerz" type="number" defaultValue={hwConfig.gpioPinSchmerz} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">GPI3 pin (O/OPIAT)</Label><Input name="gpioPinOpiat" type="number" defaultValue={hwConfig.gpioPinOpiat} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Poll interval (ms)</Label><Input name="gpioPoll" type="number" defaultValue={hwConfig.gpioPollIntervalMs} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-mono text-zinc-600">Debounce (ms)</Label><Input name="gpioDebounce" type="number" defaultValue={hwConfig.gpioDebounceMs} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" /></div>
                      </div>

                      <Button type="submit" variant="secondary" disabled={updateHwConfig.isPending}
                        className="w-full text-[10px] tracking-widest font-mono bg-zinc-800 hover:bg-zinc-700 text-white h-8 rounded-sm">
                        {updateHwConfig.isPending ? 'SPEICHERN...' : 'KONFIGURATION SPEICHERN'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </TooltipProvider>
  );
}
