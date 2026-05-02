import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw, Volume2, VolumeX, RefreshCw, Play, Plus, Utensils, Flame } from 'lucide-react';
import './styles.css';

const STAGES = [
  { name: 'raw', label: '생마시멜로우', range: [0, 15], line: '아직 폭신폭신해요', color: '#fff8ef' },
  { name: 'warm', label: '따끈함', range: [16, 35], line: '조금 말랑해졌어요', color: '#fff0cf' },
  { name: 'golden', label: '노릇노릇', range: [36, 60], line: '지금 딱 좋아요', color: '#ffd978' },
  { name: 'toasted', label: '바삭달콤', range: [61, 80], line: '갈색 점이 귀여워요', color: '#c98b4f' },
  { name: 'burnt', label: '탔어요', range: [81, 95], line: '치익... 조심해요', color: '#4b281f' },
  { name: 'ash...', label: '재가 됨...', range: [96, 100], line: '까만 달 조각 같아요', color: '#1a171a' },
];

const POPUPS = {
  close: '너무 가까워!',
  perfect: '완벽한 노릇함',
  burnt: '앗 탔다',
  eat: '냠',
  focus: '불멍 모드',
  add: '하나 더 꽂기',
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

function newMallow(id, x = 51, y = 44) {
  return {
    id,
    toastLevel: 0,
    x,
    y,
    seed: 4 + id * 1.87,
    eaten: false,
  };
}

function getSkewerGeometry(mallow) {
  const anchorX = mallow.x > 58 ? 106 : mallow.x < 42 ? -6 : 50;
  const anchorY = 95;
  const dx = mallow.x - anchorX;
  const dy = mallow.y - anchorY;
  return {
    anchorX,
    anchorY,
    length: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx) * (180 / Math.PI),
  };
}

function useCampfireAudio(soundEnabled, fireIntensity, crackleEnergy) {
  const audioRef = useRef(null);
  const crackleTimerRef = useRef(0);

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
      data[i] = (Math.random() * 2 - 1) * 0.48;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 470;
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

  const pop = useCallback((volume = 0.05) => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    const buffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.045), audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + Math.random() * 900;
    const gain = audio.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
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
    filter.frequency.value = 1500;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.045;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  }, [ensureAudio, soundEnabled]);

  useEffect(() => {
    const audio = ensureAudio();
    if (!audio) return;
    const target = soundEnabled ? 0.08 + fireIntensity * 0.14 : 0;
    audio.fireGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.35);
    if (soundEnabled) audio.ctx.resume();
  }, [ensureAudio, fireIntensity, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) return undefined;
    let live = true;
    const crackle = () => {
      if (!live) return;
      pop(0.018 + crackleEnergy * 0.05);
      const delay = 190 + Math.random() * (620 - crackleEnergy * 260);
      crackleTimerRef.current = window.setTimeout(crackle, delay);
    };
    crackleTimerRef.current = window.setTimeout(crackle, 250);
    return () => {
      live = false;
      window.clearTimeout(crackleTimerRef.current);
    };
  }, [crackleEnergy, pop, soundEnabled]);

  return { ensureAudio, click, pop, sizzle };
}

function Mallow({ mallow, active, autoRotate, rotationTick, onPointerDown }) {
  const stage = getStage(Math.round(mallow.toastLevel));
  const stageClass = stage.name.replace(/\W/g, '');
  const heat = clamp(1 - Math.hypot(mallow.x - 50, mallow.y - 72) / 42, 0, 1);
  const spots = useMemo(() => createSpots(mallow.seed), [mallow.seed]);
  const geometry = getSkewerGeometry(mallow);
  const style = {
    '--mallow-x': `${mallow.x}%`,
    '--mallow-y': `${mallow.y}%`,
    '--anchor-x': `${geometry.anchorX}%`,
    '--anchor-y': `${geometry.anchorY}%`,
    '--stick-length': `${geometry.length}%`,
    '--stick-angle': `${geometry.angle}deg`,
    '--mallow-color': stage.color,
    '--spin': `${autoRotate ? rotationTick + mallow.id * 18 : heat * 4}deg`,
    '--squash': stage.name === 'ash...' ? 0.74 : 1,
  };

  return (
    <div className={`stick ${active ? 'active-stick' : ''}`} style={style}>
      <div className="skewer-line" />
      <button className={`marshmallow ${stageClass}`} onPointerDown={(event) => onPointerDown(event, mallow.id)} aria-label={`${stage.label} 마시멜로우`}>
        {spots.map((spot, index) => (
          <i
            key={`${mallow.seed}-${index}`}
            style={{
              left: spot.left,
              top: spot.top,
              width: spot.size,
              height: spot.size,
              animationDelay: spot.delay,
            }}
          />
        ))}
      </button>
    </div>
  );
}

function App() {
  const [started, setStarted] = useState(false);
  const [mallows, setMallows] = useState([newMallow(1)]);
  const [activeId, setActiveId] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [rotationTick, setRotationTick] = useState(0);
  const sceneRef = useRef(null);
  const dragRef = useRef(false);
  const mallowsRef = useRef(mallows);
  const popupCooldownRef = useRef(0);
  const lastSizzleRef = useRef(0);
  const activeMallow = mallows.find((mallow) => mallow.id === activeId) ?? mallows[0];
  const stage = activeMallow ? getStage(Math.round(activeMallow.toastLevel)) : STAGES[0];
  const activeHeat = activeMallow ? clamp(1 - Math.hypot(activeMallow.x - 50, activeMallow.y - 72) / 42, 0, 1) : 0;
  const fireIntensity = mallows.reduce((max, mallow) => Math.max(max, clamp(1 - Math.hypot(mallow.x - 50, mallow.y - 72) / 42, 0, 1)), 0);
  const crackleEnergy = clamp(0.35 + fireIntensity * 0.65 + (focusMode ? 0.22 : 0), 0, 1);
  const { ensureAudio, click, pop, sizzle } = useCampfireAudio(soundEnabled, fireIntensity, crackleEnergy);

  useEffect(() => {
    mallowsRef.current = mallows;
  }, [mallows]);

  const showPopup = useCallback((message, force = false) => {
    const now = performance.now();
    if (!force && now < popupCooldownRef.current) return;
    popupCooldownRef.current = now + 4300;
    setPopupMessage(message);
    window.setTimeout(() => setPopupMessage(''), 1450);
  }, []);

  const moveActiveToPointer = useCallback((event) => {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect || focusMode) return;
    const nextX = ((event.clientX - rect.left) / rect.width) * 100;
    const nextY = ((event.clientY - rect.top) / rect.height) * 100;
    setMallows((current) => current.map((mallow) => (
      mallow.id === activeId
        ? { ...mallow, x: clamp(nextX, 11, 89), y: clamp(nextY, 14, 69) }
        : mallow
    )));
  }, [activeId, focusMode]);

  const startDrag = useCallback((event, id = activeId) => {
    event.stopPropagation();
    if (focusMode) return;
    const rect = sceneRef.current?.getBoundingClientRect();
    dragRef.current = true;
    setActiveId(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (!rect) return;
    const nextX = ((event.clientX - rect.left) / rect.width) * 100;
    const nextY = ((event.clientY - rect.top) / rect.height) * 100;
    setMallows((current) => current.map((mallow) => (
      mallow.id === id
        ? { ...mallow, x: clamp(nextX, 11, 89), y: clamp(nextY, 14, 69) }
        : mallow
    )));
  }, [activeId, focusMode]);

  const drag = useCallback((event) => {
    if (!dragRef.current) return;
    moveActiveToPointer(event);
  }, [moveActiveToPointer]);

  const stopDrag = useCallback(() => {
    dragRef.current = false;
  }, []);

  const reset = useCallback(() => {
    click();
    setMallows([newMallow(1)]);
    setActiveId(1);
    setFocusMode(false);
    setPopupMessage('');
  }, [click]);

  const addMallow = useCallback(() => {
    click();
    setMallows((current) => {
      if (current.length >= 4) {
        showPopup('꼬치는 4개까지', true);
        return current;
      }
      const id = Math.max(...current.map((mallow) => mallow.id), 0) + 1;
      const x = 34 + current.length * 13;
      const y = 43 + (current.length % 2) * 8;
      setActiveId(id);
      showPopup(POPUPS.add, true);
      return [...current, newMallow(id, x, y)];
    });
  }, [click, showPopup]);

  const eatMallow = useCallback(() => {
    if (!activeMallow) return;
    click();
    pop(0.075);
    showPopup(POPUPS.eat, true);
    setMallows((current) => {
      const next = current.filter((mallow) => mallow.id !== activeId);
      if (next.length === 0) {
        const fresh = newMallow(1);
        setActiveId(1);
        return [fresh];
      }
      setActiveId(next[0].id);
      return next;
    });
  }, [activeId, activeMallow, click, pop, showPopup]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => !enabled);
    window.setTimeout(() => {
      ensureAudio()?.ctx.resume();
    }, 0);
  }, [ensureAudio]);

  const toggleFocus = useCallback(() => {
    click();
    setFocusMode((value) => {
      const next = !value;
      if (next) showPopup(POPUPS.focus, true);
      return next;
    });
  }, [click, showPopup]);

  const enter = useCallback(() => {
    setStarted(true);
    click();
  }, [click]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      setMallows((current) => current.map((mallow) => {
        const currentHeat = clamp(1 - Math.hypot(mallow.x - 50, mallow.y - 72) / 42, 0, 1);
        const closeBoost = currentHeat > 0.72 ? 3.5 : 1;
        const sweetSpot = currentHeat > 0.35 && currentHeat < 0.62 ? 0.42 : 0;
        const rotateEase = autoRotate && currentHeat > 0.16 ? 0.8 : 1;
        const focusEase = focusMode ? 0.55 : 1;
        const rate = (currentHeat ** 1.7 * 7.1 * closeBoost + sweetSpot) * rotateEase * focusEase;
        if (rate <= 0.02 || mallow.toastLevel >= 100) return mallow;
        const previousStage = getStage(Math.round(mallow.toastLevel)).name;
        const nextLevel = clamp(mallow.toastLevel + rate * delta, 0, 100);
        const nextStage = getStage(Math.round(nextLevel)).name;
        if (previousStage !== nextStage) {
          if (mallow.id === activeId && nextStage === 'golden') showPopup(POPUPS.perfect);
          if (mallow.id === activeId && (nextStage === 'burnt' || nextStage === 'ash...')) showPopup(POPUPS.burnt);
        }
        return {
          ...mallow,
          toastLevel: nextLevel,
          seed: previousStage !== nextStage ? mallow.seed + 0.73 : mallow.seed,
        };
      }));
      const active = mallowsRef.current.find((mallow) => mallow.id === activeId);
      if (active) {
        const currentHeat = clamp(1 - Math.hypot(active.x - 50, active.y - 72) / 42, 0, 1);
        if (currentHeat > 0.78 && active.toastLevel < 96) showPopup(POPUPS.close);
        if (currentHeat > 0.78 && active.toastLevel > 74 && now - lastSizzleRef.current > 1900) {
          lastSizzleRef.current = now;
          sizzle();
        }
      }
      if (autoRotate) setRotationTick((tick) => tick + delta * 28);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [activeId, autoRotate, focusMode, showPopup, sizzle]);

  const roastProgress = `${Math.round(activeMallow?.toastLevel ?? 0)}%`;

  if (!started) {
    return (
      <main className="page">
        <div className="stars" />
        <div className="cloud cloud-a" />
        <div className="cloud cloud-b" />
        <section className="phone-shell start-shell" aria-label="Start screen">
          <div className="window boot-window">
            <div className="titlebar">
              <span>스모어 만들기</span>
              <div className="window-controls">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="boot-body">
              <div className="mini-popup">
                <div className="mini-title">smore maker</div>
                <div className="mallow-icon">□</div>
              </div>
              <h1>스모어 만들기</h1>
              <p>천천히 마시멜로우를 구워요</p>
              <button className="pixel-button start-button" onClick={enter}>
                <Play size={16} />
                <span>Start</span>
              </button>
              <div className="loading-window">
                <span>cozy fire 준비중</span>
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
      <section className="phone-shell app-shell" aria-label="Smore roasting toy">
        <div className="window app-window">
          <div className="titlebar">
            <span>스모어 만들기</span>
            <div className="window-controls">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div
            className={`scene ${focusMode ? 'focus-scene' : ''}`}
            ref={sceneRef}
            onPointerMove={drag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <div className="moon" />
            <div className="pixel-stars star-one" />
            <div className="pixel-stars star-two" />
            {popupMessage && <div className="toast-popup">{popupMessage}</div>}
            <div className="first-person-hands">
              <span />
              <span />
            </div>
            {mallows.map((mallow) => (
              <Mallow
                key={mallow.id}
                mallow={mallow}
                active={mallow.id === activeId}
                autoRotate={autoRotate}
                rotationTick={rotationTick}
                onPointerDown={startDrag}
              />
            ))}
            <div className="campfire" aria-hidden="true">
              <div className="glow-ring" />
              <div className="log log-back" />
              <div className="log log-left" />
              <div className="log log-right" />
              <div className="coal coal-a" />
              <div className="coal coal-b" />
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
              <span className="label">상태</span>
              <strong>{stage.label}</strong>
              <small>{focusMode ? '꽂아두고 불멍 중...' : stage.line}</small>
            </div>
            <div className="meter" aria-label={`구움 정도 ${Math.round(activeMallow?.toastLevel ?? 0)}퍼센트`}>
              <span style={{ width: roastProgress }} />
            </div>
            <div className="controls primary-controls">
              <button className="pixel-button" onClick={reset}>
                <RotateCcw size={16} />
                <span>처음</span>
              </button>
              <button className="pixel-button" onClick={addMallow}>
                <Plus size={16} />
                <span>추가</span>
              </button>
              <button className="pixel-button" onClick={eatMallow}>
                <Utensils size={16} />
                <span>먹기</span>
              </button>
            </div>
            <div className="controls secondary-controls">
              <button className="pixel-button icon-toggle" onClick={toggleSound} aria-pressed={soundEnabled}>
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{soundEnabled ? '소리 켬' : '소리 끔'}</span>
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
                <span>{autoRotate ? '회전 켬' : '회전 끔'}</span>
              </button>
              <button className="pixel-button icon-toggle" onClick={toggleFocus} aria-pressed={focusMode}>
                <Flame size={16} />
                <span>{focusMode ? '불멍 중' : '불멍'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
