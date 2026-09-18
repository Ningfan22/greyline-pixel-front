import assert from 'node:assert/strict';
import {
  adultFrameChoice,
  poseTransitionChoice,
} from '../game/adult-animation.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field adultFrameChoice reads before reaching
// the v110 pose-transition branch.
function stubUnit(overrides = {}) {
  return {
    uid: 7,
    id: 'infantry',
    hp: 100,
    walk: 0,
    backpedaling: false,
    rappelling: false,
    surrendered: false,
    surrenderTime: 0,
    wounded: false,
    crawling: false,
    woundedFromPose: 'idle',
    woundedTime: 0,
    fragThrow: 0,
    tending: false,
    tendingTime: 0,
    overheatedUntil: 0,
    motion: undefined,
    motionTime: 0,
    motionDuration: 0,
    climbing: 0,
    climbDuration: 0,
    signalUntil: 0,
    ackUntil: 0,
    aimUntil: 0,
    reloadingUntil: 0,
    ammoSignalUntil: 0,
    ammoShareUntil: 0,
    scavengeUntil: 0,
    firstAidUntil: 0,
    pose: 'idle',
    moving: false,
    fire: 0,
    suppression: 0,
    flash: 0,
    tactic: 'advance',
    ...overrides,
  };
}

const act = (index) => ({ group: 'actions20', index });

// Drive a unit through a pose change and sample the frames the animator
// returns at each moment. The first draw at t=0 primes poseAnimSeen.
function drive(pose, samples, start = 0) {
  const u = stubUnit({ pose });
  adultFrameChoice(u, start);
  return samples.map(([nextPose, t]) => {
    u.pose = nextPose;
    return adultFrameChoice(u, t);
  });
}

// 趴下必须有中间帧：站立 → 下蹲 → 单膝跪 → 卧倒，而不是直接闪现卧倒帧。
test('stand to prone plays the full drop chain', () => {
  const frames = drive('idle', [
    ['prone', 0.0],
    ['prone', 0.1],
    ['prone', 0.25],
    ['prone', 0.4],
    ['prone', 0.55],
    ['prone', 0.8],
  ]);
  assert.deepEqual(frames.map((f) => f.index), [0, 0, 6, 1, 2, 2]);
  assert.ok(frames.every((f) => f.group === 'actions20'));
});

// 蹲下也要有过渡：站立 → 下蹲 → 单膝跪。
test('stand to crouch plays the drop-in beat', () => {
  const frames = drive('idle', [
    ['crouch', 0.0],
    ['crouch', 0.16],
    ['crouch', 0.32],
    ['crouch', 0.6],
  ]);
  assert.deepEqual(frames.map((f) => f.index), [0, 6, 1, 1]);
});

// 起身：卧倒 → 单膝跪 → 半起 → 站立。
test('prone to stand rises through the authored frames', () => {
  const frames = drive('prone', [
    ['idle', 0.0],
    ['idle', 0.16],
    ['idle', 0.32],
    ['idle', 0.48],
    ['idle', 0.8],
  ]);
  assert.deepEqual(frames.map((f) => f.index), [2, 1, 7, 0, 0]);
});

test('crouch to stand rises through the half-rise beat', () => {
  const frames = drive('crouch', [
    ['idle', 0.0],
    ['idle', 0.16],
    ['idle', 0.32],
    ['idle', 0.6],
  ]);
  assert.deepEqual(frames.map((f) => f.index), [1, 7, 0, 0]);
});

test('crouch to prone drops knee-to-deck', () => {
  const frames = drive('crouch', [
    ['prone', 0.0],
    ['prone', 0.16],
    ['prone', 0.4],
  ]);
  assert.deepEqual(frames.map((f) => f.index), [1, 2, 2]);
});

test('prone to crouch pushes up to a knee', () => {
  const frames = drive('prone', [
    ['crouch', 0.0],
    ['crouch', 0.16],
    ['crouch', 0.4],
  ]);
  assert.deepEqual(frames.map((f) => f.index), [2, 1, 1]);
});

// 移动中的姿态切换不播过渡（滑步比直接切换更假），走路/爬行循环直接接管。
test('moving units skip the transition and use gait cycles', () => {
  const u = stubUnit({ pose: 'idle' });
  adultFrameChoice(u, 0);
  u.pose = 'prone';
  u.moving = true;
  u.walk = 1;
  const f = adultFrameChoice(u, 0.1);
  // Prone crawl alternates actions20 12 / 2 — never the stand drop-in frame 6.
  assert.ok([2, 12].includes(f.index), `crawl frame, got ${f.index}`);
  assert.equal(poseTransitionChoice(u, 0.1), null);
});

// 换弹优先于过渡：换弹动画不被姿态切换打断。
test('reload pauses the transition', () => {
  const u = stubUnit({ pose: 'idle' });
  adultFrameChoice(u, 0);
  u.pose = 'prone';
  u.reloadingUntil = 5;
  assert.equal(poseTransitionChoice(u, 1.0), null);
  // Once the reload ends, the remaining chain plays out.
  u.reloadingUntil = 0;
  const f = poseTransitionChoice(u, 1.25);
  assert.deepEqual(f, act(6));
});

// 中弹踉跄优先于过渡。
test('fresh hit flinch pauses the transition', () => {
  const u = stubUnit({ pose: 'idle' });
  adultFrameChoice(u, 0);
  u.pose = 'prone';
  u.flash = 0.5;
  assert.equal(poseTransitionChoice(u, 0.1), null);
});

// hunker 和 crouch 同属低姿，互相切换不播过渡。
test('hunker and crouch share a height class', () => {
  const u = stubUnit({ pose: 'crouch' });
  adultFrameChoice(u, 0);
  u.pose = 'hunker';
  assert.equal(poseTransitionChoice(u, 0.1), null);
});

// 跳跃/落地是瞬态动作，不触发蹲下过渡（否则落地后会莫名其妙跪一下）。
test('jump and land poses do not trigger a crouch transition', () => {
  const u = stubUnit({ pose: 'idle' });
  adultFrameChoice(u, 0);
  u.pose = 'jump';
  assert.equal(poseTransitionChoice(u, 0.1), null);
  u.pose = 'land';
  assert.equal(poseTransitionChoice(u, 0.2), null);
  u.pose = 'idle';
  assert.equal(poseTransitionChoice(u, 0.3), null);
});

// 第一次绘制只记录姿态，不播过渡。
test('first draw primes without transitioning', () => {
  const u = stubUnit({ pose: 'prone' });
  assert.equal(poseTransitionChoice(u, 12.3), null);
  assert.equal(u.poseAnimSeen, 'prone');
  assert.equal(u.poseAnimFrom, undefined);
});

// 过渡窗口结束后姿态归位，且状态被清理。
test('transition settles and clears its bookkeeping', () => {
  const u = stubUnit({ pose: 'idle' });
  adultFrameChoice(u, 0);
  u.pose = 'prone';
  adultFrameChoice(u, 0.1);
  const settled = adultFrameChoice(u, 1.0);
  assert.deepEqual(settled, act(2));
  assert.equal(u.poseAnimFrom, undefined);
});

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`PASS ${r.name}`);
  } else {
    failed++;
    console.error(`FAIL ${r.name}: ${r.error}`);
  }
}
if (failed) process.exit(1);
