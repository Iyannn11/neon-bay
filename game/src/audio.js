// audio.js — every sound in Neon Bay is synthesised with WebAudio.
// No audio files are loaded: the engine hum, the police siren, gunshots,
// pickup chimes and the music loop are all oscillators and filtered noise.
// Nothing starts until the player first interacts (browser autoplay rule).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }

  // Create the context on first user gesture.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._startEngine();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // Engine pitch and loudness follow the car's speed (0..1).
  setEngine(speedNorm, driving) {
    if (!this.engineOsc || !this.engineGain) return;
    const target = driving ? 0.05 + speedNorm * 0.10 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, this.ctx.currentTime, 0.1);
  }

  // Two-tone police siren; call with true while wanted >= 1.
  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (e) {}
      try { this._sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // A short noise burst through a low-pass filter.
  gunshot() {
    if (!this.ctx || this.muted) return;
    const dur = 0.16;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  // A bright two-note chime for pickups and mission steps.
  chime() {
    if (!this.ctx || this.muted) return;
    [880, 1318].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // A low thud for a punch landing.
  thud() {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // A simple looping bassline + sparkle arpeggio, 8 steps a bar.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 0];
    const sparkle = [440, 554, 659, 880, 659, 554, 440, 330];
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const step = this.musicStep % 8;
      this.musicStep += 1;
      const t = this.ctx.currentTime;
      if (bass[step]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = bass[step];
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.55);
      }
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = sparkle[step];
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.05, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc2.connect(gain2);
      gain2.connect(this.master);
      osc2.start(t);
      osc2.stop(t + 0.32);
    }, 300);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
