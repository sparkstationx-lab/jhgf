import React, { useEffect } from 'react';
import { WorkspaceScene } from './components/three/WorkspaceScene';
import { BootMonitorModal } from './components/ui/BootMonitorModal';
import { BottomConsole } from './components/ui/BottomConsole';
import { InspectorPanel } from './components/ui/InspectorPanel';
import { InventorySidebar } from './components/ui/InventorySidebar';
import { TopToolbar } from './components/ui/TopToolbar';
import { useSimulatorStore } from './store/useSimulatorStore';

export default function App() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if user is typing in a select/input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const store = useSimulatorStore.getState();

      if (e.key === 'r' || e.key === 'R') {
        if (store.heldSpecId) {
          e.preventDefault();
          store.rotateHeld();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (store.heldSpecId) store.cancelHolding();
        if (store.activeCableFrom) store.cancelCableDrag();
        if (store.showBootMonitor) store.setShowBootMonitor(false);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedSocketId && !store.heldSpecId) {
          e.preventDefault();
          store.removeFromSocket(store.selectedSocketId);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        store.focusSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#070b12] text-slate-100 overflow-hidden">
      {/* TOP: Mode selector, camera presets, undo/redo, save/reset, POWER ON */}
      <TopToolbar />

      {/* MIDDLE: Left Inventory + Center 3D Workspace + Right Inspector */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <InventorySidebar />

        <main className="flex-1 min-w-0 h-full relative">
          <WorkspaceScene />
        </main>

        <InspectorPanel />
      </div>

      {/* BOTTOM: Assembly progress, power telemetry, and diagnostic POST console */}
      <BottomConsole />

      {/* UEFI / Operating System Display Output Modal */}
      <BootMonitorModal />
    </div>
  );
}
