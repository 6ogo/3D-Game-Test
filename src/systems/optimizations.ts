import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Enemy } from "../types/game";

/**
 * Optimized Frustum Culling Hook
 *
 * Only renders objects within the camera's view frustum
 */
export function useFrustumCulling(
  ref: React.MutableRefObject<THREE.Object3D | null>,
  boundingSize = 1
) {
  const { camera } = useThree();
  const frustum = new THREE.Frustum();
  const cameraViewProjectionMatrix = new THREE.Matrix4();
  const bounds = new THREE.Sphere(new THREE.Vector3(), boundingSize);

  useFrame(() => {
    if (!ref.current) return;

    // Update bounds center to object position
    ref.current.getWorldPosition(bounds.center);

    // Update frustum
    cameraViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

    // Set object visibility based on frustum test
    ref.current.visible = frustum.intersectsSphere(bounds);
  });
}

/**
 * Level of Detail Hook
 *
 * Changes mesh detail based on distance from camera
 */
export function useLOD(
  ref: React.MutableRefObject<THREE.Mesh | null>,
  {
    highDetailDistance = 10,
    mediumDetailDistance = 25,
    highDetailGeometry,
    mediumDetailGeometry,
    lowDetailGeometry,
  }: {
    highDetailDistance?: number;
    mediumDetailDistance?: number;
    highDetailGeometry: THREE.BufferGeometry;
    mediumDetailGeometry: THREE.BufferGeometry;
    lowDetailGeometry: THREE.BufferGeometry;
  }
) {
  const { camera } = useThree();
  const currentLOD = useRef("high");

  useFrame(() => {
    if (!ref.current || !ref.current.position) return;

    const distance = camera.position.distanceTo(ref.current.position);

    // Switch geometry based on distance
    if (distance <= highDetailDistance && currentLOD.current !== "high") {
      ref.current.geometry = highDetailGeometry;
      currentLOD.current = "high";
    } else if (
      distance > highDetailDistance &&
      distance <= mediumDetailDistance &&
      currentLOD.current !== "medium"
    ) {
      ref.current.geometry = mediumDetailGeometry;
      currentLOD.current = "medium";
    } else if (
      distance > mediumDetailDistance &&
      currentLOD.current !== "low"
    ) {
      ref.current.geometry = lowDetailGeometry;
      currentLOD.current = "low";
    }
  });
}
/**
 * Efficiently manages enemy instances to avoid performance issues
 * with too many enemies on screen at once
 */
export function useEnemyOptimization(enemies: Enemy[], maxActiveEnemies = 15) {
  // Track active enemies to limit rendering when too many are present
  const [activeEnemies, setActiveEnemies] = useState<string[]>([]);
  const { camera } = useThree();

  useEffect(() => {
    // Skip if no enemies
    if (!enemies || enemies.length === 0) {
      setActiveEnemies([]);
      return;
    }

    // If fewer enemies than max, activate all
    if (enemies.length <= maxActiveEnemies) {
      setActiveEnemies(enemies.map((e) => e.id));
      return;
    }

    // Otherwise, prioritize enemies:
    // 1. First, sort by distance to camera
    const cameraPosition = camera.position;
    const sortedEnemies = [...enemies].sort((a, b) => {
      const distA = new THREE.Vector3(
        a.position.x,
        a.position.y,
        a.position.z
      ).distanceTo(cameraPosition);
      const distB = new THREE.Vector3(
        b.position.x,
        b.position.y,
        b.position.z
      ).distanceTo(cameraPosition);
      return distA - distB;
    });

    // 2. Always include boss enemies regardless of distance
    const bossIds = sortedEnemies
      .filter((e) => e.type === "Boss")
      .map((e) => e.id);

    // 3. Fill remaining slots with closest enemies
    const remainingSlots = maxActiveEnemies - bossIds.length;
    const closestIds = sortedEnemies
      .filter((e) => e.type !== "Boss")
      .slice(0, remainingSlots)
      .map((e) => e.id);

    // Combine and set active enemies
    setActiveEnemies([...bossIds, ...closestIds]);
  }, [enemies, camera.position, maxActiveEnemies]);

  return activeEnemies;
}
