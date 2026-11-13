// Gameplay entities of a stage, created from the `entities` list exported by the
// Blender stage scripts (art/blender/stage_*.py). Pure logic: positions, motion,
// spreadsheet bindings and player interactions. stage.js mirrors them into Three.js.
import { boxCollider } from './collisions.js';

const TAU = Math.PI * 2;
const approach = (value, target, step) =>
  (Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step);
const wave = (m, t) => (m ? m.amp * Math.sin((TAU * t) / m.period + (m.phase ?? 0)) : 0);

// Value a spreadsheet mission publishes for an entity: flags[flag] or flags[flag][key].
export function boundValue(bind, flags) {
  if (!bind) return undefined;
  const value = flags?.[bind.flag];
  return bind.key === undefined ? value : value?.[bind.key];
}

function platform(def) {
  const e = {
    ...def, active: def.active ?? true, locked: false,
    x: def.x, y: def.y, z: def.z, dx: 0, dy: 0, dz: 0, baseX: def.x, baseY: def.y, baseZ: def.z,
    thickness: def.thickness ?? 0.32,
  };
  e.collider = boxCollider('deck-' + def.id, e.x, e.z, def.w, def.d, e.y - e.thickness, e.y);
  e.update = (t, dt, flags) => {
    const bound = boundValue(def.bind, flags);
    if (typeof bound === 'number') e.baseY = bound;
    else if (bound && typeof bound === 'object') {
      if (bound.slot !== undefined && def.slots) [e.baseX, e.baseZ] = def.slots[bound.slot];
      if (bound.y !== undefined) e.baseY = bound.y;
      e.active = bound.active ?? true;
      e.locked = Boolean(bound.locked);
    } else if (def.bind && bound === undefined && def.bindInactive) e.active = false;
    const speed = (def.speed ?? 3) * dt;
    const before = [e.x, e.y, e.z];
    // Bound decks travel like real lifts; the authored motion rides on top.
    e.restX = approach(e.restX ?? e.baseX, e.baseX, speed * 1.4);
    e.restY = approach(e.restY ?? e.baseY, e.baseY, speed);
    e.restZ = approach(e.restZ ?? e.baseZ, e.baseZ, speed * 1.4);
    const m = def.motion;
    e.x = e.restX + (m?.axis === 'x' ? wave(m, t) : 0);
    e.y = e.restY + (m?.axis === 'y' ? wave(m, t) : 0);
    e.z = e.restZ + (m?.axis === 'z' ? wave(m, t) : 0);
    [e.dx, e.dy, e.dz] = [e.x - before[0], e.y - before[1], e.z - before[2]];
    Object.assign(e.collider, boxCollider(e.collider.id, e.x, e.z, def.w, def.d, e.y - e.thickness, e.y));
    e.moving = Math.abs(e.restY - e.baseY) > 0.01 || Math.abs(e.restX - e.baseX) > 0.01;
  };
  e.surfaceAt = (x, z, footY) => (e.active &&
    Math.abs(x - e.x) <= def.w / 2 - 0.08 && Math.abs(z - e.z) <= def.d / 2 - 0.08 &&
    e.y <= footY + 0.25 ? e.y : null);
  e.solid = () => (e.active ? e.collider : null);
  return e;
}

function jumpPad(def) {
  return { ...def, update() {},
    launch: (p) => (Math.hypot(p.x - def.x, p.z - def.z) < def.radius && Math.abs(p.y - def.y) < 0.35 ? def.power : 0) };
}

function fan(def) {
  const e = { ...def, power: 0, top: def.y, spin: 0 };
  e.update = (t, dt, flags) => {
    const target = Math.max(0, Math.min(1.25, Number(boundValue(def.bind, flags)) || 0));
    e.power = approach(e.power, target, dt * 0.8);
    e.top = def.y + def.height * e.power;
    e.spin += dt * (2 + e.power * 18);
  };
  // Upward speed the air column imposes, or null when Levi is outside it.
  e.lift = (p) => {
    if (e.power < 0.02 || Math.hypot(p.x - def.x, p.z - def.z) > def.radius || p.y < def.y - 0.5 || p.y > e.top + 0.6) return null;
    return p.y < e.top - 0.4 ? 7.5 : (e.top - p.y) * 3;
  };
  return e;
}

function conveyor(def) {
  return { ...def, update() {},
    push: (p) => (p.x >= def.minX && p.x <= def.maxX && p.z >= def.minZ && p.z <= def.maxZ &&
      Math.abs(p.y - def.y) < 0.12 ? { x: def.vx ?? 0, z: def.vz ?? 0 } : null) };
}

function barrier(def) {
  const along = Math.abs(Math.sin(def.yaw ?? 0)) > 0.7 ? 'z' : 'x';
  const e = { ...def, broken: false };
  e.collider = boxCollider('barrier-' + def.id, def.x, def.z,
    along === 'x' ? def.width : 0.4, along === 'x' ? 0.4 : def.width, def.y - 0.1, def.y + 2.1);
  e.update = () => {};
  e.solid = () => (e.broken ? null : e.collider);
  // A dash through the barrier breaks it; reports true the first time.
  e.tryBreak = (p, dashing) => {
    if (e.broken || !dashing) return false;
    const c = e.collider;
    const reach = 0.9;
    if (p.x > c.minX - reach && p.x < c.maxX + reach && p.z > c.minZ - reach && p.z < c.maxZ + reach &&
        p.y < c.maxY && p.y + 1.7 > c.minY) {
      e.broken = true;
      return true;
    }
    return false;
  };
  return e;
}

function scanner(def) {
  const e = { ...def, x: def.x, y: def.y, z: def.z };
  const cos = Math.cos(def.yaw ?? 0), sin = Math.sin(def.yaw ?? 0);
  e.update = (t) => {
    const s = wave(def.sweep, t);
    e.x = def.x + (def.sweep?.axis === 'x' ? s : 0);
    e.z = def.z + (def.sweep?.axis === 'z' ? s : 0);
    e.y = def.y + (def.sweep?.axis === 'y' ? s : 0);
  };
  e.hits = (p) => {
    if (p.y > e.y + 0.12 || p.y + 1.6 < e.y - 0.12) return false;
    // Distance from Levi's axis to the beam segment, in the beam's local frame.
    const lx = (p.x - e.x) * cos - (p.z - e.z) * sin;
    const lz = (p.x - e.x) * sin + (p.z - e.z) * cos;
    return Math.abs(lx) < def.length / 2 && Math.abs(lz) < 0.42;
  };
  return e;
}

function pathPoint(path, distance) {
  // Position along a closed polyline at the given travelled distance.
  const segments = path.map((a, i) => {
    const b = path[(i + 1) % path.length];
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) };
  });
  const total = segments.reduce((sum, s) => sum + s.length, 0) || 1;
  let d = ((distance % total) + total) % total;
  for (const s of segments) {
    if (d <= s.length) {
      const k = s.length ? d / s.length : 0;
      return { x: s.a[0] + (s.b[0] - s.a[0]) * k, y: s.a[1] + (s.b[1] - s.a[1]) * k, z: s.a[2] + (s.b[2] - s.a[2]) * k,
        heading: Math.atan2(s.b[0] - s.a[0], s.b[2] - s.a[2]) };
    }
    d -= s.length;
  }
  return { x: path[0][0], y: path[0][1], z: path[0][2], heading: 0 };
}

function drone(def) {
  const e = { ...def, x: def.path[0][0], y: def.path[0][1], z: def.path[0][2], heading: 0 };
  e.update = (t) => {
    const p = pathPoint(def.path, t * (def.speed ?? 2));
    Object.assign(e, { x: p.x, y: p.y + Math.sin(t * 2.2) * 0.12, z: p.z, heading: p.heading });
  };
  // Harmless knockback: returns a push direction when Levi bumps into the drone.
  e.bump = (p) => {
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > (def.radius ?? 0.95) || p.y > e.y + 0.55 || p.y + 1.7 < e.y - 0.55) return null;
    return d < 1e-4 ? { x: 0, z: 1 } : { x: dx / d, z: dz / d };
  };
  return e;
}

// Guide drone: waits at each waypoint until Levi comes close, then flies to the next.
function courier(def) {
  const e = { ...def, index: 0, x: def.path[0][0], y: def.path[0][1], z: def.path[0][2], heading: Math.PI, arrived: false };
  e.update = (t, dt, flags, player) => {
    const released = Boolean(boundValue(def.bind, flags));
    if (flags?.[def.bind?.flag] === 'done') e.index = def.path.length - 1;
    const target = def.path[e.index];
    const step = (def.speed ?? 4.5) * dt;
    const dx = target[0] - e.x, dy = target[1] - e.y, dz = target[2] - e.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > step) {
      e.x += (dx / d) * step; e.y += (dy / d) * step; e.z += (dz / d) * step;
      if (Math.hypot(dx, dz) > 0.05) e.heading = Math.atan2(dx, dz);
    } else {
      [e.x, e.y, e.z] = target;
      const last = e.index === def.path.length - 1;
      const near = player && Math.hypot(player.x - e.x, player.z - e.z) < (def.wait ?? 5.5) &&
        Math.abs(player.y - e.y) < 4.5;
      if (released && !last && near) e.index++;
      e.arrived = released && last && near;
    }
    e.bob = Math.sin(t * 2) * 0.08;
  };
  return e;
}

const point = (def) => ({ ...def, update() {}, near: (p, r = def.radius ?? 1.2, h = 2.4) =>
  Math.hypot(p.x - def.x, p.z - def.z) < r && Math.abs(p.y - (def.y ?? p.y)) < h });

function pickup(def) {
  const e = { ...point(def), collected: false, spin: 0 };
  e.update = (t) => { e.bobY = def.y + Math.sin(t * 2.4 + (def.phase ?? 0)) * 0.19; e.spin = t * 1.7; };
  e.touches = (p) => !e.collected && Math.hypot(p.x - def.x, p.z - def.z) < 0.95 && Math.abs(p.y + 1 - def.y) < 1.8;
  return e;
}

function killzone(def) {
  return { ...def, update() {}, contains: (p) =>
    p.x >= def.minX && p.x <= def.maxX && p.z >= def.minZ && p.z <= def.maxZ && p.y < def.y };
}

const FACTORIES = {
  platform, jumpPad, fan, conveyor, barrier, scanner, drone, courier, pickup, killzone,
  checkpoint: point, terminal: point, exit: point, secret: point, deco: (def) => ({ ...def, update() {} }),
};

export function createEntities(defs) {
  const list = defs.map((def) => {
    const make = FACTORIES[def.type];
    if (!make) throw new Error(`Unknown entity type "${def.type}" (${def.id})`);
    return make(def);
  });
  const byId = new Map(list.map((e) => [e.id, e]));
  const ofType = (type) => list.filter((e) => e.type === type);
  const platforms = ofType('platform');
  const solidsOf = [...platforms, ...ofType('barrier')];

  return {
    list, byId, ofType,
    update(t, dt, flags, player) { for (const e of list) e.update(t, dt, flags, player); },
    // Highest active deck under (x, z) that Levi's feet can reach, and the deck itself.
    surface(x, z, footY) {
      let best = null;
      for (const p of platforms) {
        const top = p.surfaceAt(x, z, footY);
        if (top !== null && (best === null || top > best.height)) best = { height: top, carrier: p };
      }
      return best;
    },
    solids() { return solidsOf.map((e) => e.solid()).filter(Boolean); },
  };
}
