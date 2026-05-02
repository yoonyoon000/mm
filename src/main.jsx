import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw, Volume2, VolumeX, RefreshCw, Play } from 'lucide-react';
import './styles.css';

const STAGES = [
  { name: 'raw', range: [0, 15], line: 'soft little cloud', color: '#fff8ef' },
  { name: 'warm', range: [16, 35], line: 'getting sleepy', color: '#fff0cf' },
  { name: 'golden', range: [36, 60], line: 'tiny gold glow', color: '#ffd978' },
  { name: 'toasted', range: [61, 80], line: 'cozy freckles', color: '#c98b4f' },
  { name: 'burnt', range: [81, 95], line: 'crispy edges', color: '#4b281f' },
  { name: 'ash...', range: [96, 100], line: 'oops, moon rock', color: '#1a171a' },
];

const POPUPS = {
  close: 'too close!',
  perfect: 'perfect toast',
  burnt: 'oops burnt',
};

function getStage(level) {
  return STAGES.find((stage) => level >= stage.range[0] && level <= stage.range[1]) ?? STAGES[0];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createSpots(seed) {
  return Array.from({ length: 14 }, (_, index) => {
    const x = Math.sin(seed * 12.989 + index * 78.233) * 43758.5453;
    const y = Math.sin(seed * 4.913 + index * 31.17) * 24634.6345;
    const size = Math.sin(seed * 9.1 + index * 13.7) * 8.5;
    return {
      left: `${18 + (Math.abs(x) % 64)}%`,
      top: `${18 + (Math.abs(y) % 54)}%`,
      size: `${5 + (Math.abs(size) % 13)}px`,
      delay: `${index * -0.37}s`,
    };
  });
}

function useCampfireAudio(soundEnabled, isBurning, stageName) {
  const audioRef = useRef(null);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    noise.connect(filter);
    filter.connect(fireGain);
    fireGain.connect(master);
    noise.start();

    audioRef.current = { ctx, master, fireGain };
    return audioRef.current;
  }, []);

  const click = useCallback(() => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, audio.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(280, audio.ctx.currentTime + 0.055);
    gain.gain.setValueAtTime(0.06, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.08);
  }, [ensureAudio, soundEnabled]);

  const sizzle = useCallback(() => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 0.18, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.05;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  }, [ensureAudio, soundEnabled]);

  useEffect(() => {
    const audio = ensureAudio();
    if (!audio) return;
    const target = soundEnabled ? (isBurning ? 0.19 : 0.09) : 0;
    audio.fireGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.35);
    audio.master.gain.setTargetAtTime(stageName === 'ash...' ? 0.07 : 0.12, audio.ctx.currentTime, 0.4);
    if (soundEnabled) audio.ctx.resume();
  }, [ensureAudio, isBurning, soundEnabled, stageName]);

  return { ensureAudio, click, sizzle };
}

function App() {
  const [started, setStarted] = useState(false);
  const [toastLevel, setToastLevel] = useState(0);
  const [position, setPosition] = useState({ x: 51, y: 43 });
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [spotSeed, setSpotSeed] = useState(4);
  const [rotationTick, setRotationTick] = useState(0);
  const sceneRef = useRef(null);
  const dragRef = useRef(false);
  const levelRef = useRef(0);
  const popupCooldownRef = useRef(0);
  const lastSizzleRef = useRef(0);
  const stage = getStage(Math.round(toastLevel));
  const distance = Math.hypot(position.x - 50, position.y - 72);
  const heat = clamp(1 - distance / 42, 0, 1);
  const isBurning = heat > 0.08 && toastLevel < 100;
  const spots = useMemo(() => createSpots(spotSeed), [spotSeed]);
  const { ensureAudio, click, sizzle } = useCampfireAudio(soundEnabled, isBurning, stage.name);

  const showPopup = useCallback((message) => {
    const now = performance.now();
    if (now < popupCooldownRef.current) return;
    popupCooldownRef.current = now + 5200;
    setPopupMessage(message);
    window.setTimeout(() => setPopupMessage(''), 1500);
  }, []);

  const moveToPointer = useCallback((event) => {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextX = ((event.clientX - rect.left) / rect.width) * 100;
    const nextY = ((event.clientY - rect.top) / rect.height) * 100;
    setPosition({
      x: clamp(nextX, 13, 87),
      y: clamp(nextY, 14, 66),
    });
  }, []);

  const startDrag = useCallback((event) => {
    dragRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveToPointer(event);
  }, [moveToPointer]);

  const drag = useCallback((event) => {
    if (!dragRef.current) return;
    moveToPointer(event);
  }, [moveToPointer]);

  const stopDrag = useCallback(() => {
    dragRef.current = false;
  }, []);

  const reset = useCallback(() => {
    click();
    setToastLevel(0);
    levelRef.current = 0;
    setPosition({ x: 51, y: 43 });
    setPopupMessage('');
    setSpotSeed((seed) => seed + 1);
  }, [click]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => !enabled);
    window.setTimeout(() => {
      ensureAudio()?.ctx.resume();
    }, 0);
  }, [ensureAudio]);

  const enter = useCallback(() => {
    setStarted(true);
    click();
  }, [click]);

  useEffect(() => {
    levelRef.current = toastLevel;
  }, [toastLevel]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const currentDistance = Math.hypot(position.x - 50, position.y - 72);
      const currentHeat = clamp(1 - currentDistance / 42, 0, 1);
      const closeBoost = currentHeat > 0.72 ? 3.4 : 1;
      const sweetSpot = currentHeat > 0.35 && currentHeat < 0.62 ? 0.42 : 0;
      const rotateEase = autoRotate && currentHeat > 0.16 ? 0.8 : 1;
      const rate = (currentHeat ** 1.7 * 7.2 * closeBoost + sweetSpot) * rotateEase;
      if (rate > 0.02 && levelRef.current < 100) {
        const next = clamp(levelRef.current + rate * delta, 0, 100);
        const previousStage = getStage(Math.round(levelRef.current)).name;
        const nextStage = getStage(Math.round(next)).name;
        levelRef.current = next;
        setToastLevel(next);
        if (previousStage !== nextStage) {
          setSpotSeed((seed) => seed + 0.73);
          if (nextStage === 'golden') showPopup(POPUPS.perfect);
          if (nextStage === 'burnt') showPopup(POPUPS.burnt);
          if (nextStage === 'ash...') showPopup(POPUPS.burnt);
        }
      }
      if (currentHeat > 0.78 && levelRef.current < 96) showPopup(POPUPS.close);
      if (currentHeat > 0.78 && levelRef.current > 74 && now - lastSizzleRef.current > 1900) {
        lastSizzleRef.current = now;
        sizzle();
      }
      if (autoRotate) setRotationTick((tick) => tick + delta * 28);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, position, showPopup, sizzle]);

  const stageClass = stage.name.replace(/\W/g, '');
  const roastProgress = `${Math.round(toastLevel)}%`;
  const marshmallowStyle = {
    '--mallow-x': `${position.x}%`,
    '--mallow-y': `${position.y}%`,
    '--mallow-color': stage.color,
    '--roast-progress': roastProgress,
    '--spin': `${autoRotate ? rotationTick : heat * 3}deg`,
    '--squash': stage.name === 'ash...' ? 0.74 : 1,
  };

  if (!started) {
    return (
      <main className="page">
        <div className="stars" />
        <div className="cloud cloud-a" />
        <div className="cloud cloud-b" />
        <section className="phone-shell start-shell" aria-label="Start screen">
          <div className="window boot-window">
            <div className="titlebar">
              <span>MARSHMALLOW.exe</span>
              <div className="window-controls">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="boot-body">
              <div className="mini-popup">
                <div className="mini-title">toast wizard</div>
                <div className="mallow-icon">□</div>
              </div>
              <h1>MARSHMALLOW.exe</h1>
              <p>slowly toast your tiny marshmallow</p>
              <button className="pixel-button start-button" onClick={enter}>
                <Play size={16} />
                <span>Start</span>
              </button>
              <div className="loading-window">
                <span>loading cozy fire</span>
                <div className="load-track"><i /></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="stars" />
      <div className="cloud cloud-a" />
      <div className="cloud cloud-b" />
      <section className="phone-shell app-shell" aria-label="Marshmallow roasting toy">
        <div className="window app-window">
          <div className="titlebar">
            <span>MARSHMALLOW.exe</span>
            <div className="window-controls">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div
            className="scene"
            ref={sceneRef}
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <div className="moon" />
            <div className="pixel-stars star-one" />
            <div className="pixel-stars star-two" />
            {popupMessage && <div className="toast-popup">{popupMessage}</div>}
            <div className="stick" style={marshmallowStyle}>
              <div className={`marshmallow ${stageClass}`}>
                {spots.map((spot, index) => (
                  <i
                    key={`${spotSeed}-${index}`}
                    style={{
                      left: spot.left,
                      top: spot.top,
                      width: spot.size,
                      height: spot.size,
                      animationDelay: spot.delay,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="campfire" aria-hidden="true">
              <div className="log log-left" />
              <div className="log log-right" />
              <div className="flame flame-back" />
              <div className="flame flame-mid" />
              <div className="flame flame-front" />
              <div className="ember ember-a" />
              <div className="ember ember-b" />
            </div>
            <div className="ground" />
          </div>
          <div className="status-panel">
            <div className="readout">
              <span className="label">status</span>
              <strong>{stage.name}</strong>
              <small>{stage.line}</small>
            </div>
            <div className="meter" aria-label={`Toast level ${Math.round(toastLevel)} percent`}>
              <span style={{ width: roastProgress }} />
            </div>
            <div className="controls">
              <button className="pixel-button" onClick={reset}>
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
              <button className="pixel-button icon-toggle" onClick={toggleSound} aria-pressed={soundEnabled}>
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
              </button>
              <button
                className="pixel-button icon-toggle"
                onClick={() => {
                  click();
                  setAutoRotate((value) => !value);
                }}
                aria-pressed={autoRotate}
              >
                <RefreshCw size={16} />
                <span>{autoRotate ? 'Auto On' : 'Auto Off'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
