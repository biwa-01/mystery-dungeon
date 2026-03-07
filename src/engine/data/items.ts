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
    id: 'dragonkiller', name: 'ドラゴンキラー', unidentifiedName: 'ドラゴンキラー',
    category: ItemCategory.Weapon, rarity: 7, minFloor: 8,
    props: { attack: 15, maxSeals: 5, defaultSeals: [SealType.DragonSlayer] },
  },
  {
    id: 'minotaur_axe', name: '必殺の剣', unidentifiedName: '必殺の剣',
    category: ItemCategory.Weapon, rarity: 8, minFloor: 10,
    props: { attack: 18, maxSeals: 4, defaultSeals: [SealType.Critical] },
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
    id: 'dragon_shield', name: 'ドラゴンシールド', unidentifiedName: 'ドラゴンシールド',
    category: ItemCategory.Shield, rarity: 6, minFloor: 6,
    props: { defense: 10, maxSeals: 5, defaultSeals: [SealType.FireResist] },
  },
  {
    id: 'gold_shield', name: '金の盾', unidentifiedName: '金の盾',
    category: ItemCategory.Shield, rarity: 7, minFloor: 8,
    props: { defense: 14, maxSeals: 6, defaultSeals: [SealType.RustProof] },
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
    id: 'blank_scroll', name: '白紙の巻物', unidentifiedName: 'そらの巻物',
    category: ItemCategory.Scroll, rarity: 8, minFloor: 8,
    props: { effect: 'blank' },
  },

  // === Staves ===
  {
    id: 'knockback_staff', name: 'ふきとばしの杖', unidentifiedName: '松の杖',
    category: ItemCategory.Staff, rarity: 2, minFloor: 1,
    props: { effect: 'knockback', charges: 5, maxCharges: 7 },
  },
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

  return items;
}
