export type ComponentCategory =
  | 'processing'
  | 'memory'
  | 'graphics'
  | 'storage'
  | 'power'
  | 'cooling'
  | 'expansion';

export type ComponentType =
  | 'cpu'
  | 'cpu_cooler'
  | 'ram'
  | 'gpu'
  | 'm2_ssd'
  | 'sata_ssd'
  | 'hdd'
  | 'psu'
  | 'case_fan'
  | 'cpu_fan'
  | 'wifi_card'
  | 'pcie_card'
  | 'cmos_battery';

export type CpuSocketType = 'LGA1700' | 'AM5';
export type RamGenType = 'DDR4' | 'DDR5';
export type PcieInterfaceType =
  | 'PCIe 5.0 x16'
  | 'PCIe 4.0 x16'
  | 'PCIe 4.0 x1'
  | 'PCIe 3.0 x1'
  | 'M.2 NVMe PCIe 4.0'
  | 'SATA III';

export type SocketId =
  | 'cpu_socket'
  | 'cpu_cooler_mount'
  | 'dimm_a1'
  | 'dimm_a2'
  | 'dimm_b1'
  | 'dimm_b2'
  | 'pcie_x16_1'
  | 'pcie_x1_1'
  | 'pcie_x1_2'
  | 'm2_1'
  | 'm2_2'
  | 'cmos_slot'
  | 'psu_bay'
  | 'sata_ssd_bay'
  | 'hdd_bay'
  | 'case_fan_front'
  | 'case_fan_rear';

export type CableConnectorId =
  | 'psu_24pin'
  | 'psu_8pin_cpu'
  | 'psu_pcie'
  | 'psu_sata'
  | 'mb_atx_24pin'
  | 'mb_eps_8pin'
  | 'gpu_power_in'
  | 'sata_drive_power'
  | 'mb_sata_1'
  | 'sata_drive_data'
  | 'cooler_fan_lead'
  | 'mb_cpu_fan'
  | 'case_fan_lead'
  | 'mb_sys_fan_1'
  | 'case_f_panel_lead'
  | 'mb_f_panel'
  | 'case_usb_lead'
  | 'mb_usb_hdr'
  | 'case_audio_lead'
  | 'mb_audio_hdr';

export type CableType =
  | 'atx_24pin'
  | 'eps_8pin'
  | 'pcie_gpu'
  | 'sata_power'
  | 'sata_data'
  | 'cpu_fan'
  | 'sys_fan'
  | 'front_panel'
  | 'usb_header'
  | 'front_audio';

export type WorkspaceView = 'workbench' | 'case' | 'completed';
export type AppMode = 'assemble' | 'cables' | 'learning' | 'challenge';

export interface MotherboardSpec {
  id: string;
  name: string;
  chipset: string;
  formFactor: 'ATX';
  socket: CpuSocketType;
  ramGen: RamGenType;
  maxRamSpeedMHz: number;
  description: string;
}

export interface EducationalInfo {
  whatItIs: string;
  purpose: string;
  howItWorks: string;
  howItConnects: string;
  whyNecessary: string;
  commonMistakes: string[];
}

export interface HardwareItemSpec {
  id: string;
  name: string;
  shortName: string;
  brand: string;
  category: ComponentCategory;
  type: ComponentType;
  price: number;
  wattageDraw: number;
  wattageSupply?: number;
  socketType?: CpuSocketType;
  supportedSockets?: CpuSocketType[];
  cpuGen?: string;
  hasIntegratedGraphics?: boolean;
  ramGen?: RamGenType;
  ramCapacityGB?: number;
  ramSpeedMHz?: number;
  pcieInterface?: PcieInterfaceType;
  requiresPciePower?: boolean;
  requiresSataPower?: boolean;
  requiresSataData?: boolean;
  isBootable?: boolean;
  coolerKind?: 'air' | 'liquid' | 'low_profile';
  gpuSize?: 'triple' | 'dual';
  fanSizeMm?: 120 | 140;
  dimensionsMm: [number, number, number];
  connectorType: string;
  accentColor: string;
  maxInstances: number;
  education: EducationalInfo;
}

export interface InstalledComponent {
  instanceId: string;
  specId: string;
  socketId: SocketId;
  rotationSteps: number;
  installedAt: number;
}

export interface ConnectedCable {
  id: string;
  type: CableType;
  from: CableConnectorId;
  to: CableConnectorId;
  connectedAt: number;
}

export interface SocketDefinition {
  id: SocketId;
  label: string;
  silkscreen: string;
  acceptedTypes: ComponentType[];
  position: [number, number, number];
  size: [number, number, number];
  requiredRotationSteps?: number[];
  location: 'motherboard' | 'case_or_bench';
  description: string;
  snapRadius: number;
}

export interface CableConnectorDefinition {
  id: CableConnectorId;
  label: string;
  cableType: CableType;
  role: 'source' | 'target';
  position: [number, number, number];
  color: string;
  requiresComponentAt?: SocketId;
  location: 'motherboard' | 'case_or_bench';
}

export interface CompatibilityResult {
  compatible: boolean;
  reason: string;
  warning?: string;
  orientationMismatch?: boolean;
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export type BootOutcome = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'WARNING' | 'FAILURE';

export interface PostStage {
  id: string;
  index: number;
  label: string;
  status: 'pending' | 'active' | 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface BootEvaluation {
  outcome: 'SUCCESS' | 'WARNING' | 'FAILURE';
  summary: string;
  totalWattage: number;
  psuWattage: number;
  checks: DiagnosticCheck[];
  stages: PostStage[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  targetSocketId?: SocketId;
  targetCableType?: CableType;
  highlightCategory?: ComponentCategory;
  checkCompleted: (state: SimulatorSnapshot) => boolean;
}

export interface ChallengeDefinition {
  id: string;
  number: number;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  brief: string;
  points: number;
  objectives: {
    id: string;
    label: string;
    check: (state: SimulatorSnapshot, bootEval?: BootEvaluation | null) => boolean;
  }[];
  presetSetup?: {
    motherboardId: string;
    installed: Omit<InstalledComponent, 'installedAt'>[];
    cables: Omit<ConnectedCable, 'connectedAt'>[];
    thermalPasteApplied: boolean;
    standoffsInstalled: boolean;
    motherboardMounted: boolean;
    workspaceView?: WorkspaceView;
  };
}

export interface SimulatorSnapshot {
  motherboardId: string;
  installed: Record<SocketId, InstalledComponent | undefined>;
  cables: ConnectedCable[];
  thermalPasteApplied: boolean;
  standoffsInstalled: boolean;
  motherboardMounted: boolean;
  motherboardScrewsInstalled: boolean;
}

export type CameraPreset = 'iso' | 'top' | 'side' | 'rear' | 'cpu' | 'ram' | 'gpu' | 'cables';
