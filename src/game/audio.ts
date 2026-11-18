// Original procedural audio: no downloaded recordings or autoplay dependency.
let ctx: AudioContext | undefined;
export function audioContext() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return undefined;
  }
}
export function tickSound(enabled: boolean, volume = 45) {
  if (!enabled || volume === 0) return;
  const a = audioContext();
  if (!a) return;
  const osc = a.createOscillator(),
    g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(680, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(420, a.currentTime + 0.06);
  g.gain.setValueAtTime(volume * 0.00055, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.00001, a.currentTime + 0.065);
  osc.connect(g).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + 0.07);
}
export class FlightAudio {
  a?: AudioContext;
  gain?: GainNode;
  engine?: OscillatorNode;
  rumble?: OscillatorNode;
  wind?: AudioBufferSourceNode;
  windGain?: GainNode;
  filter?: BiquadFilterNode;
  position?: StereoPannerNode;
  engineBus?: GainNode;
  lastEffect = 0;
  noiseBuffer?: AudioBuffer;
  volume: number;
  enabled: boolean;
  constructor(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    this.a = audioContext();
    const a = this.a;
    if (!a) return;
    this.gain = a.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(a.destination);
    this.position = a.createStereoPanner();
    this.engineBus = a.createGain();
    this.position.connect(this.engineBus).connect(this.gain);
    this.filter = a.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 240;
    this.filter.Q.value = 0.65;
    this.filter.connect(this.position);
    this.engine = a.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 55;
    this.engine.connect(this.filter);
    this.engine.start();
    this.rumble = a.createOscillator();
    this.rumble.type = 'sine';
    this.rumble.frequency.value = 35;
    this.rumble.connect(this.filter);
    this.rumble.start();
    this.wind = a.createBufferSource();
    const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    let last = 0;
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = last = (last + Math.random() * 0.16 - 0.08) / 1.044;
    this.noiseBuffer = b;
    this.wind.buffer = b;
    this.wind.loop = true;
    this.windGain = a.createGain();
    this.windGain.gain.value = 0.4;
    this.wind.connect(this.windGain).connect(this.gain);
    this.wind.start();
  }
  update(throttle: number, speed: number, distance: number, pan: number, active: boolean) {
    if (!this.a || !this.gain) return;
    const t = this.a.currentTime;
    this.gain.gain.setTargetAtTime(active && this.enabled ? this.volume * 0.0014 : 0, t, 0.11);
    this.engineBus?.gain.setTargetAtTime(1 / (1 + distance * 0.006), t, 0.12);
    this.engine?.frequency.setTargetAtTime(34 + throttle * 83, t, 0.15);
    this.rumble?.frequency.setTargetAtTime(20 + throttle * 18, t, 0.2);
    this.filter?.frequency.setTargetAtTime(100 + throttle * 360, t, 0.22);
    this.windGain?.gain.setTargetAtTime(Math.min(1.9, speed * 0.011), t, 0.2);
    this.position?.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
  }
  effect(type: 'hit' | 'alert' | 'debris', power = 0.5, pan = 0, distance = 0) {
    const a = this.a;
    if (!a || !this.gain || !this.enabled) return;
    if (type !== 'alert' && a.currentTime - this.lastEffect < 0.042) return;
    this.lastEffect = a.currentTime;
    const spatial = a.createStereoPanner();
    spatial.pan.value = Math.max(-1, Math.min(1, pan));
    const attenuation = a.createGain();
    attenuation.gain.value = 1 / (1 + distance * 0.008);
    spatial.connect(attenuation).connect(this.gain);
    const o = a.createOscillator(),
      g = a.createGain(),
      t = a.currentTime;
    const alert = type === 'alert';
    o.type = alert ? 'sine' : 'sawtooth';
    o.frequency.setValueAtTime(alert ? 840 : 120 + power * 40, t);
    o.frequency.exponentialRampToValueAtTime(alert ? 570 : 19, t + (alert ? 0.14 : 0.43));
    g.gain.setValueAtTime(alert ? 0.34 : Math.min(1.5, 0.7 + power), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g).connect(spatial);
    o.start();
    o.stop(t + 0.46);
    if (!alert && this.noiseBuffer) {
      const noise = a.createBufferSource(),
        ng = a.createGain(),
        filter = a.createBiquadFilter();
      noise.buffer = this.noiseBuffer;
      noise.playbackRate.value = type === 'debris' ? 3.6 : 1.4;
      filter.type = 'bandpass';
      filter.frequency.value = type === 'debris' ? 1700 : 410;
      ng.gain.setValueAtTime(2.1 + power, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.37);
      noise.connect(filter).connect(ng).connect(spatial);
      noise.start();
      noise.stop(t + 0.38);
    }
    o.onended = () => {
      spatial.disconnect();
      attenuation.disconnect();
    };
  }
  dispose() {
    this.engine?.stop();
    this.rumble?.stop();
    this.wind?.stop();
    this.gain?.disconnect();
  }
}
