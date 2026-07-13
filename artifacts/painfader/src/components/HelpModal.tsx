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
              <Row label="0 — SCHMERZ MAX" desc="Maximum pain. No medication. Spring default position. Triggers the idle countdown timer when held." />
              <Row label="1 — OPIOID LOW"  desc="Low-dose opioid relief. Reduced pain state." />
              <Row label="2 — OPIOID HIGH" desc="High-dose opioid relief. Further reduced pain state." />
              <Row label="3 — NSAR LOW"    desc="Low-dose NSAID (non-steroidal anti-inflammatory). Mild relief." />
              <Row label="4 — NSAR HIGH"   desc="High-dose NSAID. Maximum relief state." />
            </Section>

            <Section title="Presets — PRESETS Tab">
              <p>Each fader position (0–4) plus a dedicated IDLE state has a fully configurable preset defining the exact DMX output for that state.</p>
              <div className="mt-2 space-y-1">
                <Row label="CAPTURE FROM LIVE" desc="Snapshot the current live DMX state and save it as the preset for this position." />
                <Row label="SAVE PRESET"       desc="Manually save the slider values you have edited in the preset form." />
                <Row label="APPLY TO LIVE"     desc="Fire this preset immediately — same as the hardware fader reaching this position." />
              </div>
              <p className="mt-2 text-zinc-600">Preset values are stored in-memory on the server. A server restart resets them to defaults.</p>
            </Section>

            <Section title="Idle Timer">
              <p>When the spring returns the fader to position 0, the idle countdown starts. After the configured number of seconds with no other fader input, the IDLE preset fires and the mode switches to IDLE.</p>
              <Row label="Timer duration" desc="Configurable 1–3600 seconds (default 30s). Set in PRESETS → IDLE (TIMER) tab." />
              <Row label="Interruption"   desc="Any fader position 1–4 received while counting cancels the timer immediately." />
              <Row label="Visual"         desc="A progress bar appears in the pain fader card while counting down. Turns amber below 40%, red below 15%." />
            </Section>

            <Section title="Hardware Fader Input — HARDWARE INPUT Tab">
              <p>The physical fader sends its position via HTTP POST. Any microcontroller (Arduino, Raspberry Pi, ESP32) or system on the same network can trigger it.</p>
              <Row label="Endpoint"  desc="POST /api/dmx/hardware-fader" />
              <Row label="Body"      desc='{ "position": 0 }  — integer 0–4' />
              <Row label="Response"  desc="Full DMX state JSON including idleTimer and hardwareLastSeen." />
              <p className="mt-2">The header shows <span className="text-zinc-200">HW Xs ago</span> to indicate how recently a hardware signal was received.</p>
              <p>The HARDWARE INPUT tab contains a simulate panel for testing without physical hardware, plus Arduino code examples.</p>
            </Section>

            <Section title="Live Control — LIVE CONTROL Tab">
              <Row label="IDLE / EXPERIENCE"  desc="Mode toggle. IDLE = warm ambient state. EXPERIENCE = active installation running." />
              <Row label="POS 1–4 buttons"    desc="Shortcut to instantly load the preset for that position." />
              <Row label="Fan Speed (DMX)"    desc="DMX value 0–255. Maps proportionally to the fan's voltage/RPM." />
              <Row label="LED Matrix"         desc="RGB color, brightness, and pattern channel for the matrix fixture." />
              <Row label="LED Strips"         desc="Two independent strips with R/G/B/brightness. SYNC mirrors Strip 1 onto Strip 2." />
              <Row label="Disc Drive"         desc="Speed 0–255, direction CW/CCW/STOP." />
            </Section>

            <Section title="Art-Net Configuration">
              <Row label="Host IP"      desc="Target Art-Net node IP. Default 255.255.255.255 broadcasts to all nodes on the LAN." />
              <Row label="Universe"     desc="Art-Net universe number (0-indexed). Match to your fixture patch." />
              <Row label="Port"         desc="UDP port. Standard Art-Net port is 6454." />
              <Row label="Refresh Rate" desc="Packets sent per second (Hz). Default 44Hz. Lower to reduce network load." />
              <Row label="TX ACTIVE"    desc="Green = Art-Net UDP packets are being sent. Red = socket error." />
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

            <Section title="BLACKOUT">
              <p>The red <span className="text-white font-bold">BLACKOUT</span> button in the top-right immediately zeroes all 512 DMX channels and disables every component. Use in emergencies. State is not saved — re-apply presets or adjust sliders to restore output.</p>
            </Section>

            <Section title="Notes">
              <Row label="No database"   desc="All state is in-memory. A server restart resets everything to defaults." />
              <Row label="Windows"       desc="Runs on any machine with Node.js. Art-Net targets LAN devices." />
              <Row label="No response"   desc="Art-Net is UDP — there is no acknowledgement. TX ACTIVE only confirms packets were sent, not received." />
            </Section>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
