import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono font-black tracking-[0.2em] text-primary uppercase border-b border-zinc-800 pb-1">
        {title}
      </h3>
      <div className="text-xs font-mono text-zinc-400 leading-relaxed space-y-1">
        {children}
      </div>
    </div>
  );
}

function Row({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 text-zinc-300 min-w-[140px]">{label}</span>
      <span className="text-zinc-500">{desc}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-[9px] border border-zinc-600 rounded bg-zinc-900 text-zinc-300 font-mono leading-tight">
      {children}
    </kbd>
  );
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#111113] border-zinc-800 text-zinc-300 max-w-2xl rounded-sm p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-zinc-800 bg-[#161618]">
          <DialogTitle className="font-mono text-sm tracking-widest text-white uppercase flex items-center gap-2">
            <span className="text-primary">?</span> PAINFADER — OPERATOR MANUAL
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          <div className="px-5 py-5 space-y-6">

            <Section title="Overview">
              <p>
                PAINFADER is a web-based DMX control surface for the <span className="text-zinc-200">Painfader interactive installation</span>.
                It controls a fan (Entour Cyclone), LED matrix, two LED strips, and a plexiglass disc drive via Art-Net UDP output.
                A spring-loaded hardware fader drives the 5 pain/medication states.
              </p>
            </Section>

            <Section title="Pain Fader — 5 Positions">
              <p className="text-zinc-500 mb-1">
                Position 0 (SCHMERZ MAX) sits in the <span className="text-zinc-300">center</span> of the fader panel.
                Opioid states are to the <span className="text-zinc-300">left</span>, NSAR states to the <span className="text-zinc-300">right</span>.
              </p>
              <div className="bg-black border border-zinc-800 rounded-sm p-2 my-2 flex justify-between text-center text-[9px] font-mono gap-1">
                {[
                  { n: '2', l: 'OPI H', c: 'text-blue-400' },
                  { n: '1', l: 'OPI L', c: 'text-purple-400' },
                  { n: '0', l: 'SCHMERZ', c: 'text-red-400', center: true },
                  { n: '3', l: 'NSR L', c: 'text-emerald-400' },
                  { n: '4', l: 'NSR H', c: 'text-green-400' },
                ].map(({ n, l, c, center }) => (
                  <div key={n} className={`flex-1 py-2 rounded border ${center ? 'border-red-800 bg-red-950/20' : 'border-zinc-800'}`}>
                    <div className={`font-black text-base ${c}`}>{n}</div>
                    <div className="text-zinc-600 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
              <Row label="0 — SCHMERZ MAX" desc="Maximum pain. No medication. Spring default — triggers idle countdown when held." />
              <Row label="1 — OPIOID LOW"  desc="Low-dose opioid relief." />
              <Row label="2 — OPIOID HIGH" desc="High-dose opioid relief." />
              <Row label="3 — NSAR LOW"    desc="Low-dose NSAID (non-steroidal anti-inflammatory)." />
              <Row label="4 — NSAR HIGH"   desc="High-dose NSAID. Maximum relief state." />
            </Section>

            <Section title="Header — Quick Controls">
              <p>The sticky header contains mode, position shortcuts, and emergency controls.</p>
              <div className="mt-1 space-y-1">
                <Row label="IDLE / EXPERIENCE" desc="Mode switch. IDLE = ambient warm state. EXPERIENCE = active installation." />
                <Row label="POS 2 1 0 3 4"     desc="One-click preset shortcuts. Active position glows in its color. Clicking applies the full position preset immediately." />
                <Row label="TX ACTIVE"          desc="Green pulse = Art-Net UDP packets are broadcasting. Red = socket error." />
                <Row label="HW Xs ago"          desc="Seconds since the last hardware fader HTTP signal was received." />
                <Row label="BLACKOUT"           desc="Hold 1 second to zero all 512 DMX channels. A fill bar sweeps right as you hold — release early to cancel." />
              </div>
            </Section>

            <Section title="Keyboard Shortcuts">
              <div className="bg-black border border-zinc-800 rounded-sm p-3 space-y-1.5 text-[11px]">
                {[
                  { key: '0', desc: 'Apply POS 0 preset — SCHMERZ MAX', color: 'text-red-400' },
                  { key: '1', desc: 'Apply POS 1 preset — OPIOID LOW',  color: 'text-purple-400' },
                  { key: '2', desc: 'Apply POS 2 preset — OPIOID HIGH', color: 'text-blue-400' },
                  { key: '3', desc: 'Apply POS 3 preset — NSAR LOW',    color: 'text-emerald-400' },
                  { key: '4', desc: 'Apply POS 4 preset — NSAR HIGH',   color: 'text-green-400' },
                  { key: 'I', desc: 'Apply IDLE preset + switch to IDLE mode', color: 'text-zinc-300' },
                  { key: 'B', desc: 'BLACKOUT — hold 1 second to activate. Release early to cancel.', color: 'text-red-500' },
                ].map(({ key, desc, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Kbd>{key}</Kbd>
                    <span className={color}>{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-zinc-600 mt-1">Shortcuts are disabled when an input field is focused (e.g. typing in Art-Net config).</p>
            </Section>

            <Section title="Presets — PRESETS Tab">
              <p>Each position (0–4) plus IDLE has a fully configurable preset. The active position tab shows a pulsing dot.</p>
              <div className="mt-1 space-y-1">
                <Row label="CAPTURE FROM LIVE" desc="Snapshot the current live DMX state as the preset for this position." />
                <Row label="SAVE PRESET"       desc="Save manually edited slider values." />
                <Row label="APPLY TO LIVE"     desc="Fire this preset immediately to the DMX output." />
              </div>
              <p className="mt-1 text-zinc-600">Presets are stored in-memory. A server restart resets them to defaults.</p>
            </Section>

            <Section title="Idle Timer">
              <p>When the spring returns the fader to position 0, the idle countdown starts. After N seconds with no other fader input, the IDLE preset fires automatically.</p>
              <Row label="Duration"    desc="1–3600 seconds (default 30s). Configure in PRESETS → IDLE (TIMER) tab." />
              <Row label="Cancels on"  desc="Any fader position 1–4 received while counting." />
              <Row label="Visual"      desc="Progress bar in the pain fader card. Green → amber (40%) → red (15%)." />
            </Section>

            <Section title="Hardware Fader Input — HARDWARE INPUT Tab">
              <p>The physical fader sends its position via HTTP POST from any microcontroller on the same network.</p>
              <Row label="Endpoint" desc="POST /api/dmx/hardware-fader" />
              <Row label="Body"     desc='{ "position": 0 }  — integer 0–4' />
              <Row label="Response" desc="Full DMX state JSON including idleTimer and hardwareLastSeen." />
              <p className="mt-1">The HARDWARE INPUT tab has a software simulate panel for testing and Arduino/ESP32 code examples.</p>
            </Section>

            <Section title="Live Control — LIVE CONTROL Tab">
              <Row label="Fan Speed"   desc="DMX value 0–255. Maps to fan voltage/RPM." />
              <Row label="LED Matrix"  desc="RGB color, brightness, and pattern channel." />
              <Row label="LED Strips"  desc="Two independent strips with R/G/B/brightness. SYNC mirrors Strip 1 onto Strip 2." />
              <Row label="Disc Drive"  desc="Speed 0–255, direction CW / CCW / STOP." />
            </Section>

            <Section title="Art-Net Configuration">
              <Row label="Host IP"      desc="Target node IP. 255.255.255.255 broadcasts to all nodes on the LAN." />
              <Row label="Universe"     desc="Art-Net universe (0-indexed). Match to your fixture patch." />
              <Row label="Port"         desc="UDP port. Standard is 6454." />
              <Row label="Refresh Rate" desc="Packets per second (Hz). Default 44 Hz." />
            </Section>

            <Section title="DMX Channel Map">
              <div className="bg-black border border-zinc-800 rounded-sm p-3 space-y-0.5 text-[10px]">
                {[
                  ['CH 01', 'Fan — Speed'],
                  ['CH 03', 'LED Matrix — Red'],
                  ['CH 04', 'LED Matrix — Green'],
                  ['CH 05', 'LED Matrix — Blue'],
                  ['CH 06', 'LED Matrix — Brightness'],
                  ['CH 07', 'LED Matrix — Pattern'],
                  ['CH 08', 'LED Strip 1 — Red'],
                  ['CH 09', 'LED Strip 1 — Green'],
                  ['CH 10', 'LED Strip 1 — Blue'],
                  ['CH 11', 'LED Strip 1 — Brightness'],
                  ['CH 12', 'LED Strip 2 — Red'],
                  ['CH 13', 'LED Strip 2 — Green'],
                  ['CH 14', 'LED Strip 2 — Blue'],
                  ['CH 15', 'LED Strip 2 — Brightness'],
                  ['CH 16', 'Disc Drive — Speed'],
                  ['CH 17', 'Disc Drive — Direction (0=stop, 128=CW, 255=CCW)'],
                  ['CH 18', 'Pain Fader — Position (0, 64, 127, 191, 255)'],
                ].map(([ch, desc]) => (
                  <div key={ch} className="flex gap-3">
                    <span className="text-primary w-10 shrink-0">{ch}</span>
                    <span className="text-zinc-500">{desc}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Notes">
              <Row label="No database"   desc="All state is in-memory. A server restart resets everything to defaults." />
              <Row label="Art-Net / UDP" desc="No connection confirmation. TX ACTIVE confirms packets were sent, not received." />
              <Row label="Windows"       desc="Runs on any machine with Node.js. Art-Net targets any LAN device." />
            </Section>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
