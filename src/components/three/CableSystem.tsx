import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CABLE_CONNECTORS, CABLE_META } from '../../data/catalog';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CableConnectorId, ConnectedCable } from '../../types/hardware';

interface CableSystemProps {
  pointerWorldRef: React.MutableRefObject<THREE.Vector3>;
}

/**
 * Generates a realistic curved 3D cable path arching gracefully between two 3D connectors
 */
function buildCableCurve(fromPos: [number, number, number], toPos: [number, number, number], cableType: string) {
  const start = new THREE.Vector3(...fromPos);
  const end = new THREE.Vector3(...toPos);
  const mid = start.clone().lerp(end, 0.5);
  const dist = start.distanceTo(end);

  // Route cleanly above components with natural cable sag / arch
  const archHeight = Math.min(0.68, 0.24 + dist * 0.16);
  const p1 = start.clone().lerp(end, 0.25);
  const p2 = end.clone().lerp(start, 0.25);

  if (cableType === 'eps_8pin') {
    // Route EPS 8-pin neatly around the right/top perimeter
    p1.set(1.36, 0.52, 0.85);
    mid.set(1.26, 0.44, -1.48);
    p2.set(0.15, 0.48, -1.52);
  } else if (cableType === 'atx_24pin') {
    p1.set(1.32, 0.54, 1.05);
    mid.set(1.42, 0.46, 0.12);
    p2.set(1.28, 0.36, -0.58);
  } else if (cableType === 'pcie_gpu') {
    p1.set(0.62, 0.85, 1.65);
    mid.set(0.66, 1.18, 0.96);
    p2.set(0.52, 1.12, 0.48);
  } else {
    p1.y = Math.max(start.y, end.y) + archHeight * 0.85;
    mid.y = Math.max(start.y, end.y) + archHeight;
    p2.y = Math.max(start.y, end.y) + archHeight * 0.85;
  }

  return new THREE.CatmullRomCurve3([start, p1, mid, p2, end]);
}

const RoutedCableMesh: React.FC<{
  cable: ConnectedCable;
  isPoweredOn: boolean;
  onDisconnect: (id: string) => void;
}> = ({ cable, isPoweredOn, onDisconnect }) => {
  const fromDef = CABLE_CONNECTORS[cable.from];
  const toDef = CABLE_CONNECTORS[cable.to];
  const meta = CABLE_META[cable.type];
  const pulseRef = useRef<THREE.Mesh>(null);
  const animProgressRef = useRef(0);

  const { curve, tubeGeo } = useMemo(() => {
    const c = buildCableCurve(fromDef.position, toDef.position, cable.type);
    const geo = new THREE.TubeGeometry(c, 36, meta?.thickness ?? 0.022, 8, false);
    return { curve: c, tubeGeo: geo };
  }, [fromDef, toDef, cable.type, meta]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    animProgressRef.current = Math.min(1, animProgressRef.current + dt * 5);

    if (pulseRef.current) {
      pulseRef.current.visible = isPoweredOn;
      if (isPoweredOn) {
        const t = (state.clock.elapsedTime * 0.9 + (cable.connectedAt % 1000) * 0.001) % 1;
        curve.getPointAt(t, pulseRef.current.position);
      }
    }
  });

  if (!fromDef || !toDef) return null;

  return (
    <group>
      {/* Curved 3D sleeved cable */}
      <mesh
        geometry={tubeGeo}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onDisconnect(cable.id);
        }}
      >
        <meshStandardMaterial
          color={meta?.color ?? '#1e293b'}
          roughness={0.68}
          metalness={0.18}
        />
      </mesh>
      {/* Connector Plug Housings at both ends */}
      <mesh position={fromDef.position}>
        <boxGeometry args={[0.11, 0.09, 0.11]} />
        <meshStandardMaterial color="#090d14" roughness={0.5} />
      </mesh>
      <mesh position={toDef.position}>
        <boxGeometry args={[0.11, 0.09, 0.11]} />
        <meshStandardMaterial color="#090d14" roughness={0.5} />
      </mesh>
      {/* Luminous energy pulse traveling along cable when powered on */}
      <mesh ref={pulseRef} visible={false}>
        <sphereGeometry args={[(meta?.thickness ?? 0.022) * 1.45, 10, 10]} />
        <meshBasicMaterial color={fromDef.color} />
      </mesh>
    </group>
  );
};

export const CableSystem: React.FC<CableSystemProps> = ({ pointerWorldRef }) => {
  const appMode = useSimulatorStore((s) => s.appMode);
  const cables = useSimulatorStore((s) => s.snapshot.cables);
  const installed = useSimulatorStore((s) => s.snapshot.installed);
  const activeCableFrom = useSimulatorStore((s) => s.activeCableFrom);
  const hoveredConnectorId = useSimulatorStore((s) => s.hoveredConnectorId);
  const isPoweredOn = useSimulatorStore((s) => s.isPoweredOn);

  const startCableDrag = useSimulatorStore((s) => s.startCableDrag);
  const completeCableConnection = useSimulatorStore((s) => s.completeCableConnection);
  const setHoveredConnector = useSimulatorStore((s) => s.setHoveredConnector);
  const disconnectCable = useSimulatorStore((s) => s.disconnectCable);

  // Live preview cable line while dragging from a connector
  const previewMeshRef = useRef<THREE.Mesh>(null);
  const activeFromDef = activeCableFrom ? CABLE_CONNECTORS[activeCableFrom] : null;

  useFrame(() => {
    if (!previewMeshRef.current || !activeFromDef) return;
    const start = new THREE.Vector3(...activeFromDef.position);
    const end = pointerWorldRef.current.clone();
    end.y = Math.max(0.28, end.y);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.45;
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const oldGeo = previewMeshRef.current.geometry;
    previewMeshRef.current.geometry = new THREE.TubeGeometry(curve, 18, 0.022, 6, false);
    oldGeo.dispose();
  });

  const connectorList = useMemo(() => Object.values(CABLE_CONNECTORS), []);
  const connectedTypes = useMemo(() => new Set(cables.map((c) => c.type)), [cables]);

  return (
    <group name="cable_system">
      {/* Connected 3D Curved Cables */}
      {cables.map((cable) => (
        <RoutedCableMesh
          key={cable.id}
          cable={cable}
          isPoweredOn={isPoweredOn}
          onDisconnect={(id) => {
            if (appMode === 'cables') disconnectCable(id);
          }}
        />
      ))}

      {/* Live Preview Cable while actively dragging a cable in Cable Mode */}
      {activeFromDef && (
        <mesh ref={previewMeshRef}>
          <bufferGeometry />
          <meshStandardMaterial
            color={activeFromDef.color}
            emissive={activeFromDef.color}
            emissiveIntensity={0.9}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* Interactive Cable Connector Nodes (highlighted in Cable Management mode) */}
      {appMode === 'cables' &&
        connectorList.map((conn) => {
          // Hide connectors whose parent hardware isn't installed yet
          if (conn.requiresComponentAt && !installed[conn.requiresComponentAt]) {
            return null;
          }
          if (
            (conn.id === 'sata_drive_power' || conn.id === 'sata_drive_data') &&
            !installed.sata_ssd_bay &&
            !installed.hdd_bay
          ) {
            return null;
          }
          if (
            conn.id === 'case_fan_lead' &&
            !installed.case_fan_front &&
            !installed.case_fan_rear
          ) {
            return null;
          }

          const isConnected = connectedTypes.has(conn.cableType);
          const isSourceActive = activeCableFrom === conn.id;
          const isCompatibleTarget =
            activeFromDef !== null &&
            activeFromDef.id !== conn.id &&
            activeFromDef.cableType === conn.cableType &&
            activeFromDef.role !== conn.role;
          const isIncompatibleTarget =
            activeFromDef !== null &&
            activeFromDef.id !== conn.id &&
            !isCompatibleTarget;
          const isHovered = hoveredConnectorId === conn.id;

          const nodeColor = isSourceActive
            ? '#22d3ee'
            : isCompatibleTarget
              ? '#10b981'
              : isIncompatibleTarget
                ? '#ef4444'
                : isConnected
                  ? '#334155'
                  : conn.color;

          return (
            <group
              key={conn.id}
              position={[conn.position[0], conn.position[1] + 0.08, conn.position[2]]}
            >
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredConnector(conn.id as CableConnectorId);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHoveredConnector(null);
                  document.body.style.cursor = 'default';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!activeCableFrom) {
                    startCableDrag(conn.id as CableConnectorId);
                  } else {
                    completeCableConnection(conn.id as CableConnectorId);
                  }
                }}
              >
                <sphereGeometry args={[isHovered || isCompatibleTarget ? 0.095 : 0.072, 16, 16]} />
                <meshStandardMaterial
                  color={nodeColor}
                  emissive={nodeColor}
                  emissiveIntensity={isCompatibleTarget || isSourceActive || isHovered ? 1.4 : 0.45}
                  transparent
                  opacity={isIncompatibleTarget ? 0.35 : 0.92}
                />
              </mesh>
              {/* Halo ring for active/compatible cable target */}
              {(isCompatibleTarget || isSourceActive) && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.11, 0.15, 24]} />
                  <meshBasicMaterial
                    color={isCompatibleTarget ? '#10b981' : '#22d3ee'}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.85}
                  />
                </mesh>
              )}
            </group>
          );
        })}
    </group>
  );
};
