// Levi's movement through a stage: input -> traversal rules -> collisions -> entity
// interactions. Pure logic (no Three.js), so stage tests can simulate whole jumps.
import { TRAVERSAL, cameraRelativeMovement, createTraversal, jumpInput, advanceTimers, consumeJump,
  landed, startDash, isDashing } from './platforming.js';
import { smoothVelocity } from './movement.js';

export const RUN_SPEED = 4.8;
export const SPRINT = 1.45;

export function createPlayer(stage) {
  const { level, entities } = stage;
  const p = {
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, grounded: true, carrier: null,
    knockX: 0, knockZ: 0, facingX: 0, facingZ: -1, traversal: createTraversal(),
  };

  function groundAt(x, z, footY) {
    const fixed = level.groundHeight(x, z, {}, footY);
    const deck = entities.surface(x, z, footY);
    if (deck && (fixed === null || deck.height >= fixed)) return deck;
    return fixed === null ? null : { height: fixed, carrier: null };
  }

  function placeAt(spot) {
    Object.assign(p, { x: spot.x, y: spot.y, z: spot.z, vx: 0, vz: 0, vy: 0, grounded: true,
      carrier: null, knockX: 0, knockZ: 0, traversal: createTraversal() });
  }

  // One simulation step. `input`: { x, z, sprint, jump, dash, yaw }. Returns events.
  function step(dt, input, flags) {
    const events = [];
    const t = p.traversal;
    const move = cameraRelativeMovement(input.x ?? 0, input.z ?? 0, input.yaw ?? 0);
    const hasInput = Math.hypot(move.x, move.z) > 0.01;
    if (hasInput) [p.facingX, p.facingZ] = [move.x, move.z];

    advanceTimers(t, dt, p.grounded);
    if (input.jump) jumpInput(t);
    if (input.dash) {
      const dir = hasInput ? move : { x: p.facingX, z: p.facingZ };
      if (startDash(t, dir.x, dir.z)) events.push({ type: 'dash' });
    }
    const jump = consumeJump(t, p.grounded);
    if (jump > 0) {
      p.vy = jump;
      p.grounded = false;
      p.carrier = null;
      events.push({ type: 'jump', double: t.jumps === 2 });
    }

    const dashing = isDashing(t);
    const speed = RUN_SPEED * (input.sprint ? SPRINT : 1);
    p.vx = dashing ? t.dashX * TRAVERSAL.dashSpeed : smoothVelocity(p.vx, move.x * speed, dt, hasInput ? 15 : 22);
    p.vz = dashing ? t.dashZ * TRAVERSAL.dashSpeed : smoothVelocity(p.vz, move.z * speed, dt, hasInput ? 15 : 22);
    if (!dashing && !hasInput && Math.hypot(p.vx, p.vz) < 0.04) p.vx = p.vz = 0;

    // Moving decks carry Levi; conveyors push him while he stands on them.
    let carryX = 0, carryZ = 0;
    if (p.grounded && p.carrier) {
      carryX = p.carrier.dx;
      carryZ = p.carrier.dz;
      p.y += p.carrier.dy;
    }
    if (p.grounded) {
      for (const belt of entities.ofType('conveyor')) {
        const push = belt.push(p);
        if (push) { carryX += push.x * dt; carryZ += push.z * dt; }
      }
    }
    const decay = Math.exp(-dt * 5);
    p.knockX *= decay;
    p.knockZ *= decay;

    // Barriers break when dashed into; everything solid blocks the swept move.
    for (const barrier of entities.ofType('barrier')) {
      if (barrier.tryBreak(p, dashing)) events.push({ type: 'barrier', id: barrier.id });
    }
    const solids = level.colliders.concat(entities.solids());
    const dx = (p.vx + p.knockX) * dt + carryX;
    const dz = (p.vz + p.knockZ) * dt + carryZ;
    const before = { x: p.x, y: p.y, z: p.z };
    const moved = level.resolveMove(p, dx, dz, p.y, solids);
    p.x = moved.x;
    p.z = moved.z;
    if (moved.hitX) { p.vx = 0; p.knockX = 0; }
    if (moved.hitZ) { p.vz = 0; p.knockZ = 0; }

    // Vertical: snap to the ground while grounded, otherwise fall and land.
    const ground = groundAt(p.x, p.z, before.y);
    if (p.grounded && ground && Math.abs(ground.height - p.y) < 0.3) {
      p.y = ground.height;
      p.vy = 0;
      p.carrier = ground.carrier;
    } else {
      if (p.grounded) events.push({ type: 'leave' });
      p.grounded = false;
      p.carrier = null;
      p.vy -= TRAVERSAL.gravity * dt;
      p.y += p.vy * dt;
      if (ground && p.vy <= 0 && p.y <= ground.height && before.y >= ground.height - 0.2) {
        p.y = ground.height;
        p.vy = 0;
        p.grounded = true;
        p.carrier = ground.carrier;
        landed(t);
        events.push({ type: 'land' });
      }
    }

    // Jump pads and fan columns throw Levi up; the double jump stays available.
    for (const pad of entities.ofType('jumpPad')) {
      const power = p.grounded && t.padCooldown === 0 ? pad.launch(p) : 0;
      if (power > 0) {
        p.vy = power;
        p.grounded = false;
        p.carrier = null;
        t.jumps = 1;
        t.coyote = 0;
        t.padCooldown = 0.6;
        events.push({ type: 'pad', id: pad.id });
      }
    }
    for (const fan of entities.ofType('fan')) {
      const lift = fan.lift(p);
      if (lift !== null) {
        p.vy = Math.max(p.vy, lift);
        if (p.grounded && lift > 0) { p.grounded = false; p.carrier = null; }
        t.jumps = Math.min(t.jumps, 1);
        if (!p.inFan) events.push({ type: 'fan' });
      }
      p.inFan = lift !== null;
    }

    for (const drone of entities.ofType('drone')) {
      const push = drone.bump(p);
      if (push) {
        p.knockX = push.x * 9;
        p.knockZ = push.z * 9;
        if (p.grounded) { p.vy = 4.5; p.grounded = false; p.carrier = null; }
        events.push({ type: 'bump' });
      }
    }
    if (entities.ofType('scanner').some((s) => s.hits(p))) events.push({ type: 'zap' });
    if (entities.ofType('killzone').some((k) => k.contains(p)) || p.y < stage.voidY) events.push({ type: 'fall' });

    for (const cube of entities.ofType('pickup')) {
      if (cube.touches(p)) {
        cube.collected = true;
        events.push({ type: 'cube', id: cube.id });
      }
    }
    for (const secret of entities.ofType('secret')) {
      if (!secret.found && secret.near(p, secret.radius ?? 1.3, 2.2)) {
        secret.found = true;
        events.push({ type: 'secret', id: secret.id, label: secret.label });
      }
    }
    for (const cp of entities.ofType('checkpoint')) {
      if (cp.near(p, cp.radius ?? 1.8, 1.5) && (!cp.after || flags?.goalsDone?.has(cp.after))) {
        events.push({ type: 'checkpoint', id: cp.id, entity: cp });
      }
    }
    return { events, dashing, moving: Math.hypot(p.vx, p.vz) };
  }

  return { state: p, step, placeAt, groundAt };
}
