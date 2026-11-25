import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Terminal,
  XCircle,
} from 'lucide-react';
import { HARDWARE_BY_ID } from '../../data/catalog';
import { calculateSystemWattage } from '../../engine/compatibility';
import { useSimulatorStore } from '../../store/useSimulatorStore';

export const BottomConsole: React.FC = () => {
  const snapshot = useSimulatorStore((s) => s.snapshot);
  const bootOutcome = useSimulatorStore((s) => s.bootOutcome);
  const bootEvaluation = useSimulatorStore((s) => s.bootEvaluation);
  const activePostStageIndex = useSimulatorStore((s) => s.activePostStageIndex);
  const logs = useSimulatorStore((s) => s.logs);
  const bottomPanelOpen = useSimulatorStore((s) => s.bottomPanelOpen);
  const setBottomPanelOpen = useSimulatorStore((s) => s.setBottomPanelOpen);

  const cableTypes = new Set(snapshot.cables.map((c) => c.type));
  const { totalDraw, psuSupply } = calculateSystemWattage(snapshot);

  const coreMilestones = [
    { label: 'CPU', done: Boolean(snapshot.installed.cpu_socket) },
    { label: 'Paste', done: snapshot.thermalPasteApplied },
    { label: 'Cooler', done: Boolean(snapshot.installed.cpu_cooler_mount) },
    {
      label: 'RAM',
      done: Boolean(
        snapshot.installed.dimm_a1 ||
          snapshot.installed.dimm_a2 ||
          snapshot.installed.dimm_b1 ||
          snapshot.installed.dimm_b2
      ),
    },
    {
      label: 'Storage',
      done: Boolean(
        snapshot.installed.m2_1 ||
          snapshot.installed.m2_2 ||
          snapshot.installed.sata_ssd_bay ||
          snapshot.installed.hdd_bay
      ),
    },
    { label: 'PSU', done: Boolean(snapshot.installed.psu_bay) },
    { label: '24P+8P', done: cableTypes.has('atx_24pin') && cableTypes.has('eps_8pin') },
    { label: 'CPU_FAN', done: cableTypes.has('cpu_fan') },
  ];

  const completedCount = coreMilestones.filter((m) => m.done).length;
  const progressPct = Math.round((completedCount / coreMilestones.length) * 100);

  const totalCost = Object.values(snapshot.installed).reduce(
    (sum, item) => sum + (item ? HARDWARE_BY_ID[item.specId]?.price ?? 0 : 0),
    0
  );

  return (
    <section className="shrink-0 bg-[#0a101b] border-t border-slate-800/90 flex flex-col">
      {/* Compact Header Strip (always visible) */}
      <div className="h-9 px-3.5 flex items-center justify-between gap-4 border-b border-slate-800/70">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-200">Assembly Progress</span>
            <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-sky-400 tabular-nums">{progressPct}%</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
            <span>Cables: {snapshot.cables.length}/10</span>
            <span className="text-slate-700">·</span>
            <span className={psuSupply > 0 && totalDraw > psuSupply ? 'text-red-400' : ''}>
              Power: {totalDraw}W / {psuSupply || 0}W
            </span>
            <span className="text-slate-700">·</span>
            <span>Build Cost: ${totalCost}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs font-mono">
            {bootOutcome === 'SUCCESS' && (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> POST PASS
              </span>
            )}
            {bootOutcome === 'WARNING' && (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> BOOT WITH WARNINGS
              </span>
            )}
            {bootOutcome === 'FAILURE' && (
              <span className="text-red-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> POST FAILURE
              </span>
            )}
            {bootOutcome === 'RUNNING' && (
              <span className="text-cyan-400">POST Stage {activePostStageIndex}/8</span>
            )}
            {bootOutcome === 'IDLE' && <span className="text-slate-500">Standby</span>}
          </div>

          <button
            onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
            className="px-2 py-0.5 rounded bg-[#0d1524] hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1"
          >
            {bottomPanelOpen ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Console</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Diagnostics</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Diagnostic Console & POST Sequence Strip */}
      {bottomPanelOpen && (
        <div className="h-[148px] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
          {/* Left: Core Checklist & POST Stages */}
          <div className="lg:col-span-5 p-3 overflow-y-auto space-y-2.5">
            {/* Core Hardware Checklist */}
            <div className="grid grid-cols-4 gap-1.5">
              {coreMilestones.map((m) => (
                <div
                  key={m.label}
                  className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center justify-between ${
                    m.done
                      ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-300'
                      : 'bg-[#070c14] border-slate-800 text-slate-500'
                  }`}
                >
                  <span>{m.label}</span>
                  <span>{m.done ? 'OK' : '--'}</span>
                </div>
              ))}
            </div>

            {/* Power-On POST Diagnostics List */}
            {bootEvaluation ? (
              <div className="space-y-1">
                {bootEvaluation.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="flex items-start gap-2 text-[11px] leading-snug"
                  >
                    <span
                      className={`font-mono font-semibold shrink-0 w-10 ${
                        chk.status === 'pass'
                          ? 'text-emerald-400'
                          : chk.status === 'warn'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }`}
                    >
                      [{chk.status.toUpperCase()}]
                    </span>
                    <span className="text-slate-300">
                      <strong className="text-slate-100">{chk.label}:</strong> {chk.detail}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Install core components and route required power/fan cables, then click{' '}
                <strong className="text-slate-300">Power On</strong> to run full POST diagnostics.
              </p>
            )}
          </div>

          {/* Right: Live Hardware Event & POST Console */}
          <div className="lg:col-span-7 p-2.5 bg-[#070b12] overflow-y-auto font-mono text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 pb-1 border-b border-slate-800/70 mb-1">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>Hardware Diagnostic Console</span>
            </div>
            {logs.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 leading-snug">
                <span className="text-slate-600 shrink-0 tabular-nums">{entry.timestamp}</span>
                <span
                  className={
                    entry.level === 'error'
                      ? 'text-red-400'
                      : entry.level === 'warn'
                        ? 'text-amber-400'
                        : entry.level === 'success'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                  }
                >
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
