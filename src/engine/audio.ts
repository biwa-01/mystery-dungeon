// ================================================================
//  WEB AUDIO API - Dynamic Orchestral Sound Engine
//  Floor-aware BGM + Environmental Ambience + All SFX
// ================================================================

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bgmPlaying = false;
let currentBgmFloor = 0;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.25;
    bgmGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ================================================================
//  ZONE KEYS - Floor-based key modulation (every 5 floors)
// ================================================================
const ZONE_KEYS = [
  { root: 65.41, fifth: 98.0, minor3: 77.78, seventh: 123.47 },    // C minor (1-5)
  { root: 73.42, fifth: 110.0, minor3: 87.31, seventh: 138.59 },   // D minor (6-10)
  { root: 55.0, fifth: 82.41, minor3: 65.41, seventh: 103.83 },    // A minor (11-15)
  { root: 61.74, fifth: 92.50, minor3: 73.42, seventh: 116.54 },   // Bb minor (16-20)
  { root: 51.91, fifth: 77.78, minor3: 61.74, seventh: 97.99 },    // Ab minor (21-25)
];

function getZone(floor: number) {
  const idx = Math.min(ZONE_KEYS.length - 1, Math.floor((floor - 1) / 5));
  return ZONE_KEYS[idx];
}

// ================================================================
//  BGM: Dynamic orchestral dungeon soundtrack
// ================================================================
let bgmNodes: AudioNode[] = [];
let bgmTimers: ReturnType<typeof setTimeout>[] = [];
let envTimers: ReturnType<typeof setTimeout>[] = [];

export function startBGM(floor: number = 1) {
  if (bgmPlaying && currentBgmFloor === floor) return;
  if (bgmPlaying) stopBGM();
  const ac = getCtx();
  if (!bgmGain) return;
  bgmPlaying = true;
  currentBgmFloor = floor;
  const zone = getZone(floor);
  const tension = Math.min(1, (floor - 1) / 24); // 0..1 tension ramp

  // Layer 1: Deep drone (root)
  const drone1 = ac.createOscillator();
  drone1.type = 'sawtooth';
  drone1.frequency.value = zone.root;
  const droneFilter1 = ac.createBiquadFilter();
  droneFilter1.type = 'lowpass';
  droneFilter1.frequency.value = 180 + tension * 80;
  droneFilter1.Q.value = 2;
  const droneGain1 = ac.createGain();
  droneGain1.gain.value = 0.14;
  drone1.connect(droneFilter1).connect(droneGain1).connect(bgmGain);
  drone1.start();
  bgmNodes.push(drone1, droneFilter1, droneGain1);

  // Layer 2: Fifth (power chord feel)
  const drone2 = ac.createOscillator();
  drone2.type = 'sine';
  drone2.frequency.value = zone.fifth;
  const droneGain2 = ac.createGain();
  droneGain2.gain.value = 0.07;
  drone2.connect(droneGain2).connect(bgmGain);
  drone2.start();
  bgmNodes.push(drone2, droneGain2);

  // Layer 3: Minor third shimmer with tremolo
  const drone3 = ac.createOscillator();
  drone3.type = 'triangle';
  drone3.frequency.value = zone.minor3 * 2; // octave up
  const droneGain3 = ac.createGain();
  droneGain3.gain.value = 0.03 + tension * 0.02;
  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.12 + tension * 0.08;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.025;
  lfo.connect(lfoGain).connect(droneGain3.gain);
  lfo.start();
  drone3.connect(droneGain3).connect(bgmGain);
  drone3.start();
  bgmNodes.push(drone3, droneGain3, lfo, lfoGain);

  // Layer 4: Strings pad (warm filtered saw chord)
  const stringNotes = [zone.root * 2, zone.fifth, zone.minor3 * 2];
  for (const note of stringNotes) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = note;
    // Slight detune for warmth
    osc.detune.value = (Math.random() - 0.5) * 8;
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 400 + tension * 200;
    flt.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.value = 0.018;
    osc.connect(flt).connect(g).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, flt, g);
  }

  // Layer 5: Filtered noise (cave wind)
  const noise = ac.createBufferSource();
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 10, ac.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 250 + tension * 100;
  noiseFilter.Q.value = 0.4;
  const noiseGain = ac.createGain();
  noiseGain.gain.value = 0.05;
  const noiseLfo = ac.createOscillator();
  noiseLfo.type = 'sine';
  noiseLfo.frequency.value = 0.06;
  const noiseLfoGain = ac.createGain();
  noiseLfoGain.gain.value = 120;
  noiseLfo.connect(noiseLfoGain).connect(noiseFilter.frequency);
  noiseLfo.start();
  noise.connect(noiseFilter).connect(noiseGain).connect(bgmGain);
  noise.start();
  bgmNodes.push(noise, noiseFilter, noiseGain, noiseLfo, noiseLfoGain);

  // Layer 6: Timpani/bass pulse (deeper floors = faster pulse)
  function schedulePulse() {
    if (!bgmPlaying || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(zone.root * 0.5, t);
    osc.frequency.exponentialRampToValueAtTime(zone.root * 0.25, t + 0.8);
    const g = ac2.createGain();
    g.gain.setValueAtTime(0.06 + tension * 0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(g).connect(bgmGain!);
    osc.start(t);
    osc.stop(t + 0.8);
    const interval = 4000 - tension * 2000 + Math.random() * 2000;
    const timer = setTimeout(schedulePulse, interval);
    bgmTimers.push(timer);
  }
  const t1 = setTimeout(schedulePulse, 1500);
  bgmTimers.push(t1);

  // Layer 7: Bell melody (random pentatonic notes from zone)
  function scheduleBell() {
    if (!bgmPlaying || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    const scale = [zone.root * 4, zone.minor3 * 4, zone.fifth * 2, zone.root * 3, zone.seventh * 2];
    osc.frequency.value = scale[Math.floor(Math.random() * scale.length)];
    const g = ac2.createGain();
    g.gain.setValueAtTime(0.025, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    const flt = ac2.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 2000;
    osc.connect(flt).connect(g).connect(bgmGain!);
    osc.start(t);
    osc.stop(t + 3.5);
    const timer = setTimeout(scheduleBell, 3500 + Math.random() * 5000);
    bgmTimers.push(timer);
  }
  const t2 = setTimeout(scheduleBell, 2000);
  bgmTimers.push(t2);

  // Layer 8: Brass stab (high tension floors only)
  if (tension > 0.4) {
    function scheduleBrass() {
      if (!bgmPlaying || !bgmGain) return;
      const ac2 = getCtx();
      const t = ac2.currentTime;
      const notes = [zone.root * 2, zone.fifth, zone.minor3 * 2];
      for (const note of notes) {
        const osc = ac2.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note;
        const flt = ac2.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(800, t);
        flt.frequency.exponentialRampToValueAtTime(200, t + 2);
        const g = ac2.createGain();
        g.gain.setValueAtTime(0.015 * tension, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2);
        osc.connect(flt).connect(g).connect(bgmGain!);
        osc.start(t);
        osc.stop(t + 2);
      }
      const timer = setTimeout(scheduleBrass, 8000 + Math.random() * 6000);
      bgmTimers.push(timer);
    }
    const t3 = setTimeout(scheduleBrass, 5000);
    bgmTimers.push(t3);
  }

  // Environmental: Water dripping
  scheduleWaterDrip();
}

function scheduleWaterDrip() {
  if (!bgmPlaying || !bgmGain) return;
  const ac2 = getCtx();
  const t = ac2.currentTime;
  const osc = ac2.createOscillator();
  osc.type = 'sine';
  const freq = 1200 + Math.random() * 800;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.08);
  const g = ac2.createGain();
  g.gain.setValueAtTime(0.02 + Math.random() * 0.015, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g).connect(bgmGain!);
  osc.start(t);
  osc.stop(t + 0.12);
  const timer = setTimeout(scheduleWaterDrip, 2000 + Math.random() * 6000);
  envTimers.push(timer);
}

export function stopBGM() {
  bgmPlaying = false;
  for (const n of bgmNodes) {
    try {
      if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') (n as OscillatorNode).stop();
      if ('disconnect' in n) n.disconnect();
    } catch { /* ignore */ }
  }
  bgmNodes = [];
  for (const t of bgmTimers) clearTimeout(t);
  bgmTimers = [];
  for (const t of envTimers) clearTimeout(t);
  envTimers = [];
}

// BGM duck for level-up fanfare
export function duckBGM() {
  if (!bgmGain) return;
  const ac = getCtx();
  bgmGain.gain.cancelScheduledValues(ac.currentTime);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, ac.currentTime);
  bgmGain.gain.linearRampToValueAtTime(0.04, ac.currentTime + 0.15);
}

export function unduckBGM() {
  if (!bgmGain) return;
  const ac = getCtx();
  bgmGain.gain.cancelScheduledValues(ac.currentTime);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, ac.currentTime);
  bgmGain.gain.linearRampToValueAtTime(0.25, ac.currentTime + 1.2);
}

// Emergency BGM (for shopkeeper theft etc.)
let emergencyBgmActive = false;
export function startEmergencyBGM() {
  if (emergencyBgmActive) return;
  stopBGM();
  emergencyBgmActive = true;
  const ac = getCtx();
  if (!bgmGain) return;
  bgmPlaying = true;

  // Fast aggressive pulse
  const drone = ac.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 55;
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 300;
  const g = ac.createGain();
  g.gain.value = 0.18;
  drone.connect(flt).connect(g).connect(bgmGain);
  drone.start();
  bgmNodes.push(drone, flt, g);

  // Fast LFO tremolo
  const lfo = ac.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 6;
  const lg = ac.createGain();
  lg.gain.value = 0.1;
  lfo.connect(lg).connect(g.gain);
  lfo.start();
  bgmNodes.push(lfo, lg);

  // High tension string
  const str = ac.createOscillator();
  str.type = 'sawtooth';
  str.frequency.value = 220;
  const sf = ac.createBiquadFilter();
  sf.type = 'lowpass';
  sf.frequency.value = 600;
  const sg = ac.createGain();
  sg.gain.value = 0.06;
  str.connect(sf).connect(sg).connect(bgmGain);
  str.start();
  bgmNodes.push(str, sf, sg);
}

export function stopEmergencyBGM() {
  emergencyBgmActive = false;
  stopBGM();
}

// ================================================================
//  SFX: Procedural sound effects
// ================================================================

function playSynth(
  type: OscillatorType, freq: number, dur: number, vol: number,
  freqEnd?: number, filterFreq?: number, filterType?: BiquadFilterType
) {
  const ac = getCtx();
  if (!sfxGain) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  if (filterFreq) {
    const f = ac.createBiquadFilter();
    f.type = filterType ?? 'lowpass';
    f.frequency.value = filterFreq;
    osc.connect(f).connect(g).connect(sfxGain);
  } else {
    osc.connect(g).connect(sfxGain);
  }
  osc.start(t);
  osc.stop(t + dur);
}

function playNoise(dur: number, vol: number, filterFreq: number, filterType: BiquadFilterType = 'highpass') {
  const ac = getCtx();
  if (!sfxGain) return;
  const t = ac.currentTime;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
}

// Footstep: environment-aware (corridor=hard, room=resonant)
export function sfxFootstep(inCorridor: boolean = false) {
  if (inCorridor) {
    // Hard stone corridor - higher pitch, sharper
    playSynth('sine', 160, 0.06, 0.13, 80, 500);
    playNoise(0.04, 0.1, 2800, 'highpass');
  } else {
    // Room - lower, more resonant
    playSynth('sine', 100, 0.1, 0.15, 50, 350);
    playNoise(0.06, 0.06, 1500, 'highpass');
    playSynth('sine', 60, 0.08, 0.04, 35); // sub resonance
  }
}

// Sword swing (MISS) - whoosh with no impact
export function sfxSwordSwing() {
  playNoise(0.18, 0.22, 1000, 'bandpass');
  playSynth('sawtooth', 900, 0.12, 0.06, 200, 2500);
}

// Hit connect: sharp metal impact
export function sfxHit() {
  playSynth('square', 220, 0.07, 0.28, 90, 700);
  playNoise(0.1, 0.28, 3500, 'highpass');
  playSynth('sine', 350, 0.12, 0.12, 120);
  // Meaty thud
  playSynth('sine', 80, 0.06, 0.15, 40);
}

// Critical hit: massive resonant impact
export function sfxCritical() {
  playSynth('square', 280, 0.12, 0.35, 50, 900);
  playNoise(0.2, 0.35, 4500, 'highpass');
  playSynth('sine', 550, 0.25, 0.18, 70);
  setTimeout(() => {
    playSynth('sine', 400, 0.35, 0.12, 50);
    playNoise(0.15, 0.15, 2000, 'bandpass');
  }, 40);
  // Sub bass hit
  setTimeout(() => playSynth('sine', 45, 0.2, 0.2, 25), 20);
}

// Take damage: low thud + pain
export function sfxDamage() {
  playSynth('sine', 180, 0.15, 0.2, 60);
  playSynth('square', 100, 0.1, 0.15, 40, 300);
}

// Item pickup: ascending chime
export function sfxPickup() {
  playSynth('sine', 600, 0.1, 0.15);
  setTimeout(() => playSynth('sine', 900, 0.1, 0.12), 60);
  setTimeout(() => playSynth('sine', 1200, 0.15, 0.1), 120);
}

// Stairs descent: deep descending tone
export function sfxStairs() {
  playSynth('sine', 400, 0.3, 0.15, 100);
  playSynth('triangle', 300, 0.4, 0.1, 80);
  playNoise(0.3, 0.08, 500, 'lowpass');
}

// Level up: triumphant ascending arpeggio with fanfare
export function sfxLevelUp() {
  duckBGM();
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((n, i) => {
    setTimeout(() => playSynth('sine', n, 0.3, 0.14), i * 90);
    setTimeout(() => playSynth('triangle', n * 0.5, 0.35, 0.07), i * 90);
  });
  // Final chord
  setTimeout(() => {
    playSynth('sine', 1047, 0.5, 0.1);
    playSynth('sine', 784, 0.5, 0.08);
    playSynth('sine', 659, 0.5, 0.06);
  }, 400);
  setTimeout(unduckBGM, 1200);
}

// Heal: soft warm chime
export function sfxHeal() {
  playSynth('sine', 700, 0.2, 0.1);
  setTimeout(() => playSynth('sine', 880, 0.25, 0.08), 100);
}

// Miss / blocked
export function sfxMiss() {
  playNoise(0.08, 0.1, 1500, 'bandpass');
}

// Menu select
export function sfxMenuSelect() {
  playSynth('sine', 800, 0.06, 0.08);
}

// Menu cursor move
export function sfxMenuMove() {
  playSynth('sine', 600, 0.04, 0.05);
}

// Monster defeated
export function sfxDefeat() {
  playSynth('sine', 500, 0.1, 0.12, 200);
  playNoise(0.15, 0.15, 2000, 'highpass');
  setTimeout(() => playSynth('sine', 300, 0.2, 0.08, 100), 80);
}

// Trap triggered
export function sfxTrap() {
  playSynth('square', 150, 0.15, 0.2, 50);
  playNoise(0.1, 0.15, 1000, 'bandpass');
  setTimeout(() => playSynth('sine', 200, 0.1, 0.1, 80), 100);
}

// EXP gain sound (subtle)
export function sfxExpGain() {
  playSynth('sine', 800, 0.08, 0.06);
  setTimeout(() => playSynth('sine', 1000, 0.06, 0.04), 50);
}

// Inventory full "?" sound
export function sfxInventoryFull() {
  playSynth('sine', 400, 0.08, 0.1);
  setTimeout(() => playSynth('sine', 300, 0.12, 0.08), 100);
}

// Death sound (dramatic)
export function sfxDeath() {
  playSynth('sine', 200, 0.5, 0.2, 40);
  playSynth('sawtooth', 150, 0.4, 0.1, 30, 200);
  playNoise(0.4, 0.15, 400, 'lowpass');
  setTimeout(() => {
    playSynth('sine', 100, 0.8, 0.15, 25);
  }, 300);
}

// Shield block: metallic clang
export function sfxShieldBlock() {
  playSynth('square', 1200, 0.06, 0.2, 400, 3000);
  playSynth('sine', 2400, 0.04, 0.1, 800);
  playNoise(0.08, 0.15, 5000, 'highpass');
  setTimeout(() => playSynth('sine', 600, 0.15, 0.06, 200), 30);
}

// Monster attack growl
export function sfxMonsterAttack() {
  playSynth('sawtooth', 80, 0.12, 0.15, 50, 200);
  playNoise(0.08, 0.1, 800, 'bandpass');
}

// Dissolve/vanish (enemy death poof)
export function sfxDissolve() {
  playNoise(0.25, 0.12, 1200, 'bandpass');
  playSynth('sine', 300, 0.2, 0.06, 600);
  setTimeout(() => playNoise(0.15, 0.06, 2000, 'highpass'), 80);
}

// Slash whoosh (sword arc)
export function sfxSlashArc() {
  playNoise(0.12, 0.18, 1500, 'bandpass');
  playSynth('sawtooth', 1200, 0.08, 0.08, 300, 3000);
}

// Lightning/trap zap
export function sfxLightningZap() {
  playNoise(0.08, 0.25, 3000, 'highpass');
  playSynth('square', 800, 0.05, 0.2, 200);
  setTimeout(() => {
    playNoise(0.06, 0.18, 4000, 'highpass');
    playSynth('square', 600, 0.04, 0.15, 150);
  }, 50);
  setTimeout(() => playNoise(0.1, 0.1, 2000, 'bandpass'), 100);
}

// Item identification: satisfying reveal chime
export function sfxIdentify() {
  const ac = getCtx();
  if (!sfxGain) return;
  const t = ac.currentTime;
  // Shining metallic attack
  playSynth('sine', 1800, 0.04, 0.12, 2400);
  setTimeout(() => {
    playSynth('sine', 2200, 0.06, 0.1, 3000);
    playSynth('triangle', 1100, 0.08, 0.05, 1400);
  }, 40);
  setTimeout(() => {
    playSynth('sine', 2800, 0.12, 0.08, 3200);
    playSynth('sine', 1400, 0.15, 0.04, 1600);
  }, 90);
  // Sparkle tail
  setTimeout(() => playNoise(0.1, 0.04, 6000, 'highpass'), 130);
}

// EXP absorption whoosh (subtle)
export function sfxExpAbsorb() {
  playSynth('sine', 400, 0.15, 0.04, 800);
  playSynth('triangle', 600, 0.12, 0.03, 1000);
}

// Dodge/miss whoosh (enemy evades)
export function sfxDodge() {
  playNoise(0.1, 0.12, 1800, 'bandpass');
  playSynth('sine', 500, 0.06, 0.05, 300);
}

// Initialize audio on first user interaction
export function initAudio() {
  getCtx();
}
