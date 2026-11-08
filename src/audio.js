/* Procedural audio engine — no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ready = false;
    this.tension = 0;
    this._hbTimer = 0;
    this._stepTimer = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.25;
    this.comp.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.comp);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.9;
    this.ambBus.connect(this.comp);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.comp);

    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.ready = true;
    this._buildAmbience();
    this.setAmbience({ rain: 0, wind: 0.16, drone: 0.12, engine: 0 });
  }

  _noiseSource(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    s.start();
    return s;
  }

  _buildAmbience() {
    const ctx = this.ctx;

    // wind: filtered brown-ish noise
    this.windSrc = this._noiseSource();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);

    // rain: bright noise
    this.rainSrc = this._noiseSource();
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'highpass';
    this.rainFilter.frequency.value = 1600;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainSrc.connect(this.rainFilter).connect(this.rainGain).connect(this.ambBus);

    // low drone: two detuned saws through lowpass
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 220;
    this.droneFilter.Q.value = 3;
    this.droneFilter.connect(this.droneGain).connect(this.ambBus);
    this.droneOscs = [];
    for (const [f, type, g] of [[41.2, 'sawtooth', 0.5], [61.7, 'sine', 0.7], [82.4, 'triangle', 0.25]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(this.droneFilter);
      o.start();
      this.droneOscs.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(this.droneFilter.frequency);
    lfo.start();

    // heartbeat tone
    this.hbGain = ctx.createGain();
    this.hbGain.gain.value = 0;
    this.hbGain.connect(this.ambBus);

    // engine
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 700;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 48;
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = 'square';
    this.engOsc2.frequency.value = 24;
    const engMix = ctx.createGain();
    engMix.gain.value = 0.5;
    this.engOsc.connect(engMix);
    this.engOsc2.connect(engMix);
    engMix.connect(this.engFilter).connect(this.engGain).connect(this.ambBus);
    this.engOsc.start(); this.engOsc2.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  setAmbience({ rain, wind, drone, engine }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (rain !== undefined) this.rainGain.gain.setTargetAtTime(rain * 0.5, t, 0.6);
    if (wind !== undefined) this.windGain.gain.setTargetAtTime(wind * 0.55, t, 0.8);
    if (drone !== undefined) this.droneGain.gain.setTargetAtTime(drone * 0.5, t, 1.0);
    if (engine !== undefined) this.engGain.gain.setTargetAtTime(engine * 0.22, t, 0.25);
  }

  setEngine(speed, throttle = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(42 + speed * 2.4, t, 0.12);
    this.engOsc2.frequency.setTargetAtTime(21 + speed * 1.2, t, 0.12);
    this.engFilter.frequency.setTargetAtTime(420 + speed * 26 * throttle, t, 0.2);
  }

  setTension(v) {
    this.tension = v;
    if (!this.ready) return;
    this.hbGain.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.4);
    if (this.droneFilter) this.droneFilter.frequency.setTargetAtTime(180 + v * 180, this.ctx.currentTime, 1.2);
  }

  update(dt) {
    if (!this.ready) return;
    if (this.tension > 0.02) {
      this._hbTimer -= dt;
      if (this._hbTimer <= 0) {
        const rate = 0.95 - this.tension * 0.52;
        this._hbTimer = Math.max(0.26, rate);
        this._thump(0.5 + this.tension * 0.6);
        setTimeout(() => this._thump(0.32 + this.tension * 0.35), Math.max(90, rate * 280));
      }
    }
  }

  _thump(vol) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(62, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.hbGain);
    o.start(t); o.stop(t + 0.25);
  }

  /* ---------------- one-shots ---------------- */
  _env(node, vol, attack, decay) {
    const t = this.ctx.currentTime;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(vol, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone({ freq = 440, freq2 = null, type = 'sine', vol = 0.2, dur = 0.2, attack = 0.005, bus = null, filter = null }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    let node = g;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq || 1000;
      f.Q.value = filter.q || 1;
      g.connect(f);
      node = f;
    }
    o.connect(g);
    node.connect(bus || this.sfxBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ vol = 0.2, dur = 0.2, freq = 900, q = 1, type = 'bandpass', attack = 0.004, bus = null }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    src.start(t, Math.random() * 1.2, dur + attack + 0.1);
  }

  step(run = false, wet = true) {
    this.noise({ vol: run ? 0.16 : 0.09, dur: 0.1, freq: wet ? 700 : 380, q: 0.7 });
    if (wet) this.noise({ vol: 0.05, dur: 0.16, freq: 3200, q: 0.6, type: 'highpass' });
  }
  pickup() {
    this.tone({ freq: 660, freq2: 1320, type: 'triangle', vol: 0.16, dur: 0.28 });
    this.tone({ freq: 990, type: 'sine', vol: 0.09, dur: 0.35, attack: 0.03 });
  }
  ui() { this.tone({ freq: 340, freq2: 520, type: 'triangle', vol: 0.1, dur: 0.12 }); }
  hitFlesh() {
    this.noise({ vol: 0.34, dur: 0.16, freq: 260, q: 1.2, type: 'lowpass' });
    this.tone({ freq: 110, freq2: 50, type: 'sine', vol: 0.3, dur: 0.2 });
  }
  hurt() {
    this.noise({ vol: 0.26, dur: 0.22, freq: 380, q: 0.8 });
    this.tone({ freq: 180, freq2: 70, type: 'sawtooth', vol: 0.16, dur: 0.28 });
  }
  swing() { this.noise({ vol: 0.16, dur: 0.18, freq: 1100, q: 1.6, type: 'bandpass' }); }
  dodge() { this.noise({ vol: 0.14, dur: 0.25, freq: 600, q: 0.7, type: 'lowpass' }); }
  roar() {
    this.tone({ freq: 120, freq2: 48, type: 'sawtooth', vol: 0.24, dur: 1.1, filter: { type: 'lowpass', freq: 500, q: 3 } });
    this.noise({ vol: 0.2, dur: 0.9, freq: 240, q: 1.5, type: 'lowpass' });
  }
  crash() {
    this.noise({ vol: 0.4, dur: 0.5, freq: 220, q: 0.6, type: 'lowpass' });
    this.tone({ freq: 90, freq2: 34, type: 'square', vol: 0.2, dur: 0.4 });
  }
  siren() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.7);
    o.frequency.linearRampToValueAtTime(520, t + 1.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + 1.55);
  }
  thunder() {
    this.noise({ vol: 0.34, dur: 2.2, freq: 90, q: 0.5, type: 'lowpass', attack: 0.05 });
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'triangle', vol: 0.13, dur: 0.7 }), i * 150));
  }
  death() {
    this.tone({ freq: 160, freq2: 40, type: 'sawtooth', vol: 0.24, dur: 1.8, filter: { type: 'lowpass', freq: 400, q: 2 } });
    this.noise({ vol: 0.24, dur: 1.4, freq: 200, q: 0.6, type: 'lowpass' });
  }
}
