// Neon Bay — synthesized WebAudio sound: no audio files, everything is
// generated (engine hum, gunshots, pickups, siren, UI clicks). Written fresh
// for Round 12.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    } catch (_) { /* audio unavailable in headless */ }
  }

  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise(dur, vol = 0.3, filterFreq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  shoot(weapon) {
    if (weapon === 'shotgun') { this.noise(0.22, 0.5, 900); this.tone(90, 0.18, 'square', 0.3, 40); }
    else if (weapon === 'smg') { this.noise(0.08, 0.3, 2400); this.tone(220, 0.06, 'square', 0.2, 90); }
    else { this.noise(0.12, 0.4, 1600); this.tone(160, 0.1, 'square', 0.25, 60); }
  }

  pickup() { this.tone(660, 0.12, 'sine', 0.25); this.tone(990, 0.18, 'sine', 0.25, null, 0.09); }
  coin() { this.tone(880, 0.1, 'triangle', 0.25); this.tone(1320, 0.16, 'triangle', 0.25, null, 0.07); }
  click() { this.tone(440, 0.05, 'square', 0.15); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.25, null, i * 0.11)); }
  hurt() { this.tone(140, 0.2, 'sawtooth', 0.3, 70); }
  siren(on) {
    if (!this.ctx || this.muted) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 700;
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 320;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (_) {}
      this.sirenOsc = null;
    }
  }

  engine(on, speed = 0) {
    if (!this.ctx || this.muted) return;
    if (on && !this.engineOsc) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 60;
      const g = this.ctx.createGain(); g.gain.value = 0.04;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engineOsc = o; this.engineGain = g;
    } else if (!on && this.engineOsc) {
      try { this.engineOsc.stop(); } catch (_) {}
      this.engineOsc = null;
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + Math.abs(speed) * 4.2;
      this.engineGain.gain.value = 0.03 + Math.min(0.05, Math.abs(speed) * 0.0012);
    }
  }
}
