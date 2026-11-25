import { create } from 'zustand';
import {
  CABLE_CONNECTORS,
  CABLE_META,
  CHALLENGES,
  HARDWARE_BY_ID,
  MOTHERBOARD_BY_ID,
  SOCKET_DEFINITIONS,
} from '../data/catalog';
import { checkSocketCompatibility, evaluatePowerOnTest } from '../engine/compatibility';
import {
  AppMode,
  BootEvaluation,
  BootOutcome,
  CableConnectorId,
  CableType,
  CameraPreset,
  ComponentCategory,
  ConnectedCable,
  InstalledComponent,
  LogEntry,
  SimulatorSnapshot,
  SocketId,
  WorkspaceView,
} from '../types/hardware';
import {
  playClickSound,
  playErrorSound,
  playPostBeep,
  playSnapSound,
} from '../utils/soundEffects';

const STORAGE_KEY = 'siliconbench_3d_saved_build_v1';

function createEmptyInstalled(): Record<SocketId, InstalledComponent | undefined> {
  return {
    cpu_socket: undefined,
    cpu_cooler_mount: undefined,
    dimm_a1: undefined,
    dimm_a2: undefined,
    dimm_b1: undefined,
    dimm_b2: undefined,
    pcie_x16_1: undefined,
    pcie_x1_1: undefined,
    pcie_x1_2: undefined,
    m2_1: undefined,
    m2_2: undefined,
    cmos_slot: {
      instanceId: 'cmos_default',
      specId: 'cmos_cr2032',
      socketId: 'cmos_slot',
      rotationSteps: 0,
      installedAt: 0,
    },
    psu_bay: undefined,
    sata_ssd_bay: undefined,
    hdd_bay: undefined,
    case_fan_front: undefined,
    case_fan_rear: undefined,
  };
}

function createInitialSnapshot(motherboardId = 'atx_z790_ddr5'): SimulatorSnapshot {
  return {
    motherboardId,
    installed: createEmptyInstalled(),
    cables: [],
    thermalPasteApplied: false,
    standoffsInstalled: false,
    motherboardMounted: false,
    motherboardScrewsInstalled: false,
  };
}

function nowStamp(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

let uidCounter = 1;
function makeId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now()}_${uidCounter}`;
}

export interface SimulatorStore {
  // Core build snapshot
  snapshot: SimulatorSnapshot;
  past: SimulatorSnapshot[];
  future: SimulatorSnapshot[];

  // Workspace & mode state
  workspaceView: WorkspaceView;
  appMode: AppMode;
  activeCategory: ComponentCategory;

  // 3D Drag & Placement state
  heldSpecId: string | null;
  heldFromSocketId: SocketId | null;
  heldRotationSteps: number;
  hoveredSocketId: SocketId | null;
  lastErrorBanner: { message: string; timestamp: number } | null;

  // Selection & Inspection
  selectedSpecId: string | null;
  selectedSocketId: SocketId | null;

  // Cable routing state
  activeCableFrom: CableConnectorId | null;
  hoveredConnectorId: CableConnectorId | null;

  // Camera control triggers
  cameraPreset: CameraPreset;
  cameraRequestCounter: number;
  cameraFocusTarget: [number, number, number] | null;

  // Power-On & POST Simulation
  isPoweredOn: boolean;
  bootOutcome: BootOutcome;
  bootEvaluation: BootEvaluation | null;
  activePostStageIndex: number; // 0..8
  showBootMonitor: boolean;

  // Learning & Challenge state
  activeChallengeId: string | null;
  completedChallenges: Record<string, number>; // challengeId -> points earned
  totalScore: number;

  // Diagnostic console & UI state
  logs: LogEntry[];
  bottomPanelOpen: boolean;
  soundMuted: boolean;
  savedBuildExists: boolean;

  // Actions
  setWorkspaceView: (view: WorkspaceView) => void;
  setAppMode: (mode: AppMode) => void;
  setActiveCategory: (cat: ComponentCategory) => void;
  setMotherboard: (mbId: string) => void;

  startHoldingSpec: (specId: string) => void;
  pickupInstalledComponent: (socketId: SocketId) => void;
  cancelHolding: () => void;
  rotateHeld: () => void;
  setHoveredSocket: (socketId: SocketId | null) => void;
  attemptInstall: (socketId: SocketId) => boolean;
  removeFromSocket: (socketId: SocketId) => void;

  applyThermalPaste: () => void;
  installStandoffs: () => void;
  mountMotherboard: () => void;
  installMotherboardScrews: () => void;

  selectComponent: (specId: string | null, socketId?: SocketId | null) => void;
  focusSelected: () => void;
  requestCameraPreset: (preset: CameraPreset) => void;

  // Cable actions
  startCableDrag: (connectorId: CableConnectorId) => void;
  setHoveredConnector: (connectorId: CableConnectorId | null) => void;
  completeCableConnection: (targetConnectorId: CableConnectorId) => boolean;
  cancelCableDrag: () => void;
  disconnectCable: (cableId: string) => void;
  connectCablePairDirect: (type: CableType) => boolean;

  // Power-On & POST
  runPowerOnTest: () => void;
  powerOff: () => void;
  setShowBootMonitor: (open: boolean) => void;

  // Challenges
  startChallenge: (challengeId: string) => void;
  exitChallenge: () => void;

  // History & Persistence
  undo: () => void;
  redo: () => void;
  resetBuild: () => void;
  saveBuild: () => void;
  loadSavedBuild: () => void;

  // UI helpers
  setBottomPanelOpen: (open: boolean) => void;
  clearErrorBanner: () => void;
  pushLog: (level: LogEntry['level'], message: string) => void;
  toggleMute: () => void;
}

let bootTimers: number[] = [];
function clearBootTimers() {
  bootTimers.forEach((t) => window.clearTimeout(t));
  bootTimers = [];
}

function pushSnapshotToPast(
  past: SimulatorSnapshot[],
  current: SimulatorSnapshot
): SimulatorSnapshot[] {
  const cloned: SimulatorSnapshot = {
    ...current,
    installed: { ...current.installed },
    cables: current.cables.map((c) => ({ ...c })),
  };
  return [...past.slice(-24), cloned];
}

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  snapshot: createInitialSnapshot(),
  past: [],
  future: [],

  workspaceView: 'workbench',
  appMode: 'assemble',
  activeCategory: 'processing',

  heldSpecId: null,
  heldFromSocketId: null,
  heldRotationSteps: 0,
  hoveredSocketId: null,
  lastErrorBanner: null,

  selectedSpecId: 'cpu_intel_i9',
  selectedSocketId: null,

  activeCableFrom: null,
  hoveredConnectorId: null,

  cameraPreset: 'iso',
  cameraRequestCounter: 0,
  cameraFocusTarget: null,

  isPoweredOn: false,
  bootOutcome: 'IDLE',
  bootEvaluation: null,
  activePostStageIndex: 0,
  showBootMonitor: false,

  activeChallengeId: null,
  completedChallenges: {},
  totalScore: 0,

  logs: [
    {
      id: 'init_1',
      timestamp: nowStamp(),
      level: 'info',
      message: 'SiliconBench 3D initialized. Z790-PRO ATX (LGA1700 / DDR5) mounted on ESD workbench.',
    },
    {
      id: 'init_2',
      timestamp: nowStamp(),
      level: 'info',
      message: 'Select any component from the inventory to drag in 3D space. Press R to rotate, F to focus, Esc to cancel.',
    },
  ],
  bottomPanelOpen: true,
  soundMuted: false,
  savedBuildExists: typeof window !== 'undefined' && Boolean(window.localStorage.getItem(STORAGE_KEY)),

  pushLog: (level, message) =>
    set((s) => ({
      logs: [
        { id: makeId('log'), timestamp: nowStamp(), level, message },
        ...s.logs.slice(0, 49),
      ],
    })),

  setWorkspaceView: (view) => {
    playClickSound();
    set((s) => ({
      workspaceView: view,
      cameraPreset: view === 'completed' ? 'iso' : s.cameraPreset,
      cameraRequestCounter: s.cameraRequestCounter + 1,
      cameraFocusTarget: null,
    }));
  },

  setAppMode: (mode) => {
    playClickSound();
    set((s) => ({
      appMode: mode,
      heldSpecId: mode === 'cables' ? null : s.heldSpecId,
      activeCableFrom: mode !== 'cables' ? null : s.activeCableFrom,
      cameraPreset: mode === 'cables' ? 'cables' : s.cameraPreset,
      cameraRequestCounter: mode === 'cables' ? s.cameraRequestCounter + 1 : s.cameraRequestCounter,
    }));
  },

  setActiveCategory: (cat) => {
    playClickSound();
    set({ activeCategory: cat });
  },

  setMotherboard: (mbId) => {
    const board = MOTHERBOARD_BY_ID[mbId];
    if (!board) return;
    clearBootTimers();
    playClickSound();
    const { snapshot, past } = get();
    // Keep external case parts (PSU, fans, SATA drives), clear incompatible CPU/RAM/cooler
    const nextInstalled = { ...snapshot.installed };
    const removedNotes: string[] = [];

    if (nextInstalled.cpu_socket) {
      const cpu = HARDWARE_BY_ID[nextInstalled.cpu_socket.specId];
      if (cpu && cpu.socketType !== board.socket) {
        nextInstalled.cpu_socket = undefined;
        nextInstalled.cpu_cooler_mount = undefined;
        removedNotes.push(`${cpu.shortName} (socket ${cpu.socketType})`);
      }
    }
    (['dimm_a1', 'dimm_a2', 'dimm_b1', 'dimm_b2'] as SocketId[]).forEach((slot) => {
      const ram = nextInstalled[slot];
      if (ram) {
        const spec = HARDWARE_BY_ID[ram.specId];
        if (spec && spec.ramGen !== board.ramGen) {
          nextInstalled[slot] = undefined;
          removedNotes.push(`${spec.shortName} (${spec.ramGen})`);
        }
      }
    });

    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      isPoweredOn: false,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
      activePostStageIndex: 0,
      snapshot: {
        ...snapshot,
        motherboardId: mbId,
        installed: nextInstalled,
        thermalPasteApplied: nextInstalled.cpu_socket ? snapshot.thermalPasteApplied : false,
      },
    });
    get().pushLog(
      'info',
      `Switched motherboard platform to ${board.name} (${board.socket} / ${board.ramGen}).${
        removedNotes.length > 0 ? ` Unseated incompatible parts: ${removedNotes.join(', ')}.` : ''
      }`
    );
  },

  startHoldingSpec: (specId) => {
    const spec = HARDWARE_BY_ID[specId];
    if (!spec) return;
    if (get().isPoweredOn) {
      get().powerOff();
    }
    // Check max instances already installed
    const count = Object.values(get().snapshot.installed).filter(
      (i) => i && i.specId === specId
    ).length;
    if (count >= spec.maxInstances) {
      playErrorSound();
      const msg = `Maximum ${spec.maxInstances}x ${spec.shortName} already installed. Remove one before placing another.`;
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }

    playClickSound();
    set({
      appMode: get().appMode === 'cables' ? 'assemble' : get().appMode,
      heldSpecId: specId,
      heldFromSocketId: null,
      heldRotationSteps: 0,
      selectedSpecId: specId,
      selectedSocketId: null,
      lastErrorBanner: null,
    });
  },

  pickupInstalledComponent: (socketId) => {
    const { snapshot, past, isPoweredOn } = get();
    const item = snapshot.installed[socketId];
    if (!item) return;

    if (isPoweredOn) {
      get().powerOff();
    }

    // Prevent pulling CPU while cooler is bolted on top
    if (socketId === 'cpu_socket' && snapshot.installed.cpu_cooler_mount) {
      playErrorSound();
      const msg = 'Remove the CPU cooler first before unseating the processor.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }

    playClickSound();
    const nextInstalled = { ...snapshot.installed, [socketId]: undefined };
    const nextCables = snapshot.cables.filter((c) => {
      if (socketId === 'psu_bay' && (c.type === 'atx_24pin' || c.type === 'eps_8pin' || c.type === 'pcie_gpu' || c.type === 'sata_power')) return false;
      if (socketId === 'pcie_x16_1' && c.type === 'pcie_gpu') return false;
      if (socketId === 'cpu_cooler_mount' && c.type === 'cpu_fan') return false;
      return true;
    });

    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: {
        ...snapshot,
        installed: nextInstalled,
        cables: nextCables,
        thermalPasteApplied: socketId === 'cpu_socket' ? false : snapshot.thermalPasteApplied,
      },
      heldSpecId: item.specId,
      heldFromSocketId: socketId,
      heldRotationSteps: item.rotationSteps,
      selectedSpecId: item.specId,
      selectedSocketId: null,
    });
    const spec = HARDWARE_BY_ID[item.specId];
    get().pushLog('info', `Picked up ${spec?.shortName ?? item.specId} from ${SOCKET_DEFINITIONS[socketId].label}.`);
  },

  cancelHolding: () => {
    const { heldSpecId, heldFromSocketId } = get();
    if (!heldSpecId) return;
    playClickSound();
    // If picked up from an existing socket, pressing Esc restores it via undo or simply returns to inventory
    set({
      heldSpecId: null,
      heldFromSocketId: null,
      heldRotationSteps: 0,
      hoveredSocketId: null,
    });
    if (heldFromSocketId) {
      get().pushLog('info', 'Returned component to inventory.');
    }
  },

  rotateHeld: () => {
    const { heldSpecId, heldRotationSteps } = get();
    if (!heldSpecId) return;
    playClickSound();
    set({ heldRotationSteps: (heldRotationSteps + 1) % 4 });
  },

  setHoveredSocket: (socketId) => {
    if (get().hoveredSocketId !== socketId) {
      set({ hoveredSocketId: socketId });
    }
  },

  attemptInstall: (socketId) => {
    const { heldSpecId, heldRotationSteps, snapshot, past } = get();
    if (!heldSpecId) return false;
    const spec = HARDWARE_BY_ID[heldSpecId];
    if (!spec) return false;

    const compat = checkSocketCompatibility(spec, socketId, snapshot, heldRotationSteps);
    if (!compat.compatible) {
      playErrorSound();
      set({ lastErrorBanner: { message: compat.reason, timestamp: Date.now() } });
      get().pushLog('error', `Placement rejected: ${compat.reason}`);
      return false;
    }

    playSnapSound();
    const newItem: InstalledComponent = {
      instanceId: makeId(spec.type),
      specId: spec.id,
      socketId,
      rotationSteps: heldRotationSteps,
      installedAt: performance.now(),
    };

    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: {
        ...snapshot,
        installed: {
          ...snapshot.installed,
          [socketId]: newItem,
        },
      },
      heldSpecId: null,
      heldFromSocketId: null,
      heldRotationSteps: 0,
      hoveredSocketId: null,
      selectedSpecId: spec.id,
      selectedSocketId: socketId,
      lastErrorBanner: compat.warning ? { message: compat.warning, timestamp: Date.now() } : null,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
    });

    get().pushLog(
      compat.warning ? 'warn' : 'success',
      `Installed ${spec.shortName} into ${SOCKET_DEFINITIONS[socketId].label}.${
        compat.warning ? ` Note: ${compat.warning}` : ''
      }`
    );
    return true;
  },

  removeFromSocket: (socketId) => {
    const { snapshot, past, isPoweredOn } = get();
    const item = snapshot.installed[socketId];
    if (!item) return;

    if (isPoweredOn) {
      get().powerOff();
    }

    if (socketId === 'cpu_socket' && snapshot.installed.cpu_cooler_mount) {
      playErrorSound();
      const msg = 'Cannot remove CPU while the CPU cooler is mounted. Remove the CPU cooler first.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }

    playClickSound();
    const nextInstalled = { ...snapshot.installed, [socketId]: undefined };
    const nextCables = snapshot.cables.filter((c) => {
      if (socketId === 'psu_bay' && (c.type === 'atx_24pin' || c.type === 'eps_8pin' || c.type === 'pcie_gpu' || c.type === 'sata_power')) return false;
      if (socketId === 'pcie_x16_1' && c.type === 'pcie_gpu') return false;
      if (socketId === 'cpu_cooler_mount' && c.type === 'cpu_fan') return false;
      if ((socketId === 'case_fan_front' || socketId === 'case_fan_rear') && !nextInstalled.case_fan_front && !nextInstalled.case_fan_rear && c.type === 'sys_fan') return false;
      if ((socketId === 'sata_ssd_bay' || socketId === 'hdd_bay') && !nextInstalled.sata_ssd_bay && !nextInstalled.hdd_bay && (c.type === 'sata_data' || c.type === 'sata_power')) return false;
      return true;
    });

    const spec = HARDWARE_BY_ID[item.specId];
    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: {
        ...snapshot,
        installed: nextInstalled,
        cables: nextCables,
        thermalPasteApplied: socketId === 'cpu_socket' ? false : snapshot.thermalPasteApplied,
      },
      selectedSocketId: null,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
    });
    get().pushLog('info', `Removed ${spec?.shortName ?? item.specId} from ${SOCKET_DEFINITIONS[socketId].label}.`);
  },

  applyThermalPaste: () => {
    const { snapshot, past } = get();
    if (!snapshot.installed.cpu_socket) {
      playErrorSound();
      const msg = 'Install a CPU into the CPU socket before applying thermal paste.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }
    if (snapshot.installed.cpu_cooler_mount) {
      playErrorSound();
      const msg = 'Remove the CPU cooler first to access the CPU heat spreader.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }
    if (snapshot.thermalPasteApplied) {
      get().pushLog('info', 'Thermal compound is already applied to the CPU IHS.');
      return;
    }
    playSnapSound();
    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: { ...snapshot, thermalPasteApplied: true },
      lastErrorBanner: null,
    });
    get().pushLog('success', 'Applied pea-sized thermal paste compound onto CPU heat spreader (IHS).');
  },

  installStandoffs: () => {
    const { snapshot, past } = get();
    if (snapshot.standoffsInstalled) return;
    playSnapSound();
    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: { ...snapshot, standoffsInstalled: true },
    });
    get().pushLog('success', 'Installed 9x brass ATX motherboard standoffs into chassis tray.');
  },

  mountMotherboard: () => {
    const { snapshot, past } = get();
    if (!snapshot.standoffsInstalled) {
      playErrorSound();
      const msg = 'Install brass motherboard standoffs first to prevent short-circuiting the PCB against the steel tray.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('error', msg);
      return;
    }
    playSnapSound();
    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: { ...snapshot, motherboardMounted: true },
      lastErrorBanner: null,
    });
    get().pushLog('success', 'Aligned rear I/O shield and seated ATX motherboard onto chassis standoffs.');
  },

  installMotherboardScrews: () => {
    const { snapshot, past } = get();
    if (!snapshot.motherboardMounted) {
      playErrorSound();
      const msg = 'Seat the motherboard onto the standoffs before fastening mounting screws.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }
    playSnapSound();
    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: { ...snapshot, motherboardScrewsInstalled: true },
      lastErrorBanner: null,
    });
    get().pushLog('success', 'Fastened 9x M3 motherboard mounting screws cleanly.');
  },

  selectComponent: (specId, socketId = null) => {
    set({ selectedSpecId: specId, selectedSocketId: socketId });
  },

  focusSelected: () => {
    const { selectedSocketId, hoveredSocketId } = get();
    const targetId = selectedSocketId ?? hoveredSocketId;
    if (!targetId) {
      get().requestCameraPreset('iso');
      return;
    }
    const def = SOCKET_DEFINITIONS[targetId];
    if (def) {
      playClickSound();
      set((s) => ({
        cameraFocusTarget: [...def.position],
        cameraRequestCounter: s.cameraRequestCounter + 1,
      }));
    }
  },

  requestCameraPreset: (preset) => {
    playClickSound();
    set((s) => ({
      cameraPreset: preset,
      cameraFocusTarget: null,
      cameraRequestCounter: s.cameraRequestCounter + 1,
    }));
  },

  startCableDrag: (connectorId) => {
    if (get().isPoweredOn) get().powerOff();
    const conn = CABLE_CONNECTORS[connectorId];
    if (!conn) return;
    if (conn.requiresComponentAt && !get().snapshot.installed[conn.requiresComponentAt]) {
      playErrorSound();
      const msg = `Install hardware into ${SOCKET_DEFINITIONS[conn.requiresComponentAt].label} before routing this cable.`;
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return;
    }
    playClickSound();
    set({ activeCableFrom: connectorId, lastErrorBanner: null });
  },

  setHoveredConnector: (connectorId) => {
    if (get().hoveredConnectorId !== connectorId) {
      set({ hoveredConnectorId: connectorId });
    }
  },

  completeCableConnection: (targetConnectorId) => {
    const { activeCableFrom, snapshot, past } = get();
    if (!activeCableFrom) return false;
    if (activeCableFrom === targetConnectorId) {
      set({ activeCableFrom: null });
      return false;
    }

    const fromDef = CABLE_CONNECTORS[activeCableFrom];
    const toDef = CABLE_CONNECTORS[targetConnectorId];
    if (!fromDef || !toDef) return false;

    if (fromDef.cableType !== toDef.cableType || fromDef.role === toDef.role) {
      playErrorSound();
      const msg = `Incompatible cable connection: ${fromDef.label} cannot connect to ${toDef.label}.`;
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() }, activeCableFrom: null });
      get().pushLog('error', msg);
      return false;
    }

    if (toDef.requiresComponentAt && !snapshot.installed[toDef.requiresComponentAt]) {
      playErrorSound();
      const msg = `Missing target component at ${SOCKET_DEFINITIONS[toDef.requiresComponentAt].label}.`;
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() }, activeCableFrom: null });
      get().pushLog('warn', msg);
      return false;
    }

    const exists = snapshot.cables.some((c) => c.type === fromDef.cableType);
    if (exists) {
      playClickSound();
      set({ activeCableFrom: null });
      get().pushLog('info', `${CABLE_META[fromDef.cableType].label} is already connected.`);
      return true;
    }

    playSnapSound();
    const sourceId = fromDef.role === 'source' ? fromDef.id : toDef.id;
    const targetId = fromDef.role === 'target' ? fromDef.id : toDef.id;
    const newCable: ConnectedCable = {
      id: makeId('cable'),
      type: fromDef.cableType,
      from: sourceId,
      to: targetId,
      connectedAt: performance.now(),
    };

    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: {
        ...snapshot,
        cables: [...snapshot.cables, newCable],
      },
      activeCableFrom: null,
      hoveredConnectorId: null,
      lastErrorBanner: null,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
    });
    get().pushLog('success', `Connected ${CABLE_META[fromDef.cableType].label}.`);
    return true;
  },

  cancelCableDrag: () => set({ activeCableFrom: null, hoveredConnectorId: null }),

  disconnectCable: (cableId) => {
    const { snapshot, past, isPoweredOn } = get();
    if (isPoweredOn) get().powerOff();
    const cable = snapshot.cables.find((c) => c.id === cableId);
    if (!cable) return;
    playClickSound();
    set({
      past: pushSnapshotToPast(past, snapshot),
      future: [],
      snapshot: {
        ...snapshot,
        cables: snapshot.cables.filter((c) => c.id !== cableId),
      },
      bootOutcome: 'IDLE',
      bootEvaluation: null,
    });
    get().pushLog('info', `Disconnected ${CABLE_META[cable.type]?.label ?? cable.type}.`);
  },

  connectCablePairDirect: (type) => {
    const { snapshot } = get();
    const pair = Object.values(CABLE_CONNECTORS).filter((c) => c.cableType === type);
    const src = pair.find((p) => p.role === 'source');
    const dst = pair.find((p) => p.role === 'target');
    if (!src || !dst) return false;

    if (src.requiresComponentAt && !snapshot.installed[src.requiresComponentAt]) {
      playErrorSound();
      const msg = `Install ${SOCKET_DEFINITIONS[src.requiresComponentAt].label} hardware first.`;
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return false;
    }
    if (dst.requiresComponentAt && !snapshot.installed[dst.requiresComponentAt]) {
      playErrorSound();
      const msg = `Install ${SOCKET_DEFINITIONS[dst.requiresComponentAt].label} hardware first.`;
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return false;
    }
    if (type === 'sata_power' || type === 'sata_data') {
      if (!snapshot.installed.sata_ssd_bay && !snapshot.installed.hdd_bay) {
        playErrorSound();
        const msg = 'Install a 2.5" SATA SSD or 3.5" HDD before connecting SATA cables.';
        set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
        get().pushLog('warn', msg);
        return false;
      }
    }
    if (type === 'sys_fan' && !snapshot.installed.case_fan_front && !snapshot.installed.case_fan_rear) {
      playErrorSound();
      const msg = 'Install a 120mm or 140mm case fan before connecting SYS_FAN.';
      set({ lastErrorBanner: { message: msg, timestamp: Date.now() } });
      get().pushLog('warn', msg);
      return false;
    }

    set({ activeCableFrom: src.id });
    return get().completeCableConnection(dst.id);
  },

  runPowerOnTest: () => {
    clearBootTimers();
    const { snapshot, activeChallengeId, completedChallenges } = get();
    const evaluation = evaluatePowerOnTest(snapshot);

    set({
      isPoweredOn: true,
      bootOutcome: 'RUNNING',
      bootEvaluation: evaluation,
      activePostStageIndex: 0,
      bottomPanelOpen: true,
      heldSpecId: null,
      activeCableFrom: null,
    });
    get().pushLog('info', 'Power switch triggered. Initiating Power-On Self-Test (POST)...');

    // Step through each stage with visual timing
    let halted = false;
    evaluation.stages.forEach((stage, idx) => {
      const timer = window.setTimeout(() => {
        if (halted) return;
        set({ activePostStageIndex: idx + 1 });

        if (stage.status === 'fail') {
          halted = true;
          playPostBeep(false);
          set({
            bootOutcome: 'FAILURE',
            isPoweredOn: false,
          });
          get().pushLog('error', `POST HALTED at ${stage.label}: ${stage.detail}`);
          return;
        }

        if (stage.status === 'warn') {
          get().pushLog('warn', `${stage.label}: ${stage.detail}`);
        } else {
          get().pushLog('info', `${stage.label}: ${stage.detail}`);
        }

        // Final stage completion
        if (idx === evaluation.stages.length - 1) {
          playPostBeep(true);
          set({
            bootOutcome: evaluation.outcome,
            showBootMonitor: true,
          });
          get().pushLog(
            evaluation.outcome === 'SUCCESS' ? 'success' : 'warn',
            evaluation.summary
          );

          // Award challenge points if active challenge is now 100% satisfied
          if (activeChallengeId) {
            const challenge = CHALLENGES.find((c) => c.id === activeChallengeId);
            if (challenge) {
              const allMet = challenge.objectives.every((obj) =>
                obj.check(get().snapshot, evaluation)
              );
              if (allMet && !completedChallenges[challenge.id]) {
                const nextCompleted = {
                  ...get().completedChallenges,
                  [challenge.id]: challenge.points,
                };
                const totalScore = Object.values(nextCompleted).reduce((a, b) => a + b, 0);
                set({ completedChallenges: nextCompleted, totalScore });
                get().pushLog(
                  'success',
                  `Challenge #${challenge.number} Complete! +${challenge.points} pts awarded.`
                );
              }
            }
          }
        }
      }, 320 * (idx + 1));
      bootTimers.push(timer);
    });
  },

  powerOff: () => {
    clearBootTimers();
    playClickSound();
    set({
      isPoweredOn: false,
      bootOutcome: 'IDLE',
      activePostStageIndex: 0,
      showBootMonitor: false,
    });
    get().pushLog('info', 'System powered down safely.');
  },

  setShowBootMonitor: (open) => set({ showBootMonitor: open }),

  startChallenge: (challengeId) => {
    clearBootTimers();
    const ch = CHALLENGES.find((c) => c.id === challengeId);
    if (!ch) return;
    playClickSound();

    const baseSnap = createInitialSnapshot(ch.presetSetup?.motherboardId ?? 'atx_z790_ddr5');
    if (ch.presetSetup) {
      // Clear default CMOS unless preset includes it
      baseSnap.installed.cmos_slot = undefined;
      for (const item of ch.presetSetup.installed) {
        baseSnap.installed[item.socketId] = { ...item, installedAt: performance.now() };
      }
      baseSnap.cables = ch.presetSetup.cables.map((c) => ({
        ...c,
        connectedAt: performance.now(),
      }));
      baseSnap.thermalPasteApplied = ch.presetSetup.thermalPasteApplied;
      baseSnap.standoffsInstalled = ch.presetSetup.standoffsInstalled;
      baseSnap.motherboardMounted = ch.presetSetup.motherboardMounted;
    }

    set({
      activeChallengeId: challengeId,
      appMode: 'challenge',
      workspaceView: ch.presetSetup?.workspaceView ?? (challengeId === 'ch_gaming' ? 'case' : 'workbench'),
      snapshot: baseSnap,
      past: [],
      future: [],
      isPoweredOn: false,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
      activePostStageIndex: 0,
      showBootMonitor: false,
      heldSpecId: null,
      activeCableFrom: null,
    });
    get().pushLog('info', `Started Challenge #${ch.number}: ${ch.title} (${ch.points} pts).`);
  },

  exitChallenge: () => {
    playClickSound();
    set({ activeChallengeId: null, appMode: 'assemble' });
  },

  undo: () => {
    const { past, snapshot, future } = get();
    if (past.length === 0) return;
    clearBootTimers();
    playClickSound();
    const prev = past[past.length - 1];
    set({
      snapshot: prev,
      past: past.slice(0, -1),
      future: [snapshot, ...future.slice(0, 24)],
      isPoweredOn: false,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
    });
    get().pushLog('info', 'Undid last assembly action.');
  },

  redo: () => {
    const { past, snapshot, future } = get();
    if (future.length === 0) return;
    clearBootTimers();
    playClickSound();
    const next = future[0];
    set({
      snapshot: next,
      past: [...past, snapshot],
      future: future.slice(1),
      isPoweredOn: false,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
    });
    get().pushLog('info', 'Redid assembly action.');
  },

  resetBuild: () => {
    clearBootTimers();
    playClickSound();
    const currentMb = get().snapshot.motherboardId;
    set({
      past: pushSnapshotToPast(get().past, get().snapshot),
      future: [],
      snapshot: createInitialSnapshot(currentMb),
      isPoweredOn: false,
      bootOutcome: 'IDLE',
      bootEvaluation: null,
      activePostStageIndex: 0,
      showBootMonitor: false,
      heldSpecId: null,
      activeCableFrom: null,
      selectedSocketId: null,
      lastErrorBanner: null,
    });
    get().pushLog('info', 'Workbench reset to factory ATX motherboard.');
  },

  saveBuild: () => {
    try {
      const payload = JSON.stringify({
        snapshot: get().snapshot,
        workspaceView: get().workspaceView,
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(STORAGE_KEY, payload);
      playSnapSound();
      set({ savedBuildExists: true });
      get().pushLog('success', 'Build configuration saved locally.');
    } catch {
      playErrorSound();
      get().pushLog('error', 'Failed to save build to browser storage.');
    }
  },

  loadSavedBuild: () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.snapshot) return;
      clearBootTimers();
      playSnapSound();
      set({
        past: pushSnapshotToPast(get().past, get().snapshot),
        future: [],
        snapshot: parsed.snapshot,
        workspaceView: parsed.workspaceView ?? 'workbench',
        isPoweredOn: false,
        bootOutcome: 'IDLE',
        bootEvaluation: null,
      });
      get().pushLog('success', 'Loaded saved PC build configuration.');
    } catch {
      playErrorSound();
      get().pushLog('error', 'Saved build data could not be loaded.');
    }
  },

  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  clearErrorBanner: () => set({ lastErrorBanner: null }),
  toggleMute: () =>
    set((s) => {
      const next = !s.soundMuted;
      return { soundMuted: next };
    }),
}));
