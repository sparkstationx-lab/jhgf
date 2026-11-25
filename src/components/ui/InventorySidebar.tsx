import React from 'react';
import {
  Cable,
  Check,
  CircuitBoard,
  Cpu,
  Droplet,
  Fan,
  HardDrive,
  MemoryStick,
  MonitorPlay,
  PlugZap,
  Unplug,
  Wifi,
  Wrench,
} from 'lucide-react';
import {
  CABLE_META,
  HARDWARE_CATALOG,
  MOTHERBOARD_BY_ID,
  MOTHERBOARDS,
} from '../../data/catalog';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CableType, ComponentCategory, HardwareItemSpec } from '../../types/hardware';

const CATEGORIES: { id: ComponentCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'processing', label: 'CPU & Cooling', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'memory', label: 'Memory', icon: <MemoryStick className="w-3.5 h-3.5" /> },
  { id: 'graphics', label: 'Graphics', icon: <MonitorPlay className="w-3.5 h-3.5" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-3.5 h-3.5" /> },
  { id: 'power', label: 'Power', icon: <PlugZap className="w-3.5 h-3.5" /> },
  { id: 'cooling', label: 'Case Fans', icon: <Fan className="w-3.5 h-3.5" /> },
  { id: 'expansion', label: 'Expansion', icon: <Wifi className="w-3.5 h-3.5" /> },
];

export const InventorySidebar: React.FC = () => {
  const appMode = useSimulatorStore((s) => s.appMode);
  const workspaceView = useSimulatorStore((s) => s.workspaceView);
  const activeCategory = useSimulatorStore((s) => s.activeCategory);
  const snapshot = useSimulatorStore((s) => s.snapshot);
  const heldSpecId = useSimulatorStore((s) => s.heldSpecId);
  const selectedSpecId = useSimulatorStore((s) => s.selectedSpecId);

  const setActiveCategory = useSimulatorStore((s) => s.setActiveCategory);
  const setMotherboard = useSimulatorStore((s) => s.setMotherboard);
  const startHoldingSpec = useSimulatorStore((s) => s.startHoldingSpec);
  const selectComponent = useSimulatorStore((s) => s.selectComponent);
  const applyThermalPaste = useSimulatorStore((s) => s.applyThermalPaste);
  const installStandoffs = useSimulatorStore((s) => s.installStandoffs);
  const mountMotherboard = useSimulatorStore((s) => s.mountMotherboard);
  const installMotherboardScrews = useSimulatorStore((s) => s.installMotherboardScrews);
  const connectCablePairDirect = useSimulatorStore((s) => s.connectCablePairDirect);
  const disconnectCable = useSimulatorStore((s) => s.disconnectCable);

  const board = MOTHERBOARD_BY_ID[snapshot.motherboardId];
  const filteredItems = HARDWARE_CATALOG.filter((item) => item.category === activeCategory);

  const getBoardCompatibilityLabel = (item: HardwareItemSpec): { ok: boolean; text: string } => {
    if (item.type === 'cpu' && item.socketType !== board.socket) {
      return { ok: false, text: `Requires ${item.socketType} (Board is ${board.socket})` };
    }
    if (item.type === 'ram' && item.ramGen !== board.ramGen) {
      return { ok: false, text: `${item.ramGen} only (Board is ${board.ramGen})` };
    }
    if (item.type === 'cpu_cooler' && item.supportedSockets && !item.supportedSockets.includes(board.socket)) {
      return { ok: false, text: `Bracket ${item.supportedSockets.join('/')} only` };
    }
    return { ok: true, text: `Compatible · ${item.connectorType}` };
  };

  return (
    <aside className="w-[276px] shrink-0 bg-[#0b111d] border-r border-slate-800/90 flex flex-col h-full overflow-hidden">
      {/* Motherboard Platform Selector */}
      <div className="p-3 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <CircuitBoard className="w-3.5 h-3.5 text-sky-400" />
            Motherboard Platform
          </span>
          <span className="text-[11px] font-mono text-sky-400">
            {board.socket} · {board.ramGen}
          </span>
        </div>
        <select
          value={snapshot.motherboardId}
          onChange={(e) => setMotherboard(e.target.value)}
          aria-label="Select Motherboard Model"
          className="w-full px-2.5 py-1.5 text-xs bg-[#070b12] border border-slate-700/80 rounded text-slate-200 focus:outline-none focus:border-sky-500"
        >
          {MOTHERBOARDS.map((mb) => (
            <option key={mb.id} value={mb.id}>
              {mb.name} ({mb.socket} / {mb.ramGen})
            </option>
          ))}
        </select>
      </div>

      {/* Cable Mode Inventory vs Hardware Component Inventory */}
      {appMode === 'cables' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="mb-2">
            <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Cable className="w-3.5 h-3.5 text-cyan-400" />
              Cable Harness & Routing
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Click glowing connector orbs directly in the 3D scene to drag cables, or route pairs below.
            </p>
          </div>

          {(Object.keys(CABLE_META) as CableType[]).map((type) => {
            const meta = CABLE_META[type];
            const existing = snapshot.cables.find((c) => c.type === type);
            return (
              <div
                key={type}
                className={`p-2.5 rounded-md border transition-colors ${
                  existing
                    ? 'bg-emerald-950/25 border-emerald-500/35'
                    : 'bg-[#0e1625] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{meta.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {meta.description}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`text-[11px] font-mono ${
                      existing
                        ? 'text-emerald-400'
                        : meta.essential
                          ? 'text-amber-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {existing ? 'Connected' : meta.essential ? 'Required for POST' : 'Optional'}
                  </span>
                  {existing ? (
                    <button
                      onClick={() => disconnectCable(existing.id)}
                      className="px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-300 flex items-center gap-1 transition-colors"
                    >
                      <Unplug className="w-3 h-3" />
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connectCablePairDirect(type)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/30 transition-colors"
                    >
                      Route Cable
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Category Tabs Grid */}
          <div className="p-2.5 border-b border-slate-800/80 grid grid-cols-2 gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40'
                    : 'bg-[#080d16] text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {cat.icon}
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Hardware Components List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredItems.map((item) => {
              const installedCount = Object.values(snapshot.installed).filter(
                (i) => i && i.specId === item.id
              ).length;
              const compat = getBoardCompatibilityLabel(item);
              const isHeld = heldSpecId === item.id;
              const isSelected = selectedSpecId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => selectComponent(item.id)}
                  className={`p-2.5 rounded-md border transition-colors cursor-pointer ${
                    isHeld
                      ? 'bg-sky-950/40 border-sky-400'
                      : isSelected
                        ? 'bg-[#111b2d] border-slate-600'
                        : 'bg-[#0d1422] border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {item.shortName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 tabular-nums">
                        <span>{item.brand}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.wattageSupply ? `${item.wattageSupply}W` : `${item.wattageDraw}W`}</span>
                        <span aria-hidden="true">·</span>
                        <span>${item.price}</span>
                      </div>
                    </div>
                    {installedCount > 0 && (
                      <span className="text-[11px] font-mono text-emerald-400 shrink-0 tabular-nums">
                        {installedCount}/{item.maxInstances}
                      </span>
                    )}
                  </div>

                  <div
                    className={`text-[11px] mt-1.5 ${
                      compat.ok ? 'text-slate-400' : 'text-red-400'
                    }`}
                  >
                    {compat.text}
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onPointerDown={(e) => {
                        if (workspaceView === 'completed') return;
                        e.stopPropagation();
                        startHoldingSpec(item.id);
                      }}
                      disabled={workspaceView === 'completed'}
                      className={`flex-1 py-1.5 px-2.5 rounded text-xs font-medium transition-colors disabled:opacity-40 cursor-grab active:cursor-grabbing ${
                        isHeld
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/35'
                      }`}
                    >
                      {isHeld ? 'Placing in 3D...' : 'Drag / Place in 3D'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workbench & Case Mechanical Tools */}
          <div className="p-3 border-t border-slate-800/90 bg-[#080d17] space-y-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              Assembly Tools
            </div>
            <button
              onClick={applyThermalPaste}
              disabled={snapshot.thermalPasteApplied || !snapshot.installed.cpu_socket}
              className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between border transition-colors ${
                snapshot.thermalPasteApplied
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                  : 'bg-[#0e1626] border-slate-700 text-slate-200 hover:border-sky-500/50 disabled:opacity-40'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-sky-400" />
                Apply Thermal Paste
              </span>
              {snapshot.thermalPasteApplied && <Check className="w-3.5 h-3.5" />}
            </button>

            {workspaceView === 'case' && (
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <button
                  onClick={installStandoffs}
                  disabled={snapshot.standoffsInstalled}
                  className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between border transition-colors ${
                    snapshot.standoffsInstalled
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#0e1626] border-slate-700 text-slate-200 hover:border-sky-500/50'
                  }`}
                >
                  <span>1. Install Brass Standoffs</span>
                  {snapshot.standoffsInstalled && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={mountMotherboard}
                  disabled={snapshot.motherboardMounted}
                  className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between border transition-colors ${
                    snapshot.motherboardMounted
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#0e1626] border-slate-700 text-slate-200 hover:border-sky-500/50'
                  }`}
                >
                  <span>2. Seat ATX Motherboard</span>
                  {snapshot.motherboardMounted && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={installMotherboardScrews}
                  disabled={snapshot.motherboardScrewsInstalled}
                  className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between border transition-colors ${
                    snapshot.motherboardScrewsInstalled
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#0e1626] border-slate-700 text-slate-200 hover:border-sky-500/50'
                  }`}
                >
                  <span>3. Fasten 9x M3 Screws</span>
                  {snapshot.motherboardScrewsInstalled && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
