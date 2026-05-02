import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STAGES = [
  { key: 'raw', min: 0, max: 15, color: '#fff7eb', label: 'raw', bite: '차갑고 퍽퍽하다...' },
  { key: 'warm', min: 16, max: 35, color: '#ffe9bd', label: 'warm', bite: '조금 따뜻하다.' },
  { key: 'golden', min: 36, max: 60, color: '#e7b45d', label: 'golden', bite: '완벽하게 달다.' },
  { key: 'toasted', min: 61, max: 80, color: '#9d6037', label: 'toasted', bite: '겉은 바삭하고 속은 말랑하다.' },
  { key: 'burnt', min: 81, max: 95, color: '#33201a', label: 'burnt', bite: '탄 맛이 난다.' },
  { key: 'ash', min: 96, max: 100, color: '#111111', label: 'ash', bite: '먹을 수 있는 게 아니다.' },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStage(level) {
  return STAGES.find((stage) => level >= stage.min && level <= stage.max) ?? STAGES[0];
}

function spotsFor(level) {
  const count = level < 20 ? 0 : level < 45 ? 5 : level < 80 ? 10 : 16;
  return Array.from({ length: count }, (_, index) => {
    const x = Math.abs(Math.sin(index * 41.7 + level * 0.07)) * 100;
    const y = Math.abs(Math.cos(index * 17.3 + level * 0.05)) * 100;
    const size = 7 + Math.abs(Math.sin(index * 8.4)) * 18;
    return {
      left: `${14 + (x % 68)}%`,
      top: `${16 + (y % 56)}%`,
      width: `${size}px`,
      height: `${size * (0.7 + (index % 3) * 0.12)}px`,
      opacity: clamp((level - 18) / 62, 0, 0.88),
    };
  });
}

function useFireAudio(soundEnabled) {
  const audioRef = useRef(null);
  const timerRef = useRef(0);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 620;

    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    noise.connect(lowpass);
    lowpass.connect(fireGain);
    fireGain.connect(master);
    noise.start();

    audioRef.current = { ctx, master, fireGain };
    return audioRef.current;
  }, []);

  const crack = useCallback((volume = 0.05, length = 0.055) => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();

    const buffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * length), audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700 + Math.random() * 1800;
    const gain = audio.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  }, [ensureAudio, soundEnabled]);

  const eatSound = useCallback(() => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, audio.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audio.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.18);
  }, [ensureAudio, soundEnabled]);

  const whoosh = useCallback(() => {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio) return;
    audio.ctx.resume();
    crack(0.09, 0.12);
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(460, audio.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, audio.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.04, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.22);
  }, [crack, ensureAudio, soundEnabled]);

  useEffect(() => {
    const audio = ensureAudio();
    if (!audio) return;
    audio.fireGain.gain.setTargetAtTime(soundEnabled ? 0.17 : 0, audio.ctx.currentTime, 0.28);
    if (soundEnabled) audio.ctx.resume();
  }, [ensureAudio, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) return undefined;
    let live = true;
    const schedule = () => {
      if (!live) return;
      crack(0.018 + Math.random() * 0.06, 0.025 + Math.random() * 0.08);
      timerRef.current = window.setTimeout(schedule, 180 + Math.random() * 760);
    };
    schedule();
    return () => {
      live = false;
      window.clearTimeout(timerRef.current);
    };
  }, [crack, soundEnabled]);

  return { ensureAudio, crack, eatSound, whoosh };
}

function FireBackground() {
  const [media, setMedia] = useState('');

  return (
    <div className="background">
      <video
        className={`user-fire user-fire-video ${media === 'video' ? 'ready' : ''}`}
        src="/fire.mp4"
        autoPlay
        muted
        loop
        playsInline
        onLoadedData={() => setMedia('video')}
      />
      {media !== 'video' && (
        <img
          className={`user-fire user-fire-image ${media === 'image' ? 'ready' : ''}`}
          src="/fire.jpg"
          alt=""
          onLoad={() => setMedia('image')}
        />
      )}
      <div className="dark-camp" />
      <div className="fire-scene" aria-hidden="true">
        <div className="smoke smoke-a" />
        <div className="smoke smoke-b" />
        <div className="fire-glow" />
        <div className="logs">
          <span className="log log-a" />
          <span className="log log-b" />
          <span className="log log-c" />
        </div>
        <div className="coal-bed" />
        <div className="flame flame-back" />
        <div className="flame flame-left" />
        <div className="flame flame-right" />
        <div className="flame flame-mid" />
        <div className="flame flame-core" />
        <div className="spark spark-a" />
        <div className="spark spark-b" />
        <div className="spark spark-c" />
      </div>
    </div>
  );
}

function App() {
  const [toastLevel, setToastLevel] = useState(0);
  const [isEaten, setIsEaten] = useState(false);
  const [isSpinningFast, setIsSpinningFast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const fastTimerRef = useRef(0);
  const { ensureAudio, eatSound, whoosh } = useFireAudio(soundEnabled);

  const stage = getStage(Math.round(toastLevel));
  const spots = useMemo(() => spotsFor(toastLevel), [toastLevel]);

  useEffect(() => {
    if (isEaten) return undefined;
    const interval = window.setInterval(() => {
      setToastLevel((level) => clamp(level + (isSpinningFast ? 0.34 : 0.22), 0, 100));
    }, 160);
    return () => window.clearInterval(interval);
  }, [isEaten, isSpinningFast]);

  const eat = useCallback(() => {
    if (isEaten) return;
    eatSound();
    setIsEaten(true);
    setMessage(stage.bite);
  }, [eatSound, isEaten, stage.bite]);

  const reset = useCallback(() => {
    setToastLevel(0);
    setIsEaten(false);
    setIsSpinningFast(false);
    setMessage('');
    window.clearTimeout(fastTimerRef.current);
  }, []);

  const spinFast = useCallback(() => {
    if (isEaten) return;
    whoosh();
    setIsSpinningFast(true);
    setMessage('빙글빙글...');
    window.clearTimeout(fastTimerRef.current);
    fastTimerRef.current = window.setTimeout(() => {
      setIsSpinningFast(false);
      setMessage('');
    }, 1700);
  }, [isEaten, whoosh]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => !enabled);
    window.setTimeout(() => ensureAudio()?.ctx.resume(), 0);
  }, [ensureAudio]);

  return (
    <main className="app">
      <FireBackground />
      <div className="status">
        <div>status: {stage.label}</div>
        <div>toast: {Math.round(toastLevel)}%</div>
        <div>{isEaten ? 'marshmallow: eaten' : 'marshmallow: on stick'}</div>
      </div>

      <section className={`roaster ${isSpinningFast ? 'fast' : ''} ${isEaten ? 'eaten' : ''}`}>
        <div className="stick" />
        {!isEaten && (
          <div
            className={`mallow ${stage.key}`}
            style={{
              '--mallow-color': stage.color,
              '--squash': stage.key === 'ash' ? 0.72 : 1,
            }}
          >
            <div className="mallow-face">
              {spots.map((spot, index) => (
                <i key={index} style={spot} />
              ))}
            </div>
          </div>
        )}
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
