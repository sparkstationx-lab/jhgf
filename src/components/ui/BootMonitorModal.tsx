import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Power,
  Thermometer,
  X,
} from 'lucide-react';
import { HARDWARE_BY_ID, MOTHERBOARD_BY_ID } from '../../data/catalog';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { SocketId } from '../../types/hardware';

export const BootMonitorModal: React.FC = () => {
  const showBootMonitor = useSimulatorStore((s) => s.showBootMonitor);
  const bootEvaluation = useSimulatorStore((s) => s.bootEvaluation);
  const snapshot = useSimulatorStore((s) => s.snapshot);
  const setShowBootMonitor = useSimulatorStore((s) => s.setShowBootMonitor);
  const powerOff = useSimulatorStore((s) => s.powerOff);

  const [activeTab, setActiveTab] = useState<'uefi' | 'os'>('uefi');

  if (!showBootMonitor || !bootEvaluation) return null;

  const board = MOTHERBOARD_BY_ID[snapshot.motherboardId];
  const cpuSpec = snapshot.installed.cpu_socket
    ? HARDWARE_BY_ID[snapshot.installed.cpu_socket.specId]
    : null;
  const gpuSpec = snapshot.installed.pcie_x16_1
    ? HARDWARE_BY_ID[snapshot.installed.pcie_x16_1.specId]
    : null;

  const ramSlots: SocketId[] = ['dimm_a1', 'dimm_a2', 'dimm_b1', 'dimm_b2'];
  const ramModules = ramSlots
    .map((slot) => (snapshot.installed[slot] ? HARDWARE_BY_ID[snapshot.installed[slot]!.specId] : null))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const totalRamGB = ramModules.reduce((acc, m) => acc + (m.ramCapacityGB ?? 0), 0);

  const storageDevices = [
    snapshot.installed.m2_1,
    snapshot.installed.m2_2,
    snapshot.installed.sata_ssd_bay,
    snapshot.installed.hdd_bay,
  ]
    .filter(Boolean)
    .map((item) => HARDWARE_BY_ID[item!.specId])
    .filter(Boolean);

  const hasBootableOs = bootEvaluation.stages.find((s) => s.id === 'stage_storage')?.status === 'pass';
  const cpuTempC = snapshot.thermalPasteApplied ? 36 : 79;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-[#080e1a] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Monitor Frame Header */}
        <div className="px-4 py-3 bg-[#0c1424] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-bold text-slate-100">
              System Video Output · {board.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#070b12] p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setActiveTab('uefi')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  activeTab === 'uefi' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                UEFI BIOS
              </button>
              <button
                onClick={() => setActiveTab('os')}
                disabled={!hasBootableOs}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-40 ${
                  activeTab === 'os' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SiliconOS Desktop
              </button>
            </div>
            <button
              onClick={() => setShowBootMonitor(false)}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Close Display Window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Display Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Status Summary */}
          <div
            className={`p-3.5 rounded-lg border flex items-start gap-3 ${
              bootEvaluation.outcome === 'SUCCESS'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}
          >
            {bootEvaluation.outcome === 'SUCCESS' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-bold">
                {bootEvaluation.outcome === 'SUCCESS'
                  ? 'POST Passed · All Systems Operational'
                  : 'POST Passed with Non-Fatal Warnings'}
              </div>
              <p className="text-xs opacity-90 mt-0.5">{bootEvaluation.summary}</p>
            </div>
          </div>

          {activeTab === 'uefi' ? (
            <>
              {/* Hardware Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#0d1626] border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    Processor
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1.5 truncate">
                    {cpuSpec?.shortName ?? 'None'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {board.socket}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0d1626] border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <MemoryStick className="w-3.5 h-3.5 text-cyan-400" />
                    Memory
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1.5 tabular-nums">
                    {totalRamGB} GB {board.ramGen}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {ramModules.length} DIMM(s)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0d1626] border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                    CPU Temp
                  </div>
                  <div
                    className={`text-xs font-semibold mt-1.5 font-mono tabular-nums ${
                      cpuTempC > 65 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {cpuTempC}.0 °C
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    CPU_FAN 1150 RPM
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0d1626] border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    Power Rail
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1.5 font-mono tabular-nums">
                    {bootEvaluation.totalWattage}W / {bootEvaluation.psuWattage}W
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    +12.04V · +5.01V
                  </div>
                </div>
              </div>

              {/* POST Execution Sequence */}
              <div className="rounded-lg bg-[#070b12] border border-slate-800 p-3.5">
                <div className="text-xs font-semibold text-slate-200 mb-2.5">
                  POST Initialization Sequence
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bootEvaluation.stages.map((st) => (
                    <div
                      key={st.id}
                      className="px-2.5 py-2 rounded bg-[#0c1320] border border-slate-800/80 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">{st.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{st.detail}</div>
                      </div>
                      <span
                        className={`font-mono text-[10px] font-semibold shrink-0 uppercase ${
                          st.status === 'pass'
                            ? 'text-emerald-400'
                            : st.status === 'warn'
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }`}
                      >
                        {st.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-[#0b1322] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-100">SiliconOS Workstation 24.04</h3>
                  <p className="text-xs text-slate-400">
                    Kernel initialized · Hardware drivers verified
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400">System Healthy</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded bg-[#070c16] border border-slate-800">
                  <div className="text-slate-400 mb-1">Display Adapter</div>
                  <div className="font-semibold text-slate-100">
                    {gpuSpec ? gpuSpec.name : `${cpuSpec?.shortName} Integrated Graphics`}
                  </div>
                </div>
                <div className="p-3 rounded bg-[#070c16] border border-slate-800">
                  <div className="text-slate-400 mb-1">Mounted Storage Volumes</div>
                  <div className="font-semibold text-slate-100">
                    {storageDevices.map((d) => d.shortName).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-4 py-3 bg-[#0c1424] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={powerOff}
            className="px-3 py-1.5 rounded text-xs font-medium bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-red-200 flex items-center gap-1.5"
          >
            <Power className="w-3.5 h-3.5" />
            Shut Down PC
          </button>
          <button
            onClick={() => setShowBootMonitor(false)}
            className="px-4 py-1.5 rounded text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white"
          >
            Return to 3D Workbench (Keep Running)
          </button>
        </div>
      </div>
    </div>
  );
};
