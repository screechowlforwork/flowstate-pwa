import { useEffect, useRef, useState } from 'react';
import { useTimerStore } from '../store/useTimerStore';

export type SoundMode = 'rain' | 'wind' | 'waves';

const FADE_TIME = 0.5; // seconds for crossfade and on/off

function createNoiseBuffer(
  context: AudioContext,
  type: 'white' | 'pink' | 'brown',
  durationSec = 3
) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * durationSec;
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    // Simple pink noise approximation (Paul Kellet filter)
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11; // normalize gain
    }
  } else {
    // Brown noise
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5; // approximate normalization
    }
  }

  return buffer;
}

interface ModeNodes {
  // Common
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter?: BiquadFilterNode;

  // Primary LFO (used for wind or envelope)
  lfoOsc?: OscillatorNode;
  lfoGain?: GainNode;

  // Waves-specific extras
  spraySource?: AudioBufferSourceNode;
  bodyGain?: GainNode;
  sprayGain?: GainNode;
  masterFilter?: BiquadFilterNode;
  panNode?: StereoPannerNode;
  panOsc?: OscillatorNode;
  panGain?: GainNode;
}

export function useAudioEngine() {
  const { isRunning, isBreak } = useTimerStore();

  const [mode, setModeState] = useState<SoundMode>('rain');
  const [enabled, setEnabledState] = useState(false);
  const [volume, setVolumeState] = useState(0.4);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const currentNodesRef = useRef<ModeNodes | null>(null);

  const ensureContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      masterGainRef.current = master;
    }
    return audioCtxRef.current!;
  };

  // Attempt to resume AudioContext, used for iOS autoplay unlock
  const resumeContextIfNeeded = () => {
    const ctx = ensureContext();
    if (ctx.state === 'suspended') {
      // Fire and forget; iOS requires this to be called in a user gesture handler
      ctx.resume().catch(() => {
        // ignore
      });
    }
    return ctx;
  };

  const stopModeNodes = (
    nodes: ModeNodes | null,
    ctx: AudioContext,
    fadeOut = true
  ) => {
    if (!nodes) return;
    const now = ctx.currentTime;

    if (fadeOut) {
      nodes.gain.gain.cancelScheduledValues(now);
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
      nodes.gain.gain.linearRampToValueAtTime(0, now + FADE_TIME);
    }

    try {
      nodes.source.stop(now + (fadeOut ? FADE_TIME : 0));
    } catch {
      // ignore
    }
    if (nodes.spraySource) {
      try {
        nodes.spraySource.stop(now + (fadeOut ? FADE_TIME : 0));
      } catch {
        // ignore
      }
    }

    // Disconnect graph
    nodes.source.disconnect();
    nodes.spraySource?.disconnect();
    nodes.gain.disconnect();
    nodes.bodyGain?.disconnect();
    nodes.sprayGain?.disconnect();
    nodes.filter?.disconnect();
    nodes.masterFilter?.disconnect();
    nodes.panNode?.disconnect();

    nodes.lfoOsc?.stop();
    nodes.lfoOsc?.disconnect();
    nodes.lfoGain?.disconnect();

    nodes.panOsc?.stop();
    nodes.panOsc?.disconnect();
    nodes.panGain?.disconnect();
  };

  const buildModeNodes = (ctx: AudioContext, mode: SoundMode): ModeNodes => {
    const gain = ctx.createGain();

    let source: AudioBufferSourceNode;
    let filter: BiquadFilterNode | undefined;
    let lfoOsc: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;

    // Waves: dual-layer stereo ocean engine
    if (mode === 'waves') {
      // Layer A (Body): brown noise -> lowpass -> bodyGain
      const bodyBuffer = createNoiseBuffer(ctx, 'brown');
      const bodySource = ctx.createBufferSource();
      bodySource.buffer = bodyBuffer;
      bodySource.loop = true;

      const bodyLPF = ctx.createBiquadFilter();
      bodyLPF.type = 'lowpass';
      bodyLPF.frequency.value = 400; // deep rumble
      bodyLPF.Q.value = 0.7;

      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.25;

      bodySource.connect(bodyLPF);
      bodyLPF.connect(bodyGain);

      // Layer B (Spray): white/pink noise -> highpass -> sprayGain
      const sprayBuffer = createNoiseBuffer(ctx, 'pink');
      const spraySource = ctx.createBufferSource();
      spraySource.buffer = sprayBuffer;
      spraySource.loop = true;

      const sprayHPF = ctx.createBiquadFilter();
      sprayHPF.type = 'highpass';
      sprayHPF.frequency.value = 700; // foam hiss
      sprayHPF.Q.value = 0.7;

      const sprayGain = ctx.createGain();
      sprayGain.gain.value = 0.0; // mostly off until crest

      spraySource.connect(sprayHPF);
      sprayHPF.connect(sprayGain);

      // Stereo bus
      const panNode = ctx.createStereoPanner();
      bodyGain.connect(panNode);
      sprayGain.connect(panNode);

      // Master lowpass: brightness tied to envelope
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 2500; // base muffled
      masterFilter.Q.value = 0.9;

      panNode.connect(masterFilter);
      masterFilter.connect(gain);

      // Primary LFO: wave envelope (body+spray) + brightness
      lfoOsc = ctx.createOscillator();
      lfoGain = ctx.createGain();

      // 0.12Hz ≒ 8.3秒周期 → 穏やかな太平洋ビーチ
      lfoOsc.frequency.value = 0.12;
      lfoGain.gain.value = 1.0; // -1..1

      lfoOsc.connect(lfoGain);

      // Body: smooth swell (sine-like)
      const bodyModGain = ctx.createGain();
      bodyModGain.gain.value = 0.2; // modulation depth
      lfoGain.connect(bodyModGain);
      bodyModGain.connect(bodyGain.gain);

      // Spray: sharper, only near crest（同じLFOだが強度を抑えつつピークで効く）
      const sprayModGain = ctx.createGain();
      sprayModGain.gain.value = 0.25;
      lfoGain.connect(sprayModGain);
      sprayModGain.connect(sprayGain.gain);

      // Brightness: quiet = darker, loud = brighter
      const filterModGain = ctx.createGain();
      filterModGain.gain.value = 1500; // ±1500Hz
      lfoGain.connect(filterModGain);
      filterModGain.connect(masterFilter.frequency);
      masterFilter.frequency.value = 2500; // swings ≒ 1000–4000Hz

      // Stereo pan LFO: very slow left-right motion
      const panOsc = ctx.createOscillator();
      const panGain = ctx.createGain();
      panOsc.frequency.value = 0.05; // ≒20秒周期
      panGain.gain.value = 0.3; // -0.3..+0.3
      panOsc.connect(panGain);
      panGain.connect(panNode.pan);

      lfoOsc.start();
      panOsc.start();
      bodySource.start();
      spraySource.start();

      source = bodySource;

      // Connect to master
      gain.connect(masterGainRef.current!);

      return {
        source,
        gain,
        filter: undefined,
        lfoOsc,
        lfoGain,
        spraySource,
        bodyGain,
        sprayGain,
        masterFilter,
        panNode,
        panOsc,
        panGain,
      };
    }

    // Rain / Wind share simpler single-noise pipeline
    const buffer = createNoiseBuffer(ctx, 'pink');
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    if (mode === 'rain') {
      // Rain: pink noise + lowpass → 雨が窓の外で降っているイメージ
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      filter.Q.value = 0.7;

      source.connect(filter);
      filter.connect(gain);
    } else if (mode === 'wind') {
      // Wind: pink noise -> bandpass, LFO on frequency
      filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600; // mid-low center
      filter.Q.value = 1.2;

      lfoOsc = ctx.createOscillator();
      lfoGain = ctx.createGain();

      // 0.1Hz ≒ 10秒周期：風が強まったり弱まったり
      lfoOsc.frequency.value = 0.1;
      lfoGain.gain.value = 300; // ±300Hz

      lfoOsc.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfoOsc.start();

      source.connect(filter);
      filter.connect(gain);
    }

    gain.connect(masterGainRef.current!);

    return { source, gain, filter, lfoOsc, lfoGain };
  };

  const startMode = (newMode: SoundMode) => {
    const ctx = resumeContextIfNeeded();
    const now = ctx.currentTime;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oldNodes = currentNodesRef.current;
    if (oldNodes) {
      stopModeNodes(oldNodes, ctx, true);
    }

    const nodes = buildModeNodes(ctx, newMode);
    currentNodesRef.current = nodes;

    nodes.gain.gain.setValueAtTime(0, now);
    nodes.source.start?.();

    const target = enabled ? volume : 0;
    nodes.gain.gain.linearRampToValueAtTime(target, now + FADE_TIME);
  };

  const stopAll = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = masterGainRef.current;
    if (master) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + FADE_TIME);
    }
    stopModeNodes(currentNodesRef.current, ctx, true);
    currentNodesRef.current = null;
  };

  // Public API
  const setMode = (newMode: SoundMode) => {
    setModeState(newMode);
    if (!enabled) return;
    startMode(newMode);
  };

  const setEnabled = (on: boolean) => {
    setEnabledState(on);
    if (on) {
      // Ensure context is unlocked before starting sound
      resumeContextIfNeeded();
      startMode(mode);
    } else {
      stopAll();
    }
  };

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    const ctx = audioCtxRef.current;
    const nodes = currentNodesRef.current;
    if (!ctx || !nodes) return;
    const now = ctx.currentTime;
    nodes.gain.gain.cancelScheduledValues(now);
    nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
    nodes.gain.gain.linearRampToValueAtTime(clamped, now + 0.2);
  };

  // Master gain: tie to timer state (Focus = loud, Break = softer, Off = 0)
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime;

    const target = !enabled
      ? 0
      : isRunning && !isBreak
      ? 1
      : 0.3; // softer during break

    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target * volume, now + 0.5);
  }, [isRunning, isBreak, enabled, volume]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopAll();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // Global first-gesture unlock for iOS Safari (touchstart + click)
  useEffect(() => {
    const unlockHandler = () => {
      const ctx = audioCtxRef.current ?? audioCtxRef.current ?? undefined;
      // Use helper to create/resume context lazily
      resumeContextIfNeeded();

      // Remove listeners after first successful gesture
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('click', unlockHandler);
    };

    window.addEventListener('touchstart', unlockHandler, { passive: true });
    window.addEventListener('click', unlockHandler, { passive: true });

    return () => {
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('click', unlockHandler);
    };
  }, []);

  return {
    mode,
    setMode,
    enabled,
    setEnabled,
    volume,
    setVolume,
  };
}