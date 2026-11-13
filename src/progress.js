// Progress, kept as data so gameplay code never juggles mission booleans.
//   createRun()  one play-through of a stage: goals in order, world flags, checkpoint, timer
//   createSave() what survives between sessions: unlocked stages, records, cubes, secrets
import { MISSIONS, STAGES, STAGE_MISSIONS, stageById } from './campaign.js';

export function createRun(stageId, { timeTrial = false } = {}) {
  const stage = stageById(stageId);
  if (!stage) throw new Error('Unknown stage ' + stageId);
  const done = new Set();
  const sheets = new Map();
  const flags = {};
  // Every mission of the stage starts by publishing what its untouched sheet means
  // (lifts shuffled, walkway retracted, fans off...).
  for (const id of STAGE_MISSIONS[stageId] ?? []) Object.assign(flags, MISSIONS[id].preview(sheetFor(id)));
  if (timeTrial) {
    for (const goal of stage.goals) {
      if (goal.kind === 'exit') continue;
      done.add(goal.id);
      if (goal.mission) Object.assign(flags, MISSIONS[goal.mission].solvedFlags);
    }
    if (stage.goals.some((g) => g.kind === 'follow')) flags.courier = 'done';
  }

  function sheetFor(missionId) {
    if (!sheets.has(missionId)) sheets.set(missionId, MISSIONS[missionId].sheet());
    return sheets.get(missionId);
  }
  const goalOf = (missionId) => stage.goals.find((g) => g.mission === missionId);
  const current = () => stage.goals.find((g) => !done.has(g.id)) ?? null;

  return {
    stage, timeTrial, flags, done,
    time: 0, checkpoint: null, cubes: new Set(), secrets: new Set(), finished: false,
    currentGoal: current,
    sheetFor,
    // A terminal opens when its goal is the current one, or for optional missions.
    missionState(missionId) {
      const goal = goalOf(missionId);
      if (!goal) return MISSIONS[missionId].optional ? (flags[missionId + 'Solved'] ? 'solved' : 'open') : 'locked';
      if (done.has(goal.id)) return 'solved';
      return current() === goal ? 'open' : 'locked';
    },
    // Live preview while the learner works; returns the mission's verdict.
    preview(missionId, context = {}) {
      const mission = MISSIONS[missionId];
      const sheet = sheetFor(missionId);
      Object.assign(flags, mission.preview(sheet));
      return mission.validate(sheet, context);
    },
    solveMission(missionId) {
      const mission = MISSIONS[missionId];
      Object.assign(flags, mission.solvedFlags);
      const goal = goalOf(missionId);
      if (goal) done.add(goal.id);
      else flags[missionId + 'Solved'] = true;
      return goal;
    },
    completeGoal(goalId) {
      if (current()?.id !== goalId) return false;
      done.add(goalId);
      return true;
    },
    exitOpen() { return current()?.kind === 'exit'; },
  };
}

const KEY = 'levi.progress.v4';
const empty = () => ({ unlocked: [STAGES[0].id], best: {}, cubes: {}, secrets: {}, skills: [], mastery: false, world: false });

export function createSave(storage = globalThis.localStorage) {
  let data = empty();
  try {
    const stored = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (stored && Array.isArray(stored.unlocked)) data = { ...empty(), ...stored };
  } catch { /* private mode or corrupt data: start fresh */ }
  const persist = () => {
    try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  };
  const union = (list, values) => [...new Set([...(list ?? []), ...values])];

  return {
    get data() { return data; },
    isUnlocked: (id) => data.unlocked.includes(id),
    // Merge a finished run; returns what is new so the results screen can celebrate it.
    recordRun(run, totals) {
      const id = run.stage.id;
      const previous = data.best[id];
      const record = !run.timeTrial ? null : (previous === undefined || run.time < previous);
      if (run.timeTrial && record) data.best[id] = Math.round(run.time * 10) / 10;
      if (!run.timeTrial && previous === undefined) data.best[id] = null;
      data.cubes[id] = union(data.cubes[id], run.cubes);
      data.secrets[id] = union(data.secrets[id], run.secrets);
      for (const goal of run.stage.goals) if (goal.mission) data.skills = union(data.skills, [goal.mission]);
      if (run.flags.mastery) data.mastery = true;
      if (run.stage.next) data.unlocked = union(data.unlocked, [run.stage.next]);
      else data.world = true;
      persist();
      return { record, cubes: data.cubes[id].length, cubeTotal: totals.cubes, secrets: data.secrets[id].length, secretTotal: totals.secrets };
    },
    reset() { data = empty(); persist(); },
  };
}

// Medal for a time-trial: gold within par, silver within 1.5x par, bronze otherwise.
export function medal(seconds, par) {
  if (seconds <= par) return 'ouro';
  if (seconds <= par * 1.5) return 'prata';
  return 'bronze';
}

export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
