// Torneko 3-style procedural pixel-art sprite system
// 16x16 pixel grid, warm vibrant colors, SD/chibi proportions

type Color = string;
type SpriteData = (Color | null)[][];

const C = null;

function fromArt(art: string[], palette: Record<string, Color>): SpriteData {
  return art.map(row =>
    row.split('').map(ch => ch === '.' ? null : palette[ch] ?? null)
  );
}

// =================== PLAYER SPRITES (Torneko-style merchant) ===================

const PL = {
  h: '#8B5E3C', H: '#A67B5B', // hair (brown)
  s: '#F2C18D', S: '#FDDCAA', // skin
  e: '#1A1A2E', E: '#ffffff', // eyes
  m: '#C0392B',               // mouth
  t: '#1E5FAA', T: '#3B82F6', // tunic (blue)
  w: '#F0F0F0', W: '#ffffff', // white shirt
  p: '#6B4423', P: '#8B6340', // pants/boots
  b: '#4A3520',               // belt
  g: '#D4A840', G: '#F0C860', // gold buckle
};

export const SPRITE_PLAYER_DOWN: SpriteData = fromArt([
  '......hHh.......',
  '.....hHHHh......',
  '....hHHHHHh.....',
  '....sSeESeS.....',
  '....sSSSSSs.....',
  '....sSSsmSs.....',
  '.....ssssss.....',
  '....tTwwwTt.....',
  '...tTTwgwTTt....',
  '...tTTTbTTTt....',
  '...tTTTTTTTt....',
  '....tTTTTTt.....',
  '....PPpPpPP.....',
  '....PP...PP.....',
  '...PPP...PPP....',
  '...bb.....bb....',
], PL);

export const SPRITE_PLAYER_UP: SpriteData = fromArt([
  '......hHh.......',
  '.....hHHHh......',
  '....hHHHHHh.....',
  '....hHHHHHh.....',
  '....hHHHHHh.....',
  '....hHHHHHh.....',
  '.....hHHHh......',
  '....tTwwwTt.....',
  '...tTTwwwTTt....',
  '...tTTTbTTTt....',
  '...tTTTTTTTt....',
  '....tTTTTTt.....',
  '....PPpPpPP.....',
  '....PP...PP.....',
  '...PPP...PPP....',
  '...bb.....bb....',
], PL);

export const SPRITE_PLAYER_ARMED: SpriteData = fromArt([
  '......hHh..G....',
  '.....hHHHh.GG...',
  '....hHHHHHhGGG..',
  '....sSeESeS.GG..',
  '....sSSSSSsG....',
  '....sSSsmSs.....',
  '.....ssssss.....',
  '....tTwwwTt.....',
  '...tTTwgwTTt....',
  '...tTTTbTTTt....',
  '...tTTTTTTTt....',
  '....tTTTTTt.....',
  '....PPpPpPP.....',
  '....PP...PP.....',
  '...PPP...PPP....',
  '...bb.....bb....',
], PL);

// =================== MONSTER SPRITES (Torneko 3-style) ===================

// --- SLIME (classic blue-green blob with shine) ---
const MS = { a: '#20A040', A: '#40D060', B: '#60E880', s: '#90F8A8', e: '#1A1A2E', w: '#ffffff', m: '#186830' };
export const SPRITE_SLIME: SpriteData = fromArt([
  '................',
  '................',
  '................',
  '......AAA.......',
  '....AABBBAa.....',
  '...ABBsBBBBa....',
  '...ABsBBBBBa....',
  '..ABBeABBeBAa...',
  '..ABBwABBwBAa...',
  '..ABBBBBBBBAa...',
  '..ABBBmmmBBAa...',
  '...ABBBBBBAa....',
  '....AAAAAA......',
  '.....aaaa.......',
  '................',
  '................',
], MS);

// --- RAT (brown furry with pink ears) ---
const MR = { b: '#8B6340', B: '#A67B5B', D: '#C4956E', d: '#5C3A1E', e: '#1A1A2E', w: '#ffffff', n: '#F4A0A0', p: '#FFB0B0', t: '#D4A070' };
export const SPRITE_RAT: SpriteData = fromArt([
  '................',
  '..pp.......pp...',
  '.pBp......pBp...',
  '.pBBd....dBBp...',
  '..dBBbbbbBBd....',
  '...BDBBBBDBb....',
  '...BeBBBBeBb....',
  '...BwBBBBwBb....',
  '...BBBBBBBBb....',
  '...BBBnnBBBb....',
  '....bBBBBb......',
  '.....bbbb.......',
  '....bb..bb......',
  '...bb....bb.....',
  '..bb......bb.t..',
  '.bb........bttt.',
], MR);

// --- GHOST (translucent white/lavender) ---
const MG = { w: '#D8D0F0', W: '#F0ECF8', l: '#B8A8E0', e: '#4A2080', p: '#8060C0', b: '#6040A0', g: '#A090D0' };
export const SPRITE_GHOST: SpriteData = fromArt([
  '................',
  '.....WWWW.......',
  '....WWWWWW......',
  '...WWWWWWWl.....',
  '...WpWWWpWl.....',
  '...WbWWWbWl.....',
  '...WWWWWWWl.....',
  '...WWWeWWWl.....',
  '...WWWWWWWl.....',
  '....WWWWWl......',
  '....gWWWWg......',
  '...gWWWWWWg.....',
  '..gWgWWgWWgW....',
  '..g.gWg.gWg.g...',
  '......g...g.....',
  '................',
], MG);

// --- BAT (purple with spread wings) ---
const MB = { p: '#8040C0', P: '#A060E0', Q: '#C090F0', d: '#4A1880', e: '#1A1A2E', w: '#ffffff', r: '#B080E0' };
export const SPRITE_BAT: SpriteData = fromArt([
  '................',
  '................',
  'p..........p....',
  'pP........Pp....',
  'pPQ..PP..QPp....',
  'pPQPPPPPQPPp....',
  '.PQPQPPQPQP.....',
  '.PPPePPePPp.....',
  '..PPwPPwPPp.....',
  '..pPPPPPPp......',
  '...pPppPp.......',
  '....pppp........',
  '................',
  '................',
  '................',
  '................',
], MB);

// --- SKELETON (bone white with glowing eyes, sword) ---
const MK = { w: '#F0E8D0', W: '#FFF8E8', d: '#A09070', r: '#CC3333', R: '#FF4444', s: '#B0A890', g: '#808080', G: '#A0A0A0' };
export const SPRITE_SKELETON: SpriteData = fromArt([
  '......wwww......',
  '.....wWWWWw.....',
  '....wWWWWWWw....',
  '....wRWWWRWw....',
  '....wWWWWWWw....',
  '....wdswwsdw....',
  '.....wwwwww.....',
  '......wWw...G...',
  '.....wWWWw..GG..',
  '....wWwWwWwGGG..',
  '...wW.wWw.GG....',
  '..wW..wWw.G.....',
  '......wWw.......',
  '.....ww.ww......',
  '....ww...ww.....',
  '...ww.....ww....',
], MK);

// --- THIEF (golden goblin-like) ---
const MT = { g: '#D4A840', G: '#F0C860', Y: '#FFF0A0', d: '#8B6830', b: '#6B4820', e: '#1A1A2E', w: '#ffffff', s: '#A08030', c: '#AA3030' };
export const SPRITE_THIEF: SpriteData = fromArt([
  '................',
  '.....ggggg......',
  '....gGGGGGg.....',
  '...gGYGGYGGg....',
  '...gGeGGGeGg....',
  '...gGwGGGwGg....',
  '...gGGGGGGGg....',
  '...gGGcccGGg....',
  '...gGGGGGGGg....',
  '....gGGGGGg.....',
  '.....ggggg......',
  '....ss..ss......',
  '...ss....ss.....',
  '..ss......ss....',
  '................',
  '................',
], MT);

// --- MUSHROOM (poisonous purple-red cap with white spots) ---
const MM = { r: '#C03050', R: '#E04070', P: '#F06090', w: '#FFF8F0', s: '#8B6840', S: '#A08050', t: '#C4A070', e: '#1A1A2E' };
export const SPRITE_MUSHROOM: SpriteData = fromArt([
  '................',
  '.....rrrr.......',
  '....rRRRRr......',
  '...rRRwRRRr.....',
  '..rRPRRwRPRr....',
  '..rRRRRRRRRr....',
  '..rRwRRRRwRr....',
  '...rrRRRRrr.....',
  '....sSSSs.......',
  '....sSeSs.......',
  '....sSeSs.......',
  '....sSSSs.......',
  '...sStttSs......',
  '..ssSSSSSss.....',
  '.sssSSSSSsss....',
  '................',
], MM);

// --- POLYGON / SPLIT SLIME (cyan crystal) ---
const MP = { c: '#30B8D0', C: '#60D8F0', D: '#A0F0FF', d: '#1880A0', e: '#1A1A2E', w: '#ffffff', s: '#20A0B8' };
export const SPRITE_POLYGON: SpriteData = fromArt([
  '................',
  '.......c........',
  '......cDc.......',
  '.....cDCCc......',
  '....cDCCCCc.....',
  '...cCeCCCeCc....',
  '...cCwCDCwCc....',
  '..cCCCDCCCCCc...',
  '..cCCCCCCCCCc...',
  '...cCCCddCCc....',
  '....cCCCCCc.....',
  '.....sCCCs......',
  '......sCc.......',
  '.......s........',
  '................',
  '................',
], MP);

// --- DRAGON (red/orange, fierce with wings) ---
const MD = { r: '#CC3030', R: '#E84848', O: '#F07050', d: '#801818', e: '#1A1A2E', w: '#FFF080', y: '#FFD040', o: '#F09030', W: '#FFE0C0' };
export const SPRITE_DRAGON: SpriteData = fromArt([
  '..r.............',
  '.rRr.....rrr....',
  '.rORr...rORRr...',
  '..rORrrrROORr...',
  '...rRRRRRRRRr...',
  '...rReRRReRRr...',
  '...rRwRRRwRRr...',
  '...rRRRRRRRRr...',
  '...rrRRyyRRrr...',
  '..W.rRRRRRRr.W..',
  '.WW.rRRRRRRr.WW.',
  'WW.rrRrrrRrr.WW.',
  '.W.rr.rr.rr..W..',
  '...rr.rr.rr.....',
  '................',
  '................',
], MD);

// --- DRAIN / HONEY BADGER (pink/magenta cute blob) ---
const MH = { p: '#E060A0', P: '#F080C0', Q: '#FFA0D8', d: '#882060', e: '#1A1A2E', w: '#ffffff', h: '#FF70B0' };
export const SPRITE_HONEY: SpriteData = fromArt([
  '................',
  '................',
  '.....ppppp......',
  '....pPQQQPp.....',
  '...pPQQQQQPp....',
  '...pPeQQQePp....',
  '...pPwQQQwPp....',
  '...pPQQQQQPp....',
  '...pPQdddQPp....',
  '....pPQQQPp.....',
  '.....ppppp......',
  '....pp.pp.......',
  '...pp...pp......',
  '..pp.....pp.....',
  '................',
  '................',
], MH);

// --- MINOTAUR (big red beast with horns) ---
const MI = { r: '#B03030', R: '#D04848', O: '#E06060', d: '#601010', e: '#1A1A2E', w: '#ffffff', h: '#C0C0C0', H: '#E0E0E0', a: '#F0C080' };
export const SPRITE_MINOTAUR: SpriteData = fromArt([
  '..hH........Hh..',
  '.hHh..rrrr..hHh.',
  '.hh..rRRRRr..hh.',
  '....rROOOORr....',
  '...rReRRReRRr...',
  '...rRwRRRwRRr...',
  '...rRRRRRRRRr...',
  '...rrRRddRRrr...',
  '..a.rRRRRRRr.a..',
  '..aRRRRRRRRRRa..',
  '..aRRRRRRRRRRa..',
  '...rRRRRRRRRr...',
  '....rr...rr.....',
  '...rr.....rr....',
  '..rr.......rr...',
  '................',
], MI);

// --- GOLEM (gray stone giant with glowing eyes) ---
const MO = { g: '#808078', G: '#A0A098', B: '#C0C0B8', d: '#404038', y: '#F0C040', Y: '#FFE060', e: '#1A1A2E' };
export const SPRITE_GOLEM: SpriteData = fromArt([
  '................',
  '.....gggg.......',
  '....gGGGGg......',
  '...gGBBBBGg.....',
  '...gGyGGGyGg....',
  '...gGYGGGYGg....',
  '...gGGddGGGg....',
  '....gGGGGGg.....',
  '..gggGGGGGggg...',
  '.gGGGBBBBGGGGg..',
  '.gGGGBBBBGGGGg..',
  '..gggGGGGGggg...',
  '....gGGGGGg.....',
  '...gg...gg......',
  '..gGg...gGg.....',
  '..gg.....gg.....',
], MO);

// --- WARPER (indigo mage with teleport aura) ---
const MW = { i: '#4050D0', I: '#6070F0', J: '#90A0FF', d: '#202880', e: '#1A1A2E', w: '#ffffff', p: '#B060F0', P: '#D090FF', s: '#FFE060' };
export const SPRITE_WARPER: SpriteData = fromArt([
  '................',
  '.....pppp.......',
  '....pPPPPp......',
  '...iIJJJJIi.....',
  '...iIeIIeIi.....',
  '...iIwIIwIi.....',
  '...iIIIIIIi.....',
  '...iIIsssIi.....',
  '...iIIIIIIi.....',
  '....iIIIIi......',
  '.....iiii.......',
  '..P...ii...P....',
  '..Pp..ii..pP....',
  '...ppppppp......',
  '................',
  '................',
], MW);

// --- SUMMONER / PUPPET (golden marionette) ---
const MU = { y: '#D4A840', Y: '#F0C860', Z: '#FFF0A0', d: '#8B6830', e: '#1A1A2E', w: '#ffffff', s: '#A08030', c: '#D04040' };
export const SPRITE_PUPPET: SpriteData = fromArt([
  '......YY........',
  '.....YZZZ.......',
  '....yYZZZy......',
  '...yYeZZeYy.....',
  '...yYwZZwYy.....',
  '...yYZZZZYy.....',
  '...yYZddZYy.....',
  '....yYYYYy......',
  '.s..yYYYYy..s...',
  '.ss.yYZZYy.ss...',
  '..ssyYYYYyss....',
  '....yYYYYy......',
  '....yy..yy......',
  '...yy....yy.....',
  '..yy......yy....',
  '................',
], MU);

// --- DEVIL (dark red demon with horns and wings) ---
const MV = { r: '#A01818', R: '#CC2828', O: '#E04040', d: '#500808', e: '#FFE040', w: '#ffffff', h: '#601010', H: '#802020', f: '#F08020', W: '#401010' };
export const SPRITE_DEVIL: SpriteData = fromArt([
  '.hH..........Hh.',
  'hHh...rrrr...hHh',
  '.h...rRRRRr...h.',
  '....rROOOORr....',
  '...rReRRReRRr...',
  '...rRwRRRwRRr...',
  '...rRRRRRRRRr...',
  '...rRRRddRRRr...',
  '..WrrRRRRRRrrW..',
  '.WWRRRRRRRRRRWW.',
  '.WWRRRRRRRRRWWW.',
  '..WrRRRRRRRRrW..',
  '...rRRR..RRRr...',
  '..rRr......rRr..',
  '.rRr........rRr.',
  '................',
], MV);

// --- BABY SATAN (small purple devil) ---
const MBS = { p: '#9333ea', P: '#a855f7', Q: '#c084fc', d: '#581c87', e: '#1A1A2E', w: '#ffffff', h: '#6b21a8' };
export const SPRITE_BABY_SATAN: SpriteData = fromArt([
  '................',
  '..hh........hh..',
  '.hPh..pppp..hPh.',
  '..h..pPPPPp..h..',
  '....pPQQQQPp....',
  '....pPeQQePp....',
  '....pPwQQwPp....',
  '....pPQQQQPp....',
  '....pPQddQPp....',
  '.....pPPPPp.....',
  '......pppp......',
  '.....pp.pp......',
  '....pp...pp.....',
  '................',
  '................',
  '................',
], MBS);

// --- ARMY ANT (brown segmented) ---
const MAA = { b: '#92400e', B: '#b45309', D: '#d97706', d: '#451a03', e: '#1A1A2E', w: '#ffffff' };
export const SPRITE_ARMY_ANT: SpriteData = fromArt([
  '................',
  '..d..........d..',
  '.dBd........dBd.',
  '..dBd......dBd..',
  '...dBbbbbbbBd...',
  '....BBDBBDBBe...',
  '...dBBBBBBBBe...',
  '..dBBeBBBeBBd...',
  '..dBBwBBBwBBd...',
  '...BBBBBBBBBd...',
  '....BBBBBBBB....',
  '...dd.BBBB.dd...',
  '..dd..dddd..dd..',
  '.dd..........dd.',
  '................',
  '................',
], MAA);

// --- LILLIPUT (green archer) ---
const MLP = { g: '#65a30d', G: '#84cc16', Y: '#bef264', d: '#365314', e: '#1A1A2E', w: '#ffffff', b: '#8B6830', a: '#A0B0C8' };
export const SPRITE_LILLIPUT: SpriteData = fromArt([
  '................',
  '......ggg.......',
  '.....gGGGg......',
  '....gGYYYGg.....',
  '....gGeGGeGg....',
  '....gGwGGwGg....',
  '....gGGGGGGg....',
  '....gGGddGGg....',
  '.....gGGGGg.aaa.',
  '....gGGGGGgaaaa.',
  '...gGGGGGGg.aaa.',
  '....gGGGGg......',
  '....gg..gg......',
  '...gg....gg.....',
  '..gg......gg....',
  '................',
], MLP);

// --- DROLL MAGE (purple robed mage) ---
const MDM = { p: '#7c3aed', P: '#8b5cf6', Q: '#a78bfa', d: '#4c1d95', e: '#1A1A2E', w: '#ffffff', s: '#FFE060' };
export const SPRITE_DROLL_MAGE: SpriteData = fromArt([
  '......ppp.......',
  '.....pPPPp......',
  '....pPQQQPp.....',
  '....pPeQePp.....',
  '....pPwQwPp.....',
  '....pPQQQPp.....',
  '.....pPPPp......',
  '...pPPPPPPp.....',
  '..pPPsPPPPPp....',
  '..pPPssPPPPp....',
  '..pPPPPPPPPp....',
  '...pPPPPPPp.....',
  '....pppppp......',
  '...pp....pp.....',
  '..pp......pp....',
  '................',
], MDM);

// --- ROTTING CORPSE (green undead) ---
const MRC = { g: '#4b7a2e', G: '#6b8e23', Y: '#9acd32', d: '#2d4a1c', e: '#FF4444', w: '#ffffff', b: '#3d5a1e' };
export const SPRITE_ROTTING_CORPSE: SpriteData = fromArt([
  '................',
  '.....gggg.......',
  '....gGGGGg......',
  '...gGYGGYGg.....',
  '...gGeGGGeGg....',
  '...gGGGGGGGg....',
  '...gGGddGGGg....',
  '....gGGGGGg.....',
  '..gggGGGGGggg...',
  '.gGGGYYYYGGGGg..',
  '.gGGGYYYYGGGGg..',
  '..gggGGGGGggg...',
  '....gGGGGGg.....',
  '...gg...gg......',
  '..gg.....gg.....',
  '................',
], MRC);

// --- SHADOW (dark gray ghost-like) ---
const MSH = { g: '#374151', G: '#4b5563', B: '#6b7280', d: '#111827', e: '#ef4444', w: '#ffffff', p: '#1f2937' };
export const SPRITE_SHADOW: SpriteData = fromArt([
  '................',
  '.....GGGG.......',
  '....GGBBGG......',
  '...GGBBBBGg.....',
  '...GGeGGGeGg....',
  '...GGGGGGGGg....',
  '...GGBBBBGGg....',
  '....GGGGGGg.....',
  '....pGGGGp......',
  '...pGGGGGGp.....',
  '..pGpGGpGGpG....',
  '..p.pGp.pGp.p...',
  '......p...p.....',
  '................',
  '................',
  '................',
], MSH);

// --- LAVA GOLEM (orange/red fiery golem) ---
const MLG = { r: '#dc2626', R: '#ef4444', O: '#f97316', Y: '#fbbf24', d: '#7c2d12', e: '#1A1A2E' };
export const SPRITE_LAVA_GOLEM: SpriteData = fromArt([
  '................',
  '.....rrrr.......',
  '....rRRRRr......',
  '...rROOOORr.....',
  '...rReRRReRr....',
  '...rRYRRRYRr....',
  '...rRRddRRRr....',
  '....rRRRRRr.....',
  '..rrrRRRRRrrr...',
  '.rRRROOOORRRRr..',
  '.rRRROOOORRRRr..',
  '..rrrRRRRRrrr...',
  '....rRRRRRr.....',
  '...rr...rr......',
  '..rRr...rRr.....',
  '..rr.....rr.....',
], MLG);

// --- DANCING JEWEL (cyan sparkling gem) ---
const MDJ = { c: '#06b6d4', C: '#22d3ee', D: '#67e8f9', W: '#ffffff', d: '#0e7490', s: '#a5f3fc', e: '#1A1A2E' };
export const SPRITE_DANCING_JEWEL: SpriteData = fromArt([
  '................',
  '.......W........',
  '......WDW.......',
  '.....WDCDc......',
  '....WDCsCCc.....',
  '...WDCsCsCCc....',
  '...DCCsCCsCc....',
  '..DCCCCCCCCCd...',
  '..DCCCCCCCCCd...',
  '...DCCCCCCCd....',
  '...dCCCCCCd.....',
  '....dCCCCd......',
  '.....dCCd.......',
  '......dd........',
  '................',
  '................',
], MDJ);

// --- KILLER MACHINE (gray metallic robot) ---
const MKM = { g: '#6b7280', G: '#9ca3af', B: '#d1d5db', d: '#374151', r: '#ef4444', e: '#1A1A2E', s: '#A0B0C8' };
export const SPRITE_KILLER_MACHINE: SpriteData = fromArt([
  '......gggg......',
  '.....gGGGGg.....',
  '....gGBBBBGg....',
  '....grGGGrGg....',
  '....gGGGGGGg....',
  '....gGGddGGg....',
  '.....gGGGGg.....',
  '..ssgGGGGGgss...',
  '.sGGGBBBBGGGGs..',
  '.sGGGBBBBGGGGs..',
  '..ssgGGGGGgss...',
  '....gGGGGGg.....',
  '...gGg..gGg.....',
  '..gGg....gGg....',
  '..gg......gg....',
  '................',
], MKM);

// --- IRON SCORPION (gray with pincers) ---
const MIS = { g: '#a3a3a3', G: '#d4d4d4', B: '#e5e5e5', d: '#525252', e: '#1A1A2E', r: '#ef4444', p: '#7c3aed' };
export const SPRITE_IRON_SCORPION: SpriteData = fromArt([
  '.gg..........gg.',
  '.gGg........gGg.',
  '..gGg......gGg..',
  '...gGggggggGg...',
  '....GGGBBGGGe...',
  '...gGGBBBBGGe...',
  '..gGGeGBBeGGd...',
  '..gGGGBBBGGGd...',
  '...GGGGGGGGGd...',
  '....GGGGGGGG....',
  '...gg.GGGG.gg...',
  '..gg...pp...gg..',
  '.gg....pp....gg.',
  '......prrp......',
  '.......rr.......',
  '................',
], MIS);

// --- MAGE CHIMERA (purple with wings) ---
const MMC = { p: '#8b5cf6', P: '#a78bfa', Q: '#c4b5fd', d: '#4c1d95', e: '#1A1A2E', w: '#ffffff', r: '#ef4444', W: '#ddd6fe' };
export const SPRITE_MAGE_CHIMERA: SpriteData = fromArt([
  '..p.............',
  '.pPp.....ppp....',
  '.pQPp...pPQPp...',
  '..pQPpppPQQPp...',
  '...pPPPPPPPPp...',
  '...pPePPPePPp...',
  '...pPwPPPwPPp...',
  '...pPPPPPPPPp...',
  '...ppPPrrPPpp...',
  '..W.pPPPPPPp.W..',
  '.WW.pPPPPPPp.WW.',
  'WW.ppPppPppp.WW.',
  '.W.pp.pp.pp..W..',
  '...pp.pp.pp.....',
  '................',
  '................',
], MMC);

// --- ARCHMAGE (dark purple robed) ---
const MAM = { p: '#a21caf', P: '#c026d3', Q: '#d946ef', d: '#701a75', e: '#FFE060', w: '#ffffff', s: '#fbbf24' };
export const SPRITE_ARCHMAGE: SpriteData = fromArt([
  '....pppppp......',
  '...pPPPPPPp.....',
  '..pPQQQQQQPp....',
  '..pPeQQQQePp....',
  '..pPwQQQQwPp....',
  '..pPQQQQQQPp....',
  '..pPQQddQQPp....',
  '...pPPPPPPp.....',
  '..pPPsPPPPPp....',
  '.pPPPssPPPPPp...',
  '.pPPPPPPPPPPp...',
  '..pPPPPPPPPp....',
  '...pppppppp.....',
  '..pp......pp....',
  '.pp........pp...',
  '................',
], MAM);

// --- STONE MAN (dark gray massive) ---
const MSM = { g: '#57534e', G: '#78716c', B: '#a8a29e', d: '#292524', y: '#fbbf24', e: '#1A1A2E' };
export const SPRITE_STONE_MAN: SpriteData = fromArt([
  '................',
  '.....gggg.......',
  '....gGGGGg......',
  '...gGBBBBGg.....',
  '...gGyGGGyGg....',
  '...gGGGGGGGg....',
  '...gGGddGGGg....',
  '....gGGGGGg.....',
  '.ggggGGGGGgggg..',
  'gGGGGBBBBGGGGGg.',
  'gGGGGBBBBGGGGGg.',
  '.ggggGGGGGgggg..',
  '....gGGGGGg.....',
  '...gGg.gGg......',
  '..gGGg.gGGg.....',
  '..ggg...ggg.....',
], MSM);

// --- REAPER (dark indigo with scythe) ---
const MRP = { i: '#1e1b4b', I: '#312e81', J: '#3730a3', d: '#0f0d24', e: '#ef4444', w: '#ffffff', s: '#a3a3a3', S: '#d4d4d4' };
export const SPRITE_REAPER: SpriteData = fromArt([
  '...SSSSS........',
  '..SsssssS.......',
  '..Ss...sS.......',
  '..Ss..iIIIi.....',
  '..Ss.iIJJJIi....',
  '..s.iIeIIeIi....',
  '.s..iIIIIIIi....',
  's...iIIddIIi....',
  '....iIIIIIIi....',
  '...iIIIIIIIIi...',
  '..iIIIIIIIIIi...',
  '...iIIIIIIIi....',
  '....iiii.iii....',
  '...ii.....ii....',
  '..ii.......ii...',
  '................',
], MRP);

// --- METAL SLIME (silver shiny blob) ---
const MMS = { g: '#e5e7eb', G: '#f3f4f6', W: '#ffffff', d: '#9ca3af', e: '#1A1A2E', s: '#d1d5db' };
export const SPRITE_METAL_SLIME: SpriteData = fromArt([
  '................',
  '................',
  '................',
  '......GGG.......',
  '....GGWWWGs.....',
  '...GWWWWWWGs....',
  '...GWWWWWWGs....',
  '..GWWeGWWeGGs...',
  '..GWWdGWWdGGs...',
  '..GWWWWWWWGGs...',
  '..GWWWssWWGGs...',
  '...GWWWWWGGs....',
  '....GGGGGG......',
  '.....ssss.......',
  '................',
  '................',
], MMS);

// --- DARK DREAM (dark red with horns and aura) ---
const MDD = { r: '#7f1d1d', R: '#991b1b', O: '#b91c1c', d: '#450a0a', e: '#fbbf24', w: '#ffffff', h: '#3b0764', H: '#581c87', f: '#f97316', p: '#a21caf' };
export const SPRITE_DARK_DREAM: SpriteData = fromArt([
  '.hH..........Hh.',
  'hHh...rrrr...hHh',
  '.h...rRRRRr...h.',
  '....rROOOORr....',
  '...rReRRReRRr...',
  '...rRwRRRwRRr...',
  '...rRRRRRRRRr...',
  '...rRRRddRRRr...',
  'p.rrRRRRRRRRrr.p',
  'ppRRRRRRRRRRRRpp',
  'ppRRRRRRRRRRRRpp',
  'p.rRRRRRRRRRRr.p',
  '...rRRR..RRRr...',
  '..rRr......rRr..',
  '.rRr........rRr.',
  '................',
], MDD);

// =================== TILE SPRITES ===================

const T_STAIRS_P = { d: '#6B5A3A', g: '#F0C860', G: '#D4A840', D: '#B08830', b: '#8B6830', k: '#504028' };
export const SPRITE_STAIRS: SpriteData = fromArt([
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
  'kkbbbbbbbbbbbbkk',
  'kkbDDDDDDDDDDbkk',
  'kkbDbbbbbbbbDbkk',
  'kkbDbGGGGGGbDbkk',
  'kkbDbGbbbbGbDbkk',
  'kkbDbGbggbGbDbkk',
  'kkbDbGbggbGbDbkk',
  'kkbDbGbbbbGbDbkk',
  'kkbDbGGGGGGbDbkk',
  'kkbDbbbbbbbbDbkk',
  'kkbDDDDDDDDDDbkk',
  'kkbbbbbbbbbbbbkk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
], T_STAIRS_P);

const T_TRAP_P = { d: '#6B5A3A', r: '#CC3333', R: '#AA2020', D: '#881818', k: '#504028' };
export const SPRITE_TRAP: SpriteData = fromArt([
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkdk',
  'kkDDDDDDDDDDDDkk',
  'kkDrrrrrrrrrrDkk',
  'kkDrDDDDDDDDrDkk',
  'kkDrDrrrrrrDrDkk',
  'kkDrDrDDDDrDrDkk',
  'kkDrDrDrrDrDrDkk',
  'kkDrDrDrrDrDrDkk',
  'kkDrDrDDDDrDrDkk',
  'kkDrDrrrrrrDrDkk',
  'kkDrDDDDDDDDrDkk',
  'kkDrrrrrrrrrrDkk',
  'kkDDDDDDDDDDDDkk',
  'kkkkkkkkkkkkkkdk',
  'kkkkkkkkkkkkkkkk',
], T_TRAP_P);

// =================== ITEM SPRITES (vibrant Torneko 3 colors) ===================

// --- SWORD (steel with gold hilt) ---
const IS = { g: '#A0B0C8', G: '#D0D8E8', b: '#607088', h: '#D4A840', H: '#F0C860', d: '#506070' };
export const SPRITE_SWORD: SpriteData = fromArt([
  '..............GG',
  '.............GGg',
  '............GGg.',
  '...........GGg..',
  '..........GGg...',
  '.........GGg....',
  '........GGg.....',
  '.......GGg......',
  '......GGg.......',
  '.....GGg........',
  '....GGgH........',
  '...GGg.HH.......',
  '..bgg...Hh......',
  '.bb..............',
  'b...............',
  '................',
], IS);

// --- SHIELD (blue with gold emblem) ---
const IH = { b: '#3060C0', B: '#4080E0', D: '#60A0F0', d: '#1840A0', g: '#D4A840', G: '#F0C860', w: '#E8F0FF' };
export const SPRITE_SHIELD: SpriteData = fromArt([
  '................',
  '....bbbbbbb.....',
  '...bBBDBBBBb....',
  '..bBBDDBBBBBb...',
  '..bBBBwBBBBBb...',
  '..bBBwGwBBBBb...',
  '..bBBBGBBBBBb...',
  '..bBBwGwBBBBb...',
  '..bBBBwBBBBBb...',
  '...bBBBBBBBb....',
  '...bBBBBBBBb....',
  '....bBBBBBb.....',
  '.....bBBBb......',
  '......bBb.......',
  '.......b........',
  '................',
], IH);

// --- SCROLL (warm parchment with red seal) ---
const IC = { y: '#F0E0B0', Y: '#FFF0C8', b: '#8B6830', r: '#CC3333', R: '#E04040', d: '#A08050' };
export const SPRITE_SCROLL: SpriteData = fromArt([
  '................',
  '................',
  '...bbbbbbbbb....',
  '..bYYYYYYYYYb...',
  '..bYYdYYYdYYb...',
  '..bYYYYYYYYYb...',
  '..bYYdddddYYb...',
  '..bYYYYYYYYYb...',
  '..bYYdddddYYb...',
  '..bYYYYYYYYYb...',
  '..bYYdddYYYYb...',
  '..bYYYYRRYYYb...',
  '...bbbbRRbbb....',
  '................',
  '................',
  '................',
], IC);

// --- HERB (vibrant green leaf with berries) ---
const IE = { g: '#30A850', G: '#50D070', B: '#70F090', d: '#207038', s: '#286840', r: '#E04040', R: '#FF6060' };
export const SPRITE_HERB: SpriteData = fromArt([
  '................',
  '................',
  '.........G......',
  '........GBG.....',
  '.......GBG......',
  '......GBsG......',
  '.....GGsGG......',
  '......sGG.......',
  '......ss........',
  '......ss........',
  '.....ssss.......',
  '....sGBGGs......',
  '...sGBrBGGs.....',
  '...sGGRGGGs.....',
  '....ssssss......',
  '................',
], IE);

// --- STAFF (purple crystal on wooden shaft) ---
const IF = { p: '#A050E0', P: '#C080FF', Q: '#E0B0FF', d: '#6020A0', w: '#F0E8FF', b: '#8B6830', B: '#A08050' };
export const SPRITE_STAFF: SpriteData = fromArt([
  '..PPP...........',
  '.PwQP...........',
  '.PQPd...........',
  '..PPd...........',
  '...db...........',
  '....bB..........',
  '.....bB.........',
  '......bB........',
  '.......bB.......',
  '........bB......',
  '.........bB.....',
  '..........bB....',
  '...........bB...',
  '............bB..',
  '.............bB.',
  '..............b.',
], IF);

// --- POT (orange-brown ceramic) ---
const IP = { o: '#D07030', O: '#E89050', Q: '#F0B070', d: '#904818', b: '#703010', g: '#D4A840', G: '#F0C860' };
export const SPRITE_POT: SpriteData = fromArt([
  '................',
  '................',
  '.....gggg.......',
  '.....gGdg.......',
  '....dddddd......',
  '...dOQQQQOd.....',
  '..dOQQQQQQOd....',
  '..dOQQQQQQOd....',
  '..dOQQQQQQOd....',
  '..dOOQQQQOOd....',
  '..dOOOOOOOOd....',
  '...dOOOOOOd.....',
  '....dddddd......',
  '................',
  '................',
  '................',
], IP);

// --- FOOD (onigiri / rice ball) ---
const IO = { w: '#F8F8F0', W: '#FFFFFF', n: '#1A1A1A', g: '#207038', G: '#308848' };
export const SPRITE_FOOD: SpriteData = fromArt([
  '................',
  '................',
  '................',
  '.......WW.......',
  '......WWWW......',
  '.....WWWWWW.....',
  '....WWWWWWWW....',
  '...WWWWWWWWWW...',
  '..nnnnnnnnnnn...',
  '..nGGGGGGGGGn...',
  '..nGGGGGGGGGn...',
  '..nGGGGGGGGGn...',
  '...nGGGGGGGn....',
  '....nnnnnnn.....',
  '................',
  '................',
], IO);

// --- ARROW (wooden shaft with steel tip) ---
const IA = { g: '#A0B0C8', G: '#D0D8E8', b: '#8B6830', B: '#A08050', r: '#CC3333' };
export const SPRITE_ARROW: SpriteData = fromArt([
  '................',
  '................',
  '................',
  '................',
  '..............r.',
  '.............rG.',
  'BBBBBBBBBBBBGGg.',
  'bbbbbbbbbbbGGGg.',
  'BBBBBBBBBBBBGGg.',
  '.............rG.',
  '..............r.',
  '................',
  '................',
  '................',
  '................',
  '................',
], IA);

// --- RING (gold with red gem) ---
const IR = { g: '#D4A840', G: '#F0C860', Y: '#FFF0A0', d: '#8B6830', r: '#CC3333', R: '#FF4444', P: '#FF8080' };
export const SPRITE_RING: SpriteData = fromArt([
  '................',
  '................',
  '................',
  '......RP........',
  '.....RrrR.......',
  '....gGGGGg......',
  '...gGYYYGGg.....',
  '...gGY..YGg.....',
  '...gGY..YGg.....',
  '...gGYYYGGg.....',
  '....gGGGGg......',
  '................',
  '................',
  '................',
  '................',
  '................',
], IR);

// --- GOLD (shiny gold coins) ---
const IG = { g: '#D4A840', G: '#F0C860', Y: '#FFF0A0', d: '#8B6830', D: '#6B4820' };
export const SPRITE_GOLD: SpriteData = fromArt([
  '................',
  '................',
  '................',
  '.....ggggg......',
  '....gGYYYGg.....',
  '...gGYgggYGg....',
  '...gGgYYYgGg....',
  '...gGgYYYYGg....',
  '...gGgYYYYGg....',
  '...gGgYYYgGg....',
  '...gGYgggYGg....',
  '....gGYYYGg.....',
  '.....ggggg......',
  '................',
  '................',
  '................',
], IG);

// =================== UNUSED but kept for type compat ===================
export const SPRITE_WALL: SpriteData = fromArt([
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
], { G: '#808078' });

export const SPRITE_FLOOR: SpriteData = SPRITE_WALL;
export const SPRITE_CORRIDOR: SpriteData = SPRITE_WALL;

// =================== SPRITE LOOKUP ===================

export { type SpriteData };

export const MONSTER_SPRITES: Record<string, SpriteData> = {
  slime: SPRITE_SLIME,
  rat: SPRITE_RAT,
  ghost: SPRITE_GHOST,
  bat: SPRITE_BAT,
  skeleton: SPRITE_SKELETON,
  thief: SPRITE_THIEF,
  mushroom: SPRITE_MUSHROOM,
  baby_satan: SPRITE_BABY_SATAN,
  army_ant: SPRITE_ARMY_ANT,
  lilliput: SPRITE_LILLIPUT,
  droll_mage: SPRITE_DROLL_MAGE,
  split_slime: SPRITE_POLYGON,
  dragon_pup: SPRITE_DRAGON,
  drain: SPRITE_HONEY,
  zombie: SPRITE_ROTTING_CORPSE,
  dragon_child: SPRITE_DRAGON,
  rotting_corpse: SPRITE_ROTTING_CORPSE,
  shadow: SPRITE_SHADOW,
  lava_golem: SPRITE_LAVA_GOLEM,
  dancing_jewel: SPRITE_DANCING_JEWEL,
  killer_machine: SPRITE_KILLER_MACHINE,
  iron_scorpion: SPRITE_IRON_SCORPION,
  mage_chimera: SPRITE_MAGE_CHIMERA,
  archmage: SPRITE_ARCHMAGE,
  stone_man: SPRITE_STONE_MAN,
  reaper: SPRITE_REAPER,
  metal_slime: SPRITE_METAL_SLIME,
  dark_dream: SPRITE_DARK_DREAM,
  minotaur: SPRITE_MINOTAUR,
  golem: SPRITE_GOLEM,
  warper: SPRITE_WARPER,
  summoner: SPRITE_PUPPET,
  devil: SPRITE_DEVIL,
  king_dragon: SPRITE_DRAGON,
  skeleton_knight: SPRITE_SKELETON,
  mimic: SPRITE_PUPPET,
  wizard: SPRITE_DROLL_MAGE,
};

export const ITEM_SPRITES: Record<string, SpriteData> = {
  weapon: SPRITE_SWORD,
  shield: SPRITE_SHIELD,
  scroll: SPRITE_SCROLL,
  herb: SPRITE_HERB,
  staff: SPRITE_STAFF,
  pot: SPRITE_POT,
  food: SPRITE_FOOD,
  arrow: SPRITE_ARROW,
  ring: SPRITE_RING,
  gold: SPRITE_GOLD,
  projectile: SPRITE_ARROW,
};

// =================== RENDER FUNCTION ===================

const spriteCache = new Map<string, ImageData>();

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  x: number,
  y: number,
  size: number,
  alpha: number = 1.0,
  tint?: string,
  height?: number
) {
  const scaleX = size / 16;
  const scaleY = (height ?? size) / 16;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Pass 1: Black outline (draw 1px offset in all 4 directions)
  ctx.fillStyle = '#000000';
  const outlineAlpha = alpha * 0.7;
  ctx.globalAlpha = outlineAlpha;
  for (let sy = 0; sy < sprite.length; sy++) {
    for (let sx = 0; sx < sprite[sy].length; sx++) {
      const color = sprite[sy][sx];
      if (!color) continue;
      const px = x + Math.floor(sx * scaleX);
      const py = y + Math.floor(sy * scaleY);
      const pw = Math.ceil(scaleX);
      const ph = Math.ceil(scaleY);
      // Check if this pixel is on the edge (has a transparent neighbor)
      const hasEmptyNeighbor =
        (sx === 0 || !sprite[sy][sx - 1]) ||
        (sx >= sprite[sy].length - 1 || !sprite[sy][sx + 1]) ||
        (sy === 0 || !sprite[sy - 1]?.[sx]) ||
        (sy >= sprite.length - 1 || !sprite[sy + 1]?.[sx]);
      if (hasEmptyNeighbor) {
        ctx.fillRect(px - 1, py, pw + 2, ph);
        ctx.fillRect(px, py - 1, pw, ph + 2);
      }
    }
  }

  // Pass 2: Actual sprite pixels
  ctx.globalAlpha = alpha;
  for (let sy = 0; sy < sprite.length; sy++) {
    for (let sx = 0; sx < sprite[sy].length; sx++) {
      const color = sprite[sy][sx];
      if (!color) continue;

      if (tint) {
        ctx.fillStyle = tint;
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillRect(
          x + Math.floor(sx * scaleX),
          y + Math.floor(sy * scaleY),
          Math.ceil(scaleX),
          Math.ceil(scaleY)
        );
        ctx.globalAlpha = alpha * 0.6;
      }
      ctx.fillStyle = color;
      ctx.fillRect(
        x + Math.floor(sx * scaleX),
        y + Math.floor(sy * scaleY),
        Math.ceil(scaleX),
        Math.ceil(scaleY)
      );
    }
  }

  ctx.restore();
}

// Animated glow effect for special items
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  time: number
) {
  const pulse = 0.3 + Math.sin(time * 0.003) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
