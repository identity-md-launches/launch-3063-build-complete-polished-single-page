// Retro 8-bit sound, synthesized with the Web Audio API. There are no audio files.

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.51, G6: 1567.98 } as const;

type Wave = OscillatorType;

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: boolean;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Browsers only start audio from a user gesture, so call this from a click or key handler. */
  unlock(): void {
    if (!this.ctx) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const length = Math.floor(this.ctx.sampleRate * 0.4);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      // Stepped noise: holding each sample a few frames gives the crunchy 8-bit texture.
      let held = 0;
      for (let i = 0; i < length; i++) {
        if (i % 6 === 0) held = Math.random() * 2 - 1;
        data[i] = held;
      }
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.01);
  }

  private tone(frequency: number, start: number, duration: number, wave: Wave, volume: number, slideTo?: number): void {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted) return;
    const at = ctx.currentTime + start;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  private crunch(start: number, duration: number, volume: number): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || this.muted) return;
    const at = ctx.currentTime + start;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = noise;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(gain).connect(master);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  /** Climbs a semitone per orb in a streak, so a good line sounds like one. */
  orb(combo: number): void {
    const pitch = NOTE.A5 * 2 ** (Math.min(combo, 12) / 12);
    this.tone(pitch, 0, 0.07, "square", 0.13);
    this.tone(pitch * 1.5, 0.05, 0.09, "square", 0.1);
  }

  cheese(): void {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((note, i) => this.tone(note, i * 0.05, 0.1, "square", 0.14));
  }

  shield(): void {
    this.tone(220, 0, 0.3, "triangle", 0.3, 1320);
    this.tone(440, 0.04, 0.26, "square", 0.08, 1760);
  }

  shieldBlock(): void {
    this.tone(880, 0, 0.12, "square", 0.14, 220);
    this.crunch(0, 0.08, 0.14);
  }

  rankUp(): void {
    const line = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6];
    line.forEach((note, i) => {
      this.tone(note, i * 0.075, 0.14, "square", 0.14);
      this.tone(note / 2, i * 0.075, 0.14, "triangle", 0.2);
    });
  }

  trapArmed(): void {
    this.tone(180, 0, 0.09, "square", 0.08);
    this.tone(180, 0.14, 0.09, "square", 0.08);
  }

  trapLive(): void {
    this.tone(120, 0, 0.18, "sawtooth", 0.12, 620);
  }

  crash(): void {
    this.crunch(0, 0.36, 0.42);
    this.tone(320, 0, 0.42, "sawtooth", 0.24, 45);
  }

  gameOver(): void {
    [NOTE.G5, NOTE.E5, NOTE.C5, 392].forEach((note, i) => {
      this.tone(note, i * 0.16, 0.2, "square", 0.14);
      this.tone(note / 2, i * 0.16, 0.2, "triangle", 0.2);
    });
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
