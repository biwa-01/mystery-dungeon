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
    masterGain.gain.value = 0.75;
    masterGain.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.55;
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
let titleBgmActive = false;
let villageBgmActive = false;

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
  titleBgmActive = false;
  villageBgmActive = false;
  emergencyBgmActive = false;
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
  bgmGain.gain.linearRampToValueAtTime(0.08, ac.currentTime + 0.15);
}

export function unduckBGM() {
  if (!bgmGain) return;
  const ac = getCtx();
  bgmGain.gain.cancelScheduledValues(ac.currentTime);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, ac.currentTime);
  bgmGain.gain.linearRampToValueAtTime(0.55, ac.currentTime + 1.2);
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
  // Deep reverb tail
  setTimeout(() => {
    playSynth('sine', 200, 0.6, 0.06, 60);
    playSynth('sine', 150, 0.8, 0.04, 40);
    playNoise(0.5, 0.04, 300, 'lowpass');
  }, 200);
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

// Item drop sound (コトッ)
export function sfxDrop() {
  playSynth('sine', 300, 0.06, 0.12, 150);
  playSynth('sine', 180, 0.04, 0.08, 90);
  playNoise(0.03, 0.06, 2000, 'highpass');
}

// Whiff / miss swing (空振りの虚無音)
export function sfxWhiff() {
  playNoise(0.1, 0.08, 1200, 'bandpass');
  playSynth('sine', 400, 0.06, 0.04, 200);
}

// HP pinch heartbeat (HPピンチ心拍音)
export function sfxHeartbeat() {
  const ac = getCtx();
  if (!sfxGain) return;
  const t = ac.currentTime;
  // Double thump like a heartbeat
  playSynth('sine', 50, 0.12, 0.08, 35);
  setTimeout(() => playSynth('sine', 55, 0.1, 0.06, 30), 120);
}

// Auto-pickup jingle (自動拾い音)
export function sfxAutoPickup() {
  playSynth('sine', 700, 0.06, 0.1);
  setTimeout(() => playSynth('sine', 900, 0.08, 0.08), 40);
}

// Slime split/burst sound (ポチャッ)
export function sfxSplit() {
  playSynth('sine', 200, 0.12, 0.18, 80);
  playNoise(0.08, 0.12, 800, 'bandpass');
  playSynth('sine', 120, 0.15, 0.1, 60);
  setTimeout(() => {
    playSynth('sine', 160, 0.1, 0.08, 70);
    playNoise(0.06, 0.06, 600, 'lowpass');
  }, 60);
}

// Hunger stomach growl (ギュルル)
export function sfxStomachGrowl() {
  const ac = getCtx();
  if (!sfxGain) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.linearRampToValueAtTime(80, t + 0.15);
  osc.frequency.linearRampToValueAtTime(50, t + 0.3);
  osc.frequency.linearRampToValueAtTime(70, t + 0.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.04, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.15);
  g.gain.linearRampToValueAtTime(0.02, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 200;
  osc.connect(flt).connect(g).connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.7);
}

// Monster spell charge (magic buildup)
export function sfxSpellCharge() {
  playSynth('sine', 300, 0.4, 0.06, 800);
  playSynth('triangle', 450, 0.35, 0.04, 1200);
  playNoise(0.3, 0.05, 3000, 'highpass');
}

// Typewriter click for combat log
export function sfxTypeClick() {
  playNoise(0.02, 0.03, 4000, 'highpass');
}

// Heavy meaty impact sound (グシャッ)
export function sfxHitMeat() {
  playSynth('sine', 80, 0.08, 0.25, 30);
  playNoise(0.06, 0.2, 600, 'lowpass');
  playSynth('square', 60, 0.1, 0.12, 25, 150);
}

// Sword swing / whoosh without impact (素振り)
export function sfxSwing() {
  playNoise(0.12, 0.15, 1200, 'bandpass');
  playSynth('sine', 600, 0.08, 0.05, 200);
}

// Attack miss with "MISS" feel (空振り音 - distinct from sfxWhiff)
export function sfxMiss2() {
  playNoise(0.15, 0.12, 900, 'bandpass');
  playSynth('sine', 500, 0.1, 0.06, 250);
  // slight descending tone for "failure"
  setTimeout(() => playSynth('sine', 350, 0.08, 0.04, 200), 80);
}

// Eating/chewing sound (モシャモシャ)
export function sfxEatFood() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      playNoise(0.04, 0.12, 800, 'lowpass');
      playSynth('sine', 120 + Math.random() * 40, 0.03, 0.06, 80);
    }, i * 70);
  }
}

// Gulp/swallow sound (ゴクッ)
export function sfxDrinkPotion() {
  playSynth('sine', 300, 0.08, 0.12, 150);
  setTimeout(() => {
    playSynth('sine', 200, 0.06, 0.08, 100);
    playNoise(0.04, 0.06, 500, 'lowpass');
  }, 50);
}

// Paper unfurl + magic sound
export function sfxReadScroll() {
  playNoise(0.15, 0.1, 3000, 'highpass'); // paper
  playSynth('sine', 800, 0.2, 0.06, 1200); // magic shimmer
  setTimeout(() => {
    playSynth('triangle', 1000, 0.15, 0.04, 1500);
    playNoise(0.08, 0.05, 5000, 'highpass');
  }, 100);
}

// Metal clank for weapon/shield equip
export function sfxEquip() {
  playSynth('square', 800, 0.04, 0.15, 300, 2000);
  playNoise(0.06, 0.12, 3000, 'highpass');
  playSynth('sine', 400, 0.08, 0.06, 200);
}

// Ominous curse discovery sound
export function sfxCurseReveal() {
  playSynth('sawtooth', 100, 0.3, 0.12, 60, 200);
  playSynth('sine', 150, 0.25, 0.08, 80);
  setTimeout(() => playNoise(0.15, 0.08, 400, 'lowpass'), 100);
}

// Distant monster appearance
export function sfxMonsterSpawn() {
  playSynth('sawtooth', 60, 0.2, 0.06, 40, 150);
  playNoise(0.12, 0.04, 600, 'bandpass');
}

// Explosive trap trigger (バツン！)
export function sfxTrapBurst() {
  playNoise(0.08, 0.3, 2000, 'highpass'); // initial burst
  playSynth('square', 200, 0.06, 0.25, 50);
  playSynth('sine', 100, 0.15, 0.15, 30); // sub bass
  setTimeout(() => {
    playNoise(0.15, 0.12, 800, 'bandpass'); // debris
    playSynth('sine', 60, 0.2, 0.08, 25);
  }, 60);
}

// Death/game over: BGM stop + dissonant chord
export function sfxGameOver() {
  stopBGM();
  // Dissonant descending chord
  const ac = getCtx();
  if (!sfxGain) return;
  const t = ac.currentTime;
  const notes = [200, 237, 178, 133]; // tritone-heavy dissonance
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = i < 2 ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + 3);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(800, t);
    flt.frequency.exponentialRampToValueAtTime(100, t + 3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3);
    osc.connect(flt).connect(g).connect(sfxGain!);
    osc.start(t + i * 0.1);
    osc.stop(t + 3);
  });
}

// Staff waving magic release
export function sfxStaffWave() {
  playSynth('sine', 400, 0.15, 0.1, 800);
  playSynth('triangle', 600, 0.12, 0.06, 1200);
  playNoise(0.1, 0.08, 4000, 'highpass');
  setTimeout(() => {
    playSynth('sine', 800, 0.2, 0.05, 1500);
  }, 80);
}

// Material-specific pickup sounds
export function sfxItemPickupMaterial(category: string) {
  switch(category) {
    case 'weapon': case 'shield':
      // metallic clink
      playSynth('square', 1500, 0.04, 0.1, 600, 3000);
      playNoise(0.03, 0.08, 4000, 'highpass');
      break;
    case 'herb': case 'food':
      // soft rustle
      playNoise(0.06, 0.08, 2000, 'bandpass');
      playSynth('sine', 400, 0.04, 0.04, 300);
      break;
    case 'scroll':
      // paper crinkle
      playNoise(0.05, 0.1, 3500, 'highpass');
      break;
    case 'gold':
      // coin jingle
      playSynth('sine', 2000, 0.06, 0.1, 3000);
      setTimeout(() => playSynth('sine', 2500, 0.04, 0.08, 3500), 30);
      setTimeout(() => playSynth('sine', 3000, 0.03, 0.06, 4000), 60);
      break;
    default:
      playSynth('sine', 800, 0.06, 0.06, 400);
  }
}

// HP-based BGM tension modulation
export function modulateBGMTension(hpRatio: number) {
  if (!bgmGain) return;
  const ac = getCtx();
  const now = ac.currentTime;
  let targetGain: number;
  if (hpRatio < 0.25) {
    targetGain = 0.65;
  } else if (hpRatio < 0.5) {
    targetGain = 0.6;
  } else {
    targetGain = 0.55;
  }
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
  bgmGain.gain.linearRampToValueAtTime(targetGain, now + 0.5);
}

// ================================================================
//  TITLE BGM: Ethereal, mysterious atmosphere
// ================================================================

export function startTitleBGM() {
  if (titleBgmActive) return;
  stopBGM();
  titleBgmActive = true;
  const ac = getCtx();
  if (!bgmGain) return;
  bgmPlaying = true;

  // Layer 1: Deep pad - C minor chord (ethereal)
  const padNotes = [65.41, 77.78, 98.0]; // C2, Eb2, G2
  for (const note of padNotes) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note;
    osc.detune.value = (Math.random() - 0.5) * 6;
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 300;
    flt.Q.value = 0.5;
    const g = ac.createGain();
    g.gain.value = 0.06;
    osc.connect(flt).connect(g).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, flt, g);
  }

  // Layer 2: High shimmering strings
  const shimNotes = [523.25, 622.25, 783.99]; // C5, Eb5, G5
  for (const note of shimNotes) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = note;
    const g = ac.createGain();
    g.gain.value = 0.012;
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08 + Math.random() * 0.04;
    const lfoG = ac.createGain();
    lfoG.gain.value = 0.008;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    osc.connect(g).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, g, lfo, lfoG);
  }

  // Layer 3: Wind noise
  const noise = ac.createBufferSource();
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 10, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nf = ac.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 300;
  nf.Q.value = 0.3;
  const ng = ac.createGain();
  ng.gain.value = 0.035;
  const noiseLfo = ac.createOscillator();
  noiseLfo.type = 'sine';
  noiseLfo.frequency.value = 0.04;
  const noiseLfoG = ac.createGain();
  noiseLfoG.gain.value = 150;
  noiseLfo.connect(noiseLfoG).connect(nf.frequency);
  noiseLfo.start();
  noise.connect(nf).connect(ng).connect(bgmGain);
  noise.start();
  bgmNodes.push(noise, nf, ng, noiseLfo, noiseLfoG);

  // Layer 4: Slow melodic bells (pentatonic)
  function scheduleTitleBell() {
    if (!bgmPlaying || !titleBgmActive || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const scale = [261.63, 311.13, 392.0, 523.25, 622.25, 783.99];
    const note = scale[Math.floor(Math.random() * scale.length)];
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note;
    const g = ac2.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 5);
    const rvb = ac2.createBiquadFilter();
    rvb.type = 'lowpass';
    rvb.frequency.value = 1500;
    osc.connect(rvb).connect(g).connect(bgmGain!);
    osc.start(t);
    osc.stop(t + 5);
    const timer = setTimeout(scheduleTitleBell, 4000 + Math.random() * 6000);
    bgmTimers.push(timer);
  }
  const t1 = setTimeout(scheduleTitleBell, 1000);
  bgmTimers.push(t1);

  // Layer 5: Sub-bass heartbeat pulse
  function scheduleTitlePulse() {
    if (!bgmPlaying || !titleBgmActive || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(40, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 1.5);
    const g = ac2.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    osc.connect(g).connect(bgmGain!);
    osc.start(t);
    osc.stop(t + 1.5);
    const timer = setTimeout(scheduleTitlePulse, 6000 + Math.random() * 4000);
    bgmTimers.push(timer);
  }
  const t2 = setTimeout(scheduleTitlePulse, 3000);
  bgmTimers.push(t2);
}

export function stopTitleBGM() {
  titleBgmActive = false;
  stopBGM();
}

// ================================================================
//  VILLAGE BGM: Warm, peaceful medieval atmosphere
// ================================================================

export function startVillageBGM() {
  if (villageBgmActive) return;
  stopBGM();
  villageBgmActive = true;
  const ac = getCtx();
  if (!bgmGain) return;
  bgmPlaying = true;

  // Layer 1: Warm major pad (F major)
  const padNotes = [87.31, 110.0, 130.81]; // F2, A2, C3
  for (const note of padNotes) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note;
    osc.detune.value = (Math.random() - 0.5) * 5;
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 350;
    flt.Q.value = 0.4;
    const g = ac.createGain();
    g.gain.value = 0.05;
    osc.connect(flt).connect(g).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, flt, g);
  }

  // Layer 2: Gentle triangle wave harmonics
  const harmNotes = [349.23, 440.0, 523.25]; // F4, A4, C5
  for (const note of harmNotes) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = note;
    const g = ac.createGain();
    g.gain.value = 0.015;
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15 + Math.random() * 0.1;
    const lg = ac.createGain();
    lg.gain.value = 0.01;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    osc.connect(g).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, g, lfo, lg);
  }

  // Layer 3: Birdsong chirps
  function scheduleBird() {
    if (!bgmPlaying || !villageBgmActive || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const baseFreq = 1800 + Math.random() * 1200;
    // 2-3 chirp notes
    const chirps = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < chirps; i++) {
      const osc = ac2.createOscillator();
      osc.type = 'sine';
      const f = baseFreq + (Math.random() - 0.5) * 400;
      osc.frequency.setValueAtTime(f, t + i * 0.08);
      osc.frequency.exponentialRampToValueAtTime(f * 0.8, t + i * 0.08 + 0.06);
      const g = ac2.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.setValueAtTime(0.02, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.07);
      osc.connect(g).connect(bgmGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.08);
    }
    const timer = setTimeout(scheduleBird, 5000 + Math.random() * 8000);
    bgmTimers.push(timer);
  }
  const t1 = setTimeout(scheduleBird, 2000);
  bgmTimers.push(t1);

  // Layer 4: Gentle harp melody (pentatonic F major)
  function scheduleHarp() {
    if (!bgmPlaying || !villageBgmActive || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const scale = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46]; // F4 G4 A4 C5 D5 F5
    const numNotes = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numNotes; i++) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      const osc = ac2.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note;
      const g = ac2.createGain();
      const start = t + i * 0.2;
      g.gain.setValueAtTime(0.03, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 2);
      osc.connect(g).connect(bgmGain!);
      osc.start(start);
      osc.stop(start + 2);
    }
    const timer = setTimeout(scheduleHarp, 6000 + Math.random() * 5000);
    bgmTimers.push(timer);
  }
  const t2 = setTimeout(scheduleHarp, 1500);
  bgmTimers.push(t2);

  // Layer 5: Gentle breeze noise
  const wind = ac.createBufferSource();
  const windBuf = ac.createBuffer(1, ac.sampleRate * 10, ac.sampleRate);
  const wd = windBuf.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
  wind.buffer = windBuf;
  wind.loop = true;
  const wf = ac.createBiquadFilter();
  wf.type = 'lowpass';
  wf.frequency.value = 400;
  wf.Q.value = 0.3;
  const wg = ac.createGain();
  wg.gain.value = 0.02;
  const wlfo = ac.createOscillator();
  wlfo.type = 'sine';
  wlfo.frequency.value = 0.03;
  const wlg = ac.createGain();
  wlg.gain.value = 100;
  wlfo.connect(wlg).connect(wf.frequency);
  wlfo.start();
  wind.connect(wf).connect(wg).connect(bgmGain);
  wind.start();
  bgmNodes.push(wind, wf, wg, wlfo, wlg);

  // Layer 6: Distant church bell (occasional)
  function scheduleChurchBell() {
    if (!bgmPlaying || !villageBgmActive || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    // Rich bell harmonics
    const bellFreqs = [523.25, 659.25, 783.99, 1046.5];
    for (const freq of bellFreqs) {
      const osc = ac2.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ac2.createGain();
      const vol = freq === 523.25 ? 0.025 : 0.008;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 4);
      osc.connect(g).connect(bgmGain!);
      osc.start(t);
      osc.stop(t + 4);
    }
    const timer = setTimeout(scheduleChurchBell, 15000 + Math.random() * 20000);
    bgmTimers.push(timer);
  }
  const t3 = setTimeout(scheduleChurchBell, 5000);
  bgmTimers.push(t3);
}

export function stopVillageBGM() {
  villageBgmActive = false;
  stopBGM();
}

// #21: Combat BGM for monster house encounters (faster, more intense)
let combatBgmActive = false;
export function startCombatBGM() {
  if (combatBgmActive) return;
  stopBGM();
  combatBgmActive = true;
  const ac = getCtx();
  if (!bgmGain) return;
  bgmPlaying = true;

  // Fast aggressive bass drone
  const drone = ac.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 55;
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 350;
  const g = ac.createGain();
  g.gain.value = 0.16;
  drone.connect(flt).connect(g).connect(bgmGain);
  drone.start();
  bgmNodes.push(drone, flt, g);

  // Fast tremolo
  const lfo = ac.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 8;
  const lg = ac.createGain();
  lg.gain.value = 0.08;
  lfo.connect(lg).connect(g.gain);
  lfo.start();
  bgmNodes.push(lfo, lg);

  // High tension strings
  const strNotes = [110, 164.81, 220];
  for (const note of strNotes) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = note;
    const sf = ac.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 700;
    const sg = ac.createGain();
    sg.gain.value = 0.04;
    osc.connect(sf).connect(sg).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, sf, sg);
  }

  // Fast timpani pulse
  function scheduleCombatPulse() {
    if (!bgmPlaying || !combatBgmActive || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(45, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.3);
    const pg = ac2.createGain();
    pg.gain.setValueAtTime(0.1, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(pg).connect(bgmGain!);
    osc.start(t);
    osc.stop(t + 0.3);
    const timer = setTimeout(scheduleCombatPulse, 400 + Math.random() * 200);
    bgmTimers.push(timer);
  }
  const t1 = setTimeout(scheduleCombatPulse, 200);
  bgmTimers.push(t1);
}

export function stopCombatBGM() {
  combatBgmActive = false;
  stopBGM();
}

// #22: Boss floor BGM variant for floor 10, 20, 30
export function startBossFloorBGM(floor: number) {
  stopBGM();
  const ac = getCtx();
  if (!bgmGain) return;
  bgmPlaying = true;

  // Different key based on boss floor
  const bossKeys: Record<number, { root: number; fifth: number; minor3: number }> = {
    10: { root: 73.42, fifth: 110.0, minor3: 87.31 },   // D minor
    20: { root: 55.0, fifth: 82.41, minor3: 65.41 },     // A minor
    30: { root: 46.25, fifth: 69.30, minor3: 55.0 },     // G# minor
  };
  const key = bossKeys[floor] || bossKeys[10];

  // Deep ominous drone
  const drone = ac.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = key.root;
  const df = ac.createBiquadFilter();
  df.type = 'lowpass';
  df.frequency.value = 250;
  df.Q.value = 3;
  const dg = ac.createGain();
  dg.gain.value = 0.18;
  drone.connect(df).connect(dg).connect(bgmGain);
  drone.start();
  bgmNodes.push(drone, df, dg);

  // Dissonant chord
  const chordNotes = [key.root * 2, key.minor3 * 2, key.fifth];
  for (const note of chordNotes) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = note;
    osc.detune.value = (Math.random() - 0.5) * 15;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const cg = ac.createGain();
    cg.gain.value = 0.03;
    osc.connect(f).connect(cg).connect(bgmGain);
    osc.start();
    bgmNodes.push(osc, f, cg);
  }

  // Slow heavy pulse
  function scheduleBossPulse() {
    if (!bgmPlaying || !bgmGain) return;
    const ac2 = getCtx();
    const t = ac2.currentTime;
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(key.root * 0.5, t);
    osc.frequency.exponentialRampToValueAtTime(key.root * 0.25, t + 1.2);
    const pg = ac2.createGain();
    pg.gain.setValueAtTime(0.1, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(pg).connect(bgmGain!);
    osc.start(t);
    osc.stop(t + 1.2);
    const timer = setTimeout(scheduleBossPulse, 2500 + Math.random() * 1000);
    bgmTimers.push(timer);
  }
  const t1 = setTimeout(scheduleBossPulse, 500);
  bgmTimers.push(t1);
}

// #23: Victory fanfare when clearing a floor
export function sfxVictoryFanfare() {
  duckBGM();
  const notes = [523, 587, 659, 784, 880, 1047]; // C5 D5 E5 G5 A5 C6
  notes.forEach((n, i) => {
    setTimeout(() => {
      playSynth('sine', n, 0.25, 0.12);
      playSynth('triangle', n * 0.5, 0.3, 0.06);
    }, i * 100);
  });
  // Final major chord
  setTimeout(() => {
    playSynth('sine', 1047, 0.6, 0.1);
    playSynth('sine', 784, 0.6, 0.08);
    playSynth('sine', 659, 0.6, 0.06);
    playSynth('sine', 523, 0.6, 0.05);
  }, 600);
  setTimeout(unduckBGM, 1800);
}

// #24: Ambient rain sound effect for water-heavy floors
let rainActive = false;
let rainNodes: AudioNode[] = [];
export function startRainAmbience() {
  if (rainActive) return;
  rainActive = true;
  const ac = getCtx();
  if (!bgmGain) return;

  const noise = ac.createBufferSource();
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 10, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nf = ac.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 800;
  nf.Q.value = 0.3;
  const ng = ac.createGain();
  ng.gain.value = 0.06;
  // Slow volume modulation for realistic rain
  const rlfo = ac.createOscillator();
  rlfo.type = 'sine';
  rlfo.frequency.value = 0.05;
  const rlg = ac.createGain();
  rlg.gain.value = 0.02;
  rlfo.connect(rlg).connect(ng.gain);
  rlfo.start();
  noise.connect(nf).connect(ng).connect(bgmGain);
  noise.start();
  rainNodes.push(noise, nf, ng, rlfo, rlg);
}

export function stopRainAmbience() {
  rainActive = false;
  for (const n of rainNodes) {
    try {
      if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') (n as OscillatorNode).stop();
      if ('disconnect' in n) n.disconnect();
    } catch { /* ignore */ }
  }
  rainNodes = [];
}

// #25: Menu open/close sound effects
export function sfxMenuOpen() {
  playSynth('sine', 600, 0.08, 0.1);
  setTimeout(() => playSynth('sine', 800, 0.06, 0.08), 40);
  setTimeout(() => playSynth('sine', 1000, 0.04, 0.06), 80);
}

export function sfxMenuClose() {
  playSynth('sine', 1000, 0.06, 0.08);
  setTimeout(() => playSynth('sine', 700, 0.08, 0.06), 40);
}

// #26: Equipment change sound (different from pickup)
export function sfxEquipChange() {
  // Metallic ringing + leather creak
  playSynth('square', 1200, 0.05, 0.12, 500, 2500);
  playNoise(0.06, 0.08, 3500, 'highpass');
  setTimeout(() => {
    playSynth('sine', 600, 0.1, 0.08, 300);
    playNoise(0.04, 0.06, 1000, 'lowpass'); // leather
  }, 40);
  setTimeout(() => playSynth('sine', 800, 0.08, 0.05, 400), 80);
}

// Initialize audio on first user interaction
// Returns a promise that resolves when AudioContext is fully active
export async function initAudio(): Promise<void> {
  const ac = getCtx();
  if (ac.state === 'suspended') {
    await ac.resume();
  }
  // Some browsers need a silent buffer play to fully unlock audio
  const silent = ac.createBufferSource();
  const buf = ac.createBuffer(1, 1, ac.sampleRate);
  silent.buffer = buf;
  silent.connect(ac.destination);
  silent.start();
}
