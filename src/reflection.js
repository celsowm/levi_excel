import * as THREE from 'three';

// Planar reflection for the polished ground floor (the concept art's mirror-like
// stone). Each frame the scene is rendered from a camera mirrored about y = height
// into a half-resolution HDR target; the floor's lightmapped material then mixes it
// in with a Fresnel term, so light strips, Levi and props reflect on the marble.
export function createFloorReflection(renderer, scene, { height = 0.11, scale = 0.5, strength = 1 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(Math.round(size.x * scale), Math.round(size.y * scale),
    { type: THREE.HalfFloatType });
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const mirror = new THREE.PerspectiveCamera();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
  const textureMatrix = new THREE.Matrix4();
  const uniforms = {
    reflectionMap: { value: target.texture },
    reflectionMatrix: { value: textureMatrix },
    reflectionHeight: { value: height },
    reflectionStrength: { value: strength },
    reflectionTexel: { value: new THREE.Vector2(1 / target.width, 1 / target.height) },
  };
  const view = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const rotation = new THREE.Matrix4();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const normal = new THREE.Vector3(0, 1, 0);
  const planePoint = new THREE.Vector3(0, height, 0);
  let enabled = true;

  // Patch a MeshBasicMaterial (the baked LM_ floor) to mix in the reflection.
  function apply(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 reflectionMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vReflWorld;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 reflWorld = modelMatrix * vec4(transformed, 1.0);\nvReflWorld = reflWorld.xyz;\nvReflUv = reflectionMatrix * reflWorld;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D reflectionMap;
uniform float reflectionHeight;
uniform float reflectionStrength;
uniform vec2 reflectionTexel;
varying vec4 vReflUv;
varying vec3 vReflWorld;`)
        // The tile texture is beige; the concept's polished stone is a cool grey-lilac.
        .replace('#include <map_fragment>', `#include <map_fragment>
float stoneLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
diffuseColor.rgb = mix(vec3(stoneLum), diffuseColor.rgb, 0.3) * vec3(0.9, 0.92, 1.04);`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
if (abs(vReflWorld.y - reflectionHeight) < 0.03 && reflectionStrength > 0.0) {
  vec2 uv = vReflUv.xy / vReflUv.w;
  // Small cross blur: polished, not a perfect mirror.
  vec3 r = texture2D(reflectionMap, uv).rgb * 0.4;
  r += texture2D(reflectionMap, uv + vec2(reflectionTexel.x * 1.5, 0.0)).rgb * 0.15;
  r += texture2D(reflectionMap, uv - vec2(reflectionTexel.x * 1.5, 0.0)).rgb * 0.15;
  r += texture2D(reflectionMap, uv + vec2(0.0, reflectionTexel.y * 2.5)).rgb * 0.15;
  r += texture2D(reflectionMap, uv - vec2(0.0, reflectionTexel.y * 2.5)).rgb * 0.15;
  vec3 v = normalize(cameraPosition - vReflWorld);
  float fresnel = 0.16 + 0.64 * pow(1.0 - clamp(v.y, 0.0, 1.0), 4.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, r, fresnel * reflectionStrength) + r * 0.08 * reflectionStrength;
}`);
    };
    material.customProgramCacheKey = () => 'floor-reflection';
    material.needsUpdate = true;
  }

  // Mirrored camera with an oblique near plane at the floor (as in three's Reflector).
  function update(camera) {
    if (!enabled) return;
    const cameraWorld = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    if (cameraWorld.y < height) return;
    rotation.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rotation).add(cameraWorld);
    view.subVectors(planePoint, cameraWorld).reflect(normal).negate().add(planePoint);
    const target3 = new THREE.Vector3().subVectors(planePoint, lookAt).reflect(normal).negate().add(planePoint);
    mirror.position.copy(view);
    mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    mirror.lookAt(target3);
    mirror.far = camera.far;
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    textureMatrix.multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Clip everything below the floor (+1 cm so the floor itself is not mirrored).
    const clipPlane = plane.clone();
    clipPlane.constant -= 0.01;
    clipPlane.applyMatrix4(mirror.matrixWorldInverse);
    clip.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
    const p = mirror.projectionMatrix;
    q.x = (Math.sign(clip.x) + p.elements[8]) / p.elements[0];
    q.y = (Math.sign(clip.y) + p.elements[9]) / p.elements[5];
    q.z = -1.0;
    q.w = (1.0 + p.elements[10]) / p.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    p.elements[2] = clip.x;
    p.elements[6] = clip.y;
    p.elements[10] = clip.z + 1.0;
    p.elements[14] = clip.w;

    // The floor is in the scene too: it must not sample the target being drawn.
    const previous = renderer.getRenderTarget();
    uniforms.reflectionMap.value = blank;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, mirror);
    renderer.setRenderTarget(previous);
    uniforms.reflectionMap.value = target.texture;
  }

  return {
    apply,
    update,
    setSize(width, height2) { target.setSize(Math.round(width * scale), Math.round(height2 * scale)); uniforms.reflectionTexel.value.set(1 / target.width, 1 / target.height); },
    set enabled(on) { enabled = on; uniforms.reflectionStrength.value = on ? strength : 0; },
    dispose() { target.dispose(); },
  };
}
