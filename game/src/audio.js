// Neon Bay — synthesized sound. No audio files: every effect is built with
// the WebAudio API (oscillators + filtered noise), so the game stays fully
// offline and the dossier stays small.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenOsc = null;
    this.sirenGain = null;
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

  blip(freq, dur, type = 'sine', vol = 0.25) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  noiseBurst(dur, vol = 0.4, freq = 1200) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start();
  }

  shoot(weapon) {
    if (weapon === 'shotgun') this.noiseBurst(0.28, 0.5, 900);
    else if (weapon === 'smg') this.noiseBurst(0.09, 0.3, 2200);
    else this.noiseBurst(0.14, 0.35, 1600);
  }

  reload() { this.blip(520, 0.08, 'square', 0.15); setTimeout(() => this.blip(760, 0.08, 'square', 0.15), 120); }
  pickup() { this.blip(660, 0.1, 'sine', 0.25); setTimeout(() => this.blip(990, 0.14, 'sine', 0.25), 90); }
  cash() { this.blip(880, 0.09, 'triangle', 0.25); setTimeout(() => this.blip(1320, 0.16, 'triangle', 0.25), 100); }
  click() { this.blip(440, 0.05, 'square', 0.12); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.25), i * 110)); }
  busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.2), i * 180)); }

  startEngine(speedNorm) {
    this.ensure();
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.setEngineSpeed(speedNorm);
  }

  setEngineSpeed(norm) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.setTargetAtTime(55 + norm * 130, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.03 + norm * 0.05, this.ctx.currentTime, 0.1);
  }

  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
    this.engineOsc = null;
    this.engineGain = null;
  }

  startSiren() {
    this.ensure();
    if (!this.ctx || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.05;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenOn = true;
  }

  updateSiren(elapsed) {
    if (!this.sirenOsc) return;
    const f = 620 + Math.sin(elapsed * 5) * 180;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
  }

  stopSiren() {
    if (!this.sirenOsc) return;
    try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }
}
