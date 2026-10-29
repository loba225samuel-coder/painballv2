// Tiny synthesized SFX kit — no assets, all WebAudio.
type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  constructor(muted = false) {
    this.muted = muted;
  }

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.5;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      // white-noise buffer for pops / spray / impact
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  private ok() {
    return this.ctx && this.master && !this.muted;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0
  ) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private burst(dur: number, vol: number, freq: number, q: number, type: BiquadFilterType, delay = 0, sweep = 0) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    if (!this.noise) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot() {
    this.burst(0.09, 0.28, 1500, 0.9, "bandpass", 0, 0.4);
    this.tone(320 + Math.random() * 40, 0.07, "square", 0.05, 120);
  }
  enemyShoot() {
    this.burst(0.11, 0.16, 900, 1.1, "bandpass", 0, 0.45);
  }
  hit() {
    this.tone(620, 0.06, "triangle", 0.1, 300);
    this.burst(0.07, 0.14, 2400, 0.7, "highpass");
  }
  splat() {
    this.burst(0.2, 0.3, 700, 0.6, "lowpass", 0, 0.25);
    this.tone(180, 0.16, "sine", 0.16, 60);
  }
  kill() {
    this.splat();
    this.tone(880, 0.14, "square", 0.09, 220);
    this.tone(1320, 0.2, "triangle", 0.07, 440, 0.05);
  }
  boss() {
    this.tone(110, 0.7, "sawtooth", 0.16, 44);
    this.burst(0.6, 0.2, 340, 0.6, "lowpass", 0, 3);
  }
  hurt() {
    this.tone(240, 0.24, "sawtooth", 0.16, 70);
    this.burst(0.22, 0.2, 500, 0.8, "bandpass");
  }
  reloadOut() {
    this.tone(420, 0.06, "square", 0.06, 260);
    this.burst(0.08, 0.12, 1800, 0.6, "highpass");
  }
  reloadIn() {
    this.tone(300, 0.09, "square", 0.08, 620);
    this.burst(0.07, 0.14, 1200, 0.8, "bandpass", 0.05);
  }
  dash() {
    this.burst(0.22, 0.16, 1100, 0.7, "bandpass", 0, 2.4);
    this.tone(520, 0.12, "sine", 0.06, 900);
  }
  pickup() {
    this.tone(680, 0.07, "square", 0.08);
    this.tone(1020, 0.09, "square", 0.07, 1360, 0.06);
  }
  wave() {
    this.tone(300, 0.16, "square", 0.07, 460);
    this.tone(460, 0.22, "square", 0.07, 620, 0.13);
    this.tone(620, 0.3, "triangle", 0.06, 900, 0.26);
  }
  over() {
    this.tone(420, 0.5, "sawtooth", 0.14, 90);
    this.tone(300, 0.7, "square", 0.1, 60, 0.12);
    this.burst(0.8, 0.14, 400, 0.5, "lowpass", 0.1, 0.2);
  }
  shield() {
    this.tone(520, 0.16, "triangle", 0.12, 900);
    this.tone(780, 0.24, "sine", 0.08, 1240, 0.05);
    this.burst(0.12, 0.1, 1800, 0.7, "bandpass");
  }
  ricochet() {
    this.tone(900 + Math.random() * 320, 0.07, "square", 0.06, 420);
    this.burst(0.06, 0.1, 2600, 0.8, "highpass");
  }
  boom() {
    this.burst(0.34, 0.32, 420, 0.6, "lowpass", 0, 0.22);
    this.tone(140, 0.34, "sawtooth", 0.16, 46);
    this.tone(90, 0.5, "sine", 0.14, 34, 0.04);
  }
  ui() {
    this.tone(700, 0.05, "square", 0.06, 980);
  }
  combo(n: number) {
    const base = 520 + Math.min(6, n) * 90;
    this.tone(base, 0.09, "square", 0.07, base * 1.5);
  }
}
