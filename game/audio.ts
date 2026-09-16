import { assetUrl } from './asset-url';
import { distantFlashState } from './ambience';
import { CARDS, modelOf, weaponModel } from './cards';
import { pointVisible } from './world';
import { H, type Blast, type GameState } from './engine';
import { CrackTracker } from './bullet-crack';
import type { Ricochet } from './ricochet';
import { listenerDistance, soundDelay } from './acoustics';

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
  private voices = new Set<AudioScheduledSourceNode>();
  private playedAt = new Map<string, number>();
  private shots = new Map<number, [number, number, number]>();
  private blasts = new WeakSet<Blast>();
  private ricochets = new WeakSet<Ricochet>();
  private cracks = new CrackTracker();
  private crackNoise: AudioBuffer | null = null;
  private state: GameState | null = null;
  private lastRumbleCycle = -1;
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
    const now = ctx.currentTime;
    if (now - (this.playedAt.get(file) ?? -Infinity) < interval)
      return;
    const edgeDistance = Math.max(
      this.camera - x,
      x - this.camera - this.width,
      0,
    );
    if (edgeDistance > 700) return;
    this.playedAt.set(file, now);
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
    // Speed of sound: distant shots lag behind their muzzle flashes.
    source.start(
      now + soundDelay(listenerDistance(x, this.camera, this.width)),
    );
  }
  /**
   * Low thunder for the horizon flashes. Unlike `sample` this ignores the
   * 700px cull — the rumble is meant to feel like a battlefront beyond the
   * playable area — and it is delayed so the sound follows the light.
   */
  private distantRumble(x: number) {
    const ctx = this.context,
      buffer = this.buffers.get('rumble.wav');
    if (
      !ctx ||
      !buffer ||
      !this.effectsGain ||
      !this.active ||
      !this.settings.enabled ||
      this.settings.effects === 0
    )
      return;
    const now = ctx.currentTime;
    if (now - (this.playedAt.get('rumble-distant') ?? -Infinity) < 6) return;
    const edgeDistance = Math.max(
      this.camera - x,
      x - this.camera - this.width,
      0,
    );
    this.playedAt.set('rumble-distant', now);
    if (this.voices.size >= 22) {
      const oldest = this.voices.values().next().value;
      oldest?.stop();
      if (oldest) this.voices.delete(oldest);
    }
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner(),
      filter = ctx.createBiquadFilter();
    source.buffer = buffer;
    source.playbackRate.value = 0.62;
    gain.gain.value = 0.13 * clamp(1 - edgeDistance / 1600, 0.2, 1);
    pan.pan.value = clamp(
      (x - this.camera - this.width / 2) / (this.width * 0.65),
      -1,
      1,
    );
    filter.type = 'lowpass';
    filter.frequency.value = 240;
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
    source.start(now + 0.25 + edgeDistance / 2600);
  }
  update(s: GameState, camera: number, width: number, active: boolean) {
    this.camera = camera;
    this.width = width;
    if (this.state !== s) {
      this.state = s;
      this.shots.clear();
      this.blasts = new WeakSet();
      this.ricochets = new WeakSet();
      this.cracks.reset();
      this.playedAt.clear();
      this.lastRumbleCycle = -1;
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
    // v95: supersonic rounds skipping off armour whine as they fly off.
    for (const r of s.ricochets) {
      if (this.ricochets.has(r)) continue;
      this.ricochets.add(r);
      if (!active || !pointVisible(s, 0, r.x, r.y)) continue;
      this.ricochetWhine(r.x, r.seed);
    }
    const flash = distantFlashState(s.time);
    if (flash.active && flash.index !== this.lastRumbleCycle) {
      this.lastRumbleCycle = flash.index;
      this.distantRumble(flash.x);
    }
    // Supersonic rounds that streak past the camera produce a ballistic
    // crack — the single most recognisable sound of a real firefight.
    if (active) {
      const listenerX = camera + width / 2,
        listenerY = H / 2;
      for (const p of s.projectiles) {
        const event = this.cracks.consider(
          p,
          listenerX,
          listenerY,
          width,
        );
        if (event) this.crack(event.closeness, event.pan, event.seed);
      }
    }
    if (this.shots.size > s.units.length + 120) {
      const live = new Set(s.units.map((u) => u.uid));
      for (const uid of this.shots.keys())
        if (!live.has(uid)) this.shots.delete(uid);
    }
  }

  /**
   * Synthesised bullet crack: a short white-noise burst split into a sharp
   * bandpass transient (the sonic-boom "crack") and a lowpass body (the
   * passing weight). No audio asset needed — the noise buffer is generated
   * once with a deterministic xorshift so the audio path consumes no
   * simulation randomness.
   */
  private crack(closeness: number, pan: number, seed: number) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.effectsGain ||
      !this.active ||
      !this.settings.enabled ||
      this.settings.effects === 0
    )
      return;
    const now = ctx.currentTime;
    if (now - (this.playedAt.get('crack') ?? -Infinity) < 0.085) return;
    this.playedAt.set('crack', now);
    if (!this.crackNoise) {
      const len = Math.floor(ctx.sampleRate * 0.25),
        buffer = ctx.createBuffer(1, len, ctx.sampleRate),
        data = buffer.getChannelData(0);
      let state = 0x1234abcd;
      for (let i = 0; i < len; i++) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        data[i] = ((state >>> 16) & 0xffff) / 0x8000 - 1;
      }
      this.crackNoise = buffer;
    }
    if (this.voices.size >= 22) {
      const oldest = this.voices.values().next().value;
      oldest?.stop();
      if (oldest) this.voices.delete(oldest);
    }
    const source = ctx.createBufferSource(),
      panNode = ctx.createStereoPanner(),
      crackGain = ctx.createGain(),
      thumpGain = ctx.createGain(),
      crackFilter = ctx.createBiquadFilter(),
      thumpFilter = ctx.createBiquadFilter();
    source.buffer = this.crackNoise;
    source.playbackRate.value = 0.92 + seed * 0.02;
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 2500 + seed * 220;
    crackFilter.Q.value = 0.8;
    thumpFilter.type = 'lowpass';
    thumpFilter.frequency.value = 420;
    const level = 0.08 + closeness * 0.3;
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(level, now + 0.004);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(level * 0.55, now + 0.007);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    panNode.pan.value = pan;
    source.connect(crackFilter);
    crackFilter.connect(crackGain);
    source.connect(thumpFilter);
    thumpFilter.connect(thumpGain);
    crackGain.connect(panNode);
    thumpGain.connect(panNode);
    panNode.connect(this.effectsGain);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      crackFilter.disconnect();
      thumpFilter.disconnect();
      crackGain.disconnect();
      thumpGain.disconnect();
      panNode.disconnect();
    };
    source.start();
  }

  /**
   * Synthesised ricochet whine: a sawtooth glissando screaming down from
   * ~4.2 kHz to ~600 Hz over 0.16 s, layered with the same bandpass noise
   * used for the bullet crack. The "zzzip" of a round skipping off armour
   * is the second most recognisable sound of a real firefight.
   */
  private ricochetWhine(x: number, seed: number) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.effectsGain ||
      !this.active ||
      !this.settings.enabled ||
      this.settings.effects === 0
    )
      return;
    const now = ctx.currentTime;
    if (now - (this.playedAt.get('ricochet') ?? -Infinity) < 0.06) return;
    this.playedAt.set('ricochet', now);
    if (!this.crackNoise) {
      const len = Math.floor(ctx.sampleRate * 0.25),
        buffer = ctx.createBuffer(1, len, ctx.sampleRate),
        data = buffer.getChannelData(0);
      let state = 0x1234abcd;
      for (let i = 0; i < len; i++) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        data[i] = ((state >>> 16) & 0xffff) / 0x8000 - 1;
      }
      this.crackNoise = buffer;
    }
    if (this.voices.size >= 22) {
      const oldest = this.voices.values().next().value;
      oldest?.stop();
      if (oldest) this.voices.delete(oldest);
    }
    const listenerX = this.camera + this.width / 2;
    const dist = Math.abs(x - listenerX);
    const closeness = Math.max(0, 1 - dist / 600);
    if (closeness <= 0) return;
    // The whine travels with the same speed-of-sound lag as gunfire.
    const t = now + soundDelay(dist);
    const pan = Math.max(-1, Math.min(1, (x - listenerX) / (this.width * 0.65)));
    const osc = ctx.createOscillator(),
      noise = ctx.createBufferSource(),
      panNode = ctx.createStereoPanner(),
      oscGain = ctx.createGain(),
      noiseGain = ctx.createGain(),
      noiseFilter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    const startFreq = 4000 + seed * 120;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(580 + seed * 30, t + 0.16);
    noise.buffer = this.crackNoise;
    noise.playbackRate.value = 1.05 + seed * 0.03;
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.value = 1.4;
    noiseFilter.frequency.setValueAtTime(3100 + seed * 160, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(
      900 + seed * 60,
      t + 0.16,
    );
    const level = 0.05 + closeness * 0.16;
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(level, t + 0.003);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(level * 0.5, t + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    panNode.pan.value = pan;
    osc.connect(oscGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    oscGain.connect(panNode);
    noiseGain.connect(panNode);
    panNode.connect(this.effectsGain);
    this.voices.add(osc);
    this.voices.add(noise);
    const done = () => {
      this.voices.delete(osc);
      this.voices.delete(noise);
      osc.disconnect();
      noise.disconnect();
      noiseFilter.disconnect();
      oscGain.disconnect();
      noiseGain.disconnect();
      panNode.disconnect();
    };
    osc.onended = done;
    noise.onended = done;
    osc.start(t);
    noise.start(t);
    osc.stop(t + 0.22);
    noise.stop(t + 0.22);
  }
}
let instance: BattleAudio | null = null;
export function getBattleAudio() {
  return (instance ??= new BattleAudio());
}
