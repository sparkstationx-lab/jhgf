import {
  HARDWARE_BY_ID,
  MOTHERBOARD_BY_ID,
  SOCKET_DEFINITIONS,
} from '../data/catalog';
import {
  BootEvaluation,
  CompatibilityResult,
  DiagnosticCheck,
  HardwareItemSpec,
  PostStage,
  SimulatorSnapshot,
  SocketId,
} from '../types/hardware';

export function checkSocketCompatibility(
  spec: HardwareItemSpec,
  socketId: SocketId,
  state: SimulatorSnapshot,
  rotationSteps = 0
): CompatibilityResult {
  const socket = SOCKET_DEFINITIONS[socketId];
  const board = MOTHERBOARD_BY_ID[state.motherboardId];

  if (!socket || !board) {
    return { compatible: false, reason: 'Invalid socket or motherboard specification.' };
  }

  // 1. Check if slot already occupied
  if (state.installed[socketId]) {
    return {
      compatible: false,
      reason: `${socket.label} is already occupied. Remove the installed component first.`,
    };
  }

  // 2. Check accepted component type
  if (!socket.acceptedTypes.includes(spec.type)) {
    return {
      compatible: false,
      reason: `${spec.shortName} (${spec.connectorType}) cannot be installed into ${socket.label}.`,
    };
  }

  // 3. CPU socket compatibility
  if (spec.type === 'cpu') {
    if (spec.socketType !== board.socket) {
      return {
        compatible: false,
        reason: `Incompatible CPU socket: ${spec.shortName} requires ${spec.socketType}, but ${board.name} has an ${board.socket} socket.`,
      };
    }
    const normalizedRot = ((rotationSteps % 4) + 4) % 4;
    if (normalizedRot !== 0) {
      return {
        compatible: false,
        orientationMismatch: true,
        reason: `CPU orientation mismatch (${normalizedRot * 90}°). Press R to align the gold triangle with the socket pin-1 marker.`,
      };
    }
  }

  // 4. CPU cooler prerequisites & socket check
  if (spec.type === 'cpu_cooler') {
    if (!state.installed.cpu_socket) {
      return {
        compatible: false,
        reason: 'Install a compatible CPU into the CPU socket before mounting a CPU cooler.',
      };
    }
    if (spec.supportedSockets && !spec.supportedSockets.includes(board.socket)) {
      return {
        compatible: false,
        reason: `Cooler bracket mismatch: ${spec.shortName} supports ${spec.supportedSockets.join(', ')}, not ${board.socket}.`,
      };
    }
    if (!state.thermalPasteApplied) {
      return {
        compatible: true,
        reason: 'Compatible CPU cooler mount (Warning: thermal paste not applied yet).',
        warning: 'Thermal paste has not been applied to the CPU IHS. Apply thermal paste for safe thermals.',
      };
    }
  }

  // 5. RAM generation & notch orientation check
  if (spec.type === 'ram') {
    if (spec.ramGen !== board.ramGen) {
      return {
        compatible: false,
        reason: `Memory generation mismatch: ${spec.shortName} is ${spec.ramGen}, but ${board.name} only supports ${board.ramGen} DIMM modules.`,
      };
    }
    const normalizedRot = ((rotationSteps % 4) + 4) % 4;
    if (normalizedRot !== 0) {
      return {
        compatible: false,
        orientationMismatch: true,
        reason: `RAM key notch misaligned (${normalizedRot * 90}°). Press R to align the notch with the ${socket.silkscreen} ridge.`,
      };
    }
  }

  // 6. GPU / PCIe orientation check
  if (spec.type === 'gpu') {
    const normalizedRot = ((rotationSteps % 4) + 4) % 4;
    if (normalizedRot !== 0) {
      return {
        compatible: false,
        orientationMismatch: true,
        reason: `GPU bracket orientation misaligned (${normalizedRot * 90}°). Press R so the I/O bracket faces the rear (left) edge.`,
      };
    }
  }

  // 7. M.2 SSD orientation check
  if (spec.type === 'm2_ssd') {
    const normalizedRot = ((rotationSteps % 4) + 4) % 4;
    if (normalizedRot !== 0) {
      return {
        compatible: false,
        orientationMismatch: true,
        reason: `M.2 M-key connector misaligned. Press R to align gold contacts toward the right-hand M.2 header.`,
      };
    }
  }

  // 8. Expansion cards
  if (spec.type === 'wifi_card' || spec.type === 'pcie_card') {
    const normalizedRot = ((rotationSteps % 4) + 4) % 4;
    if (normalizedRot !== 0) {
      return {
        compatible: false,
        orientationMismatch: true,
        reason: `Expansion card bracket misaligned. Press R to align ports toward the rear I/O side.`,
      };
    }
  }

  return {
    compatible: true,
    reason: `Compatible with ${socket.label} (${socket.silkscreen}).`,
  };
}

export function calculateSystemWattage(state: SimulatorSnapshot): {
  totalDraw: number;
  psuSupply: number;
} {
  let totalDraw = 45; // Base ATX motherboard + VRM + chipset overhead
  let psuSupply = 0;

  for (const item of Object.values(state.installed)) {
    if (!item) continue;
    const spec = HARDWARE_BY_ID[item.specId];
    if (!spec) continue;
    totalDraw += spec.wattageDraw;
    if (spec.type === 'psu' && spec.wattageSupply) {
      psuSupply = spec.wattageSupply;
    }
  }

  return { totalDraw, psuSupply };
}

export function evaluatePowerOnTest(state: SimulatorSnapshot): BootEvaluation {
  const checks: DiagnosticCheck[] = [];
  const cableTypes = new Set(state.cables.map((c) => c.type));
  const { totalDraw, psuSupply } = calculateSystemWattage(state);

  const psuItem = state.installed.psu_bay;
  const cpuItem = state.installed.cpu_socket;
  const coolerItem = state.installed.cpu_cooler_mount;
  const gpuItem = state.installed.pcie_x16_1;
  const cmosItem = state.installed.cmos_slot;

  const ramSlots: SocketId[] = ['dimm_a1', 'dimm_a2', 'dimm_b1', 'dimm_b2'];
  const installedRam = ramSlots
    .map((id) => state.installed[id])
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const m2Drives = [state.installed.m2_1, state.installed.m2_2].filter(Boolean);
  const sataDrives = [state.installed.sata_ssd_bay, state.installed.hdd_bay].filter(Boolean);

  const cpuSpec = cpuItem ? HARDWARE_BY_ID[cpuItem.specId] : undefined;
  const gpuSpec = gpuItem ? HARDWARE_BY_ID[gpuItem.specId] : undefined;

  // 1. PSU & 24-pin ATX
  const hasPsu = Boolean(psuItem);
  const has24Pin = cableTypes.has('atx_24pin');
  const psuOverload = hasPsu && totalDraw > psuSupply;
  const psuTight = hasPsu && !psuOverload && totalDraw > psuSupply * 0.85;

  if (!hasPsu) {
    checks.push({
      id: 'power_psu',
      label: 'Power Supply (PSU)',
      status: 'fail',
      detail: 'No ATX power supply installed in PSU Bay.',
    });
  } else if (!has24Pin) {
    checks.push({
      id: 'power_24pin',
      label: '24-Pin ATX Main Power',
      status: 'fail',
      detail: '24-Pin ATX power cable is not connected to ATX_PWR. Motherboard receives no standby or main voltage.',
    });
  } else if (psuOverload) {
    checks.push({
      id: 'power_budget',
      label: 'PSU Wattage Capacity',
      status: 'fail',
      detail: `Over-Power Protection tripped: System requires ~${totalDraw}W, exceeding ${psuSupply}W PSU capacity.`,
    });
  } else if (psuTight) {
    checks.push({
      id: 'power_budget',
      label: 'PSU Wattage Headroom',
      status: 'warn',
      detail: `System load (~${totalDraw}W) is above 85% of ${psuSupply}W PSU capacity. Consider upgrading to 850W.`,
    });
  } else {
    checks.push({
      id: 'power_24pin',
      label: 'Motherboard Power Rail',
      status: 'pass',
      detail: `${psuSupply}W PSU delivering regulated +12V/+5V/+3.3V rails (Est. load ${totalDraw}W).`,
    });
  }

  // 2. CPU & 8-Pin EPS
  const hasCpu = Boolean(cpuItem && cpuSpec);
  const hasEps = cableTypes.has('eps_8pin');

  if (!hasCpu) {
    checks.push({
      id: 'cpu_installed',
      label: 'CPU Installation',
      status: 'fail',
      detail: 'No processor detected in CPU socket. POST halted at CPU LED.',
    });
  } else if (!hasEps) {
    checks.push({
      id: 'cpu_power',
      label: '8-Pin EPS CPU Power',
      status: 'fail',
      detail: '8-Pin EPS CPU_PWR cable is disconnected. CPU VRM cannot energize processor cores.',
    });
  } else {
    checks.push({
      id: 'cpu_init',
      label: 'CPU & EPS Power',
      status: 'pass',
      detail: `${cpuSpec!.shortName} initialized cleanly via 8-Pin EPS power rail.`,
    });
  }

  // 3. CPU Cooler, Thermal Paste & CPU_FAN
  const hasCooler = Boolean(coolerItem);
  const hasCpuFanCable = cableTypes.has('cpu_fan');

  if (!hasCooler) {
    checks.push({
      id: 'cpu_cooler',
      label: 'CPU Thermal Solution',
      status: 'fail',
      detail: 'No CPU cooler mounted. Thermal shutdown triggered immediately to protect silicon.',
    });
  } else if (!state.thermalPasteApplied) {
    checks.push({
      id: 'thermal_paste',
      label: 'Thermal Interface Paste',
      status: 'warn',
      detail: 'CPU cooler is mounted without thermal paste—idle temperatures are elevated (~78°C).',
    });
  } else if (!hasCpuFanCable) {
    checks.push({
      id: 'cpu_fan',
      label: 'CPU_FAN Header Telemetry',
      status: 'fail',
      detail: 'CPU cooler PWM cable is not connected to CPU_FAN header (BIOS CPU Fan Speed Error).',
    });
  } else {
    checks.push({
      id: 'cooling',
      label: 'CPU Cooling & Telemetry',
      status: 'pass',
      detail: 'Thermal paste applied, cooler mounted, and CPU_FAN reporting 1,150 RPM.',
    });
  }

  // 4. Memory (RAM)
  const totalRamGB = installedRam.reduce((acc, r) => acc + (HARDWARE_BY_ID[r.specId]?.ramCapacityGB ?? 0), 0);
  const hasDualChannel =
    Boolean(state.installed.dimm_a2 && state.installed.dimm_b2) ||
    Boolean(state.installed.dimm_a1 && state.installed.dimm_b1);

  if (installedRam.length === 0) {
    checks.push({
      id: 'ram',
      label: 'System Memory (RAM)',
      status: 'fail',
      detail: 'No DIMM modules installed. POST halted at DRAM LED (3 long beeps).',
    });
  } else if (installedRam.length === 1) {
    checks.push({
      id: 'ram',
      label: 'System Memory (Single-Channel)',
      status: 'warn',
      detail: `${totalRamGB}GB detected in single-channel mode. Add a matching module in A2+B2 for dual-channel bandwidth.`,
    });
  } else if (!hasDualChannel) {
    checks.push({
      id: 'ram',
      label: 'System Memory (Suboptimal Slot Pairing)',
      status: 'warn',
      detail: `${totalRamGB}GB detected, but sticks are in the same memory channel. Move to DIMM_A2 + DIMM_B2 for dual-channel.`,
    });
  } else {
    checks.push({
      id: 'ram',
      label: 'System Memory (Dual-Channel)',
      status: 'pass',
      detail: `${totalRamGB}GB DDR memory trained in Dual-Channel mode.`,
    });
  }

  // 5. Display / GPU
  const hasGpu = Boolean(gpuItem && gpuSpec);
  const hasGpuPower = cableTypes.has('pcie_gpu');
  const hasIgpu = Boolean(cpuSpec?.hasIntegratedGraphics);

  if (hasGpu && gpuSpec?.requiresPciePower && !hasGpuPower) {
    checks.push({
      id: 'gpu',
      label: 'Dedicated GPU Power',
      status: 'fail',
      detail: `${gpuSpec.shortName} is seated in PCIe x16, but its PCIe GPU power cable is disconnected. No video signal.`,
    });
  } else if (hasGpu) {
    checks.push({
      id: 'gpu',
      label: 'Graphics Initialization',
      status: 'pass',
      detail: `${gpuSpec!.shortName} initialized on PCIe x16 with supplemental PCIe power.`,
    });
  } else if (hasIgpu) {
    checks.push({
      id: 'gpu',
      label: 'Integrated Graphics Output',
      status: 'pass',
      detail: `Using ${cpuSpec!.shortName} integrated display engine via Rear I/O HDMI/DisplayPort.`,
    });
  } else {
    checks.push({
      id: 'gpu',
      label: 'Video Output',
      status: 'fail',
      detail: 'No dedicated GPU installed and CPU lacks integrated graphics. POST halted at VGA LED.',
    });
  }

  // 6. Bootable Storage
  const hasM2 = m2Drives.length > 0;
  const hasSataDrive = sataDrives.length > 0;
  const sataReady = hasSataDrive && cableTypes.has('sata_power') && cableTypes.has('sata_data');

  if (hasM2 || sataReady) {
    const names = [
      ...m2Drives.map((d) => HARDWARE_BY_ID[d!.specId]?.shortName),
      ...(sataReady ? sataDrives.map((d) => HARDWARE_BY_ID[d!.specId]?.shortName) : []),
    ].filter(Boolean);
    checks.push({
      id: 'storage',
      label: 'Bootable Storage',
      status: 'pass',
      detail: `UEFI boot volume detected: ${names.join(', ')}.`,
    });
  } else if (hasSataDrive && (!cableTypes.has('sata_power') || !cableTypes.has('sata_data'))) {
    checks.push({
      id: 'storage',
      label: 'SATA Storage Cabling',
      status: 'warn',
      detail: 'SATA drive is mounted but missing SATA Power and/or SATA Data cables. System drops to UEFI BIOS shell.',
    });
  } else {
    checks.push({
      id: 'storage',
      label: 'Bootable Storage',
      status: 'warn',
      detail: 'No bootable SSD or HDD detected. PC enters UEFI BIOS setup but cannot load an Operating System.',
    });
  }

  // 7. CMOS Battery & Optional Case Fans / Front Panel
  if (!cmosItem) {
    checks.push({
      id: 'cmos',
      label: 'CMOS Battery (CR2032)',
      status: 'warn',
      detail: 'CR2032 CMOS battery missing—BIOS settings and real-time clock will reset on power loss.',
    });
  } else {
    checks.push({
      id: 'cmos',
      label: 'CMOS / RTC Battery',
      status: 'pass',
      detail: '3.0V lithium CMOS cell healthy; UEFI NVRAM preserved.',
    });
  }

  const hasCaseFan = Boolean(state.installed.case_fan_front || state.installed.case_fan_rear);
  if (hasCaseFan && !cableTypes.has('sys_fan')) {
    checks.push({
      id: 'case_fan',
      label: 'Chassis Fan Header',
      status: 'warn',
      detail: 'Case fan is mounted but not connected to motherboard SYS_FAN1 header.',
    });
  }

  // Determine overall outcome
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');

  const outcome: 'SUCCESS' | 'WARNING' | 'FAILURE' = hasFail
    ? 'FAILURE'
    : hasWarn
      ? 'WARNING'
      : 'SUCCESS';

  const summary =
    outcome === 'SUCCESS'
      ? 'POST passed with zero errors. All hardware initialized and SiliconOS Desktop booted cleanly.'
      : outcome === 'WARNING'
        ? 'System powered on and passed POST with non-fatal warnings. Review diagnostic advisories below.'
        : 'System failed to boot. Resolve the critical hardware or cabling failures highlighted below.';

  // Build 8 ordered POST stages
  const powerOk = hasPsu && has24Pin && !psuOverload;
  const cpuOk = powerOk && hasCpu && hasEps && hasCooler && hasCpuFanCable;
  const ramOk = cpuOk && installedRam.length > 0;
  const gpuOk = ramOk && ((hasGpu && (!gpuSpec?.requiresPciePower || hasGpuPower)) || (!hasGpu && hasIgpu));
  const storageOk = gpuOk && (hasM2 || sataReady);

  const stages: PostStage[] = [
    {
      id: 'stage_power',
      index: 1,
      label: '1. Power Distribution (+12V / +5V / +3.3V)',
      status: powerOk ? (psuTight ? 'warn' : 'pass') : 'fail',
      detail: powerOk
        ? `PSU Power-Good signal asserted (${totalDraw}W / ${psuSupply}W).`
        : !hasPsu
          ? 'No PSU installed.'
          : !has24Pin
            ? '24-Pin ATX power disconnected.'
            : 'PSU over-power protection tripped.',
    },
    {
      id: 'stage_cpu',
      index: 2,
      label: '2. CPU Initialization & Thermal Check',
      status: !powerOk ? 'pending' : cpuOk ? (!state.thermalPasteApplied ? 'warn' : 'pass') : 'fail',
      detail: !powerOk
        ? 'Waiting for standby power.'
        : cpuOk
          ? `${cpuSpec!.shortName} microcode loaded; CPU_FAN active.`
          : !hasCpu
            ? 'No CPU installed.'
            : !hasEps
              ? '8-Pin EPS CPU_PWR missing.'
              : !hasCooler
                ? 'Thermal trip: no CPU cooler.'
                : 'CPU_FAN header unplugged.',
    },
    {
      id: 'stage_post',
      index: 3,
      label: '3. Power-On Self-Test (POST)',
      status: !cpuOk ? 'pending' : 'pass',
      detail: cpuOk ? 'Motherboard chipset & SPI BIOS checksum verified.' : 'Halted before POST.',
    },
    {
      id: 'stage_ram',
      index: 4,
      label: '4. RAM Detection & Memory Training',
      status: !cpuOk ? 'pending' : ramOk ? (hasDualChannel ? 'pass' : 'warn') : 'fail',
      detail: !cpuOk
        ? 'Skipped.'
        : ramOk
          ? `${totalRamGB}GB memory initialized (${hasDualChannel ? 'Dual-Channel' : 'Single-Channel'}).`
          : 'DRAM Error: no compatible RAM detected.',
    },
    {
      id: 'stage_gpu',
      index: 5,
      label: '5. GPU & Display Initialization',
      status: !ramOk ? 'pending' : gpuOk ? 'pass' : 'fail',
      detail: !ramOk
        ? 'Skipped.'
        : gpuOk
          ? hasGpu
            ? `${gpuSpec!.shortName} active on PCIe x16.`
            : 'Integrated graphics display pipeline active.'
          : 'VGA Error: GPU missing PCIe power or no video adapter.',
    },
    {
      id: 'stage_storage',
      index: 6,
      label: '6. NVMe / SATA Storage Detection',
      status: !gpuOk ? 'pending' : storageOk ? 'pass' : 'warn',
      detail: !gpuOk
        ? 'Skipped.'
        : storageOk
          ? 'Bootable GPT storage partition enumerated.'
          : 'No bootable drive found—entering UEFI shell.',
    },
    {
      id: 'stage_bios',
      index: 7,
      label: '7. UEFI / BIOS Firmware Startup',
      status: !gpuOk ? 'pending' : cmosItem ? 'pass' : 'warn',
      detail: !gpuOk
        ? 'Skipped.'
        : cmosItem
          ? 'SiliconBench UEFI v4.2 initialized cleanly.'
          : 'UEFI loaded (CMOS battery warning: clock reset).',
    },
    {
      id: 'stage_os',
      index: 8,
      label: '8. Operating System Kernel Loading',
      status: !gpuOk ? 'pending' : storageOk ? 'pass' : 'warn',
      detail: !gpuOk
        ? 'Skipped.'
        : storageOk
          ? 'SiliconOS Workstation desktop ready.'
          : 'Paused at UEFI setup (install an SSD/HDD to boot OS).',
    },
  ];

  return {
    outcome,
    summary,
    totalWattage: totalDraw,
    psuWattage: psuSupply,
    checks,
    stages,
  };
}
