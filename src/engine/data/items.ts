import { ItemCategory, SealType, GameItem } from '@/types/game';
import { generateId } from '../utils';

export interface ItemTemplate {
  id: string;
  name: string;
  unidentifiedName: string;
  category: ItemCategory;
  rarity: number; // 1-10, higher = rarer
  minFloor: number;
  props: Record<string, unknown>;
}

export const ITEM_TEMPLATES: ItemTemplate[] = [
  // === Weapons ===
  {
    id: 'wooden_sword', name: 'こんぼう', unidentifiedName: 'こんぼう',
    category: ItemCategory.Weapon, rarity: 1, minFloor: 1,
    props: { attack: 3, maxSeals: 3 },
  },
  {
    id: 'bronze_sword', name: '青銅の剣', unidentifiedName: '青銅の剣',
    category: ItemCategory.Weapon, rarity: 2, minFloor: 1,
    props: { attack: 5, maxSeals: 4 },
  },
  {
    id: 'iron_sword', name: '鉄の剣', unidentifiedName: '鉄の剣',
    category: ItemCategory.Weapon, rarity: 3, minFloor: 3,
    props: { attack: 8, maxSeals: 5 },
  },
  {
    id: 'katana', name: 'カタナ', unidentifiedName: 'カタナ',
    category: ItemCategory.Weapon, rarity: 5, minFloor: 5,
    props: { attack: 12, maxSeals: 6 },
  },
  {
    id: 'steel_sword', name: '鋼鉄の剣', unidentifiedName: '鋼鉄の剣',
    category: ItemCategory.Weapon, rarity: 4, minFloor: 5,
    props: { attack: 10, maxSeals: 5 },
  },
  {
    id: 'undead_sword', name: 'ゾンビキラー', unidentifiedName: 'ゾンビキラー',
    category: ItemCategory.Weapon, rarity: 6, minFloor: 7,
    props: { attack: 13, maxSeals: 5, defaultSeals: [SealType.UndeadSlayer] },
  },
  {
    id: 'dragonkiller', name: 'ドラゴンキラー', unidentifiedName: 'ドラゴンキラー',
    category: ItemCategory.Weapon, rarity: 7, minFloor: 8,
    props: { attack: 15, maxSeals: 5, defaultSeals: [SealType.DragonSlayer] },
  },
  {
    id: 'minotaur_axe', name: '必殺の剣', unidentifiedName: '必殺の剣',
    category: ItemCategory.Weapon, rarity: 8, minFloor: 10,
    props: { attack: 18, maxSeals: 4, defaultSeals: [SealType.Critical] },
  },
  {
    id: 'pickaxe', name: 'つるはし', unidentifiedName: 'つるはし',
    category: ItemCategory.Weapon, rarity: 3, minFloor: 3,
    props: { attack: 5, maxSeals: 2 },
  },
  {
    id: 'kamaitachi', name: '妖刀かまいたち', unidentifiedName: '妖刀かまいたち',
    category: ItemCategory.Weapon, rarity: 7, minFloor: 12,
    props: { attack: 8, maxSeals: 4 },
  },
  {
    id: 'demon_hammer', name: 'まじんのかなづち', unidentifiedName: 'まじんのかなづち',
    category: ItemCategory.Weapon, rarity: 6, minFloor: 15,
    props: { attack: 25, maxSeals: 3 },
  },
  {
    id: 'falcon_sword', name: 'はやぶさの剣', unidentifiedName: 'はやぶさの剣',
    category: ItemCategory.Weapon, rarity: 8, minFloor: 12,
    props: { attack: 6, maxSeals: 4, defaultSeals: [SealType.DoubleStrike] },
  },
  {
    id: 'fire_sword', name: '炎の剣', unidentifiedName: '炎の剣',
    category: ItemCategory.Weapon, rarity: 7, minFloor: 10,
    props: { attack: 14, maxSeals: 5 },
  },
  {
    id: 'drain_sword', name: 'ドレインの剣', unidentifiedName: 'ドレインの剣',
    category: ItemCategory.Weapon, rarity: 7, minFloor: 8,
    props: { attack: 10, maxSeals: 4, defaultSeals: [SealType.Drain] },
  },
  {
    id: 'legendary_sword', name: '伝説の剣', unidentifiedName: '光る剣',
    category: ItemCategory.Weapon, rarity: 10, minFloor: 20,
    props: { attack: 30, maxSeals: 8, defaultSeals: [SealType.Critical, SealType.DragonSlayer] },
  },
  {
    id: 'hero_blade', name: '勇者の剣', unidentifiedName: '古びた剣',
    category: ItemCategory.Weapon, rarity: 9, minFloor: 15,
    props: { attack: 22, maxSeals: 7, defaultSeals: [SealType.SureHit, SealType.DoubleStrike] },
  },

  // === Shields ===
  {
    id: 'wooden_shield', name: '木の盾', unidentifiedName: '木の盾',
    category: ItemCategory.Shield, rarity: 1, minFloor: 1,
    props: { defense: 2, maxSeals: 3 },
  },
  {
    id: 'bronze_shield', name: '青銅の盾', unidentifiedName: '青銅の盾',
    category: ItemCategory.Shield, rarity: 2, minFloor: 1,
    props: { defense: 4, maxSeals: 4 },
  },
  {
    id: 'iron_shield', name: '鉄の盾', unidentifiedName: '鉄の盾',
    category: ItemCategory.Shield, rarity: 3, minFloor: 3,
    props: { defense: 7, maxSeals: 5 },
  },
  {
    id: 'steel_shield', name: '鋼鉄の盾', unidentifiedName: '鋼鉄の盾',
    category: ItemCategory.Shield, rarity: 4, minFloor: 5,
    props: { defense: 9, maxSeals: 5 },
  },
  {
    id: 'counter_shield', name: 'はねかえしの盾', unidentifiedName: 'はねかえしの盾',
    category: ItemCategory.Shield, rarity: 6, minFloor: 7,
    props: { defense: 6, maxSeals: 4, defaultSeals: [SealType.Counter] },
  },
  {
    id: 'dragon_shield', name: 'ドラゴンシールド', unidentifiedName: 'ドラゴンシールド',
    category: ItemCategory.Shield, rarity: 6, minFloor: 6,
    props: { defense: 10, maxSeals: 5, defaultSeals: [SealType.FireResist] },
  },
  {
    id: 'gold_shield', name: '金の盾', unidentifiedName: '金の盾',
    category: ItemCategory.Shield, rarity: 7, minFloor: 8,
    props: { defense: 14, maxSeals: 6, defaultSeals: [SealType.RustProof] },
  },
  {
    id: 'blade_shield', name: 'やいばの盾', unidentifiedName: 'やいばの盾',
    category: ItemCategory.Shield, rarity: 5, minFloor: 5,
    props: { defense: 4, maxSeals: 4, defaultSeals: [SealType.Counter] },
  },
  {
    id: 'mirror_shield', name: 'みかがみの盾', unidentifiedName: 'みかがみの盾',
    category: ItemCategory.Shield, rarity: 8, minFloor: 15,
    props: { defense: 8, maxSeals: 5, defaultSeals: [SealType.Counter, SealType.RustProof] },
  },
  {
    id: 'landmine_shield', name: '地雷ナバリの盾', unidentifiedName: '地雷ナバリの盾',
    category: ItemCategory.Shield, rarity: 5, minFloor: 8,
    props: { defense: 6, maxSeals: 4 },
  },
  {
    id: 'heavy_shield', name: '重装の盾', unidentifiedName: '重装の盾',
    category: ItemCategory.Shield, rarity: 6, minFloor: 10,
    props: { defense: 16, maxSeals: 3 },
  },
  {
    id: 'legendary_shield', name: '伝説の盾', unidentifiedName: '光る盾',
    category: ItemCategory.Shield, rarity: 10, minFloor: 20,
    props: { defense: 25, maxSeals: 8, defaultSeals: [SealType.Counter, SealType.FireResist, SealType.RustProof] },
  },
  {
    id: 'hero_shield', name: '勇者の盾', unidentifiedName: '古びた盾',
    category: ItemCategory.Shield, rarity: 9, minFloor: 15,
    props: { defense: 18, maxSeals: 7, defaultSeals: [SealType.TheftGuard, SealType.Healing] },
  },

  // === Herbs ===
  {
    id: 'heal_herb', name: '薬草', unidentifiedName: '緑の草',
    category: ItemCategory.Herb, rarity: 1, minFloor: 1,
    props: { effect: 'heal', hpRestore: 25 },
  },
  {
    id: 'big_heal_herb', name: '弟切草', unidentifiedName: '黄色い草',
    category: ItemCategory.Herb, rarity: 2, minFloor: 1,
    props: { effect: 'bigHeal', hpRestore: 100 },
  },
  {
    id: 'life_herb', name: 'いのちの草', unidentifiedName: '白い草',
    category: ItemCategory.Herb, rarity: 5, minFloor: 4,
    props: { effect: 'maxHpUp', hpRestore: 0 },
  },
  {
    id: 'strength_herb', name: 'ちからの草', unidentifiedName: '赤い草',
    category: ItemCategory.Herb, rarity: 4, minFloor: 3,
    props: { effect: 'strengthUp', hpRestore: 0 },
  },
  {
    id: 'poison_herb', name: '毒草', unidentifiedName: '紫の草',
    category: ItemCategory.Herb, rarity: 2, minFloor: 1,
    props: { effect: 'poison', hpRestore: -5 },
  },
  {
    id: 'confusion_herb', name: '混乱草', unidentifiedName: '橙の草',
    category: ItemCategory.Herb, rarity: 2, minFloor: 2,
    props: { effect: 'confusion', hpRestore: 0 },
  },
  {
    id: 'sleep_herb', name: '睡眠草', unidentifiedName: '青い草',
    category: ItemCategory.Herb, rarity: 3, minFloor: 3,
    props: { effect: 'sleep', hpRestore: 0 },
  },
  {
    id: 'antidote_herb', name: '毒消し草', unidentifiedName: '薄緑の草',
    category: ItemCategory.Herb, rarity: 2, minFloor: 1,
    props: { effect: 'antidote', hpRestore: 0 },
  },
  {
    id: 'speed_herb', name: 'すばやさの種', unidentifiedName: '金の草',
    category: ItemCategory.Herb, rarity: 5, minFloor: 5,
    props: { effect: 'speed', hpRestore: 0 },
  },
  {
    id: 'sight_herb', name: 'めぐすり草', unidentifiedName: '透明な草',
    category: ItemCategory.Herb, rarity: 3, minFloor: 3,
    props: { effect: 'sight', hpRestore: 0 },
  },
  {
    id: 'revival_herb', name: '復活の草', unidentifiedName: '光る草',
    category: ItemCategory.Herb, rarity: 9, minFloor: 15,
    props: { effect: 'revival', hpRestore: 0 },
  },
  {
    id: 'dragon_herb', name: 'ドラゴン草', unidentifiedName: '炎の草',
    category: ItemCategory.Herb, rarity: 7, minFloor: 12,
    props: { effect: 'dragonBreath', hpRestore: 0 },
  },

  // === Scrolls ===
  {
    id: 'identify_scroll', name: '識別の巻物', unidentifiedName: 'あかりの巻物',
    category: ItemCategory.Scroll, rarity: 2, minFloor: 1,
    props: { effect: 'identify' },
  },
  {
    id: 'powerup_scroll', name: 'パワーアップの巻物', unidentifiedName: 'きぼうの巻物',
    category: ItemCategory.Scroll, rarity: 3, minFloor: 2,
    props: { effect: 'powerUp' },
  },
  {
    id: 'confusion_scroll', name: '混乱の巻物', unidentifiedName: 'てんしの巻物',
    category: ItemCategory.Scroll, rarity: 3, minFloor: 2,
    props: { effect: 'confuseAll' },
  },
  {
    id: 'sanctuary_scroll', name: '聖域の巻物', unidentifiedName: 'しあわせの巻物',
    category: ItemCategory.Scroll, rarity: 6, minFloor: 5,
    props: { effect: 'sanctuary' },
  },
  {
    id: 'bigroom_scroll', name: '大部屋の巻物', unidentifiedName: 'うしろの巻物',
    category: ItemCategory.Scroll, rarity: 4, minFloor: 3,
    props: { effect: 'bigRoom' },
  },
  {
    id: 'removal_scroll', name: 'おはらいの巻物', unidentifiedName: 'やまびこの巻物',
    category: ItemCategory.Scroll, rarity: 3, minFloor: 2,
    props: { effect: 'removeCurse' },
  },
  {
    id: 'map_scroll', name: 'あかりの巻物', unidentifiedName: 'かぜの巻物',
    category: ItemCategory.Scroll, rarity: 5, minFloor: 5,
    props: { effect: 'map' },
  },
  {
    id: 'trap_scroll', name: 'ワナけしの巻物', unidentifiedName: 'つちの巻物',
    category: ItemCategory.Scroll, rarity: 3, minFloor: 2,
    props: { effect: 'removeTrap' },
  },
  {
    id: 'gather_scroll', name: 'ひきよせの巻物', unidentifiedName: 'かみなりの巻物',
    category: ItemCategory.Scroll, rarity: 5, minFloor: 4,
    props: { effect: 'gather' },
  },
  {
    id: 'rustproof_scroll', name: 'メッキの巻物', unidentifiedName: 'ひかりの巻物',
    category: ItemCategory.Scroll, rarity: 4, minFloor: 3,
    props: { effect: 'rustproof' },
  },
  {
    id: 'blank_scroll', name: '白紙の巻物', unidentifiedName: 'そらの巻物',
    category: ItemCategory.Scroll, rarity: 8, minFloor: 8,
    props: { effect: 'blank' },
  },
  {
    id: 'warp_scroll', name: 'ワープの巻物', unidentifiedName: 'ほしの巻物',
    category: ItemCategory.Scroll, rarity: 4, minFloor: 3,
    props: { effect: 'warp' },
  },
  // #31: 混乱の巻物 (confusion scroll) - confuses all visible monsters for 5 turns
  // (already exists as confusion_scroll above with confuseAll effect)
  // #32: 壺増大の巻物 (pot expand scroll) - increases pot capacity by 1
  {
    id: 'pot_expand_scroll', name: '壺増大の巻物', unidentifiedName: 'いにしえの巻物',
    category: ItemCategory.Scroll, rarity: 6, minFloor: 5,
    props: { effect: 'potExpand' },
  },

  // === Staves ===
  // #27: 吹き飛ばしの杖 (knockback staff) - pushes monster 3 tiles back
  {
    id: 'knockback_staff', name: 'ふきとばしの杖', unidentifiedName: '松の杖',
    category: ItemCategory.Staff, rarity: 2, minFloor: 1,
    props: { effect: 'knockback', charges: 5, maxCharges: 7 },
  },
  // #29: 鈍足の杖 (slow staff) - halves monster speed for 10 turns
  {
    id: 'slow_staff', name: '鈍足の杖', unidentifiedName: '杉の杖',
    category: ItemCategory.Staff, rarity: 3, minFloor: 2,
    props: { effect: 'slow', charges: 4, maxCharges: 6 },
  },
  {
    id: 'paralysis_staff', name: 'かなしばりの杖', unidentifiedName: '桐の杖',
    category: ItemCategory.Staff, rarity: 4, minFloor: 3,
    props: { effect: 'paralysis', charges: 3, maxCharges: 5 },
  },
  {
    id: 'seal_staff', name: '封印の杖', unidentifiedName: '桜の杖',
    category: ItemCategory.Staff, rarity: 4, minFloor: 4,
    props: { effect: 'seal', charges: 3, maxCharges: 5 },
  },
  {
    id: 'warp_staff', name: 'とびつきの杖', unidentifiedName: '梅の杖',
    category: ItemCategory.Staff, rarity: 3, minFloor: 2,
    props: { effect: 'warp', charges: 4, maxCharges: 6 },
  },
  {
    id: 'lightning_staff', name: 'いかずちの杖', unidentifiedName: '柏の杖',
    category: ItemCategory.Staff, rarity: 4, minFloor: 3,
    props: { effect: 'lightning', charges: 4, maxCharges: 6 },
  },
  {
    id: 'transform_staff', name: 'へんげの杖', unidentifiedName: '楓の杖',
    category: ItemCategory.Staff, rarity: 5, minFloor: 4,
    props: { effect: 'transform', charges: 3, maxCharges: 5 },
  },
  // #28: 身代わりの杖 (substitute staff) - swaps player/monster positions
  {
    id: 'swap_staff', name: 'ばしょがえの杖', unidentifiedName: '竹の杖',
    category: ItemCategory.Staff, rarity: 3, minFloor: 2,
    props: { effect: 'swap', charges: 4, maxCharges: 6 },
  },
  {
    id: 'drain_staff', name: 'すいだしの杖', unidentifiedName: '柳の杖',
    category: ItemCategory.Staff, rarity: 5, minFloor: 5,
    props: { effect: 'drain', charges: 3, maxCharges: 5 },
  },
  // #28: 身代わりの杖 (substitute staff) - dedicated substitute staff
  {
    id: 'substitute_staff', name: '身代わりの杖', unidentifiedName: '檜の杖',
    category: ItemCategory.Staff, rarity: 5, minFloor: 5,
    props: { effect: 'substitute', charges: 3, maxCharges: 5 },
  },

  // === Pots ===
  {
    id: 'storage_pot', name: '保存の壺', unidentifiedName: '赤い壺',
    category: ItemCategory.Pot, rarity: 2, minFloor: 1,
    props: { capacity: 4, potType: 'storage' },
  },
  {
    id: 'synthesis_pot', name: '合成の壺', unidentifiedName: '青い壺',
    category: ItemCategory.Pot, rarity: 5, minFloor: 3,
    props: { capacity: 3, potType: 'synthesis' },
  },
  {
    id: 'recovery_pot', name: '回復の壺', unidentifiedName: '緑の壺',
    category: ItemCategory.Pot, rarity: 3, minFloor: 2,
    props: { capacity: 3, potType: 'recovery' },
  },
  {
    id: 'transform_pot', name: '変化の壺', unidentifiedName: '黒い壺',
    category: ItemCategory.Pot, rarity: 4, minFloor: 3,
    props: { capacity: 3, potType: 'transform' },
  },
  {
    id: 'heal_pot', name: '回復の壺', unidentifiedName: '桃色の壺',
    category: ItemCategory.Pot, rarity: 6, minFloor: 8,
    props: { capacity: 3, potType: 'recovery' },
  },

  // === Food ===
  {
    id: 'riceball', name: 'おにぎり', unidentifiedName: 'おにぎり',
    category: ItemCategory.Food, rarity: 1, minFloor: 1,
    props: { satiation: 50 },
  },
  {
    id: 'big_riceball', name: '大きなおにぎり', unidentifiedName: '大きなおにぎり',
    category: ItemCategory.Food, rarity: 3, minFloor: 1,
    props: { satiation: 100 },
  },
  {
    id: 'rotten_riceball', name: 'くさったおにぎり', unidentifiedName: 'くさったおにぎり',
    category: ItemCategory.Food, rarity: 2, minFloor: 1,
    props: { satiation: 30 },
  },
  {
    id: 'special_riceball', name: '特製おにぎり', unidentifiedName: '特製おにぎり',
    category: ItemCategory.Food, rarity: 5, minFloor: 5,
    props: { satiation: 200 },
  },
  {
    id: 'grilled_riceball', name: 'やきおにぎり', unidentifiedName: 'やきおにぎり',
    category: ItemCategory.Food, rarity: 2, minFloor: 1,
    props: { satiation: 80 },
  },

  // === Arrows ===
  {
    id: 'wood_arrow', name: '木の矢', unidentifiedName: '木の矢',
    category: ItemCategory.Arrow, rarity: 1, minFloor: 1,
    props: { attack: 4, count: 5 },
  },
  {
    id: 'iron_arrow', name: '鉄の矢', unidentifiedName: '鉄の矢',
    category: ItemCategory.Arrow, rarity: 3, minFloor: 3,
    props: { attack: 8, count: 3 },
  },
  {
    id: 'silver_arrow', name: '銀の矢', unidentifiedName: '銀の矢',
    category: ItemCategory.Arrow, rarity: 5, minFloor: 6,
    props: { attack: 14, count: 2 },
  },

  // === Rings ===
  {
    id: 'strength_ring', name: 'ちからの指輪', unidentifiedName: '赤い指輪',
    category: ItemCategory.Ring, rarity: 5, minFloor: 3,
    props: { effect: 'strength' },
  },
  {
    id: 'hunger_ring', name: 'ハラヘラズの指輪', unidentifiedName: '青い指輪',
    category: ItemCategory.Ring, rarity: 6, minFloor: 5,
    props: { effect: 'noHunger' },
  },
  {
    id: 'sight_ring', name: '遠投の指輪', unidentifiedName: '緑の指輪',
    category: ItemCategory.Ring, rarity: 5, minFloor: 4,
    props: { effect: 'farThrow' },
  },
];

export function createItemFromTemplate(templateId: string, identified: boolean = false): GameItem | null {
  const template = ITEM_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  const base = {
    id: generateId(),
    templateId: template.id,
    name: identified ? template.name : template.unidentifiedName,
    identified,
    cursed: false,
    blessed: false,
  };

  switch (template.category) {
    case ItemCategory.Weapon:
      return {
        ...base,
        category: ItemCategory.Weapon,
        attack: template.props.attack as number,
        enhancement: 0,
        seals: (template.props.defaultSeals as SealType[] | undefined) ?? [],
        maxSeals: template.props.maxSeals as number,
        equipped: false,
      };
    case ItemCategory.Shield:
      return {
        ...base,
        category: ItemCategory.Shield,
        defense: template.props.defense as number,
        enhancement: 0,
        seals: (template.props.defaultSeals as SealType[] | undefined) ?? [],
        maxSeals: template.props.maxSeals as number,
        equipped: false,
      };
    case ItemCategory.Herb:
      return {
        ...base,
        category: ItemCategory.Herb,
        effect: template.props.effect as string,
        hpRestore: template.props.hpRestore as number,
      };
    case ItemCategory.Scroll:
      return {
        ...base,
        category: ItemCategory.Scroll,
        effect: template.props.effect as string,
      };
    case ItemCategory.Staff:
      return {
        ...base,
        category: ItemCategory.Staff,
        effect: template.props.effect as string,
        charges: template.props.charges as number,
        maxCharges: template.props.maxCharges as number,
      };
    case ItemCategory.Pot:
      return {
        ...base,
        category: ItemCategory.Pot,
        capacity: template.props.capacity as number,
        contents: [],
        potType: template.props.potType as 'storage' | 'synthesis' | 'recovery' | 'transform',
      };
    case ItemCategory.Food:
      return {
        ...base,
        category: ItemCategory.Food,
        satiation: template.props.satiation as number,
      };
    case ItemCategory.Arrow:
      return {
        ...base,
        category: ItemCategory.Arrow,
        attack: template.props.attack as number,
        count: template.props.count as number,
      };
    case ItemCategory.Ring:
      return {
        ...base,
        category: ItemCategory.Ring,
        effect: template.props.effect as string,
        equipped: false,
      };
    default:
      return null;
  }
}

export function generateFloorItems(
  floorNum: number,
  count: number,
  rng: { next: () => number; nextInt: (min: number, max: number) => number }
): GameItem[] {
  const available = ITEM_TEMPLATES.filter(t => t.minFloor <= floorNum);
  const items: GameItem[] = [];

  for (let i = 0; i < count; i++) {
    // Weighted random based on rarity (lower rarity = more common)
    const totalWeight = available.reduce((sum, t) => sum + (11 - t.rarity), 0);
    let roll = rng.next() * totalWeight;
    let selected = available[0];
    for (const t of available) {
      roll -= (11 - t.rarity);
      if (roll <= 0) {
        selected = t;
        break;
      }
    }

    const item = createItemFromTemplate(selected.id, false);
    if (item) {
      // Random enhancement for weapons/shields
      if (item.category === ItemCategory.Weapon || item.category === ItemCategory.Shield) {
        const enh = rng.nextInt(-2, 3);
        (item as { enhancement: number }).enhancement = enh;
        if (enh < 0) item.cursed = true;
      }
      // Random blessing/curse
      if (rng.next() < 0.05) item.blessed = true;
      if (rng.next() < 0.08) item.cursed = true;

      items.push(item);
    }
  }

  // Always add gold
  items.push({
    id: generateId(),
    templateId: 'gold',
    name: 'ゴールド',
    category: ItemCategory.Gold,
    identified: true,
    cursed: false,
    blessed: false,
    amount: rng.nextInt(20, 100 + floorNum * 30),
  });

  // #26: Guaranteed food item every 3 floors
  if (floorNum % 3 === 0) {
    const foodTemplates = ['riceball', 'big_riceball', 'grilled_riceball'];
    const foodId = foodTemplates[Math.floor(rng.next() * foodTemplates.length)];
    const foodItem = createItemFromTemplate(foodId, true);
    if (foodItem) {
      items.push(foodItem);
    }
  }

  return items;
}
