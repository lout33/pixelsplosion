import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame} = metaversefile;

const numSmokes = 100;
const numZs = 10;
const explosionCubeGeometry = new THREE.BoxBufferGeometry(0.05, 0.05, 0.05);
const explosionCubeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uAnimation: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: `\
    #define PI 3.1415926535897932384626433832795

    uniform float uAnimation;
    attribute float z;
    attribute float maxZ;
    attribute vec4 q;
    attribute vec4 phase;
    attribute float scale;
    varying float vZ;
    varying float vMaxZ;
    varying vec4 vPhase;

    vec3 applyQuaternion(vec3 v, vec4 q) {
      return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }
    float easeBezier(float p, vec4 curve) {
      float ip = 1.0 - p;
      return (3.0 * ip * ip * p * curve.xy + 3.0 * ip * p * p * curve.zw + p * p * p).y;
    }
    float ease(float p) {
      return easeBezier(p, vec4(0., 1., 0., 1.));
    }

    void main() {
      vZ = z;
      vMaxZ = maxZ;
      vPhase = phase;
      float forwardFactor = pow(uAnimation, 0.5);
      vec2 sideFactor = vec2(sin(uAnimation*PI*2.*phase.z), sin(uAnimation*PI*2.*phase.w));
      vec3 p = applyQuaternion(position * scale * (1.-z*maxZ) * (1.0-uAnimation) + vec3(0., 0., -pow(z*maxZ*forwardFactor, 0.5)), q) +
        vec3(uAnimation * sideFactor.x, uAnimation * sideFactor.y, 0.)*0.1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `\
    #define PI 3.1415926535897932384626433832795

    uniform float uAnimation;
    varying float vZ;
    varying float vMaxZ;
    varying vec4 vPhase;

    vec3 c = vec3(${new THREE.Color(0x9ccc65).toArray().join(', ')});
    vec3 s = vec3(${new THREE.Color(0x7e57c2).toArray().join(', ')});

    void main() {
      float factor = min(pow(vZ*vMaxZ, 0.2) + pow(uAnimation, 2.), 1.0);
      gl_FragColor = vec4(mix(c, s, factor) * (2.5 - pow(uAnimation, 0.2)) * 0.6 + vec3(0.03 * vPhase.x), 1.0);
    }
  `,
  // transparent: true,
});
const _makeExplosionMesh = () => {
  const numPositions = explosionCubeGeometry.attributes.position.array.length * numSmokes * numZs;
  const numIndices = explosionCubeGeometry.index.array.length * numSmokes * numZs;
  const arrayBuffer = new ArrayBuffer(
    numPositions * Float32Array.BYTES_PER_ELEMENT + // position
    numPositions/3 * Float32Array.BYTES_PER_ELEMENT + // z
    numPositions/3 * Float32Array.BYTES_PER_ELEMENT + // maxZ
    numPositions/3*4 * Float32Array.BYTES_PER_ELEMENT + // q
    numPositions/3*4 * Float32Array.BYTES_PER_ELEMENT + // phase
    numPositions/3 * Float32Array.BYTES_PER_ELEMENT + // scale
    numIndices * Int16Array.BYTES_PER_ELEMENT // index
  );
  let index = 0;
  const positions = new Float32Array(arrayBuffer, index, numPositions);
  index += numPositions*Float32Array.BYTES_PER_ELEMENT;
  const zs = new Float32Array(arrayBuffer, index, numPositions/3);
  index += numPositions/3*Float32Array.BYTES_PER_ELEMENT;
  const maxZs = new Float32Array(arrayBuffer, index, numPositions/3);
  index += numPositions/3*Float32Array.BYTES_PER_ELEMENT;
  const qs = new Float32Array(arrayBuffer, index, numPositions/3*4);
  index += numPositions/3*4*Float32Array.BYTES_PER_ELEMENT;
  const phases = new Float32Array(arrayBuffer, index, numPositions/3*4);
  index += numPositions/3*4*Float32Array.BYTES_PER_ELEMENT;
  const scales = new Float32Array(arrayBuffer, index, numPositions/3);
  index += numPositions/3*Float32Array.BYTES_PER_ELEMENT;
  const indices = new Uint16Array(arrayBuffer, index, numIndices);
  index += numIndices*Uint16Array.BYTES_PER_ELEMENT;

  const numPositionsPerSmoke = numPositions/numSmokes;
  const numPositionsPerZ = numPositionsPerSmoke/numZs;
  const numIndicesPerSmoke = numIndices/numSmokes;
  const numIndicesPerZ = numIndicesPerSmoke/numZs;

  for (let i = 0; i < numSmokes; i++) {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((-1+Math.random()*2)*Math.PI*2*0.05, (-1+Math.random()*2)*Math.PI*2*0.05, (-1+Math.random()*2)*Math.PI*2*0.05, 'YXZ')
    );
    for (let j = 0; j < numPositionsPerSmoke/3*4; j += 4) {
      q.toArray(qs, i*numPositionsPerSmoke/3*4 + j);
    }
    const maxZ = Math.random();
    for (let j = 0; j < numZs; j++) {
      positions.set(explosionCubeGeometry.attributes.position.array, i*numPositionsPerSmoke + j*numPositionsPerZ);
      const indexOffset = i*numPositionsPerSmoke/3 + j*numPositionsPerZ/3;
      for (let k = 0; k < numIndicesPerZ; k++) {
        indices[i*numIndicesPerSmoke + j*numIndicesPerZ + k] = explosionCubeGeometry.index.array[k] + indexOffset;
      }

      const z = j/numZs;
      for (let k = 0; k < numPositionsPerZ/3; k++) {
        zs[i*numPositionsPerSmoke/3 + j*numPositionsPerZ/3 + k] = z;
      }
      for (let k = 0; k < numPositionsPerZ/3; k++) {
        maxZs[i*numPositionsPerSmoke/3 + j*numPositionsPerZ/3 + k] = maxZ;
      }
      const phase = new THREE.Vector4(Math.random()*Math.PI*2, Math.random()*Math.PI*2, 0.1+Math.random()*0.2, 0.1+Math.random()*0.2);
      for (let k = 0; k < numPositionsPerZ/3*4; k += 4) {
        phase.toArray(phases, i*numPositionsPerSmoke/3*4 + j*numPositionsPerZ/3*4 + k);
      }
      const scale = 0.9 + Math.random()*0.2;
      for (let k = 0; k < numPositionsPerZ/3; k++) {
        scales[i*numPositionsPerSmoke/3*4 + j*numPositionsPerZ/3*4 + k] = scale;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('z', new THREE.BufferAttribute(zs, 1));
  geometry.setAttribute('maxZ', new THREE.BufferAttribute(maxZs, 1));
  geometry.setAttribute('q', new THREE.BufferAttribute(qs, 4));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 4));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const material = explosionCubeMaterial.clone();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.trigger = (position, quaternion) => {
    material.uniform.uAnimation = 0;
  };
  return mesh;
};

export default () => {
  const app = useApp();
  
  let explosionMeshes = [];
  const explosionRate = 2000;
  let timePassed = explosionRate;
  useFrame(({timeDiff}) => {
    timePassed += timeDiff;
    while (timePassed >= explosionRate) {
      const explosionMesh = _makeExplosionMesh();
      explosionMesh.position.set((-0.5+Math.random())*2, 0, (-0.5+Math.random())*2);
      app.add(explosionMesh);
      explosionMeshes.push(explosionMesh);
      timePassed -= explosionRate;
    }
    
    explosionMeshes = explosionMeshes.filter(explosionMesh => {
      explosionMesh.material.uniforms.uAnimation.value += timeDiff/1000;
      if (explosionMesh.material.uniforms.uAnimation.value < 1) {
        return true;
      } else {
        app.remove(explosionMesh);
        return false;
      }
    });
  });
  
  return app;
};