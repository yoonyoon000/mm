import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STAGES = [
  { key: 'raw', min: 0, max: 15, label: 'raw', bite: '차갑고 퍽퍽하다...' },
  { key: 'warm', min: 16, max: 35, label: 'warm', bite: '조금 따뜻하다.' },
  { key: 'golden', min: 36, max: 60, label: 'golden', bite: '완벽하게 달다.' },
  { key: 'toasted', min: 61, max: 80, label: 'toasted', bite: '겉은 바삭하고 속은 말랑하다.' },
  { key: 'burnt', min: 81, max: 95, label: 'burnt', bite: '탄 맛이 난다.' },
  { key: 'ash', min: 96, max: 100, label: 'ash', bite: '먹을 수 있는 게 아니다.' },
];

const FACE_COUNT = 6;
const FACE_ANGLES = Array.from({ length: FACE_COUNT }, (_, index) => index * 60);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStage(level) {
  return STAGES.find((stage) => level >= stage.min && level <= stage.max) ?? STAGES[0];
}

function angleDistance(a, b) {
  const diff = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return diff;
}

function faceColor(level) {
  if (level < 16) return '#fff7ea';
  if (level < 36) return '#ffe2a9';
  if (level < 61) return '#d9974c';
  if (level < 81) return '#8d502e';
  if (level < 96) return '#2f1b15';
  return '#0f0f0f';
}

function faceSpots(level, faceIndex) {
  const count = level < 24 ? 0 : level < 50 ? 4 : level < 82 ? 7 : 11;
  return Array.from({ length: count }, (_, index) => {
    const x = Math.abs(Math.sin(faceIndex * 19.4 + index * 33.7)) * 100;
    const y = Math.abs(Math.cos(faceIndex * 13.1 + index * 21.8)) * 100;
    const size = 6 + Math.abs(Math.sin(index * 5.9 + faceIndex)) * 14;
    return {
      left: `${15 + (x % 66)}%`,
      top: `${13 + (y % 68)}%`,
      width: `${size}px`,
      height: `${size * 0.74}px`,
      opacity: clamp((level - 22) / 55, 0, 0.9),
    };
  });
}

function tinyTone(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type === 'whoosh' ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(type === 'whoosh' ? 180 : 220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(type === 'whoosh' ? 860 : 120, ctx.currentTime + 0.16);
  gain.gain.setValueAtTime(type === 'whoosh' ? 0.035 : 0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.22);
}

function FireBackground() {
  return (
    <div className="background">
      <video className="fire-video" src="./fire.mp4" autoPlay muted loop playsInline />
      <div className="fire-overlay" />
    </div>
  );
}

function Marshmallow3D({ faceRoasts, spinAngle, isSpinningFast, isEaten }) {
  const stage = getStage(Math.max(...faceRoasts));
  const squash = stage.key === 'ash' ? 0.76 : 1;

  if (isEaten) return null;

  return (
    <div
      className={`mallow3d ${stage.key} ${isSpinningFast ? 'wobble' : ''}`}
      style={{ '--spin': `${spinAngle}deg`, '--squash': squash }}
    >
      <div className="mallow-core">
        {faceRoasts.map((level, index) => (
          <div
            className="mallow-face"
            key={index}
            style={{
              '--face-angle': `${FACE_ANGLES[index]}deg`,
              '--face-color': faceColor(level),
            }}
          >
            {faceSpots(level, index).map((spot, spotIndex) => (
              <i key={spotIndex} style={spot} />
            ))}
          </div>
        ))}
        <div className="mallow-cap top-cap" />
        <div className="mallow-cap bottom-cap" />
      </div>
    </div>
  );
}

function App() {
  const [faceRoasts, setFaceRoasts] = useState(Array(FACE_COUNT).fill(0));
  const [spinAngle, setSpinAngle] = useState(0);
  const [isEaten, setIsEaten] = useState(false);
  const [isSpinningFast, setIsSpinningFast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const audioRef = useRef(null);
  const fastTimerRef = useRef(0);
  const spinRef = useRef(0);

  const toastLevel = useMemo(() => {
    const sum = faceRoasts.reduce((total, level) => total + level, 0);
    return Math.round(sum / faceRoasts.length);
  }, [faceRoasts]);
  const hottestFace = useMemo(() => Math.max(...faceRoasts), [faceRoasts]);
  const stage = getStage(Math.max(toastLevel, hottestFace * 0.72));

  useEffect(() => {
    if (isEaten) return undefined;
    let frame = 0;
    let last = performance.now();

    const loop = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = isSpinningFast ? 300 : 34;

      spinRef.current = (spinRef.current + speed * delta) % 360;
      setSpinAngle(spinRef.current);
      setFaceRoasts((current) => current.map((level, index) => {
        const facingFire = (FACE_ANGLES[index] + spinRef.current + 360) % 360;
        const heatWeight = clamp(1 - angleDistance(facingFire, 180) / 120, 0.05, 1);
        const rate = (isSpinningFast ? 4.7 : 2.5) * heatWeight + 0.18;
        return clamp(level + rate * delta, 0, 100);
      }));

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [isEaten, isSpinningFast]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = soundEnabled ? 0.72 : 0;
    if (soundEnabled) {
      audioRef.current.play().catch(() => {
        setSoundEnabled(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [soundEnabled]);

  const eat = useCallback(() => {
    if (isEaten) return;
    tinyTone('eat');
    setIsEaten(true);
    setMessage(stage.bite);
  }, [isEaten, stage.bite]);

  const reset = useCallback(() => {
    setFaceRoasts(Array(FACE_COUNT).fill(0));
    setSpinAngle(0);
    spinRef.current = 0;
    setIsEaten(false);
    setIsSpinningFast(false);
    setMessage('');
    window.clearTimeout(fastTimerRef.current);
  }, []);

  const spinFast = useCallback(() => {
    if (isEaten) return;
    tinyTone('whoosh');
    setIsSpinningFast(true);
    setMessage('빠르게 돌리는 중...');
    window.clearTimeout(fastTimerRef.current);
    fastTimerRef.current = window.setTimeout(() => {
      setIsSpinningFast(false);
      setMessage('');
    }, 1800);
  }, [isEaten]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => !enabled);
  }, []);

  return (
    <main className="app">
      <FireBackground />
      <audio ref={audioRef} src="./campfire.mp3" loop preload="auto" />

      <div className="status">
        <div>status: {stage.label}</div>
        <div>toast: {toastLevel}%</div>
        <div>hot side: {Math.round(hottestFace)}%</div>
      </div>

      <section className={`roaster ${isEaten ? 'eaten' : ''}`}>
        <div className="stick" />
        <Marshmallow3D
          faceRoasts={faceRoasts}
          spinAngle={spinAngle}
          isSpinningFast={isSpinningFast}
          isEaten={isEaten}
        />
      </section>

      <div className="message">{message || ' '}</div>

      <div className="buttons">
        <button type="button" onClick={eat}>먹기</button>
        <button type="button" onClick={reset}>리셋</button>
        <button type="button" onClick={spinFast}>수동으로 돌리기</button>
        <button type="button" onClick={toggleSound}>소리 {soundEnabled ? 'OFF' : 'ON'}</button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
