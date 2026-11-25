import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  GUIDED_TUTORIAL_STEPS,
  HARDWARE_BY_ID,
  SOCKET_DEFINITIONS,
  SOCKET_LIST,
} from '../../data/catalog';
import { checkSocketCompatibility } from '../../engine/compatibility';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CameraPreset, InstalledComponent, SocketId } from '../../types/hardware';
import { getWorkbenchMatTexture } from '../../utils/proceduralTextures';
import { CableSystem } from './CableSystem';
import { HardwareComponent3D } from './ComponentModels';
import { MotherboardModel } from './MotherboardModel';
import { PCCaseModel } from './PCCaseModel';

// Detect software WebGL once for rendering cost tuning (same scene content on all devices)
function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  iso: { pos: [3.2, 4.1, 4.3], target: [0.15, 0.25, 0.25] },
  top: { pos: [0.15, 5.6, 0.55], target: [0.15, 0.08, 0.25] },
  side: { pos: [5.4, 1.8, 0.4], target: [0.1, 0.35, 0.2] },
  rear: { pos: [-4.4, 2.2, -1.2], target: [-0.4, 0.3, -0.3] },
  cpu: { pos: [0.35, 1.9, 0.45], target: [-0.18, 0.16, -0.74] },
  ram: { pos: [1.85, 1.9, -0.1], target: [0.58, 0.24, -0.72] },
  gpu: { pos: [0.8, 1.8, 2.2], target: [-0.15, 0.45, 0.24] },
  cables: { pos: [3.6, 3.8, 3.5], target: [0.5, 0.35, 0.65] },
};

const StudioEnvironment: React.FC = () => {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const envTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = envTarget.texture;
    envScene.dispose();
    pmrem.dispose();

    return () => {
      scene.environment = null;
      envTarget.dispose();
    };
  }, [gl, scene]);

  return null;
};

const CameraRig: React.FC<{
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  isSoftwareGl: boolean;
}> = ({ controlsRef, isSoftwareGl }) => {
  const { camera } = useThree();
  const cameraPreset = useSimulatorStore((s) => s.cameraPreset);
  const cameraRequestCounter = useSimulatorStore((s) => s.cameraRequestCounter);
  const cameraFocusTarget = useSimulatorStore((s) => s.cameraFocusTarget);
  const workspaceView = useSimulatorStore((s) => s.workspaceView);
  const heldSpecId = useSimulatorStore((s) => s.heldSpecId);
  const activeCableFrom = useSimulatorStore((s) => s.activeCableFrom);

  const isTransitioningRef = useRef(false);
  const desiredPosRef = useRef(new THREE.Vector3(3.2, 4.1, 4.3));
  const desiredTargetRef = useRef(new THREE.Vector3(0.15, 0.25, 0.25));

  useEffect(() => {
    if (cameraFocusTarget) {
      const [tx, ty, tz] = cameraFocusTarget;
      desiredTargetRef.current.set(tx, ty + 0.12, tz);
      desiredPosRef.current.set(tx + 1.35, ty + 1.65, tz + 1.55);
    } else if (workspaceView === 'completed' && cameraPreset === 'iso') {
      desiredTargetRef.current.set(0.35, 2.0, 0.2);
      desiredPosRef.current.set(4.6, 3.1, 5.2);
    } else {
      const p = CAMERA_PRESETS[cameraPreset] ?? CAMERA_PRESETS.iso;
      desiredPosRef.current.set(...p.pos);
      desiredTargetRef.current.set(...p.target);
    }
    isTransitioningRef.current = true;
  }, [cameraPreset, cameraRequestCounter, cameraFocusTarget, workspaceView]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const controls = controlsRef.current;
    if (!controls) return;

    if (isTransitioningRef.current) {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredPosRef.current.x, 6.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredPosRef.current.y, 6.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredPosRef.current.z, 6.5, dt);

      controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredTargetRef.current.x, 6.5, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredTargetRef.current.y, 6.5, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredTargetRef.current.z, 6.5, dt);

      if (
        camera.position.distanceTo(desiredPosRef.current) < 0.03 &&
        controls.target.distanceTo(desiredTargetRef.current) < 0.03
      ) {
        isTransitioningRef.current = false;
      }
    }
    controls.update();
  });

  // When holding a component or routing a cable, left-click interacts with the 3D scene while right-click orbits!
  const isInteractingWithPart = Boolean(heldSpecId || activeCableFrom);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!isSoftwareGl}
      dampingFactor={0.07}
      minDistance={1.4}
      maxDistance={12.5}
      maxPolarAngle={Math.PI * 0.485}
      mouseButtons={{
        LEFT: isInteractingWithPart ? undefined : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      onStart={() => {
        isTransitioningRef.current = false;
      }}
    />
  );
};

/**
 * Animated Installed Hardware Component with realistic mechanical snap-in motion
 */
const InstalledComponent3D: React.FC<{
  item: InstalledComponent;
  isPoweredOn: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onPickup: () => void;
}> = ({ item, isPoweredOn, isSelected, onSelect, onPickup }) => {
  const socket = SOCKET_DEFINITIONS[item.socketId];
  const spec = HARDWARE_BY_ID[item.specId];
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    progressRef.current = 0;
  }, [item.installedAt]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    progressRef.current = Math.min(1, progressRef.current + dt * 3.4);
    const eased = 1 - Math.pow(1 - progressRef.current, 3);

    if (!groupRef.current) return;

    const [sx, sy, sz] = socket.position;
    if (spec?.type === 'm2_ssd') {
      // M.2 SSD inserts at ~24 degree angle from right edge, then smoothly lowers flat
      const tilt = THREE.MathUtils.lerp(-0.42, 0, eased);
      const lift = THREE.MathUtils.lerp(0.14, 0, eased);
      groupRef.current.position.set(sx, sy + lift, sz);
      groupRef.current.rotation.set(0, item.rotationSteps * (Math.PI / 2), tilt);
    } else {
      const dropHeight = THREE.MathUtils.lerp(0.32, 0, eased);
      groupRef.current.position.set(sx, sy + dropHeight, sz);
      groupRef.current.rotation.set(0, item.rotationSteps * (Math.PI / 2), 0);
    }
  });

  if (!socket || !spec) return null;

  return (
    <group
      ref={groupRef}
      position={socket.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onPickup();
      }}
    >
      <HardwareComponent3D
        specId={item.specId}
        isPoweredOn={isPoweredOn}
        isSelected={isSelected}
      />
    </group>
  );
};

/**
 * Interactive Socket Highlight & Snapping Beacon Zones
 */
const SocketHighlightZones: React.FC = () => {
  const heldSpecId = useSimulatorStore((s) => s.heldSpecId);
  const heldRotationSteps = useSimulatorStore((s) => s.heldRotationSteps);
  const hoveredSocketId = useSimulatorStore((s) => s.hoveredSocketId);
  const snapshot = useSimulatorStore((s) => s.snapshot);
  const appMode = useSimulatorStore((s) => s.appMode);
  const attemptInstall = useSimulatorStore((s) => s.attemptInstall);
  const setHoveredSocket = useSimulatorStore((s) => s.setHoveredSocket);
  const selectComponent = useSimulatorStore((s) => s.selectComponent);

  const heldSpec = heldSpecId ? HARDWARE_BY_ID[heldSpecId] : null;

  // Current tutorial target socket in Learning Mode
  const tutorialTargetSocketId = useMemo(() => {
    if (appMode !== 'learning') return null;
    const step = GUIDED_TUTORIAL_STEPS.find((st) => !st.checkCompleted(snapshot));
    return step?.targetSocketId ?? null;
  }, [appMode, snapshot]);

  return (
    <group name="socket_zones">
      {SOCKET_LIST.map((socket) => {
        const isTutorialTarget = tutorialTargetSocketId === socket.id && !heldSpec;
        const isHovered = hoveredSocketId === socket.id;

        if (!heldSpec && !isTutorialTarget) {
          return null;
        }

        let color = '#22d3ee';
        let opacity = 0.25;
        let showLabel = false;
        let statusText = socket.silkscreen;

        if (heldSpec) {
          const compat = checkSocketCompatibility(heldSpec, socket.id, snapshot, heldRotationSteps);
          const sameCategorySocket = socket.acceptedTypes.includes(heldSpec.type);

          // Show green for compatible, amber for rotation mismatch, red for incompatible/occupied slots
          if (compat.compatible) {
            color = '#10b981';
            opacity = isHovered ? 0.55 : 0.30;
            showLabel = isHovered;
            statusText = `${socket.silkscreen} · Snap to Install`;
          } else if (compat.orientationMismatch) {
            color = '#f59e0b';
            opacity = isHovered ? 0.55 : 0.34;
            showLabel = isHovered;
            statusText = `Press R to Align (${socket.silkscreen})`;
          } else if (sameCategorySocket || isHovered) {
            color = '#ef4444';
            opacity = isHovered ? 0.50 : 0.22;
            showLabel = isHovered;
            statusText = `Incompatible · ${socket.silkscreen}`;
          } else {
            // Subtle red tint on major incompatible motherboard slots so users clearly see red/green contrast
            if (
              socket.id === 'cpu_socket' ||
              socket.id === 'dimm_a2' ||
              socket.id === 'pcie_x16_1' ||
              socket.id === 'm2_1' ||
              socket.id === 'psu_bay'
            ) {
              color = '#ef4444';
              opacity = 0.14;
            } else {
              return null;
            }
          }
        } else if (isTutorialTarget) {
          color = '#22d3ee';
          opacity = 0.34;
          showLabel = true;
          statusText = `Install Here · ${socket.silkscreen}`;
        }

        const boxH = Math.max(0.08, Math.min(0.28, socket.size[1] * 0.45));

        return (
          <group key={socket.id} position={socket.position}>
            <mesh
              position={[0, boxH / 2, 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (heldSpec) setHoveredSocket(socket.id);
              }}
              onPointerOut={() => {
                if (heldSpec && hoveredSocketId === socket.id) setHoveredSocket(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (heldSpec) {
                  attemptInstall(socket.id);
                } else {
                  selectComponent(snapshot.installed[socket.id]?.specId ?? null, socket.id);
                }
              }}
            >
              <boxGeometry args={[socket.size[0], boxH, socket.size[2]]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isHovered ? 1.1 : 0.65}
                transparent
                opacity={opacity}
                depthWrite={false}
              />
            </mesh>
            {/* Wireframe perimeter outline */}
            <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[socket.size[0] + 0.05, socket.size[2] + 0.05]} />
              <meshBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={isHovered ? 0.95 : 0.55}
              />
            </mesh>

            {showLabel && (
              <Html
                position={[0, boxH + 0.25, 0]}
                center
                distanceFactor={6}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap border shadow-lg"
                  style={{
                    backgroundColor: 'rgba(7, 11, 18, 0.94)',
                    borderColor: color,
                    color: '#f8fafc',
                  }}
                >
                  {statusText}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

/**
 * Floating 3D Component currently held/dragged by the user with magnetic socket snapping
 */
const HeldComponent3D: React.FC<{
  pointerWorldRef: React.MutableRefObject<THREE.Vector3>;
}> = ({ pointerWorldRef }) => {
  const heldSpecId = useSimulatorStore((s) => s.heldSpecId);
  const heldRotationSteps = useSimulatorStore((s) => s.heldRotationSteps);
  const hoveredSocketId = useSimulatorStore((s) => s.hoveredSocketId);
  const snapshot = useSimulatorStore((s) => s.snapshot);

  const meshRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(0, 0.6, 0));

  const heldSpec = heldSpecId ? HARDWARE_BY_ID[heldSpecId] : null;

  const ghostStatus = useMemo<'valid' | 'invalid' | 'neutral'>(() => {
    if (!heldSpec || !hoveredSocketId) return 'neutral';
    const compat = checkSocketCompatibility(heldSpec, hoveredSocketId, snapshot, heldRotationSteps);
    return compat.compatible ? 'valid' : 'invalid';
  }, [heldSpec, hoveredSocketId, snapshot, heldRotationSteps]);

  useFrame((_, delta) => {
    if (!meshRef.current || !heldSpec) return;
    const dt = Math.min(delta, 0.05);

    if (hoveredSocketId) {
      const sock = SOCKET_DEFINITIONS[hoveredSocketId];
      targetPos.current.set(sock.position[0], sock.position[1] + 0.14, sock.position[2]);
    } else {
      targetPos.current.set(
        THREE.MathUtils.clamp(pointerWorldRef.current.x, -3.2, 3.6),
        0.55,
        THREE.MathUtils.clamp(pointerWorldRef.current.z, -2.5, 3.6)
      );
    }

    meshRef.current.position.x = THREE.MathUtils.damp(meshRef.current.position.x, targetPos.current.x, 18, dt);
    meshRef.current.position.y = THREE.MathUtils.damp(meshRef.current.position.y, targetPos.current.y, 18, dt);
    meshRef.current.position.z = THREE.MathUtils.damp(meshRef.current.position.z, targetPos.current.z, 18, dt);

    const targetRotY = heldRotationSteps * (Math.PI / 2);
    meshRef.current.rotation.y = THREE.MathUtils.damp(meshRef.current.rotation.y, targetRotY, 16, dt);
  });

  if (!heldSpecId) return null;

  return (
    <group ref={meshRef} position={[0, 0.75, 0]}>
      <HardwareComponent3D specId={heldSpecId} isGhost ghostStatus={ghostStatus} />
    </group>
  );
};

/**
 * Main Scene Content inside the R3F Canvas
 */
const SceneContent: React.FC<{ isSoftwareGl: boolean }> = ({ isSoftwareGl }) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const pointerWorldRef = useRef(new THREE.Vector3(0, 0.25, 0));
  const assemblyRigRef = useRef<THREE.Group>(null);

  const installed = useSimulatorStore((s) => s.snapshot.installed);
  const workspaceView = useSimulatorStore((s) => s.workspaceView);
  const heldSpecId = useSimulatorStore((s) => s.heldSpecId);
  const hoveredSocketId = useSimulatorStore((s) => s.hoveredSocketId);
  const selectedSocketId = useSimulatorStore((s) => s.selectedSocketId);
  const isPoweredOn = useSimulatorStore((s) => s.isPoweredOn);

  const setHoveredSocket = useSimulatorStore((s) => s.setHoveredSocket);
  const attemptInstall = useSimulatorStore((s) => s.attemptInstall);
  const selectComponent = useSimulatorStore((s) => s.selectComponent);
  const pickupInstalledComponent = useSimulatorStore((s) => s.pickupInstalledComponent);
  const cancelCableDrag = useSimulatorStore((s) => s.cancelCableDrag);
  const activeCableFrom = useSimulatorStore((s) => s.activeCableFrom);

  const matTex = useMemo(() => getWorkbenchMatTexture(), []);

  // Smoothly stand PC case upright in 'completed' view, lay ergonomically flat in 'workbench'/'case'
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (assemblyRigRef.current) {
      const standUp = workspaceView === 'completed';
      const targetRotX = standUp ? -Math.PI / 2 : 0;
      const targetY = standUp ? 2.58 : 0.02;
      const targetZ = standUp ? 0.6 : 0;

      assemblyRigRef.current.rotation.x = THREE.MathUtils.damp(
        assemblyRigRef.current.rotation.x,
        targetRotX,
        5,
        dt
      );
      assemblyRigRef.current.position.y = THREE.MathUtils.damp(
        assemblyRigRef.current.position.y,
        targetY,
        5,
        dt
      );
      assemblyRigRef.current.position.z = THREE.MathUtils.damp(
        assemblyRigRef.current.position.z,
        targetZ,
        5,
        dt
      );
    }
  });

  // Pointer raycast plane handler for smooth 3D dragging & magnetic socket snapping
  const handlePlanePointerMove = (e: ThreeEvent<PointerEvent>) => {
    pointerWorldRef.current.copy(e.point);
    if (!heldSpecId || workspaceView === 'completed') return;

    const heldSpec = HARDWARE_BY_ID[heldSpecId];
    if (!heldSpec) return;

    // Find closest socket within snapRadius (prioritizing matching-type sockets)
    let bestSocket: SocketId | null = null;
    let bestScore = Infinity;

    for (const sock of SOCKET_LIST) {
      const dx = e.point.x - sock.position[0];
      const dz = e.point.z - sock.position[2];
      const dist = Math.hypot(dx, dz);
      const isMatchingType = sock.acceptedTypes.includes(heldSpec.type);
      const effectiveRadius = isMatchingType ? sock.snapRadius * 1.25 : sock.snapRadius * 0.72;

      if (dist < effectiveRadius) {
        const score = isMatchingType ? dist * 0.45 : dist;
        if (score < bestScore) {
          bestScore = score;
          bestSocket = sock.id;
        }
      }
    }

    setHoveredSocket(bestSocket);
  };

  const handlePlaneClick = (e: ThreeEvent<MouseEvent>) => {
    if (heldSpecId && hoveredSocketId) {
      e.stopPropagation();
      attemptInstall(hoveredSocketId);
      return;
    }
    if (activeCableFrom) {
      cancelCableDrag();
    }
  };

  const installedList = useMemo(
    () =>
      Object.values(installed).filter(
        (item): item is InstalledComponent => Boolean(item)
      ),
    [installed]
  );

  return (
    <>
      <color attach="background" args={['#070b12']} />
      <fog attach="fog" args={['#070b12', 11, 24]} />

      <StudioEnvironment />

      {/* Balanced 3-Point Laboratory Studio Lighting */}
      <hemisphereLight args={['#bae6fd', '#0f172a', 0.9]} />
      <directionalLight
        position={[5.5, 8.5, 5.0]}
        intensity={2.15}
        color="#fff7ed"
        castShadow={!isSoftwareGl}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-5.0, 4.5, -4.0]} intensity={0.9} color="#38bdf8" />
      <pointLight
        position={[0.2, 2.2, 0.2]}
        intensity={isPoweredOn ? 1.4 : 0.3}
        color={isPoweredOn ? '#22d3ee' : '#94a3b8'}
        distance={8}
      />

      {/* ESD Anti-Static Hardware Laboratory Workbench */}
      <group position={[0.35, -0.06, 0.65]}>
        {/* Main dark bench desk */}
        <mesh position={[0, -0.09, 0]} receiveShadow>
          <boxGeometry args={[12.5, 0.16, 10.5]} />
          <meshStandardMaterial color="#090e17" roughness={0.72} metalness={0.18} />
        </mesh>
        {/* ESD Anti-static mat with millimeter scale */}
        <mesh position={[0, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[7.4, 7.4]} />
          <meshStandardMaterial
            map={matTex}
            roughness={0.82}
            metalness={0.08}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      </group>

      {/* Invisible Raycast Drag Plane for smooth 3D pointer tracking */}
      <mesh
        position={[0.4, 0.22, 0.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePlanePointerMove}
        onPointerUp={(e) => {
          if (heldSpecId && hoveredSocketId) {
            e.stopPropagation();
            attemptInstall(hoveredSocketId);
          }
        }}
        onClick={handlePlaneClick}
        visible={false}
      >
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial />
      </mesh>

      {/* Unified PC Hardware Assembly Rig (rotates upright together in Completed view) */}
      <group ref={assemblyRigRef} position={[0, 0.02, 0]}>
        <PCCaseModel isSoftwareGl={isSoftwareGl} />
        <MotherboardModel />
        <SocketHighlightZones />

        {/* All Installed 3D Components */}
        {installedList.map((item) => (
          <InstalledComponent3D
            key={item.instanceId}
            item={item}
            isPoweredOn={isPoweredOn}
            isSelected={selectedSocketId === item.socketId}
            onSelect={() => {
              if (heldSpecId && hoveredSocketId) {
                attemptInstall(hoveredSocketId);
              } else {
                selectComponent(item.specId, item.socketId);
              }
            }}
            onPickup={() => {
              if (!heldSpecId && workspaceView !== 'completed') {
                pickupInstalledComponent(item.socketId);
              }
            }}
          />
        ))}

        {/* Curved 3D Cable Management System */}
        <CableSystem pointerWorldRef={pointerWorldRef} />

        {/* Currently Held / Dragged Component */}
        <HeldComponent3D pointerWorldRef={pointerWorldRef} />
      </group>

      <CameraRig controlsRef={controlsRef} isSoftwareGl={isSoftwareGl} />
    </>
  );
};

export const WorkspaceScene: React.FC = () => {
  const isSoftwareGl = useMemo(() => detectSoftwareGl(), []);
  const [contextLost, setContextLost] = useState(false);

  const heldSpecId = useSimulatorStore((s) => s.heldSpecId);
  const heldRotationSteps = useSimulatorStore((s) => s.heldRotationSteps);
  const activeCableFrom = useSimulatorStore((s) => s.activeCableFrom);
  const lastErrorBanner = useSimulatorStore((s) => s.lastErrorBanner);
  const clearErrorBanner = useSimulatorStore((s) => s.clearErrorBanner);
  const rotateHeld = useSimulatorStore((s) => s.rotateHeld);
  const cancelHolding = useSimulatorStore((s) => s.cancelHolding);
  const cancelCableDrag = useSimulatorStore((s) => s.cancelCableDrag);
  const appMode = useSimulatorStore((s) => s.appMode);

  const heldSpec = heldSpecId ? HARDWARE_BY_ID[heldSpecId] : null;

  // Auto-dismiss transient error banner after 5 seconds
  useEffect(() => {
    if (!lastErrorBanner) return;
    const t = window.setTimeout(() => clearErrorBanner(), 5200);
    return () => window.clearTimeout(t);
  }, [lastErrorBanner, clearErrorBanner]);

  return (
    <div
      className="relative w-full h-full bg-[#070b12] overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {contextLost ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-[#070b12]">
          <p className="text-base font-semibold text-slate-200">WebGL Context Interrupted</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Your graphics driver suspended the 3D viewport. Click below to restore the hardware bench.
          </p>
          <button
            onClick={() => setContextLost(false)}
            className="mt-4 px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-md"
          >
            Restore 3D Viewport
          </button>
        </div>
      ) : (
        <Canvas
          shadows={!isSoftwareGl}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          camera={{ position: [3.2, 4.1, 4.3], fov: 42, near: 0.1, far: 60 }}
          gl={{
            antialias: !isSoftwareGl,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
          onCreated={({ gl }) => {
            const dom = gl.domElement;
            dom.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setContextLost(true);
            });
            dom.addEventListener('webglcontextrestored', () => {
              setContextLost(false);
            });
          }}
        >
          <SceneContent isSoftwareGl={isSoftwareGl} />
        </Canvas>
      )}

      {/* Top-Center Active Placement / Cable Status Ribbon (Solid rgba, zero backdrop-blur) */}
      {(heldSpec || activeCableFrom || appMode === 'cables') && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3.5 py-2 rounded-lg border border-sky-500/40 bg-[#0b121ee8] text-xs text-slate-200 shadow-lg">
          {heldSpec ? (
            <>
              <span className="font-semibold text-sky-400">Holding: {heldSpec.shortName}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-slate-300">Rot {heldRotationSteps * 90}°</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">Click green slot to snap · Right-drag to orbit</span>
              <button
                onClick={rotateHeld}
                className="pointer-events-auto ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-medium"
              >
                Rotate (R)
              </button>
              <button
                onClick={cancelHolding}
                className="pointer-events-auto px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium"
              >
                Cancel (Esc)
              </button>
            </>
          ) : activeCableFrom ? (
            <>
              <span className="font-semibold text-cyan-400">Routing Cable</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">Click glowing green destination connector</span>
              <button
                onClick={cancelCableDrag}
                className="pointer-events-auto ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Cancel (Esc)
              </button>
            </>
          ) : (
            <>
              <span className="font-semibold text-cyan-400">Cable Management Mode</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">
                Click any glowing connector orb to route a 3D cable, or click an installed cable to disconnect
              </span>
            </>
          )}
        </div>
      )}

      {/* Compatibility / Placement Rejection Alert Banner */}
      {lastErrorBanner && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 max-w-xl px-4 py-2.5 rounded-lg border border-red-500/50 bg-[#1a0b10f2] text-xs text-red-200 flex items-center justify-between gap-4 shadow-xl">
          <span>{lastErrorBanner.message}</span>
          <button
            onClick={clearErrorBanner}
            className="text-red-300 hover:text-white font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subtle Bottom-Left Controls Hint inside Viewport */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 px-2.5 py-1.5 rounded bg-[#070b12cc] border border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center gap-2.5">
        <span>Drag: Orbit</span>
        <span className="text-slate-600">·</span>
        <span>Wheel: Zoom</span>
        <span className="text-slate-600">·</span>
        <span>R: Rotate</span>
        <span className="text-slate-600">·</span>
        <span>F: Focus</span>
        <span className="text-slate-600">·</span>
        <span>Del: Remove</span>
        <span className="text-slate-600">·</span>
        <span>Dbl-Click: Pick Up</span>
      </div>
    </div>
  );
};
