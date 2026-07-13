import React, { useEffect, useState, useRef } from 'react';
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
  getGetDmxStateQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Power, Activity, Settings2, Wind, Disc, Lightbulb, Zap, Play, Square, FastForward, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const queryClient = useQueryClient();
  
  const { data: dmxState } = useGetDmxState({ query: { refetchInterval: 500 } });
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

  const [syncStrips, setSyncStrips] = useState(true);

  const handleInvalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDmxStateQueryKey() });
  };

  const onSetMode = (mode: 'idle' | 'experience') => {
    setMode.mutate({ data: { mode } }, { onSuccess: handleInvalidate });
  };

  const onSetFan = (speed: number, enabled: boolean) => {
    setFan.mutate({ data: { speed, enabled } }, { onSuccess: handleInvalidate });
  };

  const onSetLedMatrix = (r: number, g: number, b: number, brightness: number, pattern: number, enabled: boolean) => {
    setLedMatrix.mutate({ data: { r, g, b, brightness, pattern, enabled } }, { onSuccess: handleInvalidate });
  };

  const onSetLedStrip1 = (r: number, g: number, b: number, brightness: number, enabled: boolean) => {
    setLedStrips.mutate({ data: { strip1: { r, g, b, brightness, enabled }, sync: syncStrips } }, { onSuccess: handleInvalidate });
  };

  const onSetLedStrip2 = (r: number, g: number, b: number, brightness: number, enabled: boolean) => {
    setLedStrips.mutate({ data: { strip2: { r, g, b, brightness, enabled }, sync: syncStrips } }, { onSuccess: handleInvalidate });
  };

  const onSetDisc = (speed: number, direction: 'cw' | 'ccw' | 'stop', enabled: boolean) => {
    setDisc.mutate({ data: { speed, direction, enabled } }, { onSuccess: handleInvalidate });
  };

  const onSetPainFader = (position: number) => {
    setPainFader.mutate({ data: { position } }, { onSuccess: handleInvalidate });
  };

  const onLoadScene = (scene: 'idle' | 'warmup' | 'experience_low' | 'experience_mid' | 'experience_high' | 'blackout') => {
    loadScene.mutate({ data: { scene } }, { onSuccess: handleInvalidate });
  };

  const onBlackout = () => {
    blackout.mutate(undefined, { onSuccess: handleInvalidate });
  };

  const onSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateConfig.mutate({
      data: {
        host: formData.get('host') as string,
        universe: Number(formData.get('universe')),
        port: Number(formData.get('port')),
        refreshRate: Number(formData.get('refreshRate'))
      }
    }, {
      onSuccess: () => {
        toast.success("Config saved");
      }
    });
  };

  if (!dmxState) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-muted-foreground text-sm uppercase bg-[#050505]">INITIALIZING CONTROLLER...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 p-4 md:p-6 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-4">
        
        {/* Header / Main Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 bg-[#111113] p-4 rounded border border-zinc-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 xl:gap-8">
            <h1 className="text-xl font-black tracking-widest text-white flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              PAINFADER
            </h1>
            
            <div className="h-8 w-px bg-zinc-800 hidden sm:block" />
            
            <div className="flex gap-1 bg-black p-1 rounded border border-zinc-800 shrink-0">
              <Button 
                variant={dmxState.mode === 'idle' ? 'default' : 'ghost'} 
                className={`w-32 uppercase tracking-widest font-bold ${dmxState.mode === 'idle' ? 'bg-primary text-black hover:bg-primary/90' : 'text-zinc-500 hover:text-white'}`}
                onClick={() => onSetMode('idle')}
              >
                IDLE
              </Button>
              <Button 
                variant={dmxState.mode === 'experience' ? 'default' : 'ghost'} 
                className={`w-32 uppercase tracking-widest font-bold ${dmxState.mode === 'experience' ? 'bg-accent text-black hover:bg-accent/90' : 'text-zinc-500 hover:text-white'}`}
                onClick={() => onSetMode('experience')}
              >
                EXPERIENCE
              </Button>
            </div>
            
            <div className="h-8 w-px bg-zinc-800 hidden sm:block" />

            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="font-mono text-xs border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800" onClick={() => onLoadScene('warmup')}>WARMUP</Button>
              <Button variant="outline" size="sm" className="font-mono text-xs border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800" onClick={() => onLoadScene('experience_low')}>LOW</Button>
              <Button variant="outline" size="sm" className="font-mono text-xs border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800" onClick={() => onLoadScene('experience_mid')}>MID</Button>
              <Button variant="outline" size="sm" className="font-mono text-xs border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800" onClick={() => onLoadScene('experience_high')}>HIGH</Button>
            </div>
          </div>
          
          <div className="flex items-center gap-6 justify-between xl:justify-end">
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider">
              <div className={`w-2 h-2 rounded-full ${dmxState.artnetConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={dmxState.artnetConnected ? 'text-green-500' : 'text-red-500'}>
                {dmxState.artnetConnected ? 'TX ACTIVE' : 'OFFLINE'}
              </span>
            </div>
            <Button 
              variant="destructive" 
              className="uppercase tracking-widest font-black shrink-0 px-8 bg-red-600 hover:bg-red-700 text-white"
              onClick={onBlackout}
            >
              BLACKOUT
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* LEFT COLUMN - SENSORS & MOTORS */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="bg-[#111113] border-zinc-800 rounded-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                  <Activity className="w-4 h-4 text-accent" /> PAIN FADER
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-between items-end mb-4">
                  <div className="text-xs font-mono text-zinc-500">POS: {dmxState.painFader.position}</div>
                  <div className="text-[10px] font-mono bg-black px-2 py-1 rounded border border-zinc-800 text-zinc-500">CH: {dmxState.painFader.channel}</div>
                </div>
                <div className="flex justify-between gap-2">
                  {[0, 1, 2, 3, 4].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onSetPainFader(pos)}
                      className={`
                        flex-1 flex flex-col items-center justify-center py-5 rounded border-2 transition-all
                        ${dmxState.painFader.position === pos 
                          ? 'border-accent bg-accent/10 text-accent shadow-[0_0_15px_rgba(230,130,50,0.2)]' 
                          : 'border-zinc-800 bg-black text-zinc-600 hover:border-zinc-700'}
                      `}
                    >
                      <span className="text-xl font-black mb-1 font-mono">{pos}</span>
                      <span className="text-[8px] uppercase tracking-widest">
                        {pos === 0 ? 'Kein' : pos === 4 ? 'Max' : '—'}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800/50 flex justify-between items-center">
                  <span className="text-xs font-mono text-zinc-500">DMX OUT:</span>
                  <span className="font-mono text-primary text-sm font-bold bg-black px-3 py-1 rounded border border-zinc-800">{dmxState.painFader.dmxValue}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111113] border-zinc-800 rounded-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                  <Wind className="w-4 h-4 text-zinc-300" /> FAN
                </CardTitle>
                <Switch 
                  checked={dmxState.fan.enabled} 
                  onCheckedChange={(checked) => onSetFan(dmxState.fan.speed, checked)} 
                />
              </CardHeader>
              <CardContent className="pt-6 opacity-100 transition-opacity" style={{ opacity: dmxState.fan.enabled ? 1 : 0.5 }}>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-zinc-500 font-mono">SPEED</Label>
                    <span className="font-mono text-sm text-primary bg-black px-2 py-1 rounded border border-zinc-800 min-w-[3rem] text-center">{dmxState.fan.speed}</span>
                  </div>
                  <Slider 
                    value={[dmxState.fan.speed]} 
                    min={0} max={255} step={1}
                    onValueChange={([val]) => onSetFan(val, dmxState.fan.enabled)}
                    className="py-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111113] border-zinc-800 rounded-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                  <Disc className="w-4 h-4 text-zinc-300" /> DISC DRIVE
                </CardTitle>
                <Switch 
                  checked={dmxState.disc.enabled} 
                  onCheckedChange={(checked) => onSetDisc(dmxState.disc.speed, dmxState.disc.direction, checked)} 
                />
              </CardHeader>
              <CardContent className="pt-6 space-y-6 transition-opacity" style={{ opacity: dmxState.disc.enabled ? 1 : 0.5 }}>
                <div className="flex gap-2">
                  <Button 
                    variant={dmxState.disc.direction === 'ccw' ? 'secondary' : 'outline'} 
                    size="sm" className={`flex-1 font-mono text-xs ${dmxState.disc.direction === 'ccw' ? 'bg-primary text-black hover:bg-primary/90' : 'bg-black border-zinc-800 text-zinc-400'}`}
                    onClick={() => onSetDisc(dmxState.disc.speed, 'ccw', dmxState.disc.enabled)}
                  >
                    CCW
                  </Button>
                  <Button 
                    variant={dmxState.disc.direction === 'stop' ? 'secondary' : 'outline'} 
                    size="sm" className={`flex-1 font-mono text-xs ${dmxState.disc.direction === 'stop' ? 'bg-red-500 text-white hover:bg-red-600 border-red-500' : 'bg-black border-zinc-800 text-zinc-400'}`}
                    onClick={() => onSetDisc(dmxState.disc.speed, 'stop', dmxState.disc.enabled)}
                  >
                    STOP
                  </Button>
                  <Button 
                    variant={dmxState.disc.direction === 'cw' ? 'secondary' : 'outline'} 
                    size="sm" className={`flex-1 font-mono text-xs ${dmxState.disc.direction === 'cw' ? 'bg-primary text-black hover:bg-primary/90' : 'bg-black border-zinc-800 text-zinc-400'}`}
                    onClick={() => onSetDisc(dmxState.disc.speed, 'cw', dmxState.disc.enabled)}
                  >
                    CW
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-zinc-500 font-mono">SPEED</Label>
                    <span className="font-mono text-sm text-primary bg-black px-2 py-1 rounded border border-zinc-800 min-w-[3rem] text-center">{dmxState.disc.speed}</span>
                  </div>
                  <Slider 
                    value={[dmxState.disc.speed]} 
                    min={0} max={255} step={1}
                    onValueChange={([val]) => onSetDisc(val, dmxState.disc.direction, dmxState.disc.enabled)}
                    className="py-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CENTER COLUMN - LIGHTING */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="bg-[#111113] border-zinc-800 rounded-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                  <Lightbulb className="w-4 h-4 text-zinc-300" /> LED MATRIX
                </CardTitle>
                <Switch 
                  checked={dmxState.ledMatrix.enabled} 
                  onCheckedChange={(checked) => onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, dmxState.ledMatrix.b, dmxState.ledMatrix.brightness, dmxState.ledMatrix.pattern, checked)} 
                />
              </CardHeader>
              <CardContent className="pt-6 space-y-5 transition-opacity" style={{ opacity: dmxState.ledMatrix.enabled ? 1 : 0.5 }}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-mono text-red-500 font-bold">RED</Label>
                    <span className="font-mono text-xs bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.r}</span>
                  </div>
                  <Slider value={[dmxState.ledMatrix.r]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedMatrix(val, dmxState.ledMatrix.g, dmxState.ledMatrix.b, dmxState.ledMatrix.brightness, dmxState.ledMatrix.pattern, dmxState.ledMatrix.enabled)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-mono text-green-500 font-bold">GREEN</Label>
                    <span className="font-mono text-xs bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.g}</span>
                  </div>
                  <Slider value={[dmxState.ledMatrix.g]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedMatrix(dmxState.ledMatrix.r, val, dmxState.ledMatrix.b, dmxState.ledMatrix.brightness, dmxState.ledMatrix.pattern, dmxState.ledMatrix.enabled)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-mono text-blue-500 font-bold">BLUE</Label>
                    <span className="font-mono text-xs bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.b}</span>
                  </div>
                  <Slider value={[dmxState.ledMatrix.b]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, val, dmxState.ledMatrix.brightness, dmxState.ledMatrix.pattern, dmxState.ledMatrix.enabled)} />
                </div>
                
                <div className="pt-4 mt-2 border-t border-zinc-800/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-mono text-zinc-400">BRIGHTNESS</Label>
                      <span className="font-mono text-xs text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.brightness}</span>
                    </div>
                    <Slider value={[dmxState.ledMatrix.brightness]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, dmxState.ledMatrix.b, val, dmxState.ledMatrix.pattern, dmxState.ledMatrix.enabled)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-mono text-zinc-400">PATTERN</Label>
                      <span className="font-mono text-xs text-primary bg-black px-2 py-0.5 rounded border border-zinc-800 w-10 text-right">{dmxState.ledMatrix.pattern}</span>
                    </div>
                    <Slider value={[dmxState.ledMatrix.pattern]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedMatrix(dmxState.ledMatrix.r, dmxState.ledMatrix.g, dmxState.ledMatrix.b, dmxState.ledMatrix.brightness, val, dmxState.ledMatrix.enabled)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111113] border-zinc-800 rounded-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                  <Lightbulb className="w-4 h-4 text-zinc-300" /> LED STRIPS
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="sync" checked={syncStrips} onCheckedChange={(c) => setSyncStrips(!!c)} className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:text-black" />
                    <Label htmlFor="sync" className="text-xs font-mono text-zinc-400 cursor-pointer">SYNC</Label>
                  </div>
                  <Switch 
                    checked={dmxState.ledStrips.strip1.enabled || dmxState.ledStrips.strip2.enabled} 
                    onCheckedChange={(checked) => {
                      onSetLedStrip1(dmxState.ledStrips.strip1.r, dmxState.ledStrips.strip1.g, dmxState.ledStrips.strip1.b, dmxState.ledStrips.strip1.brightness, checked);
                      onSetLedStrip2(dmxState.ledStrips.strip2.r, dmxState.ledStrips.strip2.g, dmxState.ledStrips.strip2.b, dmxState.ledStrips.strip2.brightness, checked);
                    }} 
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-6 opacity-100 transition-opacity" style={{ opacity: dmxState.ledStrips.strip1.enabled || dmxState.ledStrips.strip2.enabled ? 1 : 0.5 }}>
                <div className="grid grid-cols-2 gap-6">
                  {/* Strip 1 */}
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-zinc-500 mb-2 font-bold border-b border-zinc-800 pb-1">STRIP 1</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-red-500">R</span><span className="font-mono text-[10px]">{dmxState.ledStrips.strip1.r}</span></div>
                      <Slider value={[dmxState.ledStrips.strip1.r]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip1(val, dmxState.ledStrips.strip1.g, dmxState.ledStrips.strip1.b, dmxState.ledStrips.strip1.brightness, dmxState.ledStrips.strip1.enabled)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-green-500">G</span><span className="font-mono text-[10px]">{dmxState.ledStrips.strip1.g}</span></div>
                      <Slider value={[dmxState.ledStrips.strip1.g]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip1(dmxState.ledStrips.strip1.r, val, dmxState.ledStrips.strip1.b, dmxState.ledStrips.strip1.brightness, dmxState.ledStrips.strip1.enabled)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-blue-500">B</span><span className="font-mono text-[10px]">{dmxState.ledStrips.strip1.b}</span></div>
                      <Slider value={[dmxState.ledStrips.strip1.b]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip1(dmxState.ledStrips.strip1.r, dmxState.ledStrips.strip1.g, val, dmxState.ledStrips.strip1.brightness, dmxState.ledStrips.strip1.enabled)} />
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-zinc-400">BRIGHT</span><span className="font-mono text-[10px] text-primary">{dmxState.ledStrips.strip1.brightness}</span></div>
                      <Slider value={[dmxState.ledStrips.strip1.brightness]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip1(dmxState.ledStrips.strip1.r, dmxState.ledStrips.strip1.g, dmxState.ledStrips.strip1.b, val, dmxState.ledStrips.strip1.enabled)} />
                    </div>
                  </div>

                  {/* Strip 2 */}
                  <div className="space-y-4" style={{ opacity: syncStrips ? 0.3 : 1, pointerEvents: syncStrips ? 'none' : 'auto' }}>
                    <div className="text-xs font-mono text-zinc-500 mb-2 font-bold border-b border-zinc-800 pb-1">STRIP 2</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-red-500">R</span><span className="font-mono text-[10px]">{dmxState.ledStrips.strip2.r}</span></div>
                      <Slider value={[dmxState.ledStrips.strip2.r]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip2(val, dmxState.ledStrips.strip2.g, dmxState.ledStrips.strip2.b, dmxState.ledStrips.strip2.brightness, dmxState.ledStrips.strip2.enabled)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-green-500">G</span><span className="font-mono text-[10px]">{dmxState.ledStrips.strip2.g}</span></div>
                      <Slider value={[dmxState.ledStrips.strip2.g]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip2(dmxState.ledStrips.strip2.r, val, dmxState.ledStrips.strip2.b, dmxState.ledStrips.strip2.brightness, dmxState.ledStrips.strip2.enabled)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-blue-500">B</span><span className="font-mono text-[10px]">{dmxState.ledStrips.strip2.b}</span></div>
                      <Slider value={[dmxState.ledStrips.strip2.b]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip2(dmxState.ledStrips.strip2.r, dmxState.ledStrips.strip2.g, val, dmxState.ledStrips.strip2.brightness, dmxState.ledStrips.strip2.enabled)} />
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-zinc-400">BRIGHT</span><span className="font-mono text-[10px] text-primary">{dmxState.ledStrips.strip2.brightness}</span></div>
                      <Slider value={[dmxState.ledStrips.strip2.brightness]} min={0} max={255} step={1} onValueChange={([val]) => onSetLedStrip2(dmxState.ledStrips.strip2.r, dmxState.ledStrips.strip2.g, dmxState.ledStrips.strip2.b, val, dmxState.ledStrips.strip2.enabled)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - MONITOR & CONFIG */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-[#111113] border-zinc-800 rounded-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618]">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center gap-2 text-zinc-400 uppercase">
                  <Settings2 className="w-4 h-4 text-zinc-300" /> ART-NET CONFIG
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {dmxConfig && (
                  <form onSubmit={onSaveConfig} className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-mono text-zinc-500">HOST IP</Label>
                        <Input name="host" defaultValue={dmxConfig.host} className="h-8 font-mono text-xs bg-[#0a0a0c] border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 rounded-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-mono text-zinc-500">UNIVERSE</Label>
                          <Input name="universe" type="number" defaultValue={dmxConfig.universe} className="h-8 font-mono text-xs bg-[#0a0a0c] border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 rounded-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-mono text-zinc-500">PORT</Label>
                          <Input name="port" type="number" defaultValue={dmxConfig.port} className="h-8 font-mono text-xs bg-[#0a0a0c] border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 rounded-sm" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-mono text-zinc-500">REFRESH RATE (MS)</Label>
                        <Input name="refreshRate" type="number" defaultValue={dmxConfig.refreshRate} className="h-8 font-mono text-xs bg-[#0a0a0c] border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 rounded-sm" />
                      </div>
                    </div>
                    <Button type="submit" variant="secondary" className="w-full text-[10px] tracking-widest font-mono bg-zinc-800 hover:bg-zinc-700 text-white h-8 rounded-sm">APPLY CONFIG</Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#111113] border-zinc-800 rounded-sm flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b border-zinc-800/50 bg-[#161618] py-3">
                <CardTitle className="text-xs font-mono tracking-widest flex items-center justify-between text-zinc-400 uppercase">
                  <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-zinc-300" /> DMX MONITOR</span>
                  <span className="text-[10px] text-zinc-600">CH 1-64</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="bg-[#050505] p-3 font-mono text-[10px] text-zinc-600 h-[380px] overflow-y-auto custom-scrollbar leading-tight border-t border-black">
                  <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
                    {dmxState.channels.slice(0, 64).map((val, i) => (
                      <div key={i} className="flex justify-between items-center group hover:bg-zinc-900 rounded px-1 -mx-1">
                        <span className="text-zinc-600 group-hover:text-zinc-400">{String(i + 1).padStart(3, '0')}</span>
                        <span className={`transition-colors ${val > 0 ? 'text-primary font-bold' : 'text-zinc-800 group-hover:text-zinc-600'}`}>{String(val).padStart(3, '0')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
