import { assetUrl } from './asset-url';
import { CARDS, modelOf, weaponModel } from './cards';
import { pointVisible } from './world';
import type { Blast, GameState } from './engine';

export interface AudioSettings {
  enabled: boolean;
  effects: number;
  music: number;
}
export const DEFAULT_AUDIO: AudioSettings = {
  enabled: true,
  effects: 0.65,
  music: 0.22,
};
const STORAGE = 'greyline-audio-v1';
const FILES = [
  'rifle-1.wav',
  'rifle-2.wav',
  'sniper.wav',
  'explosion.wav',
  'explosion-small.wav',
  'rumble.wav',
  'rotor.wav',
  'step-1.wav',
  'step-2.wav',
  'step-3.wav',
  'searching.mp3',
];
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

/** Recorded public audio, mixed locally. No simulation random values are consumed. */
export class BattleAudio {
  settings = { ...DEFAULT_AUDIO };
  private context: AudioContext | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private retryAfter = 0;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicOffset = 0;
  private musicStarted = 0;
  private active = false;
  private voices = new Set<AudioBufferSourceNode>();
  private playedAt = new Map<string, number>();
  private shots = new Map<number, [number, number, number]>();
  private blasts = new WeakSet<Blast>();
  private state: GameState | null = null;
  private camera = 0;
  private width = 1280;
  private variation = 0;
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
      if (saved)
        this.settings = {
          enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true,
          effects: Number.isFinite(saved.effects)
            ? clamp(saved.effects)
            : DEFAULT_AUDIO.effects,
          music: Number.isFinite(saved.music)
            ? clamp(saved.music)
            : DEFAULT_AUDIO.music,
        };
    } catch {
      /* Storage is optional. */
    }
  }
  configure(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    this.settings.effects = clamp(this.settings.effects);
    this.settings.music = clamp(this.settings.music);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(this.settings));
    } catch {
      /* Optional. */
    }
    this.applyVolumes();
    if (!this.settings.enabled) {
      this.stopVoices();
      this.stopMusic();
    } else this.startMusic();
  }
  /** Call from a click/touch, so mobile browsers can authorize the audio context. */
  async unlock() {
    if (!this.settings.enabled) return;
    if (!this.context) {
      const ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!ctor) return;
      this.context = new ctor();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.18;
      this.effectsGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.effectsGain.connect(compressor);
      this.musicGain.connect(compressor);
      compressor.connect(this.context.destination);
      this.applyVolumes();
    }
    const ctx = this.context;
    try {
      await ctx.resume();
    } catch {
      return;
    }
    if (!this.loading && performance.now() >= this.retryAfter) {
      const missing = FILES.filter((file) => !this.buffers.has(file));
      if (missing.length)
        this.loading = Promise.allSettled(
          missing.map(async (file) => {
            const controller = new AbortController();
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const buffer = await Promise.race([
                (async () => {
                  const response = await fetch(assetUrl('/audio/' + file), {
                    signal: controller.signal,
                  });
                  if (!response.ok) throw new Error('Audio unavailable');
                  return ctx.decodeAudioData(await response.arrayBuffer());
                })(),
                new Promise<AudioBuffer>((_, reject) => {
                  timer = setTimeout(() => {
                    controller.abort();
                    reject(new Error('Audio timed out'));
                  }, 10000);
                }),
              ]);
              this.buffers.set(file, buffer);
              this.startMusic();
            } finally {
              clearTimeout(timer);
            }
          }),
        )
          .then((results) => {
            this.retryAfter = results.some(
              (result) => result.status === 'rejected',
            )
              ? performance.now() + 3000
              : 0;
          })
          .finally(() => {
            this.loading = null;
          });
    }
    await this.loading;
    this.startMusic();
  }
  private applyVolumes() {
    if (!this.context) return;
    const enabled = this.settings.enabled && this.active;
    this.effectsGain?.gain.setTargetAtTime(
      enabled ? this.settings.effects : 0,
      this.context.currentTime,
      0.025,
    );
    this.musicGain?.gain.setTargetAtTime(
      enabled ? this.settings.music * 0.55 : 0,
      this.context.currentTime,
      0.12,
    );
  }
  setActive(value: boolean) {
    if (this.active === value) return;
    this.active = value;
    this.applyVolumes();
    if (value) this.startMusic();
    else {
      this.stopVoices();
      this.stopMusic();
    }
  }
  private startMusic() {
    const buffer = this.buffers.get('searching.mp3'),
      ctx = this.context;
    if (
      !ctx ||
      !buffer ||
      !this.musicGain ||
      this.musicSource ||
      !this.active ||
      !this.settings.enabled
    )
      return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start(0, this.musicOffset % buffer.duration);
    this.musicStarted = ctx.currentTime;
    this.musicSource = source;
  }
  private stopMusic() {
    if (!this.musicSource || !this.context) return;
    this.musicOffset += this.context.currentTime - this.musicStarted;
    this.musicSource.stop();
    this.musicSource.disconnect();
    this.musicSource = null;
  }
  private stopVoices() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.voices.clear();
  }
  private sample(
    file: string,
    x: number,
    level: number,
    interval = 0.055,
    pitch = 1,
  ) {
    const ctx = this.context,
      buffer = this.buffers.get(file);
    if (
      !ctx ||
      !buffer ||
      !this.effectsGain ||
      !this.active ||
      !this.settings.enabled ||
      this.settings.effects === 0
    )
      return;
    if (ctx.currentTime - (this.playedAt.get(file) ?? -Infinity) < interval)
      return;
    const edgeDistance = Math.max(
      this.camera - x,
      x - this.camera - this.width,
      0,
    );
    if (edgeDistance > 700) return;
    this.playedAt.set(file, ctx.currentTime);
    if (this.voices.size >= 22) {
      const oldest = this.voices.values().next().value;
      oldest?.stop();
      if (oldest) this.voices.delete(oldest);
    }
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    const pan = ctx.createStereoPanner(),
      filter = ctx.createBiquadFilter();
    source.buffer = buffer;
    source.playbackRate.value = pitch;
    gain.gain.value = level / (1 + edgeDistance / 150);
    pan.pan.value = clamp(
      (x - this.camera - this.width / 2) / (this.width * 0.65),
      -1,
      1,
    );
    filter.type = 'lowpass';
    filter.frequency.value = Math.max(1500, 11000 - edgeDistance * 15);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.effectsGain);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    source.start();
  }
  update(s: GameState, camera: number, width: number, active: boolean) {
    this.camera = camera;
    this.width = width;
    if (this.state !== s) {
      this.state = s;
      this.shots.clear();
      this.blasts = new WeakSet();
      this.playedAt.clear();
    }
    this.setActive(active);
    const visible = new Set(s.visible[0]);
    for (const u of s.units) {
      const foot = Math.floor(u.walk / 4),
        previous = this.shots.get(u.uid) ?? [0, 0, foot];
      this.shots.set(u.uid, [u.shots, u.secondaryShots, foot]);
      if (!active || (u.side !== 0 && !visible.has(u.uid))) continue;
      const card = CARDS[u.id],
        model = weaponModel(u);
      if (u.shots > previous[0] && u.fire > 0) {
        if (card.attackRun === 'bomb') {
          /* Explosions are heard on impact. */
        } else if (model === 'tank' || card.indirect || card.emplacement)
          this.sample('explosion-small.wav', u.x, 0.34, 0.18, 0.85);
        else if (model === 'rocket')
          this.sample('rumble.wav', u.x, 0.22, 0.25, 1.25);
        else if (model === 'sniper') this.sample('sniper.wav', u.x, 0.3, 0.09);
        else
          this.sample(
            ++this.variation % 2 ? 'rifle-1.wav' : 'rifle-2.wav',
            u.x,
            model === 'machinegun' || card.attackRun === 'strafe' ? 0.25 : 0.2,
            0.05,
            0.97 + (this.variation % 4) * 0.02,
          );
      }
      if (u.secondaryShots > previous[1] && u.secondaryFire > 0)
        this.sample('rifle-2.wav', u.x, 0.22, 0.065, 0.87);
      if (
        u.hp > 0 &&
        !u.wounded &&
        !u.surrendered &&
        card.members &&
        u.moving &&
        u.motion === 'ground' &&
        u.pose !== 'prone' &&
        foot !== previous[2] &&
        Math.abs(u.x - camera - width / 2) < 400
      )
        this.sample(`step-${1 + ((u.uid + foot) % 3)}.wav`, u.x, 0.07, 0.22);
      if (
        u.hp > 0 &&
        card.air &&
        !card.sortie &&
        !card.oneWay &&
        modelOf(u.id) === 'helicopter'
      )
        this.sample('rotor.wav', u.x, 0.085, 3.8, card.observer ? 1.4 : 0.88);
    }
    for (const b of s.blasts) {
      if (this.blasts.has(b)) continue;
      this.blasts.add(b);
      if (!active || b.age > 0.2 || !pointVisible(s, 0, b.x, b.y)) continue;
      if (b.kind === 'penetration')
        this.sample('explosion-small.wav', b.x, 0.12, 0.09, 1.7);
      else if (b.kind === 'grenade')
        this.sample('explosion-small.wav', b.x, 0.32, 0.09, 1.12);
      else {
        this.sample(
          'explosion.wav',
          b.x,
          b.kind === 'artillery' ? 0.56 : 0.42,
          0.09,
          0.94,
        );
        if (b.kind === 'artillery' || b.kind === 'wreck')
          this.sample('rumble.wav', b.x, 0.28, 0.35, 0.9);
      }
    }
    if (this.shots.size > s.units.length + 120) {
      const live = new Set(s.units.map((u) => u.uid));
      for (const uid of this.shots.keys())
        if (!live.has(uid)) this.shots.delete(uid);
    }
  }
}
let instance: BattleAudio | null = null;
export function getBattleAudio() {
  return (instance ??= new BattleAudio());
}
