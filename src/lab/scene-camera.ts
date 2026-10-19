import { Box3, MathUtils, Vector3 } from 'three';

/** Fit every corner to both axes of the viewport, including narrow laptop panels. */
export function frameBounds(bounds: Box3, aspect: number, fov: number, direction: Vector3, padding = 1.18) {
  const target = bounds.getCenter(new Vector3());
  const backward = direction.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), backward).normalize();
  const up = new Vector3().crossVectors(backward, right).normalize();
  const tanV = Math.tan(MathUtils.degToRad(fov / 2));
  const tanH = tanV * Math.max(.1, aspect);
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const offset = new Vector3(x, y, z).sub(target);
    distance = Math.max(distance, offset.dot(backward) + padding * Math.max(Math.abs(offset.dot(right)) / tanH, Math.abs(offset.dot(up)) / tanV));
  }
  return { target, position: target.clone().addScaledVector(backward, Math.max(distance, 2.5)) };
}
