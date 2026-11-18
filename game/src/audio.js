// Neon Bay — all sound is synthesised with WebAudio. No audio files, no
// network. The engine is created lazily on the first user gesture (browsers
// block AudioContext before one) and stays silent in screenshot mode.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  const MUSIC_BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];

  function ensure() {
    if (started) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 25;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();

      started = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  function blip(freq, seconds, type, volume, when = 0) {
    if (!ctx || !master) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.2, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + seconds + 0.05);
    } catch (error) {
      // Sound is garnish; never let it break the game.
    }
  }

  function noiseBurst(seconds, volume) {
    if (!ctx || !master) return;
    try {
      const length = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.value = volume || 0.4;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch (error) {
      // Ignore audio errors.
    }
  }

  return {
    // Call from a click / keydown handler.
    unlock() {
      if (ensure() && ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    get muted() {
      return muted;
    },
    setEngine(speedFraction) {
      if (!ctx || !engineOsc) return;
      const f = 48 + speedFraction * 130;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.06);
      engineOsc2.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.06);
      engineGain.gain.setTargetAtTime(0.03 + speedFraction * 0.05, ctx.currentTime, 0.08);
    },
    setEngineOff() {
      if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    // dt in seconds, wanted > 0 enables the two-tone siren.
    updateSiren(dt, wanted, nearestPoliceDistance) {
      if (!ctx || !sirenOsc) return;
      if (wanted <= 0) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        return;
      }
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.02);
      }
      const loudness = Math.max(0, 1 - nearestPoliceDistance / 90);
      sirenGain.gain.setTargetAtTime(0.02 + loudness * 0.06, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.16, 0.5);
    },
    punch() {
      noiseBurst(0.08, 0.25);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.25);
      blip(880, 0.18, 'sine', 0.25, 0.1);
    },
    missionComplete() {
      blip(523, 0.14, 'triangle', 0.3);
      blip(659, 0.14, 'triangle', 0.3, 0.12);
      blip(784, 0.22, 'triangle', 0.3, 0.24);
      blip(1047, 0.3, 'triangle', 0.3, 0.36);
    },
    busted() {
      blip(220, 0.4, 'sawtooth', 0.25);
      blip(180, 0.5, 'sawtooth', 0.25, 0.3);
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(() => {
        if (!ctx || muted) return;
        const freq = MUSIC_BASS[musicStep % MUSIC_BASS.length];
        musicStep += 1;
        if (freq > 0) blip(freq, 0.22, 'triangle', 0.12);
      }, 210);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
