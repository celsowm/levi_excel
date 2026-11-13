// Gameplay view of a level exported by art/blender/build_world01.py. Pure data and
// geometry: no DOM, renderer or Three.js dependency, so tests can load it directly.
import { boxCollider, moveWithCollisions, shortenCameraArm } from './collisions.js';

export function createLevel(data) {
  const toBox = (c) => boxCollider(c.id, c.x, c.z, c.width, c.depth, c.minY, c.maxY);
  // Camera-only volumes (hanging signs) stop the orbit camera but never Levi.
  const colliders = data.colliders.filter((c) => !c.cameraOnly).map(toBox);
  const cameraColliders = colliders.concat(data.colliders.filter((c) => c.cameraOnly).map(toBox));
  const { bounds } = data;

  // Highest floor slab under (x, z); optional slabs (the bridge) need their flag.
  function floorHeight(x, z, flags = {}) {
    let height = null;
    for (const f of data.floors) {
      if (f.requires && !flags[f.requires]) continue;
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && (height === null || f.y > height)) {
        height = f.y;
      }
    }
    return height;
  }

  // Furniture tops Levi can stand on, only once his feet are high enough to reach them.
  function walkableHeight(x, z, footY, lower) {
    let highest = lower;
    for (const top of data.walkables) {
      if (Math.abs(x - top.x) <= top.halfX && Math.abs(z - top.z) <= top.halfZ &&
          top.height <= footY + 0.2 && (highest === null || top.height > highest)) {
        highest = top.height;
      }
    }
    return highest;
  }

  function groundHeight(x, z, flags = {}, footY = Infinity) {
    return walkableHeight(x, z, footY, floorHeight(x, z, flags));
  }

  // `solids` lets the world add moving colliders (platform decks) to the static set.
  function resolveMove(position, dx, dz, footY, solids = colliders) {
    const moved = moveWithCollisions(position, dx, dz, footY, solids);
    return {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, moved.x)),
      z: Math.min(bounds.maxZ, Math.max(bounds.minZ, moved.z)),
      hitX: moved.hitX, hitZ: moved.hitZ,
    };
  }

  function resolveCamera(from, to, solids = cameraColliders) {
    return shortenCameraArm(from, to, solids, 0.21);
  }

  return { data, colliders, cameraColliders, floorHeight, walkableHeight, groundHeight, resolveMove, resolveCamera };
}
