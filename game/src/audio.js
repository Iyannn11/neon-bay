// Neon Bay — synthesized sound.
//
// One clear job: every sound in the game is made live with WebAudio — no
// audio files, no network. Engine hum, sirens, gunshots, pickups and mission
// jingles are all oscillators and filtered noise. M mutes everything.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this._started = false;
  }

  start() {
    if (this._started) return;
    this._started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows the speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 42;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: two alternating tones, quiet until the police are near.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this._sirenPhase = 0;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(38 + speedNorm * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.06 : 0.0, t, 0.1);
  }

  setSiren(on, dt) {
    if (!this.ctx || !this.sirenOsc) return;
    const t = this.ctx.currentTime;
    if (on) {
      this._sirenPhase = (this._sirenPhase + dt) % 0.9;
      const hi = this._sirenPhase < 0.45;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 620, t, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.035, t, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  _tone(freq, dur, type, vol, when = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  shot() { this._noise(0.12, 0.5, 2400); this._tone(160, 0.08, 'square', 0.16); }
  boom() { this._noise(0.45, 0.8, 900); this._tone(70, 0.35, 'sine', 0.4); }
  punch() { this._noise(0.08, 0.3, 1400); }
  pickup() { this._tone(660, 0.1, 'sine', 0.25); this._tone(990, 0.14, 'sine', 0.25, 0.09); }
  cash() { this._tone(880, 0.1, 'triangle', 0.3); this._tone(1174, 0.12, 'triangle', 0.3, 0.08); this._tone(1568, 0.2, 'triangle', 0.3, 0.16); }
  denied() { this._tone(180, 0.18, 'square', 0.2); this._tone(140, 0.22, 'square', 0.2, 0.14); }
  missionStart() { this._tone(523, 0.12, 'triangle', 0.3); this._tone(659, 0.12, 'triangle', 0.3, 0.11); this._tone(784, 0.2, 'triangle', 0.3, 0.22); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.32, i * 0.11)); }
  wantedUp() { this._tone(440, 0.14, 'square', 0.22); this._tone(466, 0.18, 'square', 0.22, 0.13); }
  crash() { this._noise(0.25, 0.5, 700); }
  door() { this._noise(0.09, 0.25, 1800); }
}
