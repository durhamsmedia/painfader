"""
Patch: adds Start Button card + status row to Dashboard.tsx.
Run as: python3 patch-dashboard.py
"""
import sys, pathlib

p = pathlib.Path('/opt/painfader/artifacts/painfader/src/pages/Dashboard.tsx')
t = p.read_text()

# ── 1  Add PlayCircle to icon imports ────────────────────────────────────────
OLD1 = "  Monitor, ChevronsUpDown, Radio, Waves,\n} from 'lucide-react';"
NEW1 = "  Monitor, ChevronsUpDown, Radio, Waves, PlayCircle,\n} from 'lucide-react';"
if OLD1 not in t:
    sys.exit("FAIL: icon import not found — already patched or wrong file?")
t = t.replace(OLD1, NEW1, 1)

# ── 2  Add btnFlash state + onStartButton handler (before keyboard shortcuts) ─
OLD2 = "  // ── Keyboard shortcuts ─────────────────────────────────────────────────────"
NEW2 = """\
  // ── Start button ──────────────────────────────────────────────────────────────
  const [btnFlash, setBtnFlash] = useState(false);
  const onStartButton = async () => {
    await fetch('/api/dmx/start-button', { method: 'POST' });
    queryClient.invalidateQueries({ queryKey: getGetDmxStateQueryKey() });
    setBtnFlash(true);
    setTimeout(() => setBtnFlash(false), 600);
    toast.success('START', { description: 'Button pressed \u2014 mode toggled' });
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────"""
if OLD2 not in t:
    sys.exit("FAIL: keyboard shortcuts comment not found")
t = t.replace(OLD2, NEW2, 1)

# ── 3  Insert Start Button card before Fan card ───────────────────────────────
OLD3 = "                  {/* FAN */}\n                  <Card className=\"bg-[#111113] border-zinc-800 rounded-sm\">"
NEW3 = """\
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
                      <button onClick={onStartButton}
                        className={`w-full h-16 rounded-sm border-2 font-black tracking-widest text-sm uppercase transition-all flex items-center justify-center gap-2 select-none ${
                          btnFlash
                            ? 'border-green-400 bg-green-900/60 text-green-300 shadow-[0_0_20px_rgba(74,222,128,0.5)]'
                            : 'border-zinc-700 bg-black text-zinc-300 hover:border-green-600 hover:bg-green-950/30 hover:text-green-300'
                        }`}>
                        <PlayCircle className={`w-5 h-5 ${btnFlash ? 'text-green-300' : 'text-zinc-500'}`} />
                        START
                      </button>
                      <div className="text-[9px] font-mono text-zinc-700 flex justify-between">
                        <span>{dmxState.startButton?.port ?? '/dev/ttyUSB2'}</span>
                        <span>{dmxState.mode === 'idle' ? '\u2192 EXPERIENCE' : '\u2192 restart timer'}</span>
                      </div>
                      {!dmxState.startButton?.simulated && (
                        <div className="text-[9px] font-mono text-green-600 text-center">Physischer Taster aktiv</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* FAN */}
                  <Card className="bg-[#111113] border-zinc-800 rounded-sm">"""
if OLD3 not in t:
    sys.exit("FAIL: FAN card marker not found")
t = t.replace(OLD3, NEW3, 1)

# ── 4  Add Start Button row to Hardware Status ────────────────────────────────
OLD4 = "                        { label: 'GPIO', value: gpio.simulated ? 'simulation' : `/dev/gpiochip${dmxState.hardwareConfig.gpioChip}`, ok: !gpio.simulated },"
NEW4 = """\
                        { label: 'GPIO', value: gpio.simulated ? 'simulation' : `/dev/gpiochip${dmxState.hardwareConfig.gpioChip}`, ok: !gpio.simulated },
                        { label: 'Start Button', value: dmxState.startButton?.port ?? '\u2014', ok: !dmxState.startButton?.simulated },"""
if OLD4 not in t:
    print("WARN: Hardware Status row not found — skipping (non-fatal)")
else:
    t = t.replace(OLD4, NEW4, 1)

p.write_text(t)
print("Dashboard.tsx patched OK")
