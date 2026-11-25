import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HARDWARE_BY_ID } from '../../data/catalog';
import {
  getCpuIhsTexture,
  getNvmeLabelTexture,
  getPsuLabelTexture,
} from '../../utils/proceduralTextures';

interface ComponentModelProps {
  specId: string;
  isPoweredOn?: boolean;
  isGhost?: boolean;
  ghostStatus?: 'valid' | 'invalid' | 'neutral';
  isSelected?: boolean;
}

/**
 * Reusable spinning 7-blade axial fan rotor
 */
const FanRotor: React.FC<{
  radius: number;
  isSpinning: boolean;
  hubColor?: string;
  bladeColor?: string;
  speed?: number;
}> = ({ radius, isSpinning, hubColor = '#1e293b', bladeColor = '#0f172a', speed = 16 }) => {
  const rotorRef = useRef<THREE.Group>(null);
  const velRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = isSpinning ? speed : 0;
    velRef.current = THREE.MathUtils.damp(velRef.current, target, 3.2, dt);
    if (rotorRef.current && velRef.current > 0.01) {
      rotorRef.current.rotation.y -= velRef.current * dt;
    }
  });

  const blades = useMemo(() => [0, 1, 2, 3, 4, 5, 6], []);

  return (
    <group ref={rotorRef}>
      {/* Center motor hub */}
      <mesh castShadow>
        <cylinderGeometry args={[radius * 0.28, radius * 0.28, 0.05, 16]} />
        <meshStandardMaterial color={hubColor} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Metallic center sticker */}
      <mesh position={[0, 0.026, 0]}>
        <cylinderGeometry args={[radius * 0.16, radius * 0.16, 0.004, 16]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* 7 angled swept blades */}
      {blades.map((idx) => {
        const angle = (idx / 7) * Math.PI * 2;
        return (
          <group key={idx} rotation={[0, angle, 0]}>
            <mesh position={[radius * 0.56, 0, 0]} rotation={[0.42, 0, 0]}>
              <boxGeometry args={[radius * 0.66, 0.012, radius * 0.26]} />
              <meshStandardMaterial color={bladeColor} metalness={0.15} roughness={0.45} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/**
 * Detailed CPU model (Substrate PCB + Stepped Nickel IHS + Gold Pin-1 Triangle + Underside Gold Pads)
 */
const CpuModel: React.FC<{ specId: string }> = ({ specId }) => {
  const spec = HARDWARE_BY_ID[specId];
  const isAmd = spec?.socketType === 'AM5';
  const ihsTex = useMemo(
    () =>
      getCpuIhsTexture(
        spec?.brand ?? 'Intel',
        spec?.shortName ?? 'CPU',
        spec?.socketType ?? 'LGA1700'
      ),
    [spec]
  );

  const w = isAmd ? 0.38 : 0.36;
  const d = isAmd ? 0.38 : 0.43;

  return (
    <group>
      {/* Green/teal fiberglass substrate PCB */}
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.016, d]} />
        <meshStandardMaterial color={isAmd ? '#0f5c43' : '#0f5132'} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* Underside gold LGA contact array */}
      <mesh position={[0, 0.003, 0]}>
        <boxGeometry args={[w * 0.9, 0.003, d * 0.9]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.22} />
      </mesh>
      {/* Stepped nickel-plated copper IHS */}
      <mesh position={[0, 0.032, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.84, 0.026, d * 0.84]} />
        <meshStandardMaterial
          map={ihsTex}
          metalness={0.78}
          roughness={0.22}
        />
      </mesh>
      {/* Side IHS flange tabs */}
      <mesh position={[0, 0.022, 0]} castShadow>
        <boxGeometry args={[w * 0.92, 0.01, d * 0.56]} />
        <meshStandardMaterial color="#b0bccb" metalness={0.85} roughness={0.24} />
      </mesh>
      {/* Corner Gold Orientation Triangle Marker (Bottom-Left) */}
      <mesh position={[-w * 0.43, 0.022, d * 0.42]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.028, 3]} />
        <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.4} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

/**
 * DDR4 / DDR5 RAM Stick with keyed notch, gold contact fingers, dual heatspreaders, and top lightbar
 */
const RamModel: React.FC<{ specId: string; isPoweredOn: boolean }> = ({ specId, isPoweredOn }) => {
  const spec = HARDWARE_BY_ID[specId];
  const isDdr4 = spec?.ramGen === 'DDR4';
  const height = spec?.ramCapacityGB === 32 ? 0.36 : 0.31;
  const accent = spec?.accentColor ?? '#22d3ee';
  const notchOffset = isDdr4 ? 0.06 : -0.05; // Physical key difference between DDR4 and DDR5

  return (
    <group>
      {/* Inner dark PCB */}
      <mesh position={[0, height / 2 + 0.02, 0]} castShadow>
        <boxGeometry args={[0.018, height - 0.02, 1.24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Split Gold Contact Edge Fingers (keyed notch gap) */}
      <mesh position={[0, 0.024, -0.32 + notchOffset * 0.5]}>
        <boxGeometry args={[0.02, 0.045, 0.56 + notchOffset]} />
        <meshStandardMaterial color="#eab308" metalness={0.92} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.024, 0.33 + notchOffset * 0.5]}>
        <boxGeometry args={[0.02, 0.045, 0.56 - notchOffset]} />
        <meshStandardMaterial color="#eab308" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* Brushed Anodized Aluminum Heatspreaders (left & right) */}
      <mesh position={[-0.022, height / 2 + 0.045, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.02, height - 0.05, 1.26]} />
        <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[0.022, height / 2 + 0.045, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.02, height - 0.05, 1.26]} />
        <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.28} />
      </mesh>
      {/* Machined diagonal metallic trim stripe */}
      <mesh position={[-0.034, height * 0.62, 0]}>
        <boxGeometry args={[0.004, 0.04, 0.96]} />
        <meshStandardMaterial color={accent} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0.034, height * 0.62, 0]}>
        <boxGeometry args={[0.004, 0.04, 0.96]} />
        <meshStandardMaterial color={accent} metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Top Diffuser Lightbar */}
      <mesh position={[0, height + 0.025, 0]}>
        <boxGeometry args={[0.056, 0.034, 1.22]} />
        <meshStandardMaterial
          color={isPoweredOn ? accent : '#334155'}
          emissive={isPoweredOn ? accent : '#000000'}
          emissiveIntensity={isPoweredOn ? 1.5 : 0}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
};

/**
 * Dual-Fan or Triple-Fan Dedicated GPU with backplate, copper heatpipes, fin stack, I/O bracket, spinning fans
 */
const GpuModel: React.FC<{ specId: string; isPoweredOn: boolean }> = ({ specId, isPoweredOn }) => {
  const spec = HARDWARE_BY_ID[specId];
  const isTriple = spec?.gpuSize === 'triple';
  const length = isTriple ? 2.15 : 1.55;
  const height = isTriple ? 0.84 : 0.72;
  const thickness = isTriple ? 0.34 : 0.24;
  const accent = spec?.accentColor ?? '#10b981';

  const fanOffsets = isTriple ? [-0.66, 0, 0.66] : [-0.36, 0.36];
  const fanRadius = isTriple ? 0.27 : 0.28;
  // Offset X so the rear I/O bracket aligns with left edge of ATX board (~X = -1.16)
  const centerX = isTriple ? 0.02 : -0.26;

  return (
    <group position={[centerX, 0, 0]}>
      {/* PCIe x16 Gold Edge Connector (bottom) */}
      <mesh position={[-length / 2 + 0.62, 0.03, 0]}>
        <boxGeometry args={[0.88, 0.06, 0.025]} />
        <meshStandardMaterial color="#eab308" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* Internal GPU PCB */}
      <mesh position={[0, height / 2 + 0.06, -thickness * 0.28]} castShadow>
        <boxGeometry args={[length - 0.06, height - 0.06, 0.026]} />
        <meshStandardMaterial color="#0b1320" roughness={0.48} metalness={0.2} />
      </mesh>
      {/* Brushed Aluminum Backplate (negative Z side) */}
      <mesh position={[0, height / 2 + 0.06, -thickness * 0.42]} castShadow receiveShadow>
        <boxGeometry args={[length, height, 0.024]} />
        <meshStandardMaterial color="#1e293b" metalness={0.82} roughness={0.26} />
      </mesh>
      {/* Aluminum Heatsink Fin Core */}
      <mesh position={[0, height / 2 + 0.06, 0]} castShadow>
        <boxGeometry args={[length - 0.08, height - 0.08, thickness * 0.54]} />
        <meshStandardMaterial color="#64748b" metalness={0.88} roughness={0.34} />
      </mesh>
      {/* Exposed Copper Heatpipes along top edge */}
      {[-0.04, 0.02, 0.08].map((zOff, i) => (
        <mesh key={i} position={[0, height + 0.04, zOff]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, length * 0.86, 10]} />
          <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      {/* Sculpted Matte Shroud (positive Z face) */}
      <mesh position={[0, height / 2 + 0.06, thickness * 0.34]} castShadow receiveShadow>
        <boxGeometry args={[length + 0.02, height, 0.05]} />
        <meshStandardMaterial color="#111827" metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Top Edge Brand Lightbar */}
      <mesh position={[0.08, height + 0.065, thickness * 0.12]}>
        <boxGeometry args={[0.85, 0.028, 0.05]} />
        <meshStandardMaterial
          color={isPoweredOn ? accent : '#334155'}
          emissive={isPoweredOn ? accent : '#000000'}
          emissiveIntensity={isPoweredOn ? 1.8 : 0}
          roughness={0.2}
        />
      </mesh>
      {/* Top 8/16-Pin PCIe Power Receptacle */}
      <mesh position={[length * 0.26, height + 0.06, 0.04]}>
        <boxGeometry args={[0.16, 0.07, 0.11]} />
        <meshStandardMaterial color="#090d14" roughness={0.7} />
      </mesh>
      {/* Chrome Rear I/O Bracket (Left Edge) */}
      <mesh position={[-length / 2 - 0.025, height / 2 + 0.04, 0]} castShadow>
        <boxGeometry args={[0.03, height + 0.14, thickness + 0.04]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* Axial Cooling Fans */}
      {fanOffsets.map((fx, idx) => (
        <group key={idx} position={[fx, height / 2 + 0.06, thickness * 0.38]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Fan shroud ring */}
          <mesh>
            <torusGeometry args={[fanRadius, 0.022, 10, 24]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
          </mesh>
          <FanRotor radius={fanRadius * 0.92} isSpinning={isPoweredOn} speed={18 + idx * 1.5} />
        </group>
      ))}
    </group>
  );
};

/**
 * CPU Coolers: Dual-Tower Air Cooler, 240mm AIO Liquid Cooler, or Low-Profile Stock Cooler
 */
const CpuCoolerModel: React.FC<{ specId: string; isPoweredOn: boolean }> = ({
  specId,
  isPoweredOn,
}) => {
  const spec = HARDWARE_BY_ID[specId];
  const kind = spec?.coolerKind ?? 'air';

  const aioTubes = useMemo(() => {
    const c1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.14, 0.18, 0.04),
      new THREE.Vector3(0.42, 0.44, -0.22),
      new THREE.Vector3(0.32, 0.68, -0.58),
      new THREE.Vector3(-0.08, 0.72, -0.78),
    ]);
    const c2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.14, 0.18, -0.06),
      new THREE.Vector3(0.46, 0.48, -0.32),
      new THREE.Vector3(0.36, 0.72, -0.66),
      new THREE.Vector3(0.06, 0.72, -0.78),
    ]);
    return [
      new THREE.TubeGeometry(c1, 24, 0.032, 8, false),
      new THREE.TubeGeometry(c2, 24, 0.032, 8, false),
    ];
  }, []);

  if (kind === 'low_profile') {
    return (
      <group>
        {/* Copper base */}
        <mesh position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.04, 20]} />
          <meshStandardMaterial color="#b45309" metalness={0.88} roughness={0.22} />
        </mesh>
        {/* Radial aluminum heatsink */}
        <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.29, 0.27, 0.18, 24]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.82} roughness={0.32} />
        </mesh>
        {/* Black shroud + top axial fan */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.31, 0.31, 0.07, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.25} />
        </mesh>
        <group position={[0, 0.26, 0]}>
          <FanRotor radius={0.26} isSpinning={isPoweredOn} speed={15} />
        </group>
      </group>
    );
  }

  if (kind === 'liquid') {
    return (
      <group>
        {/* Copper coldplate */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.34, 0.04, 0.34]} />
          <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Cylindrical AIO pump housing */}
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.26, 0.24, 28]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.28} />
        </mesh>
        {/* Illuminated infinity LED ring on pump cap */}
        <mesh position={[0, 0.274, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.13, 0.18, 32]} />
          <meshStandardMaterial
            color={isPoweredOn ? '#22d3ee' : '#334155'}
            emissive={isPoweredOn ? '#06b6d4' : '#000000'}
            emissiveIntensity={isPoweredOn ? 2.0 : 0}
          />
        </mesh>
        {/* Braided coolant hoses */}
        {aioTubes.map((geo, i) => (
          <mesh key={i} geometry={geo} castShadow>
            <meshStandardMaterial color="#1e293b" roughness={0.75} metalness={0.15} />
          </mesh>
        ))}
        {/* Top-mounted 240mm radiator + dual fans */}
        <group position={[0.15, 0.72, -0.82]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.48, 0.14, 0.48]} />
            <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.32, 0.15, 0.42]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.45} />
          </mesh>
          {[-0.36, 0.36].map((fx, idx) => (
            <group key={idx} position={[fx, -0.10, 0]} rotation={[Math.PI, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.58, 0.08, 0.48]} />
                <meshStandardMaterial color="#111827" roughness={0.5} />
              </mesh>
              <FanRotor radius={0.22} isSpinning={isPoweredOn} speed={16 + idx * 2} />
            </group>
          ))}
        </group>
      </group>
    );
  }

  // Default: Dual-Tower Air Cooler with Copper Heatpipes, Stacked Fins, and 120mm PWM Fan
  return (
    <group>
      {/* Mounting crossbar bracket */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.52, 0.025, 0.14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Copper coldplate */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.32, 0.04, 0.32]} />
        <meshStandardMaterial color="#b45309" metalness={0.92} roughness={0.2} />
      </mesh>
      {/* 4 Copper heatpipe risers */}
      {[-0.14, -0.05, 0.05, 0.14].map((zPos, i) => (
        <mesh key={i} position={[0, 0.44, zPos]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
          <meshStandardMaterial color="#c2410c" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      {/* Stacked Aluminum Fin Array */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[0, 0.22 + i * 0.052, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.016, 0.58]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.86} roughness={0.26} />
        </mesh>
      ))}
      {/* Anodized Black Top Cover Plate */}
      <mesh position={[0, 0.84, 0]} castShadow>
        <boxGeometry args={[0.44, 0.032, 0.60]} />
        <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.28} />
      </mesh>
      {/* Side-mounted 120mm PWM Fan */}
      <group position={[0.27, 0.50, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow>
          <boxGeometry args={[0.56, 0.09, 0.56]} />
          <meshStandardMaterial color="#111827" roughness={0.45} metalness={0.25} />
        </mesh>
        <group position={[0, 0.02, 0]}>
          <FanRotor radius={0.24} isSpinning={isPoweredOn} speed={17} />
        </group>
      </group>
    </group>
  );
};

/**
 * M.2 2280 NVMe SSD with M-key gold edge connector, controller IC, NAND chips, and label
 */
const M2SsdModel: React.FC<{ specId: string }> = ({ specId }) => {
  const tex = useMemo(() => getNvmeLabelTexture(specId), [specId]);
  return (
    <group>
      {/* 2280 PCB */}
      <mesh position={[0, 0.012, 0]} castShadow>
        <boxGeometry args={[0.78, 0.014, 0.22]} />
        <meshStandardMaterial color="#0f172a" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Gold M-Key contacts (right end) */}
      <mesh position={[0.38, 0.013, 0]}>
        <boxGeometry args={[0.045, 0.016, 0.19]} />
        <meshStandardMaterial color="#eab308" metalness={0.92} roughness={0.2} />
      </mesh>
      {/* Top Graphene Heatspreader Label */}
      <mesh position={[-0.03, 0.024, 0]}>
        <boxGeometry args={[0.66, 0.012, 0.20]} />
        <meshStandardMaterial map={tex} roughness={0.35} metalness={0.35} />
      </mesh>
      {/* Semicircle mounting notch ring (left end) */}
      <mesh position={[-0.38, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.022, 0.036, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};

/**
 * 2.5" SATA SSD
 */
const SataSsdModel: React.FC = () => (
  <group>
    <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.70, 0.08, 1.0]} />
      <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0.088, 0]}>
      <boxGeometry args={[0.56, 0.008, 0.78]} />
      <meshStandardMaterial color="#0ea5e9" metalness={0.5} roughness={0.35} />
    </mesh>
    {/* SATA Data & Power Ports on left edge */}
    <mesh position={[-0.35, 0.035, 0.12]}>
      <boxGeometry args={[0.04, 0.04, 0.34]} />
      <meshStandardMaterial color="#090d14" roughness={0.7} />
    </mesh>
  </group>
);

/**
 * 3.5" Mechanical HDD
 */
const HddModel: React.FC = () => (
  <group>
    <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.0, 0.24, 1.42]} />
      <meshStandardMaterial color="#1f2937" metalness={0.68} roughness={0.38} />
    </mesh>
    {/* Brushed silver top cover plate */}
    <mesh position={[0, 0.255, 0]} castShadow>
      <boxGeometry args={[0.92, 0.018, 1.32]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.22} />
    </mesh>
    {/* Platter spindle hub boss */}
    <mesh position={[0, 0.268, 0.12]}>
      <cylinderGeometry args={[0.14, 0.16, 0.014, 24]} />
      <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
    </mesh>
    {/* Label strip */}
    <mesh position={[0, 0.266, -0.34]}>
      <boxGeometry args={[0.78, 0.006, 0.44]} />
      <meshStandardMaterial color="#f8fafc" roughness={0.6} />
    </mesh>
  </group>
);

/**
 * Modular ATX Power Supply Unit
 */
const PsuModel: React.FC<{ specId: string; isPoweredOn: boolean }> = ({
  specId,
  isPoweredOn,
}) => {
  const spec = HARDWARE_BY_ID[specId];
  const wattage = spec?.wattageSupply ?? 850;
  const labelTex = useMemo(
    () => getPsuLabelTexture(wattage, wattage >= 800 ? '80+ Gold' : '80+ Bronze'),
    [wattage]
  );

  return (
    <group>
      {/* Main powder-coated black steel chassis */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.48, 0.84, 1.36]} />
        <meshStandardMaterial color="#111827" metalness={0.55} roughness={0.42} />
      </mesh>
      {/* Top Fan Grille Ring & Spinning Cooling Fan */}
      <group position={[0, 0.425, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.52, 28]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        <FanRotor radius={0.41} isSpinning={isPoweredOn} speed={11} />
      </group>
      {/* Side Wattage Nameplate */}
      <mesh position={[0, 0, 0.684]}>
        <planeGeometry args={[1.18, 0.58]} />
        <meshStandardMaterial map={labelTex} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Modular Power Output Bank (Right face facing cables) */}
      <mesh position={[0.745, 0, 0]}>
        <boxGeometry args={[0.02, 0.62, 1.08]} />
        <meshStandardMaterial color="#090d14" roughness={0.65} />
      </mesh>
      {/* AC Power Rocker Switch + Status LED (Left face) */}
      <mesh position={[-0.745, 0.14, 0.32]}>
        <boxGeometry args={[0.03, 0.18, 0.14]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} />
      </mesh>
      <mesh position={[-0.746, -0.14, 0.32]}>
        <boxGeometry args={[0.02, 0.04, 0.04]} />
        <meshStandardMaterial
          color={isPoweredOn ? '#10b981' : '#334155'}
          emissive={isPoweredOn ? '#10b981' : '#000000'}
          emissiveIntensity={isPoweredOn ? 2.0 : 0}
        />
      </mesh>
    </group>
  );
};

/**
 * 120mm or 140mm PWM Case Fan
 */
const CaseFanModel: React.FC<{ specId: string; isPoweredOn: boolean }> = ({
  specId,
  isPoweredOn,
}) => {
  const spec = HARDWARE_BY_ID[specId];
  const size = spec?.fanSizeMm === 140 ? 1.24 : 1.08;
  const accent = spec?.accentColor ?? '#06b6d4';

  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* Outer square frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size, 0.22, size]} />
        <meshStandardMaterial color="#0f172a" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* Illuminated perimeter ring */}
      <mesh position={[0, 0.114, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.41, size * 0.45, 32]} />
        <meshStandardMaterial
          color={isPoweredOn ? accent : '#334155'}
          emissive={isPoweredOn ? accent : '#000000'}
          emissiveIntensity={isPoweredOn ? 1.6 : 0}
        />
      </mesh>
      <FanRotor radius={size * 0.4} isSpinning={isPoweredOn} speed={14} />
    </group>
  );
};

/**
 * PCIe x1 Wi-Fi 6E Card or 10GbE Network Card
 */
const ExpansionCardModel: React.FC<{ specId: string }> = ({ specId }) => {
  const isWifi = specId === 'card_wifi_6e';
  return (
    <group>
      {/* PCIe x1 Gold Edge Connector */}
      <mesh position={[0.14, 0.025, 0]}>
        <boxGeometry args={[0.24, 0.05, 0.022]} />
        <meshStandardMaterial color="#eab308" metalness={0.92} roughness={0.2} />
      </mesh>
      {/* Main PCB */}
      <mesh position={[0, 0.26, 0]} castShadow>
        <boxGeometry args={[0.78, 0.44, 0.024]} />
        <meshStandardMaterial color="#0f172a" roughness={0.48} metalness={0.2} />
      </mesh>
      {/* Controller Heatsink / RF Shield */}
      <mesh position={[0.04, 0.26, 0.032]} castShadow>
        <boxGeometry args={[0.38, 0.28, 0.045]} />
        <meshStandardMaterial
          color={isWifi ? '#1e293b' : '#94a3b8'}
          metalness={0.82}
          roughness={0.26}
        />
      </mesh>
      {/* Rear Metal Bracket */}
      <mesh position={[-0.41, 0.26, 0]} castShadow>
        <boxGeometry args={[0.028, 0.56, 0.14]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* Dual External SMA Wi-Fi Antennas */}
      {isWifi && (
        <>
          <mesh position={[-0.58, 0.42, 0.03]} rotation={[0, 0, 0.4]}>
            <cylinderGeometry args={[0.018, 0.024, 0.48, 10]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
          <mesh position={[-0.58, 0.18, -0.03]} rotation={[0, 0, 1.2]}>
            <cylinderGeometry args={[0.018, 0.024, 0.48, 10]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
};

/**
 * CR2032 Lithium Coin Cell CMOS Battery
 */
const CmosBatteryModel: React.FC = () => (
  <group>
    <mesh position={[0, 0.02, 0]} castShadow>
      <cylinderGeometry args={[0.095, 0.095, 0.032, 24]} />
      <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.14} />
    </mesh>
    {/* Etched "+" symbol */}
    <mesh position={[0, 0.037, 0]}>
      <boxGeometry args={[0.06, 0.004, 0.012]} />
      <meshStandardMaterial color="#475569" roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.037, 0]}>
      <boxGeometry args={[0.012, 0.004, 0.06]} />
      <meshStandardMaterial color="#475569" roughness={0.4} />
    </mesh>
  </group>
);

export const HardwareComponent3D: React.FC<ComponentModelProps> = ({
  specId,
  isPoweredOn = false,
  isGhost = false,
  ghostStatus = 'neutral',
  isSelected = false,
}) => {
  const spec = HARDWARE_BY_ID[specId];
  if (!spec) return null;

  const content = (() => {
    switch (spec.type) {
      case 'cpu':
        return <CpuModel specId={specId} />;
      case 'ram':
        return <RamModel specId={specId} isPoweredOn={isPoweredOn} />;
      case 'gpu':
        return <GpuModel specId={specId} isPoweredOn={isPoweredOn} />;
      case 'cpu_cooler':
        return <CpuCoolerModel specId={specId} isPoweredOn={isPoweredOn} />;
      case 'm2_ssd':
        return <M2SsdModel specId={specId} />;
      case 'sata_ssd':
        return <SataSsdModel />;
      case 'hdd':
        return <HddModel />;
      case 'psu':
        return <PsuModel specId={specId} isPoweredOn={isPoweredOn} />;
      case 'case_fan':
        return <CaseFanModel specId={specId} isPoweredOn={isPoweredOn} />;
      case 'wifi_card':
      case 'pcie_card':
        return <ExpansionCardModel specId={specId} />;
      case 'cmos_battery':
        return <CmosBatteryModel />;
      default:
        return null;
    }
  })();

  const outlineColor =
    ghostStatus === 'valid'
      ? '#10b981'
      : ghostStatus === 'invalid'
        ? '#ef4444'
        : '#38bdf8';

  return (
    <group>
      {content}
      {(isGhost || isSelected) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.22, 24]} />
          <meshBasicMaterial
            color={isGhost ? outlineColor : '#22d3ee'}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};
