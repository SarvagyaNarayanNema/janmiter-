import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface RobotAssistant3DProps {
  state: RobotState;
  size?: 'mini' | 'header';
}

function createRobotContactShadow(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 58);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const RobotAssistant3D: React.FC<RobotAssistant3DProps> = ({
  state,
  size = 'mini',
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<RobotState>(state);
  stateRef.current = state;

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || (size === 'mini' ? 68 : 110);
    const height = container.clientHeight || (size === 'mini' ? 68 : 96);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.05, 3.35);
    camera.lookAt(0, 0.92, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 1.0);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(2.5, 3.5, 3);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xef4444, 1.6);
    rimLight.position.set(-2.5, 1.5, -2);
    scene.add(rimLight);

    // Composite 10-part 3D Rescue Robot ("Aegis SOS") pivoted at bottom-center y = 0
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const contactShadowTex = createRobotContactShadow();
    const shadowPlaneGeo = new THREE.PlaneGeometry(1.6, 1.6);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlane = new THREE.Mesh(
      shadowPlaneGeo,
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.45,
      })
    );
    shadowPlane.position.y = 0.01;
    rootGroup.add(shadowPlane);

    const robotGroup = new THREE.Group();
    robotGroup.position.set(0, 0.85, 0);
    rootGroup.add(robotGroup);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.22, 0);
    robotGroup.add(headGroup);

    // Part 1: Bevelled ExtrudeGeometry Brushed Titanium Head Helmet
    const helmetShape = new THREE.Shape();
    helmetShape.moveTo(-0.5, -0.36);
    helmetShape.lineTo(0.5, -0.36);
    helmetShape.lineTo(0.5, 0.36);
    helmetShape.lineTo(-0.5, 0.36);
    helmetShape.closePath();
    const helmetGeo = new THREE.ExtrudeGeometry(helmetShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    helmetGeo.translate(0, 0, -0.36);
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.24,
      metalness: 0.8,
    });
    const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
    headGroup.add(helmetMesh);

    // Part 2: Rescue Crimson Ear / Side Visor Acoustic Pods
    const trimGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.24, 16);
    trimGeo.rotateZ(Math.PI / 2);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.52,
      metalness: 0.45,
    });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    headGroup.add(trimMesh);

    // Part 3: Glossy Dark Optical Visor Faceplate
    const visorGeo = new THREE.BoxGeometry(0.94, 0.54, 0.08);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x090a0f,
      roughness: 0.1,
      metalness: 0.88,
      clearcoat: 1.0,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.03, 0.43);
    headGroup.add(visorMesh);

    // Part 4 & 5: Left & Right Cursor-Tracking LED Eyes
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(0, 0.08, 0.48);
    headGroup.add(eyeGroup);

    const eyeGeo = new THREE.SphereGeometry(0.095, 16, 16);
    eyeGeo.scale(1, 1.15, 0.35);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.22, 0, 0);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.22, 0, 0);
    eyeGroup.add(leftEye, rightEye);

    // Part 6: Voice Equalizer Mouth Bar (pulses when speaking)
    const mouthGeo = new THREE.BoxGeometry(0.36, 0.055, 0.04);
    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.1,
    });
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, -0.11, 0.48);
    headGroup.add(mouthMesh);

    // Part 7 & 8: LatheGeometry Emergency Beacon Dome & Antenna Stem
    const antennaStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.24, 12),
      helmetMat
    );
    antennaStem.position.set(0, 0.52, 0);
    headGroup.add(antennaStem);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const beaconProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.09, 0.02),
      new THREE.Vector2(0.08, 0.11),
      new THREE.Vector2(0, 0.15),
    ];
    const beaconBulb = new THREE.Mesh(
      new THREE.LatheGeometry(beaconProfile, 16),
      beaconMat
    );
    beaconBulb.position.set(0, 0.6, 0);
    headGroup.add(beaconBulb);

    // Part 9: LatheGeometry Tapered Torso Chassis
    const torsoProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.26, 0),
      new THREE.Vector2(0.38, 0.52),
      new THREE.Vector2(0, 0.52),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 20);
    const torsoMesh = new THREE.Mesh(torsoGeo, helmetMat);
    torsoMesh.position.set(0, -0.78, 0);
    robotGroup.add(torsoMesh);

    // Part 10: Thinking Halo Ring around Antenna
    const thinkRingGeo = new THREE.TorusGeometry(0.24, 0.018, 12, 32);
    const thinkRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.0,
    });
    const thinkRing = new THREE.Mesh(thinkRingGeo, thinkRingMat);
    thinkRing.rotation.x = Math.PI / 2;
    thinkRing.position.set(0, 0.66, 0);
    headGroup.add(thinkRing);

    let cursorX = 0;
    let cursorY = 0;
    const onPointerMove = (e: PointerEvent) => {
      cursorX = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      cursorY = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const s = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (s === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const nowMs = performance.now();
      const dt = Math.min((nowMs - prevTimeMs) * 0.001, 0.1);
      prevTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) * 0.001;
      const mode = stateRef.current;

      // Idle hover bob above ground contact shadow
      robotGroup.position.y = 0.85 + Math.sin(elapsed * 2.4) * 0.05;

      // Exponentially damped eye + head tracking toward cursor
      const targetHeadY = cursorX * 0.38;
      const targetHeadX = -cursorY * 0.22;
      headGroup.rotation.y = THREE.MathUtils.damp(
        headGroup.rotation.y,
        targetHeadY,
        6,
        dt
      );
      headGroup.rotation.x = THREE.MathUtils.damp(
        headGroup.rotation.x,
        targetHeadX,
        6,
        dt
      );
      eyeGroup.position.x = THREE.MathUtils.damp(
        eyeGroup.position.x,
        cursorX * 0.07,
        8,
        dt
      );
      eyeGroup.position.y = THREE.MathUtils.damp(
        eyeGroup.position.y,
        0.08 + cursorY * 0.04,
        8,
        dt
      );

      // State-specific animations (idle, listening, thinking, speaking)
      if (mode === 'speaking') {
        const pulse = 1 + Math.abs(Math.sin(elapsed * 16)) * 2.4;
        mouthMesh.scale.set(1.15, pulse, 1);
        mouthMat.color.setHex(0xef4444);
        mouthMat.emissive.setHex(0xef4444);
        beaconMat.emissiveIntensity = 1.0 + Math.sin(elapsed * 12) * 0.6;
        thinkRing.visible = false;
      } else if (mode === 'thinking') {
        mouthMesh.scale.set(0.6, 0.8, 1);
        eyeMat.color.setHex(0xf59e0b);
        eyeMat.emissive.setHex(0xf59e0b);
        thinkRing.visible = true;
        thinkRing.rotation.z = elapsed * 4.5;
        thinkRing.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.15);
      } else if (mode === 'listening') {
        mouthMesh.scale.set(0.9 + Math.sin(elapsed * 8) * 0.2, 1.3, 1);
        eyeMat.color.setHex(0x22c55e);
        eyeMat.emissive.setHex(0x22c55e);
        thinkRing.visible = true;
        thinkRing.scale.setScalar(1.1);
      } else {
        mouthMesh.scale.set(1, 0.7, 1);
        eyeMat.color.setHex(0x38bdf8);
        eyeMat.emissive.setHex(0x38bdf8);
        thinkRing.visible = false;
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      contactShadowTex.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      ref={canvasMountRef}
      data-testid={`robot-assistant-3d-${size}`}
      aria-hidden="true"
      className={size === 'mini' ? 'h-16 w-16' : 'h-24 w-28'}
    />
  );
};
