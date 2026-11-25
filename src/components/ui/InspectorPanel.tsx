import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Crosshair,
  Move,
  Trash2,
  Trophy,
} from 'lucide-react';
import {
  CHALLENGES,
  GUIDED_TUTORIAL_STEPS,
  HARDWARE_BY_ID,
  MOTHERBOARD_BY_ID,
  SOCKET_DEFINITIONS,
} from '../../data/catalog';
import { useSimulatorStore } from '../../store/useSimulatorStore';

export const InspectorPanel: React.FC = () => {
  const appMode = useSimulatorStore((s) => s.appMode);
  const snapshot = useSimulatorStore((s) => s.snapshot);
  const selectedSpecId = useSimulatorStore((s) => s.selectedSpecId);
  const selectedSocketId = useSimulatorStore((s) => s.selectedSocketId);
  const activeChallengeId = useSimulatorStore((s) => s.activeChallengeId);
  const completedChallenges = useSimulatorStore((s) => s.completedChallenges);
  const totalScore = useSimulatorStore((s) => s.totalScore);
  const bootEvaluation = useSimulatorStore((s) => s.bootEvaluation);

  const startHoldingSpec = useSimulatorStore((s) => s.startHoldingSpec);
  const pickupInstalledComponent = useSimulatorStore((s) => s.pickupInstalledComponent);
  const removeFromSocket = useSimulatorStore((s) => s.removeFromSocket);
  const focusSelected = useSimulatorStore((s) => s.focusSelected);
  const startChallenge = useSimulatorStore((s) => s.startChallenge);
  const exitChallenge = useSimulatorStore((s) => s.exitChallenge);
  const setActiveCategory = useSimulatorStore((s) => s.setActiveCategory);
  const setAppMode = useSimulatorStore((s) => s.setAppMode);
  const requestCameraPreset = useSimulatorStore((s) => s.requestCameraPreset);

  const board = MOTHERBOARD_BY_ID[snapshot.motherboardId];
  const spec = selectedSpecId ? HARDWARE_BY_ID[selectedSpecId] : null;
  const installedAtSelected = selectedSocketId ? snapshot.installed[selectedSocketId] : undefined;

  // Compute current tutorial step in Learning Mode
  const activeTutorialStep = GUIDED_TUTORIAL_STEPS.find(
    (step) => !step.checkCompleted(snapshot)
  );
  const tutorialCompletedCount = GUIDED_TUTORIAL_STEPS.filter((step) =>
    step.checkCompleted(snapshot)
  ).length;

  // Render Challenge Mode View
  if (appMode === 'challenge') {
    const activeChallenge = CHALLENGES.find((c) => c.id === activeChallengeId);

    return (
      <aside className="w-[300px] shrink-0 bg-[#0b111d] border-l border-slate-800/90 flex flex-col h-full overflow-hidden">
        <div className="p-3.5 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-slate-100">PC Building Challenges</h2>
          </div>
          <span className="text-xs font-mono font-semibold text-amber-400 tabular-nums">
            {totalScore} pts
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeChallenge ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-sky-400">
                  Challenge {activeChallenge.number} · {activeChallenge.difficulty}
                </span>
                <button
                  onClick={exitChallenge}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  All Challenges
                </button>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">{activeChallenge.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {activeChallenge.brief}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-200">Mission Objectives</div>
                {activeChallenge.objectives.map((obj) => {
                  const done = obj.check(snapshot, bootEvaluation);
                  return (
                    <div
                      key={obj.id}
                      className={`p-2 rounded border text-xs flex items-start gap-2 ${
                        done
                          ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-300'
                          : 'bg-[#0d1422] border-slate-800 text-slate-300'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          done ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                      <span>{obj.label}</span>
                    </div>
                  );
                })}
              </div>

              {completedChallenges[activeChallenge.id] && (
                <div className="p-2.5 rounded-md bg-emerald-950/40 border border-emerald-500/50 text-xs text-emerald-200">
                  Challenge Complete! Earned +{completedChallenges[activeChallenge.id]} points.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-400 leading-relaxed">
                Test your hardware engineering and troubleshooting skills across 5 practical missions.
              </p>
              {CHALLENGES.map((ch) => {
                const earned = completedChallenges[ch.id];
                return (
                  <div
                    key={ch.id}
                    className="p-3 rounded-md bg-[#0e1625] border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>
                        0{ch.number}. {ch.difficulty}
                      </span>
                      <span className={earned ? 'text-emerald-400' : 'text-amber-400'}>
                        {earned ? `Completed (+${earned})` : `${ch.points} pts`}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-100 mt-1">{ch.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{ch.brief}</p>
                    <button
                      onClick={() => startChallenge(ch.id)}
                      className="mt-2.5 w-full py-1.5 rounded bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-300 text-xs font-medium transition-colors"
                    >
                      {earned ? 'Replay Challenge' : 'Start Challenge'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[300px] shrink-0 bg-[#0b111d] border-l border-slate-800/90 flex flex-col h-full overflow-hidden">
      {/* Guided Beginner Tutorial Banner when Learning Mode is Active */}
      {appMode === 'learning' && (
        <div className="p-3 border-b border-sky-500/30 bg-[#0c1829]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Guided Assembly Tutorial
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {tutorialCompletedCount}/{GUIDED_TUTORIAL_STEPS.length}
            </span>
          </div>
          {activeTutorialStep ? (
            <>
              <div className="text-xs font-semibold text-slate-100 mt-1">
                {activeTutorialStep.title}
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {activeTutorialStep.instruction}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                {activeTutorialStep.highlightCategory && (
                  <button
                    onClick={() => setActiveCategory(activeTutorialStep.highlightCategory!)}
                    className="px-2 py-1 text-[11px] font-medium rounded bg-sky-600/25 border border-sky-500/40 text-sky-200 hover:bg-sky-600/40"
                  >
                    Open Category
                  </button>
                )}
                {activeTutorialStep.targetCableType && (
                  <button
                    onClick={() => setAppMode('cables')}
                    className="px-2 py-1 text-[11px] font-medium rounded bg-cyan-600/25 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/40"
                  >
                    Open Cable Mode
                  </button>
                )}
                {activeTutorialStep.targetSocketId && (
                  <button
                    onClick={() => {
                      const id = activeTutorialStep.targetSocketId;
                      if (id === 'cpu_socket' || id === 'cpu_cooler_mount') requestCameraPreset('cpu');
                      else if (id?.startsWith('dimm')) requestCameraPreset('ram');
                      else if (id === 'pcie_x16_1') requestCameraPreset('gpu');
                      else requestCameraPreset('iso');
                    }}
                    className="px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    Focus Slot
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-emerald-300 mt-1">
              All core steps assembled! Click Power On to test your system.
            </p>
          )}
        </div>
      )}

      {/* Selected Component / Socket Inspector */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {spec ? (
          <>
            <div>
              <div className="text-[11px] font-mono text-sky-400">
                {spec.brand} · {spec.category.toUpperCase()}
              </div>
              <h2 className="text-sm font-bold text-slate-100 mt-0.5 leading-snug">{spec.name}</h2>
              {selectedSocketId && (
                <div className="text-[11px] text-emerald-400 font-mono mt-1">
                  Installed in {SOCKET_DEFINITIONS[selectedSocketId].label}
                </div>
              )}
            </div>

            {/* Quick Component Actions */}
            <div className="flex flex-wrap gap-1.5">
              {installedAtSelected && selectedSocketId ? (
                <>
                  <button
                    onClick={() => pickupInstalledComponent(selectedSocketId)}
                    className="flex-1 px-2.5 py-1.5 rounded text-xs font-medium bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-300 flex items-center justify-center gap-1.5"
                  >
                    <Move className="w-3.5 h-3.5" />
                    Pick Up
                  </button>
                  <button
                    onClick={focusSelected}
                    className="px-2.5 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                    title="Focus Camera (F)"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Focus
                  </button>
                  <button
                    onClick={() => removeFromSocket(selectedSocketId)}
                    className="px-2.5 py-1.5 rounded text-xs font-medium bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 flex items-center gap-1"
                    title="Remove Component (Delete)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startHoldingSpec(spec.id)}
                  className="w-full py-1.5 rounded text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                >
                  Pick Up & Place in 3D
                </button>
              )}
            </div>

            {/* Hardware Specifications Grid */}
            <div className="border-t border-slate-800 pt-3">
              <div className="text-xs font-semibold text-slate-200 mb-2">
                Hardware Specifications
              </div>
              <dl className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px]">
                <dt className="text-slate-500">Connector</dt>
                <dd className="text-slate-200 font-mono text-right">{spec.connectorType}</dd>

                {spec.socketType && (
                  <>
                    <dt className="text-slate-500">CPU Socket</dt>
                    <dd
                      className={`font-mono text-right ${
                        spec.socketType === board.socket ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {spec.socketType}
                    </dd>
                  </>
                )}
                {spec.ramGen && (
                  <>
                    <dt className="text-slate-500">Memory Spec</dt>
                    <dd
                      className={`font-mono text-right ${
                        spec.ramGen === board.ramGen ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {spec.ramCapacityGB}GB {spec.ramGen}-{spec.ramSpeedMHz}
                    </dd>
                  </>
                )}
                {spec.supportedSockets && (
                  <>
                    <dt className="text-slate-500">Supported Sockets</dt>
                    <dd className="text-slate-200 font-mono text-right">
                      {spec.supportedSockets.join(', ')}
                    </dd>
                  </>
                )}
                <dt className="text-slate-500">{spec.wattageSupply ? 'Max Output' : 'Power Draw'}</dt>
                <dd className="text-slate-200 font-mono text-right tabular-nums">
                  {spec.wattageSupply ? `${spec.wattageSupply} W` : `${spec.wattageDraw} W`}
                </dd>

                <dt className="text-slate-500">Dimensions</dt>
                <dd className="text-slate-200 font-mono text-right tabular-nums">
                  {spec.dimensionsMm.join('×')} mm
                </dd>

                <dt className="text-slate-500">Est. Cost</dt>
                <dd className="text-slate-200 font-mono text-right tabular-nums">${spec.price}</dd>
              </dl>
            </div>

            {/* Educational Engineering Breakdown */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="text-xs font-semibold text-cyan-300">
                Engineering & Learning Guide
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">What It Is</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{spec.education.whatItIs}</p>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">Purpose & How It Works</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {spec.education.purpose} {spec.education.howItWorks}
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">How It Connects</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {spec.education.howItConnects}
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">Why It Is Necessary</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {spec.education.whyNecessary}
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Common Installation Mistakes
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc pl-4">
                  {spec.education.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="leading-snug">
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400 py-8 text-center">
            Select any component from the left inventory or click an installed 3D part to inspect its specifications and compatibility.
          </div>
        )}
      </div>
    </aside>
  );
};
