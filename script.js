// Cursor-driven eye movement for the Mochi mascot video.
// Same video-scrubbing technique as the reference footer component:
// instead of animating anything, we seek a pre-recorded clip to whichever
// frame already shows Mochi looking closest to the cursor's direction.
//
// Source: Mochi-eyes-only.mp4 (HERO COMING SOON folder), upscaled to true
// 4K (5120x2160, Topaz) then frame-interpolated to 120fps (596 frames,
// from the 24fps original).
//
// THIS CLIP MOVES ONLY THE EYES. His head and nose are completely still;
// only the pupils travel, so every frame is sharp (nothing large to
// motion-blur) and the pupil is a clean thing to measure. It also means he
// looks at the cursor but does not turn his head.
//
// THE CLIP IS THE SAME LAP REPEATED. The pupils trace one clockwise
// circle (right, down, left, then back across the middle to the right)
// about every 1.5s, three times over. Using all of it made every direction
// appear three times at three different moments, and moving between the
// copies played the whole lap in between: the eyes visibly darted. So only
// ONE lap is used: frames 170-349 (1.4167s-2.9167s). The frame after the
// last one (f350) is measured to match f170 to within normal frame-to-frame
// noise (mean squared pixel difference 1.5 against 1.3 between neighbours;
// pupils 0.8-1.4px apart), so the lap is a seamless ring and the position
// wraps around it (LOOP_START / LOOP_LEN). Around the ring the pupil angle
// rises by 359 degrees with no backward step, so each direction has exactly
// one place on it.
//
// WHAT THE TABLE MEASURES: the direction each pupil has moved from its
// resting position, averaged over a 40ms window to remove ~2px of pixel
// jitter. The pupil is found by colour: it is near-neutral grey-black
// where the fur is strongly brown, and the navy background (also dark and
// neutral) touches the frame edge, so anything connected to the edge is
// thrown out. The right pupil is used (found in 588 of 596 frames) and gaps
// are interpolated. Frames within 10px of centre are left out: the pupil
// jitters by ~2px, so under ~10px the direction is noise.
//
// Limits of the footage:
//  - Range is small and lopsided: up to ~60px sideways and ~40px down,
//    but only ~11-15px up. The ring crosses the middle on its way from
//    up-left to right, so every "upward" cursor gets that slight glance.
//  - The middle of the ring (REST_TIME) is the closest thing to a
//    straight-ahead look, and he opens on it. It is a single point on the
//    lap, so it is not used as a "return to centre" pose: from most looks
//    the way to it runs round the ring. While the cursor is on his face
//    the eyes just hold their look.

const TAU = Math.PI * 2;
const wrappedAngle = (a) => ((a % TAU) + TAU) % TAU;

// [angleInRadians, videoTimeInSeconds, pupilOffsetInSourcePixels] — screen
// convention: 0 = right, pi/2 = down, pi = left, 3pi/2 = up. Angle is the
// direction the pupil has moved from its resting position, and the last
// value is how far it has moved (how strong the look is).
const GAZE_FRAMES = [
  [3.50457, 1.41667, 40.0],
  [3.52501, 1.42500, 39.5],
  [3.54327, 1.43333, 38.4],
  [3.55803, 1.44167, 37.5],
  [3.57287, 1.45000, 35.9],
  [3.57872, 1.45833, 31.7],
  [3.59124, 1.46667, 26.8],
  [3.62376, 1.47500, 22.2],
  [3.69135, 1.48333, 17.3],
  [3.79379, 1.49167, 12.9],
  [3.95548, 1.50000, 11.4],
  [4.13593, 1.50833, 10.6],
  [4.34450, 1.51667, 10.0],
  [4.71239, 1.53333, 10.2],
  [4.87190, 1.54167, 11.1],
  [4.99479, 1.55000, 12.1],
  [5.09118, 1.55833, 13.0],
  [5.20909, 1.56667, 13.3],
  [5.28447, 1.57500, 14.6],
  [5.37950, 1.58333, 14.7],
  [5.48755, 1.59167, 15.2],
  [5.54561, 1.60000, 16.9],
  [5.54225, 1.60833, 19.4],
  [5.58479, 1.61667, 21.0],
  [5.59125, 1.62500, 23.8],
  [5.63395, 1.63333, 25.1],
  [5.66285, 1.64167, 26.9],
  [5.70119, 1.65000, 28.6],
  [5.72740, 1.65833, 30.1],
  [5.75111, 1.66667, 31.7],
  [5.74529, 1.67500, 34.0],
  [5.77129, 1.68333, 35.2],
  [5.79461, 1.69167, 36.6],
  [5.81347, 1.70000, 38.3],
  [5.83263, 1.70833, 39.6],
  [5.84770, 1.71667, 41.3],
  [5.86576, 1.72500, 43.0],
  [5.88701, 1.73333, 44.3],
  [5.90733, 1.74167, 45.5],
  [5.93001, 1.75000, 46.9],
  [5.94326, 1.75833, 47.7],
  [5.95763, 1.76667, 48.2],
  [5.97058, 1.77500, 49.1],
  [5.98307, 1.78333, 50.0],
  [5.99813, 1.79167, 50.9],
  [6.01988, 1.80000, 51.9],
  [6.03454, 1.80833, 52.9],
  [6.04835, 1.81667, 53.5],
  [6.06248, 1.82500, 54.4],
  [6.07530, 1.83333, 54.9],
  [6.08387, 1.84167, 55.3],
  [6.09094, 1.85000, 55.6],
  [6.09793, 1.85833, 55.9],
  [6.10763, 1.86667, 56.2],
  [6.11535, 1.87500, 56.4],
  [6.12510, 1.88333, 56.8],
  [6.14025, 1.89167, 57.1],
  [6.15347, 1.90000, 57.4],
  [6.16366, 1.90833, 57.5],
  [6.18400, 1.91667, 58.0],
  [6.20107, 1.92500, 58.3],
  [6.22461, 1.93333, 58.4],
  [6.24826, 1.94167, 59.0],
  [6.27143, 1.95000, 59.5],
  [0.00434, 1.95833, 59.9],
  [0.02818, 1.96667, 60.3],
  [0.04772, 1.97500, 60.8],
  [0.06585, 1.98333, 61.1],
  [0.08109, 1.99167, 61.5],
  [0.09896, 2.00000, 61.7],
  [0.11169, 2.00833, 61.9],
  [0.12484, 2.01667, 61.8],
  [0.13965, 2.02500, 61.6],
  [0.15949, 2.03333, 61.6],
  [0.17234, 2.04167, 61.2],
  [0.19101, 2.05000, 60.8],
  [0.20550, 2.05833, 60.5],
  [0.21856, 2.06667, 60.2],
  [0.23004, 2.07500, 59.7],
  [0.25280, 2.08333, 59.6],
  [0.27199, 2.09167, 59.6],
  [0.29307, 2.10000, 59.3],
  [0.31822, 2.10833, 59.1],
  [0.34097, 2.11667, 58.9],
  [0.35925, 2.12500, 58.5],
  [0.37903, 2.13333, 57.8],
  [0.39878, 2.14167, 57.1],
  [0.42188, 2.15000, 56.1],
  [0.45036, 2.15833, 55.2],
  [0.47858, 2.16667, 53.9],
  [0.51056, 2.17500, 52.3],
  [0.54373, 2.18333, 50.8],
  [0.57617, 2.19167, 49.2],
  [0.60874, 2.20000, 47.9],
  [0.63871, 2.20833, 46.7],
  [0.65848, 2.21667, 45.9],
  [0.68146, 2.22500, 45.1],
  [0.70271, 2.23333, 44.3],
  [0.72211, 2.24167, 43.6],
  [0.74598, 2.25000, 42.7],
  [0.77487, 2.25833, 41.7],
  [0.80540, 2.26667, 40.3],
  [0.84044, 2.27500, 39.3],
  [0.88481, 2.28333, 37.8],
  [0.94135, 2.29167, 36.1],
  [1.02908, 2.30000, 34.3],
  [1.13933, 2.30833, 32.5],
  [1.27230, 2.31667, 30.7],
  [1.41235, 2.32500, 29.9],
  [1.55729, 2.33333, 29.6],
  [1.66798, 2.34167, 29.7],
  [1.75864, 2.35000, 30.0],
  [1.85252, 2.35833, 30.5],
  [1.93386, 2.36667, 31.1],
  [1.99905, 2.37500, 31.6],
  [2.06528, 2.38333, 32.2],
  [2.13607, 2.39167, 32.7],
  [2.18846, 2.40000, 33.3],
  [2.24885, 2.40833, 33.9],
  [2.30340, 2.41667, 34.6],
  [2.35420, 2.42500, 35.4],
  [2.39965, 2.43333, 36.1],
  [2.44644, 2.44167, 36.9],
  [2.49258, 2.45000, 37.8],
  [2.54746, 2.45833, 38.9],
  [2.60177, 2.46667, 40.2],
  [2.65857, 2.47500, 41.6],
  [2.71823, 2.48333, 43.1],
  [2.76804, 2.49167, 44.3],
  [2.80550, 2.50000, 45.4],
  [2.83695, 2.50833, 46.2],
  [2.85821, 2.51667, 47.0],
  [2.87538, 2.52500, 47.5],
  [2.89299, 2.53333, 48.2],
  [2.91489, 2.54167, 48.8],
  [2.93554, 2.55000, 49.4],
  [2.95723, 2.55833, 49.6],
  [2.97947, 2.56667, 49.9],
  [2.99783, 2.57500, 50.1],
  [3.01586, 2.58333, 50.2],
  [3.03570, 2.59167, 50.5],
  [3.05282, 2.60000, 50.8],
  [3.06732, 2.60833, 50.9],
  [3.08501, 2.61667, 51.3],
  [3.10247, 2.62500, 51.6],
  [3.11656, 2.63333, 51.9],
  [3.13046, 2.64167, 52.1],
  [3.14427, 2.65000, 52.2],
  [3.15500, 2.65833, 52.2],
  [3.16266, 2.66667, 52.2],
  [3.17343, 2.67500, 52.1],
  [3.18406, 2.68333, 52.3],
  [3.19170, 2.69167, 52.3],
  [3.20697, 2.70000, 52.4],
  [3.21927, 2.70833, 52.3],
  [3.23159, 2.71667, 52.3],
  [3.24713, 2.72500, 52.2],
  [3.25967, 2.73333, 52.1],
  [3.26919, 2.74167, 52.0],
  [3.28202, 2.75000, 51.9],
  [3.28903, 2.75833, 51.6],
  [3.29350, 2.76667, 51.1],
  [3.30428, 2.77500, 50.8],
  [3.31496, 2.78333, 50.4],
  [3.32419, 2.79167, 50.1],
  [3.34049, 2.80000, 49.7],
  [3.35070, 2.80833, 49.2],
  [3.35755, 2.81667, 48.8],
  [3.36811, 2.82500, 48.4],
  [3.37966, 2.83333, 47.7],
  [3.38698, 2.84167, 47.0],
  [3.39788, 2.85000, 46.3],
  [3.41371, 2.85833, 45.8],
  [3.41971, 2.86667, 45.1],
  [3.43122, 2.87500, 43.9],
  [3.44525, 2.88333, 43.0],
  [3.45927, 2.89167, 41.9],
  [3.46783, 2.90000, 40.9],
  [3.48781, 2.90833, 39.5],
];

// The point on screen that cursor direction is measured FROM -- the
// nose, i.e. the visual centre of the face, at rest in the source's
// 5120x2160 space (located by the same colour method as before: the nose
// is a greyer brown than the fur). His head never moves in this clip, so
// this is simply where his face is.
const SRC_W = 5120, SRC_H = 2160;

// The seamless lap inside the clip (see the header): playback and the
// table only ever use [LOOP_START, LOOP_START + LOOP_LEN), and moving
// between two poses takes the shorter way round that ring.
const LOOP_START = 170 / 120;
const LOOP_LEN = 180 / 120;
const ANCHOR_X = 2573, ANCHOR_Y = 736;

// How close to the nose counts as "you're looking right at him", in
// source pixels (scaled to the rendered size at runtime). Sized against
// the face in the rest pose: his eyes sit about 220px from the nose in
// this space, so this covers the muzzle and both eyes with a little
// margin.
const REST_RADIUS_SRC = 300;

// The pose he opens on, before the cursor has told him where to look: the
// frame at the middle of the lap where the pupils are closest to centre
// (f183, about 10px off, eyes nearly straight ahead and a touch up).
const REST_TIME = 1.52917;

// Pick by a combined cost: angular error (degrees) plus a small penalty
// per second of temporal jump from the current position (wrapped around
// the loop point). A real, deliberate direction change always wins on
// angular error alone, no matter how far away in the clip it sits -- the
// gap is tens or hundreds of degrees, which swamps any reasonable
// temporal penalty. But the recording isn't a perfectly clean sweep --
// it has natural head jitter, so nearby angles are sometimes served by
// two different, imperfect candidates: a whole nearby cluster that's
// SLIGHTLY less accurate, and an isolated frame elsewhere in the clip
// that's fractionally more accurate. Picking on accuracy alone made the
// target flip back and forth between those two for a continuous, tiny
// cursor move -- a real oscillation, not a rendering artifact.
//
// Tuned against a battery simulating a human moving the mouse
// everywhere: circles round the face at three radii, plus rasters,
// S-curves and corner flicks. This value is specific to the table and
// must be re-swept whenever it is regenerated. For the eyes-only table
// the eyes wander, so the same direction sits at several times in the
// clip and this needs to be much higher than it was for the head clip:
// flips between those copies only stop at 8 (34 at 2, 6 at 4, none from
// 8 up). Accuracy is identical from 6 upward (median 7 degrees, 75%
// within 15), so 8 gives up nothing for the stability.
const CONTINUITY_WEIGHT = 8; // degrees of accuracy traded per second of jump avoided

// How strongly turned the head should be, from how far the cursor is
// from his nose. Direction alone is ambiguous here: the same direction
// shows up in the footage as a small nudge on the way out of the rest
// pose and again as a full turn later on (to the right, a barely-moved
// nose at 0.4s and a full profile at 1.5s). Matching on direction alone
// kept choosing the nudge because it was closer in time, so a cursor at
// the far right edge got a head that had barely turned. Cursor distance
// is the normalized radius used for direction (0 at the nose, 1 at the
// edge); a full-strength pose is wanted from about 60% of the way out.
// Strength is only a tie-breaker between candidates in nearly the same
// direction: the weight below is low enough that direction still wins.
const FULL_POSE_SRC = 55;       // pupil offset, in source pixels, of a full-strength look
const FULL_POSE_RADIUS = 0.6;   // cursor distance at which a full-strength turn is wanted
const HYSTERESIS_DEG = 3; // a new frame must beat the current one by this many degrees of cost
const POSE_STRENGTH_WEIGHT = 3; // degrees of direction error traded per eighth of a full pose (12.5%) of strength mismatch

function timeForAngle(angle, currentTime, loopDuration, wantStrength) {
  const target = wrappedAngle(angle);
  let bestTime = GAZE_FRAMES[0][1];
  let bestCost = Infinity;
  let currentCost = null;
  for (const [sampleAngle, time, sampleStrength] of GAZE_FRAMES) {
    const diff = Math.abs(target - sampleAngle);
    const angularDistDeg = Math.min(diff, TAU - diff) * (180 / Math.PI);
    // The lap is a ring, so "closer in time" has to account for wrapping
    // around its seam too.
    let temporalDist = currentTime == null ? 0 : Math.abs(time - currentTime);
    if (loopDuration) temporalDist = Math.min(temporalDist, loopDuration - temporalDist);
    const strengthCost = wantStrength == null
      ? 0
      : (POSE_STRENGTH_WEIGHT * 8 * Math.abs(sampleStrength - wantStrength)) / FULL_POSE_SRC;
    const cost = angularDistDeg + CONTINUITY_WEIGHT * temporalDist + strengthCost;
    if (currentTime != null && Math.abs(time + 1 / 240 - currentTime) < 1e-6) currentCost = cost;
    if (cost < bestCost) {
      bestCost = cost;
      bestTime = time;
    }
  }
  // Hysteresis: stay on the current frame unless another is clearly better.
  // The footage has a gap in its directions (the pupil crosses the middle
  // quickly, so ~230-300 degrees is thinly covered): a cursor resting near
  // the gap sits almost exactly between two candidates, and a hand's
  // tremor would flip the eyes back and forth between them.
  if (currentCost != null && currentCost - bestCost < HYSTERESIS_DEG) return currentTime;
  return bestTime + 1 / 240;
}

function initMochiGaze() {
  const video = document.getElementById('mochi-video');
  if (!video) return;

  // Snapping video.currentTime straight to the target frame reads as
  // "robotic" — an instant pose swap with no transition. So we move
  // toward the new target at a FIXED, constant speed (seconds of footage
  // per second of real time) — never faster for a big jump, never
  // slower for a small one. A distance-scaled or eased duration was
  // tried first, but both mean the effective speed changes depending on
  // how far the jump is, which is exactly the "speed keeps jumping up"
  // feeling being fixed here. With a much denser frame table (see
  // GAZE_FRAMES), most real cursor movement only ever needs a small
  // time-delta anyway, so the constant rate reads as smooth rather than
  // slow — it only becomes noticeable, evenly, on a genuinely large
  // swing.
  //
  // This is the calm-versus-snappy dial. The eyes-only footage wanders
  // (right, left, right...), so any move between distant times plays
  // through the frames in between; at 6 that read as the eyes darting
  // about. 1.8 is the speed this page originally shipped with and settled
  // on for the first clip, and it is the smooth setting: a 1.5s move
  // takes about 0.8s instead of 0.25s.
  const EASE_RATE = 10; // per second: distance left is closed at this rate once under MAX_SPEED / EASE_RATE
  const MAX_SPEED = 1.8; // seconds of footage per second of real time, constant

  let frame = 0;
  let desiredTime = REST_TIME;
  let lastTickTs = null;
  let pointer = null;
  let animating = false;
  const mobile = window.matchMedia('(max-width: 860px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const tick = (ts) => {
    frame = 0;
    if (mobile.matches) { animating = false; lastTickTs = null; return; }
    if (lastTickTs == null) lastTickTs = ts;
    const dt = Math.min((ts - lastTickTs) / 1000, 0.1);
    lastTickTs = ts;
    if (video.readyState >= 2 && !video.seeking) {
      // Position is a phase on the ring [0, LOOP_LEN). Take the shorter
      // way round to the target, so a target just across the seam is a
      // short hop instead of a sweep through the whole lap.
      const wrapPhase = (x) => ((x % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
      const phase = wrapPhase(video.currentTime - LOOP_START);
      let diff = wrapPhase(desiredTime - LOOP_START) - phase;
      if (diff > LOOP_LEN / 2) diff -= LOOP_LEN;
      else if (diff < -LOOP_LEN / 2) diff += LOOP_LEN;
      if (Math.abs(diff) > 1 / 240) {
        // Constant speed on a long move, easing out over the last stretch:
        // speed shrinks in proportion to the distance left, so the eyes
        // settle onto the target instead of stopping dead.
        const speed = Math.min(MAX_SPEED, EASE_RATE * Math.abs(diff));
        const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
        video.currentTime = LOOP_START + wrapPhase(phase + step);
      }
    }
    if (animating) frame = requestAnimationFrame(tick);
  };
  const startAnimating = () => {
    animating = true;
    lastTickTs = null;
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const updateTarget = () => {
    if (mobile.matches || !pointer) return;
    const rect = video.getBoundingClientRect();
    const scale = Math.max(rect.width / SRC_W, rect.height / SRC_H);
    const anchorX = rect.left + rect.width / 2 + (ANCHOR_X - SRC_W / 2) * scale;
    const anchorY = rect.top + rect.height / 2 + (ANCHOR_Y - SRC_H / 2) * scale;
    const dx = pointer.x - anchorX;
    const dy = pointer.y - anchorY;
    // The anchor (the character's eyes) isn't screen-centered — it sits
    // well above the vertical middle. Raw pixel dx/dy would mean the
    // literal top corners, which are close to the anchor vertically but
    // far horizontally, read as barely-diagonal ("mostly left/right")
    // instead of a true 45°. Normalizing each axis by its own distance
    // to the relevant edge (left/right/top/bottom) makes every screen
    // corner map to an actual diagonal regardless of where the anchor
    // happens to sit, which is what "follow the mouse" should feel like.
    const leftDist = Math.max(anchorX - rect.left, 1);
    const rightDist = Math.max(rect.right - anchorX, 1);
    const topDist = Math.max(anchorY - rect.top, 1);
    const bottomDist = Math.max(rect.bottom - anchorY, 1);
    const normDx = dx / (dx < 0 ? leftDist : rightDist);
    const normDy = dy / (dy < 0 ? topDist : bottomDist);
    // With the cursor on his face there's no direction left to redirect
    // toward, so the eyes simply stay where they are. Sending them to a
    // "look straight ahead" pose instead was tried: that pose is a single
    // point on the lap, so from most looks (down, for one) the shortest
    // route to it runs a long way round the ring and the eyes swung across
    // to the far side and back every time the cursor crossed his face.
    //
    // The zone is in real pixels, not the normalized units above (those
    // are divided by the distance from the anchor to each edge, so the same
    // normalized threshold is a different pixel distance on every side), and
    // it keeps the cursor out of the region where angle is hypersensitive.
    // The radius is defined in source pixels and scaled with the video, so
    // it stays pinned to his face at any viewport size: it covers the muzzle
    // and both eyes.
    const restRadius = REST_RADIUS_SRC * scale;
    // Always track the target exactly, with no "ignore small changes"
    // gate — that gate used to compare each new target only against
    // wherever desiredTime already was, so a long run of individually
    // tiny mouse steps (any real, continuous cursor movement) could each
    // slip under the threshold and never update anything, silently
    // piling up real drift between where the head was aiming and where
    // the cursor actually was. A full-page raster sweep exposed just how
    // far that drift could go (over 40 degrees off in testing) despite
    // every single step looking "negligible" on its own. The easing in
    // tick() already makes tiny, frequent target changes smooth rather
    // than jittery, so there was never a need for this extra gate.
    if (Math.hypot(dx, dy) <= restRadius) return;
    desiredTime = timeForAngle(
      Math.atan2(normDy, normDx),
      desiredTime,
      LOOP_LEN,
      FULL_POSE_SRC * Math.min(1, Math.hypot(normDx, normDy) / FULL_POSE_RADIUS)
    );
  };
  const move = (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    updateTarget();
  };
  // Mobile autoplay: play only the seamless lap, jumping back to its start
  // as it ends (the clip as a whole does not loop cleanly).
  const loopEnd = LOOP_START + LOOP_LEN;
  const keepLapLooping = (_now, meta) => {
    if (video.paused || !mobile.matches) return;
    const at = meta ? meta.mediaTime : video.currentTime;
    if (at >= loopEnd - 1 / 120 || at < LOOP_START - 0.05) {
      video.currentTime = LOOP_START + Math.max(0, at - loopEnd);
    }
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(keepLapLooping);
  };
  video.addEventListener('timeupdate', () => {
    if (!video.requestVideoFrameCallback) keepLapLooping();
  });
  const ready = () => {
    video.loop = false;
    if (video.currentTime < LOOP_START || video.currentTime >= loopEnd) {
      video.currentTime = mobile.matches ? LOOP_START : REST_TIME;
    }
    if (mobile.matches && !reducedMotion.matches) {
      video.play().then(() => {
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(keepLapLooping);
      }).catch(() => { /* leave the poster/first frame visible */ });
    } else {
      video.pause();
      if (!mobile.matches) { updateTarget(); startAnimating(); }
    }
  };

  video.addEventListener('loadeddata', ready);
  mobile.addEventListener('change', ready);
  reducedMotion.addEventListener('change', ready);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('resize', updateTarget);
  window.addEventListener('scroll', updateTarget, { passive: true });
  if (video.readyState >= 2) ready();
}

function initSignupForm() {
  const form = document.getElementById('signup-form');
  const note = document.getElementById('form-note');
  if (!form || !note) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Cosmetic only — there's no email service wired up yet.
    note.textContent = "Thanks — we'll let you know!";
    note.classList.add('is-success');
    form.reset();
  });
}

function initLoadingBadge() {
  const video = document.getElementById('mochi-video');
  const badge = document.getElementById('loading-badge');
  if (!video || !badge) return;
  const hide = () => badge.classList.add('is-hidden');
  if (video.readyState >= 2) { hide(); return; }
  video.addEventListener('loadeddata', hide, { once: true });
}

// Missing media fallbacks: if the scrub video or the wordmark image can't be
// loaded, show the still mascot and a text wordmark instead of a stuck
// loading badge and a broken image.
function initMediaFallbacks() {
  const video = document.getElementById('mochi-video');
  const hero = document.querySelector('.hero-full');
  const badge = document.getElementById('loading-badge');
  if (video && hero) {
    const useStill = () => {
      hero.classList.add('no-video');
      if (badge) badge.classList.add('is-hidden');
    };
    const sources = video.querySelectorAll('source');
    const last = sources[sources.length - 1];
    if (last) last.addEventListener('error', useStill);
    video.addEventListener('error', useStill);
    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) useStill();
  }

  const wordmark = document.querySelector('.wordmark');
  if (wordmark) {
    const useText = () => {
      const text = document.createElement('span');
      text.className = 'wordmark-text';
      text.textContent = wordmark.alt || 'Mochi';
      wordmark.replaceWith(text);
    };
    if (wordmark.complete && wordmark.naturalWidth === 0) useText();
    else wordmark.addEventListener('error', useText, { once: true });
  }
}

initMediaFallbacks();
initMochiGaze();
initSignupForm();
initLoadingBadge();
