import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MOTHERBOARD_BY_ID } from '../../data/catalog';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import {
  getCpuSocketPinTexture,
  getMotherboardPcbTexture,
} from '../../utils/proceduralTextures';

/**
 * Detailed ATX Motherboard Model (305mm x 244mm -> 3.05 x 2.44 units)
 * Accurately models all 18 required motherboard subsystems:
 * 1. CPU Socket (with animated ILM retention arm)
 * 2. 4x DIMM RAM Slots (with animated top/bottom latches)
 * 3. Reinforced PCIe x16 Slot (with animated latch)
 * 4. 2x PCIe x1 Slots
 * 5. 2x M.2 NVMe Slots (with standoff & animated screw)
 * 6. 4x SATA Connectors
 * 7. 24-Pin ATX Power Connector
 * 8. 8-Pin EPS CPU Power Connector
 * 9. Dual VRM Heatsinks + Instanced VRM Chokes & Solid Capacitors
 * 10. Chipset Heatsink with Illuminated Power Strip
 * 11. CMOS Battery Holder
 * 12. BIOS SOIC-8 Flash Chip
 * 13. CPU_FAN Header
 * 14. SYS_FAN Headers
 * 15. Front Panel Header (F_PANEL)
 * 16. Internal USB 3.2 Header
 * 17. HD Audio Header
 * 18. Full Rear I/O Port Cluster & Aluminum Shroud
 */
export const MotherboardModel: React.FC = () => {
  const motherboardId = useSimulatorStore((s) => s.snapshot.motherboardId);
  const installed = useSimulatorStore((s) => s.snapshot.installed);
  const thermalPasteApplied = useSimulatorStore((s) => s.snapshot.thermalPasteApplied);
  const isPoweredOn = useSimulatorStore((s) => s.isPoweredOn);
  const bootOutcome = useSimulatorStore((s) => s.bootOutcome);
  const activePostStageIndex = useSimulatorStore((s) => s.activePostStageIndex);
  const standoffsInstalled = useSimulatorStore((s) => s.snapshot.standoffsInstalled);
  const motherboardScrewsInstalled = useSimulatorStore((s) => s.snapshot.motherboardScrewsInstalled);
  const workspaceView = useSimulatorStore((s) => s.workspaceView);

  const board = MOTHERBOARD_BY_ID[motherboardId];

  const pcbTex = useMemo(
    () => getMotherboardPcbTexture(board.name, board.socket, board.ramGen),
    [board]
  );
  const pinTex = useMemo(() => getCpuSocketPinTexture(), []);

  // Animated ILM retention lever & frame
  const ilmLeverRef = useRef<THREE.Group>(null);
  const pcieLatchRef = useRef<THREE.Mesh>(null);
  const dimmLatchRefs = useRef<(THREE.Group | null)[]>([]);
  const pulseDotRef = useRef<THREE.Mesh>(null);
  const pulseDot2Ref = useRef<THREE.Mesh>(null);

  // Instanced VRM capacitors & ferrite chokes
  const chokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const capMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    // 14 VRM Chokes (left column + top row)
    if (chokeMeshRef.current) {
      const chokePositions: [number, number][] = [
        [-0.54, -1.04], [-0.54, -0.94], [-0.54, -0.84], [-0.54, -0.74],
        [-0.54, -0.64], [-0.54, -0.54], [-0.54, -0.44],
        [-0.44, -1.08], [-0.34, -1.08], [-0.24, -1.08], [-0.14, -1.08],
        [-0.04, -1.08], [0.06, -1.08], [0.16, -1.08],
      ];
      chokePositions.forEach(([x, z], i) => {
        dummy.position.set(x, 0.115, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        chokeMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      chokeMeshRef.current.instanceMatrix.needsUpdate = true;
      chokeMeshRef.current.computeBoundingSphere();
    }

    // 16 Solid aluminum VRM & Audio capacitors
    if (capMeshRef.current) {
      const capPositions: [number, number][] = [
        [-0.46, -0.99], [-0.46, -0.87], [-0.46, -0.75], [-0.46, -0.63], [-0.46, -0.51],
        [-0.38, -1.01], [-0.26, -1.01], [-0.14, -1.01], [-0.02, -1.01], [0.10, -1.01],
        // Audio niche golden caps bottom-left
        [-1.10, 0.72], [-1.10, 0.84], [-1.10, 0.96], [-1.10, 1.08], [-1.10, 1.20], [-1.10, 1.32],
      ];
      capPositions.forEach(([x, z], i) => {
        dummy.position.set(x, 0.115, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        capMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      capMeshRef.current.instanceMatrix.needsUpdate = true;
      capMeshRef.current.computeBoundingSphere();
    }
  }, []);

  // Animate CPU retention arm, DIMM clips, PCIe latch, and POST data flow signals
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    // CPU ILM load lever closes flat (0 rad) when CPU installed, lifts open (-1.25 rad) when empty
    if (ilmLeverRef.current) {
      const targetAngle = installed.cpu_socket ? 0 : -1.25;
      ilmLeverRef.current.rotation.x = THREE.MathUtils.damp(
        ilmLeverRef.current.rotation.x,
        targetAngle,
        9,
        dt
      );
    }

    // PCIe x16 retention latch locks upright when GPU installed
    if (pcieLatchRef.current) {
      const targetRot = installed.pcie_x16_1 ? 0 : -0.45;
      pcieLatchRef.current.rotation.z = THREE.MathUtils.damp(
        pcieLatchRef.current.rotation.z,
        targetRot,
        10,
        dt
      );
    }

    // DIMM latches snap inward when RAM stick seated
    const ramIds = ['dimm_a1', 'dimm_a2', 'dimm_b1', 'dimm_b2'] as const;
    ramIds.forEach((id, idx) => {
      const grp = dimmLatchRefs.current[idx];
      if (grp) {
        const occupied = Boolean(installed[id]);
        const target = occupied ? 0 : 0.38;
        grp.children.forEach((child, cIdx) => {
          child.rotation.x = THREE.MathUtils.damp(
            child.rotation.x,
            cIdx === 0 ? -target : target,
            10,
            dt
          );
        });
      }
    });

    // Animated PCB signal pulses during Power-On Test
    const t = state.clock.elapsedTime;
    if (pulseDotRef.current) {
      pulseDotRef.current.visible = isPoweredOn;
      if (isPoweredOn) {
        const p = (t * 1.4) % 1;
        pulseDotRef.current.position.set(
          THREE.MathUtils.lerp(-0.18, 0.54, p),
          0.092,
          -0.74
        );
      }
    }
    if (pulseDot2Ref.current) {
      pulseDot2Ref.current.visible = isPoweredOn;
      if (isPoweredOn) {
        const p = (t * 1.1 + 0.5) % 1;
        pulseDot2Ref.current.position.set(
          -0.18,
          0.092,
          THREE.MathUtils.lerp(-0.56, 0.24, p)
        );
      }
    }
  });

  // 9 ATX standoff/screw coordinates
  const mountCoords: [number, number][] = useMemo(
    () => [
      [-1.10, -1.40], [0.02, -1.40], [1.10, -1.40],
      [-1.10, 0.02], [0.02, 0.02], [1.10, 0.02],
      [-1.10, 1.40], [0.02, 1.40], [1.10, 1.40],
    ],
    []
  );

  // POST Diagnostic LED status colors (CPU, DRAM, VGA, BOOT)
  const postLedColors = useMemo(() => {
    const getLed = (stageIdx: number, failColor: string, okColor: string) => {
      if (!isPoweredOn && bootOutcome === 'IDLE') return '#1e293b';
      if (bootOutcome === 'FAILURE' && activePostStageIndex === stageIdx) return failColor;
      if (activePostStageIndex >= stageIdx) return okColor;
      return '#1e293b';
    };
    return [
      getLed(2, '#ef4444', '#10b981'), // CPU LED
      getLed(4, '#f59e0b', '#10b981'), // DRAM LED
      getLed(5, '#ef4444', '#10b981'), // VGA LED
      getLed(6, '#f59e0b', '#22d3ee'), // BOOT LED
    ];
  }, [isPoweredOn, bootOutcome, activePostStageIndex]);

  return (
    <group name="atx_motherboard">
      {/* Main 6-layer ATX PCB */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.44, 0.04, 3.05]} />
        <meshStandardMaterial
          map={pcbTex}
          roughness={0.52}
          metalness={0.22}
        />
      </mesh>

      {/* Brass Standoffs beneath PCB + Mounting Screws on top */}
      {mountCoords.map(([mx, mz], i) => (
        <group key={i} position={[mx, 0, mz]}>
          {(workspaceView === 'workbench' || standoffsInstalled) && (
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.028, 0.028, 0.04, 6]} />
              <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.24} />
            </mesh>
          )}
          {(workspaceView === 'workbench' || motherboardScrewsInstalled) && (
            <mesh position={[0, 0.088, 0]}>
              <cylinderGeometry args={[0.032, 0.032, 0.016, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
            </mesh>
          )}
        </group>
      ))}

      {/* Instanced VRM Ferrite Chokes & Solid Capacitors */}
      <instancedMesh ref={chokeMeshRef} args={[undefined, undefined, 14]} castShadow>
        <boxGeometry args={[0.072, 0.062, 0.072]} />
        <meshStandardMaterial color="#334155" metalness={0.72} roughness={0.38} />
      </instancedMesh>
      <instancedMesh ref={capMeshRef} args={[undefined, undefined, 16]} castShadow>
        <cylinderGeometry args={[0.026, 0.026, 0.075, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.2} />
      </instancedMesh>

      {/* 1. CPU SOCKET + ANIMATED ILM RETENTION MECHANISM */}
      <group position={[-0.18, 0.08, -0.74]}>
        {/* Socket polymer base */}
        <mesh position={[0, 0.014, 0]} receiveShadow>
          <boxGeometry args={[0.46, 0.028, 0.52]} />
          <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.2} />
        </mesh>
        {/* LGA Gold Pin Contact Bed */}
        <mesh position={[0, 0.029, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.37, 0.43]} />
          <meshStandardMaterial map={pinTex} roughness={0.35} metalness={0.65} />
        </mesh>
        {/* Pin-1 Gold Corner Orientation Triangle on Socket */}
        <mesh position={[-0.19, 0.031, 0.21]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 3]} />
          <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.45} />
        </mesh>
        {/* Steel ILM Retention Frame & Load Arm */}
        <group ref={ilmLeverRef} position={[0, 0.035, -0.25]}>
          {/* Top/Bottom/Left/Right steel perimeter frame */}
          <mesh position={[-0.21, 0.015, 0.25]}>
            <boxGeometry args={[0.038, 0.018, 0.50]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0.21, 0.015, 0.25]}>
            <boxGeometry args={[0.038, 0.018, 0.50]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.015, 0.01]}>
            <boxGeometry args={[0.45, 0.018, 0.04]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.015, 0.49]}>
            <boxGeometry args={[0.45, 0.018, 0.04]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Steel Load Lever Bar along right edge */}
          <mesh position={[0.255, 0.02, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.54, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.16} />
          </mesh>
        </group>

        {/* Simulated Thermal Paste Dollop on top of installed CPU IHS */}
        {installed.cpu_socket && thermalPasteApplied && (
          <group position={[0, 0.078, 0]}>
            <mesh>
              <cylinderGeometry args={[0.068, 0.088, 0.018, 20]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.45} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.008, 0]}>
              <sphereGeometry args={[0.052, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.2} />
            </mesh>
          </group>
        )}
      </group>

      {/* 2. FOUR DIMM RAM SLOTS (A1, A2, B1, B2) WITH ANIMATED RETAINING LATCHES */}
      {[0.42, 0.54, 0.66, 0.78].map((xPos, idx) => {
        const isPrimaryChannel = idx === 1 || idx === 3; // A2 & B2 highlighted subtle grey
        return (
          <group key={idx} position={[xPos, 0.08, -0.72]}>
            {/* Slot body */}
            <mesh position={[0, 0.036, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.068, 0.072, 1.32]} />
              <meshStandardMaterial
                color={isPrimaryChannel ? '#334155' : '#111827'}
                roughness={0.55}
                metalness={0.15}
              />
            </mesh>
            {/* Dark interior channel + key ridge */}
            <mesh position={[0, 0.073, 0]}>
              <boxGeometry args={[0.024, 0.01, 1.24]} />
              <meshStandardMaterial color="#05080f" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.074, board.ramGen === 'DDR4' ? 0.06 : -0.05]}>
              <boxGeometry args={[0.03, 0.018, 0.03]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
            {/* Animated Top & Bottom Retaining Clips */}
            <group
              ref={(el) => {
                dimmLatchRefs.current[idx] = el;
              }}
            >
              <mesh position={[0, 0.065, -0.68]}>
                <boxGeometry args={[0.062, 0.078, 0.045]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0.065, 0.68]}>
                <boxGeometry args={[0.062, 0.078, 0.045]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* 3. REINFORCED STEEL PCIe 5.0 x16 SLOT + RETENTION LATCH */}
      <group position={[-0.36, 0.08, 0.24]}>
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.98, 0.09, 0.095]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.092, 0]}>
          <boxGeometry args={[0.92, 0.012, 0.032]} />
          <meshStandardMaterial color="#05080f" roughness={0.8} />
        </mesh>
        {/* Retention latch on right end */}
        <mesh ref={pcieLatchRef} position={[0.52, 0.055, 0]}>
          <boxGeometry args={[0.075, 0.085, 0.085]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.4} metalness={0.2} />
        </mesh>
      </group>

      {/* 4. TWO PCIe x1 EXPANSION SLOTS */}
      {[0.56, 1.00].map((zPos, i) => (
        <group key={i} position={[-0.64, 0.08, zPos]}>
          <mesh position={[0, 0.042, 0]} castShadow>
            <boxGeometry args={[0.30, 0.084, 0.078]} />
            <meshStandardMaterial color="#111827" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.086, 0]}>
            <boxGeometry args={[0.25, 0.01, 0.028]} />
            <meshStandardMaterial color="#05080f" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* 5. TWO M.2 NVMe SLOTS (Header + Standoff + Retaining Screw) */}
      {[
        { z: -0.10, occupied: Boolean(installed.m2_1) },
        { z: 0.72, occupied: Boolean(installed.m2_2) },
      ].map((slot, i) => (
        <group key={i} position={[-0.14, 0.08, slot.z]}>
          {/* M.2 Connector Socket (right edge) */}
          <mesh position={[0.41, 0.032, 0]} castShadow>
            <boxGeometry args={[0.075, 0.064, 0.24]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
          {/* 2280 Standoff (left edge) */}
          <mesh position={[-0.39, 0.018, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.036, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.22} />
          </mesh>
          {/* Retaining screw fastened when M.2 installed */}
          {slot.occupied && (
            <mesh position={[-0.39, 0.056, 0]}>
              <cylinderGeometry args={[0.032, 0.028, 0.018, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
            </mesh>
          )}
        </group>
      ))}

      {/* 6. FOUR RIGHT-ANGLE SATA CONNECTORS */}
      <group position={[1.08, 0.08, 0.86]}>
        {[-0.14, -0.05, 0.05, 0.14].map((zOff, i) => (
          <mesh key={i} position={[0, 0.042, zOff]} castShadow>
            <boxGeometry args={[0.14, 0.075, 0.075]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* 7. 24-PIN ATX MAIN POWER CONNECTOR */}
      <group position={[1.08, 0.08, -0.58]}>
        <mesh position={[0, 0.065, 0]} castShadow>
          <boxGeometry args={[0.12, 0.13, 0.56]} />
          <meshStandardMaterial color="#111827" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.132, 0]}>
          <boxGeometry args={[0.08, 0.008, 0.50]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
      </group>

      {/* 8. 8-PIN EPS CPU POWER CONNECTOR */}
      <group position={[-0.76, 0.08, -1.40]}>
        <mesh position={[0, 0.062, 0]} castShadow>
          <boxGeometry args={[0.24, 0.12, 0.12]} />
          <meshStandardMaterial color="#111827" roughness={0.55} />
        </mesh>
      </group>

      {/* 9. DUAL FINNED ANODIZED VRM HEATSINKS */}
      {/* Left VRM Heatsink */}
      <group position={[-0.74, 0.08, -0.74]}>
        <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.24, 0.88]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.26} />
        </mesh>
        {[-0.32, -0.16, 0, 0.16, 0.32].map((zOff, i) => (
          <mesh key={i} position={[0.02, 0.245, zOff]}>
            <boxGeometry args={[0.18, 0.02, 0.07]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
      </group>
      {/* Top VRM Heatsink */}
      <group position={[-0.14, 0.08, -1.24]}>
        <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.22, 0.20]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.26} />
        </mesh>
        {[-0.28, -0.14, 0, 0.14, 0.28].map((xOff, i) => (
          <mesh key={i} position={[xOff, 0.225, 0]}>
            <boxGeometry args={[0.08, 0.018, 0.16]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
      </group>

      {/* 10. CHIPSET HEATSINK WITH ILLUMINATED POWER BAR */}
      <group position={[0.66, 0.08, 0.72]}>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.12, 0.62]} />
          <meshStandardMaterial color="#1e293b" metalness={0.86} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.124, 0]}>
          <boxGeometry args={[0.48, 0.012, 0.48]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Glowing cyan accent strip on chipset */}
        <mesh position={[0, 0.132, 0.16]}>
          <boxGeometry args={[0.38, 0.01, 0.04]} />
          <meshStandardMaterial
            color={isPoweredOn ? '#22d3ee' : '#0f172a'}
            emissive={isPoweredOn ? '#06b6d4' : '#000000'}
            emissiveIntensity={isPoweredOn ? 2.2 : 0}
          />
        </mesh>
      </group>

      {/* 11. CMOS BATTERY HOLDER */}
      <group position={[-0.18, 0.08, 1.12]}>
        <mesh position={[0, 0.018, 0]}>
          <cylinderGeometry args={[0.115, 0.12, 0.036, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.6} />
        </mesh>
        <mesh position={[0.09, 0.038, 0]}>
          <boxGeometry args={[0.04, 0.016, 0.05]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* 12. BIOS FLASH CHIP (SOIC-8) */}
      <group position={[0.16, 0.08, 1.12]}>
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[0.10, 0.026, 0.12]} />
          <meshStandardMaterial color="#090d14" roughness={0.45} />
        </mesh>
        <mesh position={[-0.03, 0.029, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.01, 10]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* 13. CPU_FAN 4-PIN HEADER */}
      <group position={[0.16, 0.08, -1.38]}>
        <mesh position={[0, 0.035, 0]}>
          <boxGeometry args={[0.11, 0.07, 0.045]} />
          <meshStandardMaterial color="#0284c7" roughness={0.45} />
        </mesh>
      </group>

      {/* 14. SYS_FAN HEADERS (SYS_FAN1 & SYS_FAN2) */}
      <mesh position={[-0.30, 0.115, 1.40]}>
        <boxGeometry args={[0.11, 0.07, 0.045]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[1.08, 0.115, 0.12]}>
        <boxGeometry args={[0.045, 0.07, 0.11]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>

      {/* 15. FRONT PANEL HEADER (F_PANEL) */}
      <group position={[0.88, 0.08, 1.40]}>
        <mesh position={[0, 0.032, 0]}>
          <boxGeometry args={[0.20, 0.064, 0.06]} />
          <meshStandardMaterial color="#1e293b" roughness={0.55} />
        </mesh>
        <mesh position={[-0.04, 0.066, 0]}>
          <boxGeometry args={[0.06, 0.01, 0.05]} />
          <meshStandardMaterial color="#10b981" />
        </mesh>
        <mesh position={[0.05, 0.066, 0]}>
          <boxGeometry args={[0.06, 0.01, 0.05]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* 16. INTERNAL USB 3.2 HEADER */}
      <mesh position={[0.34, 0.125, 1.40]} castShadow>
        <boxGeometry args={[0.28, 0.09, 0.09]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.45} />
      </mesh>

      {/* 17. HD AUDIO HEADER */}
      <mesh position={[-0.88, 0.115, 1.40]}>
        <boxGeometry args={[0.18, 0.064, 0.06]} />
        <meshStandardMaterial color="#1e293b" roughness={0.55} />
      </mesh>

      {/* 18. REAR I/O SHROUD & PORT STACK (Left Top Edge) */}
      <group position={[-1.06, 0.08, -0.68]}>
        {/* Sculpted matte I/O cover */}
        <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.34, 1.42]} />
          <meshStandardMaterial color="#111827" metalness={0.62} roughness={0.34} />
        </mesh>
        {/* Metallic port faceplates along outer left edge (X = -0.165) */}
        {/* DisplayPort / HDMI */}
        <mesh position={[-0.165, 0.16, -0.52]}>
          <boxGeometry args={[0.02, 0.22, 0.18]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.2} />
        </mesh>
        {/* USB 3.2 Blue Stack */}
        <mesh position={[-0.165, 0.16, -0.24]}>
          <boxGeometry args={[0.02, 0.24, 0.22]} />
          <meshStandardMaterial color="#2563eb" metalness={0.4} roughness={0.3} />
        </mesh>
        {/* USB-C + 2.5GbE RJ45 Ethernet */}
        <mesh position={[-0.165, 0.16, 0.08]}>
          <boxGeometry args={[0.02, 0.24, 0.24]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Audio Jacks (Green/Pink/Blue/Black) */}
        {['#22c55e', '#ec4899', '#3b82f6'].map((col, idx) => (
          <mesh key={idx} position={[-0.165, 0.16, 0.38 + idx * 0.11]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.036, 0.036, 0.03, 12]} />
            <meshStandardMaterial color={col} roughness={0.35} />
          </mesh>
        ))}
      </group>

      {/* EZ-DEBUG POST LED INDICATOR BAR (CPU / DRAM / VGA / BOOT) */}
      <group position={[1.08, 0.085, -1.08]}>
        {postLedColors.map((col, idx) => (
          <mesh key={idx} position={[0, 0.015, idx * 0.065]}>
            <boxGeometry args={[0.038, 0.02, 0.036]} />
            <meshStandardMaterial
              color={col}
              emissive={col !== '#1e293b' ? col : '#000000'}
              emissiveIntensity={col !== '#1e293b' ? 2.4 : 0}
            />
          </mesh>
        ))}
      </group>

      {/* ANIMATED SIGNAL FLOW PULSES ON BOOT */}
      <mesh ref={pulseDotRef} visible={false}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
      <mesh ref={pulseDot2Ref} visible={false}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
    </group>
  );
};
