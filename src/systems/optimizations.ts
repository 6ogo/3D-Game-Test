import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Optimized Frustum Culling Hook
 * 
 * Only renders objects within the camera's view frustum
 */
export function useFrustumCulling(ref: React.MutableRefObject<THREE.Object3D | null>, boundingSize = 1) {
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
    lowDetailGeometry
  }: {
    highDetailDistance?: number;
    mediumDetailDistance?: number;
    highDetailGeometry: THREE.BufferGeometry;
    mediumDetailGeometry: THREE.BufferGeometry;
    lowDetailGeometry: THREE.BufferGeometry;
  }
) {
  const { camera } = useThree();
  const currentLOD = useRef('high');
  
  useFrame(() => {
    if (!ref.current || !ref.current.position) return;
    
    const distance = camera.position.distanceTo(ref.current.position);
    
    // Switch geometry based on distance
    if (distance <= highDetailDistance && currentLOD.current !== 'high') {
      ref.current.geometry = highDetailGeometry;
      currentLOD.current = 'high';
    } else if (distance > highDetailDistance && distance <= mediumDetailDistance && currentLOD.current !== 'medium') {
      ref.current.geometry = mediumDetailGeometry;
      currentLOD.current = 'medium';
    } else if (distance > mediumDetailDistance && currentLOD.current !== 'low') {
      ref.current.geometry = lowDetailGeometry;
      currentLOD.current = 'low';
    }
  });
}