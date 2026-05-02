import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import './styles.css';

const FACE_COUNT = 6;
const FACE_ANGLES = [0, 60, 120, 180, 240, 300];
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
  const color = new THREE.Color('#fff6e9');
  if (level < 16) return color;
  if (level < 36) return color.lerp(new THREE.Color('#ffe0a5'), (level - 16) / 20);
  if (level < 61) return new THREE.Color('#ffe0a5').lerp(new THREE.Color('#d58b42'), (level - 36) / 25);
  if (level < 81) return new THREE.Color('#d58b42').lerp(new THREE.Color('#744126'), (level - 61) / 20);
  if (level < 96) return new THREE.Color('#744126').lerp(new THREE.Color('#211410'), (level - 81) / 15);
  return new THREE.Color('#080808');
}

function seeded(index, salt) {
  return Math.abs(Math.sin(index * 37.21 + salt * 11.73) * 43758.5453) % 1;
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

function makeFacePanel(index) {
  const group = new THREE.Group();
  const faceAngle = THREE.MathUtils.degToRad(FACE_ANGLES[index]);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.86, 4, 4),
    new THREE.MeshStandardMaterial({
      color: '#fff6e9',
      roughness: 0.92,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  panel.position.set(Math.sin(faceAngle) * 0.47, 0, Math.cos(faceAngle) * 0.47);
  panel.rotation.y = faceAngle;
  group.add(panel);

  const spots = [];
  const spotGeometry = new THREE.CircleGeometry(1, 14);
  for (let i = 0; i < 9; i += 1) {
    const spot = new THREE.Mesh(
      spotGeometry,
      new THREE.MeshBasicMaterial({
        color: '#17100d',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const x = (seeded(i, index) - 0.5) * 0.62;
    const y = (seeded(i + 20, index) - 0.5) * 0.62;
    const scale = 0.025 + seeded(i + 40, index) * 0.07;
    spot.position.set(
      Math.sin(faceAngle) * 0.486 + Math.cos(faceAngle) * x,
      y,
      Math.cos(faceAngle) * 0.486 - Math.sin(faceAngle) * x,
    );
    spot.rotation.y = faceAngle;
    spot.scale.set(scale * 1.22, scale * 0.78, 1);
    spots.push(spot);
    group.add(spot);
  }

  return { group, panel, spots };
}

function ThreeRoaster({ faceRoasts, isEaten, turnSignal, onTurnDone }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const roastsRef = useRef(faceRoasts);
  const eatenRef = useRef(isEaten);
  const turnSignalRef = useRef(turnSignal);
  const onTurnDoneRef = useRef(onTurnDone);

  useEffect(() => {
    roastsRef.current = faceRoasts;
  }, [faceRoasts]);

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
    scene.fog = new THREE.FogExp2(0x070302, 0.18);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
    camera.position.set(0, 1.0, 4.35);
    camera.lookAt(0, -0.72, -0.85);

    const ambient = new THREE.AmbientLight(0x3a251b, 0.72);
    scene.add(ambient);
    const fireLight = new THREE.PointLight(0xff7b2d, 4.2, 8, 1.25);
    fireLight.position.set(0, -0.25, -1.28);
    scene.add(fireLight);
    const softLight = new THREE.PointLight(0xffc778, 1.35, 4, 2);
    softLight.position.set(0.6, 0.95, 1.25);
    scene.add(softLight);

    const fireVideo = document.createElement('video');
    fireVideo.src = './fire.mp4';
    fireVideo.muted = true;
    fireVideo.loop = true;
    fireVideo.playsInline = true;
    fireVideo.autoplay = true;
    fireVideo.play().catch(() => {});
    const fireTexture = new THREE.VideoTexture(fireVideo);
    fireTexture.colorSpace = THREE.SRGBColorSpace;
    const firePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 4.2),
      new THREE.MeshBasicMaterial({ map: fireTexture, transparent: true, opacity: 0.9 }),
    );
    firePlane.position.set(0, -0.22, -2.38);
    firePlane.scale.set(1.1, 1.1, 1);
    scene.add(firePlane);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 3.6),
      new THREE.MeshBasicMaterial({
        color: 0xff6328,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.set(0, -0.24, -2.28);
    scene.add(glow);

    const skewerGroup = new THREE.Group();
    scene.add(skewerGroup);

    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, 5.4, 18),
      new THREE.MeshStandardMaterial({
        color: '#8a5a32',
        roughness: 0.86,
        metalness: 0,
      }),
    );
    stick.rotation.x = Math.PI / 2;
    stick.position.set(0, -0.82, 1.08);
    stick.scale.set(1, 1, 1);
    skewerGroup.add(stick);

    const woodLines = [];
    for (let i = 0; i < 7; i += 1) {
      const line = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.004, 3.8, 6),
        new THREE.MeshBasicMaterial({ color: 0x2e170c }),
      );
      line.rotation.x = Math.PI / 2;
      line.position.set((i - 3) * 0.006, -0.82 + (i % 2) * 0.006, 1.2);
      woodLines.push(line);
      skewerGroup.add(line);
    }

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.24, 18),
      new THREE.MeshStandardMaterial({ color: '#6e4729', roughness: 0.78 }),
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, -0.82, -1.68);
    skewerGroup.add(tip);

    const mallowGroup = new THREE.Group();
    mallowGroup.position.set(0, -0.82, -1.32);
    mallowGroup.scale.set(1.06, 0.92, 0.9);
    skewerGroup.add(mallowGroup);

    const core = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 0.88, 0.92, 8, 0.22),
      new THREE.MeshStandardMaterial({
        color: '#fff4e7',
        roughness: 0.96,
        metalness: 0,
        emissive: '#3a1906',
        emissiveIntensity: 0.08,
      }),
    );
    mallowGroup.add(core);

    const panels = FACE_ANGLES.map((_, index) => makeFacePanel(index));
    panels.forEach(({ group }) => mallowGroup.add(group));

    const state = {
      renderer,
      scene,
      camera,
      skewerGroup,
      mallowGroup,
      core,
      panels,
      fireLight,
      softLight,
      fireTexture,
      fireVideo,
      turn: {
        active: false,
        start: 0,
        duration: 1300,
        from: 0,
        to: 0,
        current: 0,
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
      if (turn.active) {
        const t = clamp((now - turn.start) / turn.duration, 0, 1);
        turn.current = turn.from + (turn.to - turn.from) * easeOutCubic(t);
        if (t >= 1) {
          turn.active = false;
          onTurnDoneRef.current();
        }
      }

      const handNoise = Math.sin(elapsed * 1.7) * 0.008 + Math.sin(elapsed * 3.9) * 0.004;
      state.skewerGroup.rotation.set(
        -0.21 + Math.sin(elapsed * 2.2) * 0.01,
        turn.current + handNoise,
        Math.sin(elapsed * 1.3) * 0.012,
      );
      state.skewerGroup.position.set(Math.sin(elapsed * 1.8) * 0.012, Math.cos(elapsed * 1.2) * 0.01, 0);
      state.mallowGroup.scale.set(
        1.06 + Math.sin(elapsed * 2.8) * 0.012,
        0.92 + Math.cos(elapsed * 2.2) * 0.01,
        0.9 + Math.sin(elapsed * 2.5) * 0.012,
      );

      if (eatenRef.current) {
        state.mallowGroup.visible = false;
      } else {
        state.mallowGroup.visible = true;
      }

      const hottest = Math.max(...roastsRef.current);
      const avg = roastsRef.current.reduce((sum, value) => sum + value, 0) / roastsRef.current.length;
      state.core.material.color.copy(roastColor(avg * 0.8));
      state.core.material.emissiveIntensity = 0.07 + Math.sin(elapsed * 8) * 0.015;
      state.panels.forEach(({ panel, spots }, index) => {
        const roast = roastsRef.current[index];
        panel.material.color.copy(roastColor(roast));
        panel.material.opacity = roast > 15 ? 0.82 : 0.38;
        spots.forEach((spot, spotIndex) => {
          const visible = clamp((roast - 22 - spotIndex * 2) / 45, 0, 0.86);
          spot.material.opacity = visible;
          spot.material.color.set(roast > 82 ? '#030303' : roast > 58 ? '#24120d' : '#6b321a');
        });
      });

      state.fireLight.intensity = 3.7 + Math.sin(elapsed * 11) * 0.55 + Math.random() * 0.2;
      state.softLight.intensity = 1.1 + clamp(hottest / 100, 0, 1) * 0.5;
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
    state.turn.to = state.turn.current + Math.PI;
  }, [turnSignal]);

  return <canvas className="three-canvas" ref={canvasRef} aria-label="3D marshmallow roasting scene" />;
}

function App() {
  const [faceRoasts, setFaceRoasts] = useState(Array(FACE_COUNT).fill(0));
  const [isEaten, setIsEaten] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [turnSignal, setTurnSignal] = useState(0);
  const [isTurning, setIsTurning] = useState(false);
  const rotationRef = useRef(0);
  const directionRef = useRef(0);
  const faceRoastsRef = useRef(faceRoasts);
  const ambientAudioRef = useRef(null);
  const { ensureAudio, bite, whoosh } = useEffectAudio(soundEnabled);

  const toastLevel = useMemo(() => Math.round(faceRoasts.reduce((sum, value) => sum + value, 0) / FACE_COUNT), [faceRoasts]);
  const hottestFace = useMemo(() => Math.max(...faceRoasts), [faceRoasts]);
  const stage = getStage(Math.max(toastLevel, hottestFace));

  useEffect(() => {
    faceRoastsRef.current = faceRoasts;
  }, [faceRoasts]);

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
      if (isTurning) directionRef.current += (Math.PI / 1180) * delta * 1000;
      const degrees = THREE.MathUtils.radToDeg(directionRef.current);
      setFaceRoasts((current) => current.map((level, index) => {
        const facingFire = (FACE_ANGLES[index] + degrees + 360) % 360;
        const heatWeight = clamp(1 - angleDistance(facingFire, 180) / 105, 0.03, 1);
        const rate = (isTurning ? 2.1 : 3.6) * heatWeight + 0.08;
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
    setFaceRoasts(Array(FACE_COUNT).fill(0));
    faceRoastsRef.current = Array(FACE_COUNT).fill(0);
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
        faceRoasts={faceRoasts}
        isEaten={isEaten}
        turnSignal={turnSignal}
        onTurnDone={doneTurning}
      />

      <div className="status">
        <div>status: {stage.label}</div>
        <div>toast avg: {toastLevel}%</div>
        <div>hot side: {Math.round(hottestFace)}%</div>
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
