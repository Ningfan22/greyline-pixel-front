# v151 — veteran squad fire discipline

This release differentiates the veteran squad from commandos by actual combat
behavior. It is NOT the rejected moving-reload art experiment, and does not
claim the whole animation/card roster is finished.

## Delivered behavior

- Veterans no longer use the commando's 1-second / 1.5× ambush opening shot.
- Six-person veteran squads instead perform covered, sequential magazine
  changes. A stationary member with 1–12 rounds and reserve ammunition can
  start only with two healthy, settled same-squad riflemen within 120 horizontal
  / 32 lane distance who recently fired and can see and hit the current enemy.
- The target must be an infantry contact beyond 100. Rush, withdrawal, terrain
  motion, movement, uncompleted stance changes, treatment, digging, grenade
  throws, suppression ≥55, morale <40 and pending repositioning prevent starts.
- One voluntary drill per squad; an already-dry/reloading living mate also
  prevents another start. The real 2.5-second reload clock and existing authored
  standing/knee/prone magazine frames are reused. No new pose or command gesture.
- No firing with an unseated magazine. The completed drill deducts exactly the
  missing rounds from reserve, never grants free ammunition, and does not speed
  firing. Escape orders still allow movement. Ordinary safe-lull top-ups remain.
- Preserve 4 cost, 6 members, 260 total health, 96 discipline, existing 35%
  direct-hit morale/suppression mitigation, IDs, owned copies, deck data, rarity,
  economy and approved flavor. Card short rules stay within 15 characters.
- The scan uses the existing squad index and stops expensive covering-line
  checks after two valid riflemen. No new whole-army scan or artwork download.

## Evidence

- `tests/v151-veteran-team.test.mjs`: seven tests cover independent roles,
  invalid covering states, one-at-a-time gating, real both-side firing/reload,
  all eight magazine cels, exact ammunition accounting, retreat/rush/close
  contact, and actual bullet damage without the old ambush multiplier.
- Controlled 90-second simulation (same 6-member squad, one non-shooting durable
  infantry target, flat ground): old behavior 516 shots / 2.50s longest whole-
  squad firing gap; new behavior 489 shots / 1.167s longest gap / 27 voluntary
  drills. This demonstrates continuity at a modest throughput cost in this
  scenario, not a universal balance or win-rate claim.
- `scripts/qa-v151-veterans.mjs`: 1,440 production-rendered Napi frames across
  both sides and standing/kneeling/prone states. Actual rendered image identity
  checked for all eight reload cels; other squad members fired through each
  drill. Rendering does not mutate units. Representative outputs inspected:
  `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v151-veterans-pDZiRP`.
- 168 focused v135–v151 checks pass. TypeScript and Pages build pass.
- All 170 historical gameplay checks pass, including three complete seeded
  matches: 13 draw at 600s (1000:1000), 71 blue victory at 267.5s, 102 blue
  victory at 309.5s. The first run caught an overlong new card rule; shortened
  it to “双人掩护，逐个换弹。” and reran the entire suite successfully.
- No browser/device QA or FPS benchmark was performed in this background
  continuation. No preview tab was opened; existing user browser view preserved.

## Still open

Moving reloads still use locomotion rather than a complete authored moving
magazine drill; the rejected art remains local outside public assets. Other
overlapping cards, movement/effect visual coverage and broader balance trials
remain part of the active goal. This slice introduces no new explosion or
building changes and does not claim those screenshots newly verified here.
