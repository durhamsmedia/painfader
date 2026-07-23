import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl bg-[#111113] border-zinc-800 text-zinc-300 font-mono max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm tracking-widest font-bold text-white flex items-center gap-2">
            <span style={{ color: '#EC6602' }}>PAIN</span><span style={{ color: '#009999' }}>FADER</span>
            <span className="text-zinc-500 font-normal">— Operator Manual</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-[11px] leading-relaxed">

          {/* Hardware */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">HARDWARE SETUP</h3>
            <div className="space-y-1.5 text-zinc-500">
              <div><span className="text-zinc-300">3-Positions-Kiphebel</span> — Frühlingszentrum bei Position 0 (SCHMERZ)</div>
              <div><span className="text-zinc-300">Art-Net UDP</span> — Broadcast auf konfigurierter IP, Universe 0, Port 6454</div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                <div className="text-zinc-600">CH 1</div><div>Ventilator (Lüfter)</div>
                <div className="text-zinc-600">CH 3–7</div><div>Haube LED Matrix (RGBBP)</div>
                <div className="text-zinc-600">CH 8–11</div><div>SCHMERZ-Band (Mitte, rot)</div>
                <div className="text-zinc-600">CH 12–15</div><div>NSAR-Band (im Tisch, blau)</div>
                <div className="text-zinc-600">CH 16–19</div><div>OPIAT-Band (im Tisch, türkis)</div>
                <div className="text-zinc-600">CH 20</div><div>Motor Speed (Opiat-Schild)</div>
                <div className="text-zinc-600">CH 21</div><div>Motor Direction (AUF / AB)</div>
                <div className="text-zinc-600">CH 22</div><div>Kiphebel-Position DMX</div>
                <div className="text-zinc-600">CH 23</div><div>Screen Video-Select (Mediaplayer)</div>
              </div>
            </div>
          </section>

          {/* Positions */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">POSITIONEN</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-950/30 border border-blue-900/50 rounded-sm p-3">
                <div className="text-blue-400 font-black text-xl mb-1">N</div>
                <div className="text-blue-300 font-bold text-[10px]">NSAR</div>
                <div className="text-zinc-600 text-[9px] mt-1">Pos −1 · DMX 0</div>
                <div className="text-zinc-600 text-[9px]">Motor AB · nsar.mp4</div>
              </div>
              <div className="bg-orange-950/30 border border-orange-900/50 rounded-sm p-3">
                <div className="text-orange-400 font-black text-xl mb-1">0</div>
                <div className="text-orange-300 font-bold text-[10px]">SCHMERZ</div>
                <div className="text-zinc-600 text-[9px] mt-1">Pos 0 · DMX 128</div>
                <div className="text-zinc-600 text-[9px]">Feder-Mitte · schmerz.mp4</div>
              </div>
              <div className="bg-teal-950/30 border border-teal-900/50 rounded-sm p-3">
                <div className="text-teal-400 font-black text-xl mb-1">O</div>
                <div className="text-teal-300 font-bold text-[10px]">OPIAT</div>
                <div className="text-zinc-600 text-[9px] mt-1">Pos +1 · DMX 255</div>
                <div className="text-zinc-600 text-[9px]">Motor AUF · opiat.mp4</div>
              </div>
            </div>
          </section>

          {/* Keyboard shortcuts */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">TASTATURKÜRZEL</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                ['N', 'Position −1 → NSAR'],
                ['0', 'Position 0 → SCHMERZ'],
                ['O', 'Position +1 → OPIAT'],
                ['B (halten)', 'BLACKOUT — alle Kanäle auf 0'],
              ].map(([key, desc]) => (
                <React.Fragment key={key}>
                  <div>
                    <kbd className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-white">{key}</kbd>
                  </div>
                  <div className="text-zinc-500">{desc}</div>
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Motor */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">OPIAT-SCHILD MOTOR</h3>
            <div className="space-y-1 text-zinc-500">
              <div>Der Motor hebt/senkt das Opiat-Schild automatisch mit dem Preset.</div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="border border-teal-800 bg-teal-950/20 rounded-sm p-2 text-teal-400">▲ AUF<div className="text-[9px] text-zinc-500 mt-0.5">Schild sichtbar (OPIAT)</div></div>
                <div className="border border-red-800 bg-red-950/20 rounded-sm p-2 text-red-400">■ STOP<div className="text-[9px] text-zinc-500 mt-0.5">Motor hält</div></div>
                <div className="border border-zinc-700 bg-zinc-900/30 rounded-sm p-2 text-zinc-400">▼ AB<div className="text-[9px] text-zinc-500 mt-0.5">Schild versteckt</div></div>
              </div>
            </div>
          </section>

          {/* Screen/Video */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">SCREEN / VIDEO (CH 23)</h3>
            <div className="space-y-1 text-zinc-500">
              <div>CH 23 trägt einen numerischen Wert, den der Mediaplayer periodisch abfragt.</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-zinc-600">idle.mp4</div><div>DMX 0 → Idle-Loop</div>
                <div className="text-zinc-600">schmerz.mp4</div><div>DMX 64 → Schmerz-Video</div>
                <div className="text-zinc-600">opiat.mp4</div><div>DMX 128 → Opiat-Video</div>
                <div className="text-zinc-600">nsar.mp4</div><div>DMX 192 → NSAR-Video</div>
              </div>
              <div className="mt-1.5 text-[9px] text-zinc-600">
                GET /api/dmx/screen — Mediaplayer Polling-Endpoint
              </div>
            </div>
          </section>

          {/* Presets */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">PRESETS</h3>
            <div className="space-y-1 text-zinc-500">
              <div>Jede Hebelposition hat ein vollständiges Preset: Licht, Lüfter, Motor, Video.</div>
              <div className="text-[10px] mt-1">
                <span className="text-zinc-300">CAPTURE FROM LIVE</span> — speichert den aktuellen Live-Zustand als Preset
              </div>
              <div className="text-[10px]">
                <span className="text-zinc-300">APPLY TO LIVE</span> — sendet das Preset sofort an alle DMX-Kanäle
              </div>
            </div>
          </section>

          {/* Idle timer */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">IDLE-TIMER</h3>
            <div className="text-zinc-500">
              Kehrt der Hebel zu Position 0 zurück und bleibt dort für die konfigurierte Zeit (Standard: 30 s),
              wird automatisch das IDLE-Preset geladen. Konfigurierbar im Tab <span className="text-zinc-300">PRESETS → IDLE</span>.
            </div>
          </section>

          {/* Hardware API */}
          <section>
            <h3 className="text-[10px] tracking-widest text-zinc-400 uppercase mb-2 border-b border-zinc-800 pb-1">HARDWARE FADER API</h3>
            <div className="bg-[#050505] border border-zinc-800 rounded-sm p-3 text-[10px] text-zinc-500 space-y-1">
              <div className="text-green-400">POST /api/dmx/hardware-fader</div>
              <div>{'{"position": -1}   // N  — NSAR'}</div>
              <div>{'{"position":  0}   // 0  — SCHMERZ (Feder)'}</div>
              <div>{'{"position":  1}   // O  — OPIAT'}</div>
            </div>
          </section>

          <div className="text-[9px] text-zinc-700 pt-2 border-t border-zinc-800">
            PAINFADER DMX Controller — Medical Art Installation · Art-Net/DMX512 · CI #EC6602 / #009999
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
