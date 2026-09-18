import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
} from '../game/engine.ts';

function arena() {
  const s = createGame(1);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.players[1].played = 0;
  s.aiIn = 0;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function hand(s, ids, energy) {
  s.players[1].hand = ids.map((id, i) => ({ id, uid: 10000 + i, readyAt: 0 }));
  s.players[1].energy = energy;
}

function probe(name, setup) {
  const s = arena();
  setup(s);
  refreshVision(s);
  tick(s, 0.05);
  const played = s.players[1].discard.map((c) => c.id);
  const phase = s.aiPhase;
  const profile = s.aiProfile;
  console.log(
    `${name}: played=[${played.join(',')}] phase=${phase} profile=${JSON.stringify(profile)} playedCount=${s.players[1].played}`,
  );
}

// 1. early economy
probe('1-early-econ', (s) => {
  s.time = 30;
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2850);
  hand(s, ['war_bonds', 'ifv'], 6);
});

// 2. mid AA
probe('2-mid-aa', (s) => {
  s.time = 120;
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2850);
  squad(s, 0, 'helicopter', 2500);
  squad(s, 0, 'helicopter', 2560);
  hand(s, ['aa_gun', 'infantry'], 4);
});

// 3. mid anti-tank
probe('3-mid-antitank', (s) => {
  s.time = 120;
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2850);
  squad(s, 0, 'tank', 2500);
  squad(s, 0, 'tank', 2560);
  hand(s, ['antiarmor', 'infantry'], 4);
});

// 4. mid anti-turtle indirect
probe('4-mid-turtle', (s) => {
  s.time = 120;
  for (let i = 0; i < 4; i++) squad(s, 1, 'infantry', 2800 - i * 24);
  for (let i = 0; i < 3; i++) squad(s, 0, 'infantry', 2500 - i * 30);
  hand(s, ['mortar_carrier', 'infantry'], 5);
});

// 5. late all-in
probe('5-late-allin', (s) => {
  s.time = 400;
  squad(s, 1, 'infantry', 2800);
  hand(s, ['war_bonds', 'reserve_mobilization'], 4);
});
