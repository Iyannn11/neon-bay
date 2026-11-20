// Neon Bay — WebAudio synth sound, no audio files.
// Everything is generated: a low engine hum that follows the car speed, a
// two-tone police siren that fades in with the wanted level, short blips
// for pickups, a little fanfare for a finished job, and a simple bass loop
// for music. Nothing loads over the network.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let sirenPhase = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth whose pitch follows the car.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch (error) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  const bassLine = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];

  function musicTick() {
    if (!ctx || muted) return;
    const note = bassLine[musicStep % bassLine.length];
    musicStep += 1;
    if (note > 0) {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.34);
    }
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    setMuted(flag) {
      muted = !!flag;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted && engineGain) engineGain.gain.value = 0;
      if (muted && sirenGain) sirenGain.gain.value = 0;
    },
    setEngine(speed) {
      if (!ensure() || muted) return;
      const target = Math.abs(speed) > 0.5 ? 0.05 + Math.min(0.12, Math.abs(speed) * 0.003) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 3.2, ctx.currentTime, 0.08);
    },
    setEngineOff() {
      if (!ctx || !engineGain) return;
      engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    updateSiren(dt, stars, nearest) {
      if (!ensure()) return;
      sirenPhase += dt;
      const audible = stars > 0 && nearest < 90;
      const target = audible && !muted ? Math.min(0.09, 0.02 + stars * 0.015) : 0;
      sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.2);
      const high = 880;
      const low = 620;
      const wave = Math.sin(sirenPhase * 4.4) > 0 ? high : low;
      sirenOsc.frequency.setTargetAtTime(wave, ctx.currentTime, 0.05);
    },
    pickup() {
      blip(660, 0.09, 'square', 0.1);
      blip(990, 0.12, 'square', 0.1, 0.08);
    },
    missionComplete() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => blip(freq, 0.22, 'triangle', 0.14, i * 0.11));
    },
    busted() {
      blip(220, 0.5, 'sawtooth', 0.14);
      blip(165, 0.7, 'sawtooth', 0.14, 0.4);
      noiseBurst(0.25, 0.15);
    },
    shoot() {
      noiseBurst(0.12, 0.25);
      blip(180, 0.08, 'square', 0.12);
    },
    gunshot() {
      noiseBurst(0.12, 0.25);
      blip(180, 0.08, 'square', 0.12);
    },
    punch() {
      noiseBurst(0.08, 0.2);
    },
    startMusic() {
      if (!ensure()) return;
      if (musicTimer) return;
      musicTimer = window.setInterval(musicTick, 190);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
