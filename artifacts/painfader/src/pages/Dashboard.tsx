import React, { useState, useEffect, useRef } from 'react';
import {
  useGetDmxState,
  useGetDmxConfig,
  useUpdateDmxConfig,
  useSetMode,
  useSetFan,
  useSetLedMatrix,
  useSetLedStrips,
  useSetDisc,
  useSetPainFader,
  useLoadScene,
  useBlackout,
  useHardwareFaderInput,
  getGetDmxStateQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Activity, Settings2, Wind, Disc, Lightbulb, Zap, AlertTriangle, Clock, Cpu, HelpCircle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import PresetEditor from '@/components/PresetEditor';
import HelpModal from '@/components/HelpModal';

const FADER_LABELS = ['SCHMERZ MAX', 'OPIOID LOW', 'OPIOID HIGH', 'NSAR LOW', 'NSAR HIGH'];
const FADER_COLORS = ['#ef4444', '#a855f7', '#3b82f6', '#10b981', '#22c55e'];
const FADER_BG = [
  'border-red-700 bg-red-950/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
  'border-purple-700 bg-purple-950/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
  'border-blue-700 bg-blue-950/20 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
  'border-emerald-700 bg-emerald-950/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
  'border-green-700 bg-green-950/20 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.15)]',
];
const FADER_INACTIVE = 'border-zinc-800 bg-black text-zinc-600 hover:border-zinc-700 hover:text-zinc-400';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [syncStrips, setSyncStrips] = useState(true);
  const [mainTab, setMainTab] = useState('live');
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: dmxState } = useGetDmxState({ query: { queryKey: getGetDmxStateQueryKey(), refetchInterval: 500 } });
  const { data: dmxConfig } = useGetDmxConfig();

  const updateConfig = useUpdateDmxConfig();
  const setMode = useSetMode();
  const setFan = useSetFan();
  const setLedMatrix = useSetLedMatrix();
  const setLedStrips = useSetLedStrips();
  const setDisc = useSetDisc();
  const setPainFader = useSetPainFader();
  const loadScene = useLoadScene();
  const blackout = useBlackout();
  const applyPosition = useHardwareFaderInput();

  const inv = () => queryClient.invalidateQueries({ queryKey: getGetDmxStateQueryKey() });

  const onSetMode = (mode: 'idle' | 'experience') =>
    setMode.mutate({ data: { mode } }, { onSuccess: inv });

  const onSetFan = (speed: number, enabled: boolean) =>
    setFan.mutate({ data: { speed, enabled } }, { onSuccess: inv });

  const onSetLedMatrix = (r: number, g: number, b: number, brightness: number, pattern: number, enabled: boolean) =>
    setLedMatrix.mutate({ data: { r, g, b, brightness, pattern, enabled } }, { onSuccess: inv });

  const onSetLedStrip1 = (r: number, g: number, b: number, brightness: number, enabled: boolean) =>
    setLedStrips.mutate({ data: { strip1: { r, g, b, brightness, enabled }, sync: syncStrips } }, { onSuccess: inv });

  const onSetLedStrip2 = (r: number, g: number, b: number, brightness: number, enabled: boolean) =>
    setLedStrips.mutate({ data: { strip2: { r, g, b, brightness, enabled } } }, { onSuccess: inv });

  const onSetDisc = (speed: number, direction: 'cw' | 'ccw' | 'stop', enabled: boolean) =>
    setDisc.mutate({ data: { speed, direction, enabled } }, { onSuccess: inv });

  const onSetPainFader = (position: number) =>
    setPainFader.mutate({ data: { position } }, { onSuccess: inv });

  const onLoadScene = (scene: 'idle' | 'warmup' | 'experience_low' | 'experience_mid' | 'experience_high' | 'blackout') =>
    loadScene.mutate({ data: { scene } }, { onSuccess: inv });

  const onBlackout = () =>
    blackout.mutate(undefined, {
      onSuccess: () => {
        inv();
        toast.error('BLACKOUT', { description: 'All channels zeroed' });
      },
    });

  const onSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    updateConfig.mutate(
      {
        data: {
          host: f.get('host') as string,
          universe: Number(f.get('universe')),
          port: Number(f.get('port')),
          refreshRate: Number(f.get('refreshRate')),
        },
      },
      { onSuccess: () => toast.success('Art-Net config saved') }
    );
  };

  const [lastKey, setLastKey] = useState<string | null>(null);
  const lastKeyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (['0','1','2','3','4'].includes(k)) {
        const p = parseInt(k, 10) as 0|1|2|3|4;
        applyPosition.mutate({ data: { position: p } }, { onSuccess: inv });
        setLastKey(k.toUpperCase());
      } else if (k === 'i') {
        onLoadScene('idle');
        setLastKey('I');
      } else if (k === 'b') {
        onBlackout();
        setLastKey('B');
      } else {
        return;
      }
      if (lastKeyTimer.current) clearTimeout(lastKeyTimer.current);
      lastKeyTimer.current = setTimeout(() => setLastKey(null), 800);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!dmxState) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-zinc-600 text-sm uppercase tracking-widest bg-[#050505]">
        INITIALIZING CONTROLLER...
      </div>
    );
  }

  const timer = dmxState.idleTimer ?? { enabled: false, timerSeconds: 30, remaining: null, triggered: false };
  const timerPct = timer.remaining !== null && timer.timerSeconds > 0
    ? (timer.remaining / timer.timerSeconds) * 100
    : null;

  const pos = dmxState.painFader.position;

  return (
    <TooltipProvider delayDuration={400}>
    <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-[#0d0d0f] border-b border-zinc-800 px-4 md:px-6 py-3 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 xl:gap-6">
          <h1 className="text-lg font-black tracking-widest text-white flex items-center gap-2.5 shrink-0">
            <Zap className="w-4 h-4 text-primary" />
            PAINFADER
          </h1>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          <div className="flex gap-1 bg-black p-1 rounded border border-zinc-800 shrink-0">
            <Button
              variant="ghost"
              className={`h-7 px-5 uppercase tracking-widest font-bold text-xs rounded-sm ${
                dmxState.mode === 'idle' ? 'bg-primary text-black hover:bg-primary/90' : 'text-zinc-500 hover:text-white'
              }`}
              onClick={() => onSetMode('idle')}
            >
              IDLE
            </Button>
            <Button
              variant="ghost"
              className={`h-7 px-5 uppercase tracking-widest font-bold text-xs rounded-sm ${
                dmxState.mode === 'experience' ? 'bg-accent text-black hover:bg-accent/90' : 'text-zinc-500 hover:text-white'
              }`}
              onClick={() => onSetMode('experience')}
            >
              EXPERIENCE
            </Button>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          <div className="flex gap-1.5 shrink-0 flex-wrap">
            {([2, 1, 0, 3, 4] as const).map((p) => {
              const isActive = dmxState.painFader.position === p;
              const activeStyle = [
                'border-red-600 bg-red-950/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
                'border-purple-600 bg-purple-950/30 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]',
                'border-blue-600 bg-blue-950/30 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]',
                'border-emerald-600 bg-emerald-950/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
                'border-green-600 bg-green-950/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
              ][p];
              return (
                <Tooltip key={p}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`font-mono text-[10px] h-7 px-2.5 rounded-sm transition-all flex items-center gap-1.5 ${isActive ? activeStyle : 'border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                      onClick={() => applyPosition.mutate({ data: { position: p } }, { onSuccess: inv })}
                    >
                      POS {p}
                      <kbd className={`text-[8px] px-1 rounded border font-mono leading-tight ${lastKey === String(p) ? 'border-current bg-current/20' : 'border-zinc-700 bg-zinc-900 text-zinc-600'}`}>{p}</kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="font-mono text-[10px]">
                    Press <kbd className="px-1 border border-zinc-600 rounded text-[9px]">{p}</kbd> — {FADER_LABELS[p]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 justify-between xl:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider cursor-default">
                <div className={`w-2 h-2 rounded-full ${dmxState.artnetConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={dmxState.artnetConnected ? 'text-green-500' : 'text-red-500'}>
                  {dmxState.artnetConnected ? 'TX ACTIVE' : 'OFFLINE'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-[10px]">
              Art-Net UDP packets broadcasting to {dmxState.artnetConnected ? 'network' : 'no target — socket error'}
            </TooltipContent>
          </Tooltip>

          {dmxState.hardwareLastSeen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[10px] font-mono text-zinc-600 hidden md:flex items-center gap-1 cursor-default">
                  <Cpu className="w-3 h-3" />
                  HW {Math.round((Date.now() - dmxState.hardwareLastSeen) / 1000)}s ago
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-[10px]">
                Last hardware fader POST received {Math.round((Date.now() - dmxState.hardwareLastSeen) / 1000)}s ago
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-sm"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-[10px]">
              Open operator manual
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                className="uppercase tracking-widest font-black shrink-0 px-4 h-8 bg-red-600 hover:bg-red-700 text-white text-xs rounded-sm flex items-center gap-2"
                onClick={onBlackout}
              >
                BLACKOUT
                <kbd className={`text-[8px] px-1 rounded border font-mono leading-tight ${lastKey === 'B' ? 'border-white bg-white/20 text-white' : 'border-red-400/40 bg-red-900/40 text-red-300'}`}>B</kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-[10px] bg-red-950 border-red-800 text-red-300">
              Emergency — zeros ALL 512 DMX channels instantly
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="p-4 md:p-6">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="bg-black border border-zinc-800 rounded-sm p-1 mb-5 h-auto">
            <TabsTrigger value="live" className="font-mono text-[11px] tracking-widest rounded-sm px-5 h-7 data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500">
              LIVE CONTROL
            </TabsTrigger>
            <TabsTrigger value="presets" className="font-mono text-[11px] tracking-widest rounded-sm px-5 h-7 data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500">
              PRESETS
            </TabsTrigger>
            <TabsTrigger value="hardware" className="font-mono text-[11px] tracking-widest rounded-sm px-5 h-7 data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500">
              HARDWARE INPUT
            </TabsTrigger>
          </TabsList>

          {/* ── LIVE TAB ── */}
          <TabsContent value="live">
            <div className="max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* LEFT — fader + fan + disc */}
                <div className="lg:col-span-4 space-y-4">

                  {/* PAIN FADER */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Activity className="w-4 h-4 text-accent" /> PAIN FADER
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex justify-between items-end mb-3">
                        <div className="text-[10px] font-mono text-zinc-500">
                          POS: <span style={{ color: FADER_COLORS[pos] }} className="font-bold">{pos}</span>
                          {' — '}
                          <span style={{ color: FADER_COLORS[pos] }}>{FADER_LABELS[pos]}</span>
                        </div>
                        <div className="text-[10px] font-mono bg-black px-2 py-0.5 rounded border border-zinc-800 text-zinc-500">CH: {dmxState.painFader.channel}</div>
                      </div>

                      <div className="flex justify-between gap-2 mb-4">
                        {([2, 1, 0, 3, 4] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => applyPosition.mutate({ data: { position: p } }, { onSuccess: inv })}
                            className={`flex-1 flex flex-col items-center justify-center py-4 rounded border-2 transition-all ${
                              pos === p ? FADER_BG[p] : FADER_INACTIVE
                            } ${p === 0 ? 'ring-1 ring-zinc-700' : ''}`}
                          >
                            <span className="text-lg font-black mb-0.5 font-mono">{p}</span>
                            <span className="text-[8px] uppercase tracking-widest leading-tight text-center px-0.5">
                              {p === 0 ? 'SCHMERZ' : p === 1 ? 'OPI L' : p === 2 ? 'OPI H' : p === 3 ? 'NSR L' : 'NSR H'}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Idle timer countdown */}
                      {timer.enabled && pos === 0 && timerPct !== null && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-zinc-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> IDLE TIMER</span>
                            <span className={timer.remaining !== null && timer.remaining < 5 ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}>
                              {timer.remaining !== null ? `${timer.remaining.toFixed(1)}s` : 'STANDBY'}
                            </span>
                          </div>
                          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${timerPct}%`,
                                backgroundColor: timerPct > 40 ? '#22c55e' : timerPct > 15 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {timer.triggered && pos === 0 && (
                        <div className="mt-2 text-[10px] font-mono text-primary text-center tracking-widest animate-pulse">
                          IDLE MODE ACTIVE
                        </div>
                      )}
                      {timer.enabled && pos === 0 && timerPct === null && !timer.triggered && (
                        <div className="mt-2 text-[10px] font-mono text-zinc-700 text-center tracking-widest">
                          TIMER ARMED — {timer.timerSeconds}s
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-500">DMX OUT:</span>
                        <span className="font-mono text-sm font-bold bg-black px-3 py-1 rounded border border-zinc-800" style={{ color: FADER_COLORS[pos] }}>
                          {dmxState.painFader.dmxValue}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* FAN */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Wind className="w-4 h-4" /> FAN
                      </CardTitle>
                      <Switch
                        checked={dmxState.fan.enabled}
                        onCheckedChange={(c) => onSetFan(dmxState.fan.speed, c)}
                      />
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4 transition-opacity" style={{ opacity: dmxState.fan.enabled ? 1 : 0.45 }}>
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] text-zinc-500 font-mono">SPEED (DMX)</Label>
                        <span className="font-mono text-sm text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 min-w-[3rem] text-center">{dmxState.fan.speed}</span>
                      </div>
                      <Slider
                        value={[dmxState.fan.speed]}
                        min={0} max={255} step={1}
                        onValueChange={([v]) => onSetFan(v, dmxState.fan.enabled)}
                      />
                    </CardContent>
                  </Card>

                  {/* DISC */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Disc className="w-4 h-4" /> DISC DRIVE
                      </CardTitle>
                      <Switch
                        checked={dmxState.disc.enabled}
                        onCheckedChange={(c) => onSetDisc(dmxState.disc.speed, dmxState.disc.direction, c)}
                      />
                    </CardHeader>
                    <CardContent className="pt-5 space-y-5 transition-opacity" style={{ opacity: dmxState.disc.enabled ? 1 : 0.45 }}>
                      <div className="flex gap-2">
                        {(['ccw', 'stop', 'cw'] as const).map((d) => (
                          <Button
                            key={d}
                            size="sm"
                            variant="outline"
                            className={`flex-1 font-mono text-[10px] tracking-widest rounded-sm ${
                              dmxState.disc.direction === d
                                ? d === 'stop'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-primary text-black border-primary'
                                : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600'
                            }`}
                            onClick={() => onSetDisc(dmxState.disc.speed, d, dmxState.disc.enabled)}
                          >
                            {d.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] text-zinc-500 font-mono">SPEED</Label>
                          <span className="font-mono text-sm text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 min-w-[3rem] text-center">{dmxState.disc.speed}</span>
                        </div>
                        <Slider
                          value={[dmxState.disc.speed]}
                          min={0} max={255} step={1}
                          onValueChange={([v]) => onSetDisc(v, dmxState.disc.direction, dmxState.disc.enabled)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* CENTER — LEDs */}
                <div className="lg:col-span-5 space-y-4">

                  {/* LED MATRIX */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Lightbulb className="w-4 h-4" /> LED MATRIX
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-sm border border-zinc-700"
                          style={{
                            backgroundColor: dmxState.ledMatrix.enabled
                              ? `rgb(${dmxState.ledMatrix.r},${dmxState.ledMatrix.g},${dmxState.ledMatrix.b})`
                              : 'transparent',
                          }}
                        />
                        <Switch
                          checked={dmxState.ledMatrix.enabled}
                          onCheckedChange={(c) =>
                            onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, dmxState.ledMatrix.b, dmxState.ledMatrix.brightness, dmxState.ledMatrix.pattern, c)
                          }
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4 transition-opacity" style={{ opacity: dmxState.ledMatrix.enabled ? 1 : 0.45 }}>
                      {[
                        { label: 'RED', key: 'r' as const, color: 'text-red-500' },
                        { label: 'GREEN', key: 'g' as const, color: 'text-green-500' },
                        { label: 'BLUE', key: 'b' as const, color: 'text-blue-500' },
                      ].map(({ label, key, color }) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className={`text-[10px] font-mono font-bold ${color}`}>{label}</Label>
                            <span className="font-mono text-[10px] bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix[key]}</span>
                          </div>
                          <Slider
                            value={[dmxState.ledMatrix[key]]}
                            min={0} max={255} step={1}
                            onValueChange={([v]) =>
                              onSetLedMatrix(
                                key === 'r' ? v : dmxState.ledMatrix.r,
                                key === 'g' ? v : dmxState.ledMatrix.g,
                                key === 'b' ? v : dmxState.ledMatrix.b,
                                dmxState.ledMatrix.brightness,
                                dmxState.ledMatrix.pattern,
                                dmxState.ledMatrix.enabled
                              )
                            }
                          />
                        </div>
                      ))}
                      <div className="pt-3 border-t border-zinc-800/50 space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] font-mono text-zinc-400">BRIGHTNESS</Label>
                            <span className="font-mono text-[10px] text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.brightness}</span>
                          </div>
                          <Slider
                            value={[dmxState.ledMatrix.brightness]}
                            min={0} max={255} step={1}
                            onValueChange={([v]) =>
                              onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, dmxState.ledMatrix.b, v, dmxState.ledMatrix.pattern, dmxState.ledMatrix.enabled)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] font-mono text-zinc-400">PATTERN</Label>
                            <span className="font-mono text-[10px] text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.pattern}</span>
                          </div>
                          <Slider
                            value={[dmxState.ledMatrix.pattern]}
                            min={0} max={255} step={1}
                            onValueChange={([v]) =>
                              onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, dmxState.ledMatrix.b, dmxState.ledMatrix.brightness, v, dmxState.ledMatrix.enabled)
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* LED STRIPS */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Lightbulb className="w-4 h-4" /> LED STRIPS
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id="sync"
                            checked={syncStrips}
                            onCheckedChange={(c) => setSyncStrips(!!c)}
                            className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:text-black w-3.5 h-3.5"
                          />
                          <Label htmlFor="sync" className="text-[10px] font-mono text-zinc-500 cursor-pointer">SYNC</Label>
                        </div>
                        <Switch
                          checked={dmxState.ledStrips.strip1.enabled || dmxState.ledStrips.strip2.enabled}
                          onCheckedChange={(c) => {
                            onSetLedStrip1(dmxState.ledStrips.strip1.r, dmxState.ledStrips.strip1.g, dmxState.ledStrips.strip1.b, dmxState.ledStrips.strip1.brightness, c);
                            onSetLedStrip2(dmxState.ledStrips.strip2.r, dmxState.ledStrips.strip2.g, dmxState.ledStrips.strip2.b, dmxState.ledStrips.strip2.brightness, c);
                          }}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5 transition-opacity" style={{ opacity: (dmxState.ledStrips.strip1.enabled || dmxState.ledStrips.strip2.enabled) ? 1 : 0.45 }}>
                      <div className="grid grid-cols-2 gap-5">
                        {[
                          { label: 'STRIP 1', strip: dmxState.ledStrips.strip1, setVal: onSetLedStrip1 },
                          { label: 'STRIP 2', strip: dmxState.ledStrips.strip2, setVal: onSetLedStrip2, disabled: syncStrips },
                        ].map(({ label, strip, setVal, disabled }) => (
                          <div key={label} className={`space-y-3 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="text-[10px] font-mono text-zinc-500 font-bold border-b border-zinc-800 pb-1 flex items-center justify-between">
                              <span>{label}</span>
                              <div
                                className="w-4 h-4 rounded-sm border border-zinc-700"
                                style={{
                                  backgroundColor: strip.enabled
                                    ? `rgb(${strip.r},${strip.g},${strip.b})`
                                    : 'transparent',
                                }}
                              />
                            </div>
                            {[
                              { k: 'r' as const, c: 'text-red-500' },
                              { k: 'g' as const, c: 'text-green-500' },
                              { k: 'b' as const, c: 'text-blue-500' },
                            ].map(({ k, c }) => (
                              <div key={k} className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className={`text-[9px] font-mono ${c}`}>{k.toUpperCase()}</span>
                                  <span className="font-mono text-[9px]">{strip[k]}</span>
                                </div>
                                <Slider
                                  value={[strip[k]]}
                                  min={0} max={255} step={1}
                                  onValueChange={([v]) =>
                                    setVal(
                                      k === 'r' ? v : strip.r,
                                      k === 'g' ? v : strip.g,
                                      k === 'b' ? v : strip.b,
                                      strip.brightness,
                                      strip.enabled
                                    )
                                  }
                                />
                              </div>
                            ))}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-mono text-zinc-400">BRIGHT</span>
                                <span className="font-mono text-[9px] text-primary">{strip.brightness}</span>
                              </div>
                              <Slider
                                value={[strip.brightness]}
                                min={0} max={255} step={1}
                                onValueChange={([v]) => setVal(strip.r, strip.g, strip.b, v, strip.enabled)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT — config + monitor */}
                <div className="lg:col-span-3 space-y-4">
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                        <Settings2 className="w-4 h-4" /> ART-NET CONFIG
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {dmxConfig && (
                        <form onSubmit={onSaveConfig} className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-mono text-zinc-500">HOST IP</Label>
                            <Input name="host" defaultValue={dmxConfig.host} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-mono text-zinc-500">UNIVERSE</Label>
                              <Input name="universe" type="number" defaultValue={dmxConfig.universe} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-mono text-zinc-500">PORT</Label>
                              <Input name="port" type="number" defaultValue={dmxConfig.port} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-mono text-zinc-500">REFRESH RATE (Hz)</Label>
                            <Input name="refreshRate" type="number" defaultValue={dmxConfig.refreshRate} className="h-7 font-mono text-xs bg-black border-zinc-800 rounded-sm" />
                          </div>
                          <Button type="submit" variant="secondary" className="w-full text-[10px] tracking-widest font-mono bg-zinc-800 hover:bg-zinc-700 text-white h-7 rounded-sm">
                            APPLY CONFIG
                          </Button>
                        </form>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                    <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] py-3">
                      <CardTitle className="text-xs font-mono tracking-widest flex items-center justify-between text-zinc-400 uppercase">
                        <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> DMX MONITOR</span>
                        <span className="text-[10px] text-zinc-600">CH 1-64</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="bg-[#050505] p-3 font-mono text-[10px] text-zinc-600 h-[340px] overflow-y-auto leading-tight">
                        <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                          {dmxState.channels.slice(0, 64).map((val, i) => (
                            <div key={i} className="flex justify-between items-center hover:bg-zinc-900 rounded px-1 -mx-1">
                              <span className="text-zinc-700">{String(i + 1).padStart(3, '0')}</span>
                              <span className={val > 0 ? 'text-primary font-bold' : 'text-zinc-800'}>{String(val).padStart(3, '0')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </div>
            </div>
          </TabsContent>

          {/* ── PRESETS TAB ── */}
          <TabsContent value="presets">
            <div className="max-w-[1400px] mx-auto">
              <PresetEditor />
            </div>
          </TabsContent>

          {/* ── HARDWARE INPUT TAB ── */}
          <TabsContent value="hardware">
            <div className="max-w-[900px] mx-auto space-y-4">
              <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                  <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                    <Cpu className="w-4 h-4 text-primary" /> HARDWARE FADER INPUT
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  <div className="flex items-center gap-4 p-3 bg-[#0d0d0f] border border-zinc-800 rounded-sm">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${dmxState.hardwareLastSeen ? 'bg-green-500' : 'bg-zinc-700'}`} />
                    <div>
                      <div className="text-xs font-mono text-zinc-300">
                        {dmxState.hardwareLastSeen
                          ? `LAST SIGNAL: ${Math.round((Date.now() - dmxState.hardwareLastSeen) / 1000)}s ago`
                          : 'NO HARDWARE SIGNAL RECEIVED YET'}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600 mt-0.5">
                        Current position: {dmxState.painFader.position} — {FADER_LABELS[dmxState.painFader.position]}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-mono text-zinc-500 tracking-widest">ENDPOINT</div>
                    <div className="bg-black border border-zinc-800 rounded-sm p-3 font-mono text-xs text-primary">
                      POST /api/dmx/hardware-fader
                    </div>
                    <div className="bg-black border border-zinc-800 rounded-sm p-3 font-mono text-xs text-zinc-400">
                      {`{ "position": 0 }   // 0 = SCHMERZ MAX (spring default)\n{ "position": 1 }   // 1 = OPIOID LOW\n{ "position": 2 }   // 2 = OPIOID HIGH\n{ "position": 3 }   // 3 = NSAR LOW\n{ "position": 4 }   // 4 = NSAR HIGH`}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-mono text-zinc-500 tracking-widest">BEHAVIOR</div>
                    <div className="space-y-2 text-[11px] font-mono text-zinc-500 leading-relaxed bg-[#0d0d0f] border border-zinc-800 rounded-sm p-3">
                      <div>• <span className="text-zinc-300">Position 1–4:</span> Switches to EXPERIENCE mode and fires the configured preset for that position immediately.</div>
                      <div>• <span className="text-zinc-300">Position 0:</span> Spring brings fader here. Starts the idle countdown timer (configured in PRESETS tab). After the timer expires, fires the IDLE preset and switches to IDLE mode.</div>
                      <div>• <span className="text-zinc-300">Timer interruption:</span> If the fader moves to any position 1–4 during the countdown, the timer resets.</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-mono text-zinc-500 tracking-widest">ARDUINO / RASPBERRY PI EXAMPLE</div>
                    <div className="bg-black border border-zinc-800 rounded-sm p-3 font-mono text-[10px] text-zinc-400 whitespace-pre leading-relaxed overflow-x-auto">
{`// Arduino (with WiFi or Ethernet)
void sendFaderPosition(int position) {
  HTTPClient http;
  http.begin("http://<THIS_PC_IP>/api/dmx/hardware-fader");
  http.addHeader("Content-Type", "application/json");
  String body = "{\\"position\\":" + String(position) + "}";
  http.POST(body);
  http.end();
}

// Read 5-position switch and send on change
int lastPos = -1;
void loop() {
  int pos = readFaderPosition(); // 0-4
  if (pos != lastPos) {
    sendFaderPosition(pos);
    lastPos = pos;
  }
}`}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-mono text-zinc-500 tracking-widest">TEST FROM CURL (WINDOWS)</div>
                    <div className="bg-black border border-zinc-800 rounded-sm p-3 font-mono text-[10px] text-zinc-400 whitespace-pre overflow-x-auto">
                      {`curl -X POST http://localhost/api/dmx/hardware-fader -H "Content-Type: application/json" -d "{\\"position\\":2}"`}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111113] border-zinc-800 rounded-sm">
                <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                  <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> SIMULATE HARDWARE INPUT
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-[10px] font-mono text-zinc-600 mb-4">Test hardware fader positions without physical hardware</div>
                  <div className="flex gap-2 flex-wrap">
                    {([2, 1, 0, 3, 4] as const).map((p) => (
                      <Button
                        key={p}
                        variant="outline"
                        size="sm"
                        className="font-mono text-[10px] tracking-widest border-zinc-700 bg-black hover:bg-zinc-900 rounded-sm h-8"
                        style={{
                          color: FADER_COLORS[p],
                          borderColor: dmxState.painFader.position === p ? FADER_COLORS[p] : undefined,
                        }}
                        onClick={() => {
                          fetch('/api/dmx/hardware-fader', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ position: p }),
                          }).then(() => inv());
                        }}
                      >
                        POS {p} — {FADER_LABELS[p]}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
    </TooltipProvider>
  );
}
