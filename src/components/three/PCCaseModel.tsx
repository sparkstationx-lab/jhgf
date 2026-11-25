import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulatorStore } from '../../store/useSimulatorStore';

interface PCCaseModelProps {
  isSoftwareGl: boolean;
}

/**
 * Mid-Tower ATX PC Case Enclosure surrounding the motherboard assembly
 * Visible in 'case' and 'completed' workspace views.
 */
export const PCCaseModel: React.FC<PCCaseModelProps> = ({ isSoftwareGl }) => {
  const workspaceView = useSimulatorStore((s) => s.workspaceView);
  const isPoweredOn = useSimulatorStore((s) => s.isPoweredOn);
  const glassRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (glassRef.current) {
      const targetY = workspaceView === 'completed' ? 1.56 : 2.9;
      glassRef.current.position.y = THREE.MathUtils.damp(
        glassRef.current.position.y,
        targetY,
        5,
        dt
      );
      const mat = glassRef.current.material as THREE.MeshPhysicalMaterial;
      const targetOpacity = workspaceView === 'completed' ? (isSoftwareGl ? 0.22 : 0.32) : 0;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 6, dt);
      glassRef.current.visible = mat.opacity > 0.01;
    }
  });

  if (workspaceView === 'workbench') return null;

  return (
    <group name="pc_mid_tower_case">
      {/* Main Steel Motherboard Tray / Back Wall (Y = -0.02) */}
      <mesh position={[0.38, -0.02, 0.68]} receiveShadow castShadow>
        <boxGeometry args={[4.40, 0.06, 5.10]} />
        <meshStandardMaterial color="#0d131e" metalness={0.68} roughness={0.44} />
      </mesh>

      {/* Cable Routing Rubber Grommets along right edge of motherboard */}
      {[-0.85, 0.05, 0.95].map((zPos, i) => (
        <mesh key={i} position={[1.44, 0.015, zPos]}>
          <boxGeometry args={[0.18, 0.016, 0.56]} />
          <meshStandardMaterial color="#05080f" roughness={0.9} />
        </mesh>
      ))}

      {/* Top Panel Wall (Z = -1.86) */}
      <mesh position={[0.38, 0.78, -1.86]} castShadow receiveShadow>
        <boxGeometry args={[4.40, 1.62, 0.08]} />
        <meshStandardMaterial color="#111827" metalness={0.65} roughness={0.38} />
      </mesh>

      {/* Bottom Panel Wall (Z = +3.22) */}
      <mesh position={[0.38, 0.78, 3.22]} castShadow receiveShadow>
        <boxGeometry args={[4.40, 1.62, 0.08]} />
        <meshStandardMaterial color="#111827" metalness={0.65} roughness={0.38} />
      </mesh>

      {/* Left Rear I/O & PCIe Expansion Wall (X = -1.82) */}
      <group position={[-1.82, 0.78, 0.68]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.08, 1.62, 5.10]} />
          <meshStandardMaterial color="#111827" metalness={0.65} roughness={0.4} />
        </mesh>
        {/* Rear exhaust fan grille cutout frame */}
        <mesh position={[0.045, -0.08, -1.42]}>
          <boxGeometry args={[0.02, 1.15, 1.15]} />
          <meshStandardMaterial color="#05080f" roughness={0.85} />
        </mesh>
        {/* Rear PCIe slot brackets */}
        {[0, 1, 2, 3, 4].map((idx) => (
          <mesh key={idx} position={[0.045, -0.32, -0.44 + idx * 0.22]}>
            <boxGeometry args={[0.02, 0.55, 0.14]} />
            <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
          </mesh>
        ))}
      </group>

      {/* Right Front Airflow Mesh Panel Wall (X = +2.56) */}
      <group position={[2.56, 0.78, 0.68]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.08, 1.62, 5.10]} />
          <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.42} />
        </mesh>
        {/* Front Illuminated Lab Accent Strip */}
        <mesh position={[0.048, 0.72, 0]}>
          <boxGeometry args={[0.02, 0.05, 4.6]} />
          <meshStandardMaterial
            color={isPoweredOn ? '#22d3ee' : '#1e293b'}
            emissive={isPoweredOn ? '#06b6d4' : '#000000'}
            emissiveIntensity={isPoweredOn ? 2.0 : 0}
          />
        </mesh>
        {/* Front I/O Power Button & USB Ports */}
        <mesh position={[0.05, 0.55, -2.05]}>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 18]} />
          <meshStandardMaterial
            color={isPoweredOn ? '#10b981' : '#475569'}
            emissive={isPoweredOn ? '#10b981' : '#000000'}
            emissiveIntensity={isPoweredOn ? 1.8 : 0}
          />
        </mesh>
      </group>

      {/* Lower PSU Shroud Divider Wall (separating motherboard chamber from PSU/HDD chamber) */}
      <mesh position={[0.38, 0.44, 1.62]} castShadow receiveShadow>
        <boxGeometry args={[4.28, 0.88, 0.05]} />
        <meshStandardMaterial color="#0f172a" metalness={0.68} roughness={0.38} />
      </mesh>

      {/* 4 Rubber Chassis Feet on Bottom Edge (visible when stood upright in Completed view) */}
      {[
        [-1.35, 3.30, 0.25],
        [-1.35, 3.30, 1.32],
        [2.05, 3.30, 0.25],
        [2.05, 3.30, 1.32],
      ].map(([fx, fz, fy], idx) => (
        <mesh key={idx} position={[fx, fy, fz]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.12, 16]} />
          <meshStandardMaterial color="#090d14" roughness={0.85} />
        </mesh>
      ))}

      {/* Tempered Glass Side Panel (closes smoothly in Completed PC View) */}
      <mesh ref={glassRef} position={[0.38, 2.9, 0.68]} renderOrder={10}>
        <boxGeometry args={[4.28, 0.035, 4.98]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          transparent
          opacity={0}
          depthWrite={false}
          roughness={0.08}
          metalness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
        />
      </mesh>
    </group>
  );
};
