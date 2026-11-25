import React from 'react';
import {
  BookOpen,
  Cable,
  Camera,
  FolderOpen,
  Layers,
  Monitor,
  Power,
  Redo2,
  RotateCcw,
  Save,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { AppMode, CameraPreset, WorkspaceView } from '../../types/hardware';
import { setSoundEnabled } from '../../utils/soundEffects';

export const TopToolbar: React.FC = () => {
  const workspaceView = useSimulatorStore((s) => s.workspaceView);
  const appMode = useSimulatorStore((s) => s.appMode);
  const isPoweredOn = useSimulatorStore((s) => s.isPoweredOn);
  const bootOutcome = useSimulatorStore((s) => s.bootOutcome);
  const pastCount = useSimulatorStore((s) => s.past.length);
  const futureCount = useSimulatorStore((s) => s.future.length);
  const savedBuildExists = useSimulatorStore((s) => s.savedBuildExists);
  const soundMuted = useSimulatorStore((s) => s.soundMuted);
  const cameraPreset = useSimulatorStore((s) => s.cameraPreset);

  const setWorkspaceView = useSimulatorStore((s) => s.setWorkspaceView);
  const setAppMode = useSimulatorStore((s) => s.setAppMode);
  const requestCameraPreset = useSimulatorStore((s) => s.requestCameraPreset);
  const undo = useSimulatorStore((s) => s.undo);
  const redo = useSimulatorStore((s) => s.redo);
  const resetBuild = useSimulatorStore((s) => s.resetBuild);
  const saveBuild = useSimulatorStore((s) => s.saveBuild);
  const loadSavedBuild = useSimulatorStore((s) => s.loadSavedBuild);
  const runPowerOnTest = useSimulatorStore((s) => s.runPowerOnTest);
  const powerOff = useSimulatorStore((s) => s.powerOff);
  const toggleMute = useSimulatorStore((s) => s.toggleMute);

  const views: { id: WorkspaceView; label: string }[] = [
    { id: 'workbench', label: 'Workbench' },
    { id: 'case', label: 'PC Case' },
    { id: 'completed', label: 'Completed' },
  ];

  const modes: { id: AppMode; label: string; icon: React.ReactNode }[] = [
    { id: 'assemble', label: 'Assemble', icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: 'cables', label: 'Cables', icon: <Cable className="w-3.5 h-3.5" /> },
    { id: 'learning', label: 'Learn', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'challenge', label: 'Challenges', icon: <Trophy className="w-3.5 h-3.5" /> },
  ];

  const cameras: { id: CameraPreset; label: string }[] = [
    { id: 'iso', label: 'Iso' },
    { id: 'top', label: 'Top' },
    { id: 'side', label: 'Side' },
    { id: 'rear', label: 'I/O' },
  ];

  const handleMuteToggle = () => {
    setSoundEnabled(soundMuted);
    toggleMute();
  };

  return (
    <header className="h-13 shrink-0 bg-[#0a101b] border-b border-slate-800/90 px-3.5 flex items-center justify-between gap-3 overflow-x-auto">
      {/* Zone 1: Brand Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-md bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400">
          <Layers className="w-4 h-4" />
        </div>
        <span className="text-sm font-bold tracking-tight text-slate-100 whitespace-nowrap">
          SiliconBench 3D
        </span>
      </div>

      {/* Zone 2: Workspace & Mode Segmented Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Workspace View Switcher */}
        <div className="flex items-center bg-[#070b12] p-0.5 rounded-md border border-slate-800">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setWorkspaceView(v.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                workspaceView === v.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-[#070b12] p-0.5 rounded-md border border-slate-800">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setAppMode(m.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                appMode === m.id
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Camera Angle Presets */}
        <div className="hidden xl:flex items-center gap-1 bg-[#070b12] px-1.5 py-0.5 rounded-md border border-slate-800">
          <Camera className="w-3.5 h-3.5 text-slate-500 mr-0.5" />
          {cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => requestCameraPreset(cam.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === cam.id
                  ? 'bg-slate-800 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone 3: History, Save/Reset, and Primary POWER ON Control */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={undo}
          disabled={pastCount === 0}
          title="Undo"
          className="p-1.5 rounded border border-slate-800 bg-[#0d1422] text-slate-300 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={futureCount === 0}
          title="Redo"
          className="p-1.5 rounded border border-slate-800 bg-[#0d1422] text-slate-300 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={saveBuild}
          title="Save Build"
          className="px-2 py-1.5 rounded border border-slate-800 bg-[#0d1422] text-slate-300 hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Save</span>
        </button>
        {savedBuildExists && (
          <button
            onClick={loadSavedBuild}
            title="Load Saved Build"
            className="p-1.5 rounded border border-slate-800 bg-[#0d1422] text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={resetBuild}
          title="Reset Workbench"
          className="p-1.5 rounded border border-slate-800 bg-[#0d1422] text-slate-300 hover:bg-slate-800 hover:text-red-300 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMuteToggle}
          title={soundMuted ? 'Unmute Audio' : 'Mute Audio'}
          className="p-1.5 rounded border border-slate-800 bg-[#0d1422] text-slate-300 hover:bg-slate-800 transition-colors"
        >
          {soundMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Primary Action: POWER ON / POWER OFF */}
        {isPoweredOn ? (
          <button
            onClick={powerOff}
            className="ml-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Power Off</span>
          </button>
        ) : (
          <button
            onClick={runPowerOnTest}
            disabled={bootOutcome === 'RUNNING'}
            className="ml-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{bootOutcome === 'RUNNING' ? 'Testing POST...' : 'Power On'}</span>
          </button>
        )}

        {isPoweredOn && (bootOutcome === 'SUCCESS' || bootOutcome === 'WARNING') && (
          <button
            onClick={() => useSimulatorStore.getState().setShowBootMonitor(true)}
            title="Open UEFI / OS Screen"
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-sky-600/20 border border-sky-500/40 text-sky-300 hover:bg-sky-600/30 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Display</span>
          </button>
        )}
      </div>
    </header>
  );
};
