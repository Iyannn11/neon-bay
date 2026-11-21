// Neon Bay — all sound is synthesized with WebAudio: no audio files, no network.
// One AudioContext, created on the first user gesture; every effect is a small
// node graph that starts and stops itself.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.rainNodes = null;
    this.engineNodes = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  _noiseBuffer(seconds = 1) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type = 'sine', vol = 0.25, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  shot(kind) {
    if (!this.ctx) return;
    if (kind === 'shotgun') { this._noise(0.28, 0.5, 900); this._blip(120, 0.18, 'square', 0.3, 45); }
    else if (kind === 'smg') { this._noise(0.09, 0.32, 2400, 'highpass'); this._blip(220, 0.06, 'square', 0.16, 90); }
    else { this._noise(0.12, 0.35, 1600, 'highpass'); this._blip(180, 0.08, 'square', 0.2, 70); }
  }

  cash() { this._blip(880, 0.09, 'sine', 0.22); setTimeout(() => this._blip(1320, 0.14, 'sine', 0.22), 90); }
  pickup() { this._blip(660, 0.08, 'triangle', 0.22); setTimeout(() => this._blip(990, 0.12, 'triangle', 0.22), 70); }
  click() { this._blip(1200, 0.04, 'square', 0.1); }
  error() { this._blip(160, 0.16, 'sawtooth', 0.18, 110); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'triangle', 0.22), i * 110)); }
  horn() { this._blip(370, 0.22, 'sawtooth', 0.16, 370); }
  jump() { this._blip(300, 0.14, 'sine', 0.14, 620); }
  hurt() { this._blip(140, 0.2, 'sawtooth', 0.25, 60); }
  busted() { [440, 415, 392].forEach((f, i) => setTimeout(() => this._blip(f, 0.3, 'square', 0.18), i * 220)); }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this._sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 700;
      g.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.5;
      const lg = this.ctx.createGain(); lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this._sirenOsc = o; this._sirenLfo = lfo; this._sirenGain = g;
    } else if (!on && this._sirenOsc) {
      try { this._sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) { /* already stopped */ }
      this._sirenOsc = null; this._sirenLfo = null; this._sirenGain = null;
    }
  }

  engine(on, speed01 = 0) {
    if (!this.ctx) return;
    if (on && !this.engineNodes) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 55;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 320;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engineNodes = { o, f, g };
    } else if (!on && this.engineNodes) {
      try { this.engineNodes.o.stop(); } catch (e) { /* already stopped */ }
      this.engineNodes = null;
    }
    if (this.engineNodes) {
      this.engineNodes.o.frequency.value = 55 + speed01 * 130;
      this.engineNodes.f.frequency.value = 320 + speed01 * 700;
    }
  }

  rain(on) {
    if (!this.ctx) return;
    if (on && !this.rainNodes) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(2);
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.4;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      this.rainNodes = { src, g };
    } else if (!on && this.rainNodes) {
      try { this.rainNodes.src.stop(); } catch (e) { /* already stopped */ }
      this.rainNodes = null;
    }
  }
}
