import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import './styles.css';

const SIDE_COUNT = 6;
const SIDE_ANGLES = [0, 60, 120, 180, 240, 300];
const AUTO_ROTATION_SPEED = 0.18;
const MANUAL_ROTATION_SPEED = 1.35;
const SIDE_HEAT_ANGLE = 90;
const LOCAL_Z = new THREE.Vector3(0, 0, 1);
const LOCAL_Y = new THREE.Vector3(0, 1, 0);
const MARSHMALLOW_CENTER = new THREE.Vector3(0.25, -0.45, 0);
const STAGES = [
  { key: 'raw', min: 0, max: 15, label: 'raw', bite: '차갑고 퍽퍽하다...' },
  { key: 'warm', min: 16, max: 35, label: 'warm', bite: '조금 따뜻하다.' },
  { key: 'golden', min: 36, max: 60, label: 'golden', bite: '완벽하게 달다.' },
  { key: 'toasted', min: 61, max: 80, label: 'toasted', bite: '겉은 바삭하고 속은 말랑하다.' },
  { key: 'burnt', min: 81, max: 95, label: 'burnt', bite: '탄 맛이 난다.' },
  { key: 'ash', min: 96, max: 100, label: 'ash', bite: '먹을 수 있는 게 아니다.' },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStage(level) {
  return STAGES.find((stage) => level >= stage.min && level <= stage.max) ?? STAGES[0];
}

function easeOutCubic(t) {
  return 1 - ((1 - t) ** 3);
}

function angleDistance(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

function roastColor(level) {
  const color = new THREE.Color('#fff3df');
  if (level < 16) return color;
  if (level < 36) return color.lerp(new THREE.Color('#ffe7bd'), (level - 16) / 20);
  if (level < 61) return new THREE.Color('#ffe7bd').lerp(new THREE.Color('#d89a45'), (level - 36) / 25);
  if (level < 81) return new THREE.Color('#d89a45').lerp(new THREE.Color('#8f5427'), (level - 61) / 20);
  if (level < 96) return new THREE.Color('#8f5427').lerp(new THREE.Color('#2b160c'), (level - 81) / 15);
  return new THREE.Color('#111111');
}

function makeMarshmallowGeometry() {
  const geometry = new THREE.CylinderGeometry(0.32, 0.32, 0.6, 32, 8, false);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const end = Math.abs(y) / 0.3;
    const roundedEdge = 1 - Math.pow(clamp(end, 0, 1), 4) * 0.08;
    const middlePuff = 1 + (1 - clamp(end, 0, 1)) * 0.018;
    const softUneven = 1 + Math.sin(Math.atan2(z, x) * 3 + y * 9) * 0.01;
    const radius = roundedEdge * middlePuff * softUneven;
    position.setXYZ(i, x * radius, y * 0.98, z * radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function useEffectAudio(soundEnabled) {
  const audioRef = useRef(null);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    audioRef.current = { ctx, master };
    return audioRef.current;
  }, []);

  const noisePop = useCallback((volume = 0.045, length = 0.05) => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    const buffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * length), audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650 + Math.random() * 1800;
    const gain = audio.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  }, [ensureAudio, soundEnabled]);

  const whoosh = useCallback(() => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    noisePop(0.08, 0.12);
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, audio.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, audio.ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.045, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.26);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.28);
  }, [ensureAudio, noisePop, soundEnabled]);

  const bite = useCallback(() => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, audio.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(95, audio.ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.07, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.2);
  }, [ensureAudio, soundEnabled]);

  return { ensureAudio, bite, whoosh };
}

function makeBurnMarks() {
  const markGeometry = new THREE.SphereGeometry(0.044, 14, 10);
  const markData = [
    { side: 0, along: 0.14, around: 0.03, size: 1.0 },
    { side: 0, along: -0.1, around: -0.08, size: 0.74 },
    { side: 1, along: 0.08, around: 0.04, size: 0.84 },
    { side: 2, along: -0.12, around: -0.02, size: 0.76 },
    { side: 3, along: 0.02, around: 0.08, size: 0.68 },
    { side: 4, along: 0.13, around: -0.04, size: 0.8 },
    { side: 5, along: -0.06, around: 0.05, size: 0.88 },
  ];

  return markData.map(({ side, along, around, size }) => {
    const angle = THREE.MathUtils.degToRad(SIDE_ANGLES[side]);
    const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const mark = new THREE.Mesh(
      markGeometry,
      new THREE.MeshStandardMaterial({
        color: '#9a5a25',
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity: 0,
      }),
    );
    mark.position.copy(
      normal.clone().multiplyScalar(0.326)
        .add(tangent.clone().multiplyScalar(around))
        .add(LOCAL_Y.clone().multiplyScalar(along)),
    );
    mark.quaternion.setFromUnitVectors(LOCAL_Z, normal);
    mark.scale.set(size * 1.0, size * 0.72, 0.12);
    return { mark, side };
  });
}

function ThreeRoaster({ sideRoasts, isEaten, turnSignal, onTurnDone }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const roastsRef = useRef(sideRoasts);
  const eatenRef = useRef(isEaten);
  const turnSignalRef = useRef(turnSignal);
  const onTurnDoneRef = useRef(onTurnDone);

  useEffect(() => {
    roastsRef.current = sideRoasts;
  }, [sideRoasts]);

  useEffect(() => {
    eatenRef.current = isEaten;
  }, [isEaten]);

  useEffect(() => {
    onTurnDoneRef.current = onTurnDone;
  }, [onTurnDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x050302, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070302, 0.1);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    camera.position.set(0.75, 0.38, 4.2);
    camera.lookAt(0.18, -0.32, 0);

    scene.add(new THREE.AmbientLight(0xfff4e6, 0.72));
    const fireLight = new THREE.PointLight(0xff7a00, 3.2, 7, 1.4);
    fireLight.position.set(0.2, -0.52, -1.7);
    scene.add(fireLight);
    const fillLight = new THREE.DirectionalLight(0xfffff2, 1.25);
    fillLight.position.set(2, 1.5, 3.2);
    scene.add(fillLight);
    const fillPoint = new THREE.PointLight(0xfff0d9, 1.4, 4, 2);
    fillPoint.position.set(0.8, 0.2, 2.1);
    scene.add(fillPoint);

    const fireVideo = document.createElement('video');
    fireVideo.src = './fire.mp4';
    fireVideo.muted = true;
    fireVideo.loop = true;
    fireVideo.playsInline = true;
    fireVideo.autoplay = true;
    fireVideo.play().catch(() => {});
    const fireTexture = new THREE.VideoTexture(fireVideo);
    fireTexture.colorSpace = THREE.SRGBColorSpace;
    const fireSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: fireTexture, transparent: true, opacity: 0.9 }),
    );
    fireSprite.position.set(0.08, -0.22, -4.25);
    fireSprite.scale.set(9.9, 7.0, 1);
    scene.add(fireSprite);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xff6328,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.set(0.08, -0.24, -4.05);
    scene.add(glow);

    const skewerStart = new THREE.Vector3(-0.62, -1.02, 1.28);
    const skewerAxis = new THREE.Vector3().subVectors(MARSHMALLOW_CENTER, skewerStart).normalize();
    const skewerEnd = MARSHMALLOW_CENTER.clone().add(skewerAxis.clone().multiplyScalar(1.08));
    const skewerDirection = new THREE.Vector3().subVectors(skewerEnd, skewerStart);
    const skewerLength = skewerDirection.length();
    const skewerCenter = new THREE.Vector3().addVectors(skewerStart, skewerDirection.clone().multiplyScalar(0.5));
    const skewerQuaternion = new THREE.Quaternion().setFromUnitVectors(LOCAL_Y, skewerAxis);
    const mallowBaseQuaternion = new THREE.Quaternion().setFromUnitVectors(LOCAL_Y, skewerAxis);

    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, skewerLength, 18),
      new THREE.MeshStandardMaterial({
        color: '#c99058',
        roughness: 0.76,
        metalness: 0,
      }),
    );
    stick.position.copy(skewerCenter);
    stick.quaternion.copy(skewerQuaternion);
    scene.add(stick);

    for (let i = 0; i < 7; i += 1) {
      const line = new THREE.Mesh(
        new THREE.CylinderGeometry(0.002, 0.003, skewerLength * 0.66, 6),
        new THREE.MeshStandardMaterial({ color: '#2e170c', roughness: 0.85, metalness: 0 }),
      );
      line.position.copy(skewerCenter)
        .add(new THREE.Vector3(0.004 * (i - 3), 0.003 * (i % 2), 0));
      line.quaternion.copy(skewerQuaternion);
      scene.add(line);
    }

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.18, 18),
      new THREE.MeshStandardMaterial({ color: '#9f6738', roughness: 0.78, metalness: 0 }),
    );
    tip.position.copy(skewerEnd.clone().add(skewerAxis.clone().multiplyScalar(-0.08)));
    tip.quaternion.copy(skewerQuaternion);
    scene.add(tip);

    const mallowPivot = new THREE.Group();
    mallowPivot.position.copy(MARSHMALLOW_CENTER);
    mallowPivot.quaternion.copy(mallowBaseQuaternion);
    mallowPivot.scale.set(0.96, 1.0, 0.98);
    scene.add(mallowPivot);

    const core = new THREE.Mesh(
      makeMarshmallowGeometry(),
      new THREE.MeshStandardMaterial({
        color: '#fff3df',
        roughness: 0.9,
        metalness: 0,
        emissive: '#2a1206',
        emissiveIntensity: 0.05,
      }),
    );
    mallowPivot.add(core);

    const marks = makeBurnMarks();
    marks.forEach(({ mark }) => mallowPivot.add(mark));

    const state = {
      renderer,
      scene,
      camera,
      mallowPivot,
      mallowBaseQuaternion,
      core,
      marks,
      fireLight,
      fillPoint,
      fireTexture,
      fireVideo,
      turn: {
        active: false,
        start: 0,
        duration: 1300,
        from: 0,
        to: 0,
        current: 0,
        auto: 0,
      },
      clock: new THREE.Clock(),
    };
    sceneRef.current = state;

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    const render = (now) => {
      const elapsed = now / 1000;
      const delta = state.clock.getDelta();
      const turn = state.turn;
      turn.auto = (turn.auto + AUTO_ROTATION_SPEED * delta) % (Math.PI * 2);
      if (turn.active) {
        const t = clamp((now - turn.start) / turn.duration, 0, 1);
        turn.current = turn.from + (turn.to - turn.from) * easeOutCubic(t);
        if (t >= 1) {
          turn.active = false;
          onTurnDoneRef.current();
        }
      }

      const handNoise = Math.sin(elapsed * 1.7) * 0.008 + Math.sin(elapsed * 3.9) * 0.004;
      const axialRotation = new THREE.Quaternion().setFromAxisAngle(LOCAL_Y, turn.auto + turn.current + handNoise);
      state.mallowPivot.quaternion.copy(state.mallowBaseQuaternion).multiply(axialRotation);
      state.mallowPivot.scale.set(
        0.96 + Math.sin(elapsed * 2.8) * 0.006,
        1.0 + Math.cos(elapsed * 2.2) * 0.005,
        0.98 + Math.sin(elapsed * 2.5) * 0.006,
      );

      if (eatenRef.current) {
        state.mallowPivot.visible = false;
      } else {
        state.mallowPivot.visible = true;
      }

      const hottest = Math.max(...roastsRef.current);
      const avg = roastsRef.current.reduce((sum, value) => sum + value, 0) / roastsRef.current.length;
      state.core.material.color.copy(roastColor(avg * 0.52));
      state.core.material.emissiveIntensity = 0.05 + Math.sin(elapsed * 8) * 0.01;
      state.marks.forEach(({ mark, side }) => {
        const roast = roastsRef.current[side];
        mark.material.opacity = clamp((roast - 8) / 34, 0, 0.94);
        mark.material.color.set(roast > 52 ? '#2a1208' : '#5e2d16');
      });

      state.fireLight.intensity = 3.0 + Math.sin(elapsed * 11) * 0.55 + Math.random() * 0.2;
      state.fillPoint.intensity = 1.1 + Math.sin(elapsed * 5) * 0.08;
      state.fireTexture.needsUpdate = true;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      fireVideo.pause();
      fireTexture.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || turnSignal === turnSignalRef.current) return;
    turnSignalRef.current = turnSignal;
    state.turn.active = true;
    state.turn.start = performance.now();
    state.turn.duration = 1180;
    state.turn.from = state.turn.current;
    state.turn.to = state.turn.current + Math.PI * 2;
  }, [turnSignal]);

  return <canvas className="three-canvas" ref={canvasRef} aria-label="3D marshmallow roasting scene" />;
}

function App() {
  const [sideRoasts, setSideRoasts] = useState(Array(SIDE_COUNT).fill(0));
  const [isEaten, setIsEaten] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [turnSignal, setTurnSignal] = useState(0);
  const [isTurning, setIsTurning] = useState(false);
  const rotationRef = useRef(0);
  const directionRef = useRef(0);
  const sideRoastsRef = useRef(sideRoasts);
  const ambientAudioRef = useRef(null);
  const { ensureAudio, bite, whoosh } = useEffectAudio(soundEnabled);

  const toastLevel = useMemo(() => Math.round(sideRoasts.reduce((sum, value) => sum + value, 0) / SIDE_COUNT), [sideRoasts]);
  const hottestSide = useMemo(() => Math.max(...sideRoasts), [sideRoasts]);
  const stage = getStage(Math.max(toastLevel, hottestSide));

  useEffect(() => {
    sideRoastsRef.current = sideRoasts;
  }, [sideRoasts]);

  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio) return;
    audio.volume = soundEnabled ? 0.82 : 0;
    if (soundEnabled) {
      audio.play().catch(() => setSoundEnabled(false));
    } else {
      audio.pause();
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (isEaten) return undefined;
    let frame = 0;
    let last = performance.now();
    const loop = (now) => {
      const delta = Math.min(0.08, (now - last) / 1000);
      last = now;
      directionRef.current += (AUTO_ROTATION_SPEED + (isTurning ? MANUAL_ROTATION_SPEED : 0)) * delta;
      const degrees = THREE.MathUtils.radToDeg(directionRef.current);
      setSideRoasts((current) => current.map((level, index) => {
        const sideAngle = (SIDE_ANGLES[index] + degrees + 360) % 360;
        const heatWeight = clamp(1 - angleDistance(sideAngle, SIDE_HEAT_ANGLE) / 105, 0.03, 1);
        const rate = (isTurning ? 2.4 : 3.7) * heatWeight + 0.08;
        return clamp(level + rate * delta, 0, 100);
      }));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [isEaten, isTurning]);

  const eat = useCallback(() => {
    if (isEaten) return;
    bite();
    setIsEaten(true);
    setMessage(stage.bite);
  }, [bite, isEaten, stage.bite]);

  const reset = useCallback(() => {
    setSideRoasts(Array(SIDE_COUNT).fill(0));
    sideRoastsRef.current = Array(SIDE_COUNT).fill(0);
    rotationRef.current = 0;
    directionRef.current = 0;
    setIsTurning(false);
    setIsEaten(false);
    setMessage('');
  }, []);

  const turnStick = useCallback(() => {
    if (isEaten || isTurning) return;
    whoosh();
    setMessage('꼬치를 돌렸다.');
    rotationRef.current += 1;
    setTurnSignal(rotationRef.current);
    setIsTurning(true);
  }, [isEaten, isTurning, whoosh]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => !enabled);
    window.setTimeout(() => ensureAudio()?.ctx.resume(), 0);
  }, [ensureAudio]);

  const doneTurning = useCallback(() => {
    setIsTurning(false);
    setMessage('');
  }, []);

  return (
    <main className="app">
      <audio ref={ambientAudioRef} src="./campfire.mp3" loop preload="auto" />
      <ThreeRoaster
        sideRoasts={sideRoasts}
        isEaten={isEaten}
        turnSignal={turnSignal}
        onTurnDone={doneTurning}
      />

      <div className="status">
        <div>status: {stage.label}</div>
        <div>toast avg: {toastLevel}%</div>
        <div>hot side: {Math.round(hottestSide)}%</div>
      </div>

      <div className="message">{message || ' '}</div>

      <div className="buttons">
        <button type="button" onClick={eat}>먹기</button>
        <button type="button" onClick={reset}>리셋</button>
        <button type="button" onClick={turnStick} disabled={isTurning}>수동으로 돌리기</button>
        <button type="button" onClick={toggleSound}>소리 {soundEnabled ? 'OFF' : 'ON'}</button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
