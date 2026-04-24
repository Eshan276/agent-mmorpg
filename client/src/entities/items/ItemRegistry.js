import { PotionItem }   from './PotionItem.js';
import { WeaponItem }   from './WeaponItem.js';
import { ResourceItem, PlankItem } from './ResourceItem.js';
import { TreasureItem } from './TreasureItem.js';
import { FoodItem }     from './FoodItem.js';
import { ToolItem }     from './ToolItem.js';

// Central catalogue. create(id) returns a fresh Item instance.
const REGISTRY = {
  // ── Potions ──────────────────────────────────────────────────────────────
  life_potion: () => new PotionItem({
    id: 'life_potion', name: 'Life Potion',
    sprite: 'assets/items/Potion/LifePot.png',
    desc: 'Restores 40 HP.', hpRestore: 40,
  }),
  heart: () => new PotionItem({
    id: 'heart', name: 'Heart',
    sprite: 'assets/items/Potion/Heart.png',
    desc: 'Restores 20 HP.', hpRestore: 20,
  }),
  milk_pot: () => new PotionItem({
    id: 'milk_pot', name: 'Milk Pot',
    sprite: 'assets/items/Potion/MilkPot.png',
    desc: 'Restores 30 energy.', enRestore: 30,
  }),
  water_pot: () => new PotionItem({
    id: 'water_pot', name: 'Water Pot',
    sprite: 'assets/items/Potion/WaterPot.png',
    desc: 'Restores 15 energy.', enRestore: 15,
  }),

  // ── Weapons ──────────────────────────────────────────────────────────────
  sword: () => new WeaponItem({
    id: 'sword', name: 'Sword',
    sprite: 'assets/items/Weapons/Sword/Sprite.png',
    desc: 'A trusty iron sword.', damage: 15,
  }),
  katana: () => new WeaponItem({
    id: 'katana', name: 'Katana',
    sprite: 'assets/items/Weapons/Katana/Sprite.png',
    desc: 'A razor-sharp katana.', damage: 22,
  }),
  kunai: () => new WeaponItem({
    id: 'kunai', name: 'Kunai',
    sprite: 'assets/items/Weapons/Sai/Sprite.png',
    desc: 'A ninja throwing blade.', damage: 8,
  }),
  big_sword: () => new WeaponItem({
    id: 'big_sword', name: 'Big Sword',
    sprite: 'assets/items/Weapons/BigSword/Sprite.png',
    desc: 'A heavy two-handed blade.', damage: 30,
  }),

  // ── Tools ─────────────────────────────────────────────────────────────────
  axe: () => new ToolItem({
    id: 'axe', name: 'Axe',
    sprite: 'assets/items/Weapons/AxeTool/Sprite.png',
    desc: 'Chops trees into planks.', toolType: 'axe', damage: 8,
  }),
  pickaxe: () => new ToolItem({
    id: 'pickaxe', name: 'Pickaxe',
    sprite: 'assets/items/Weapons/Pickaxe/Sprite.png',
    desc: 'Mines rocks for ore and gems.', toolType: 'pickaxe', damage: 6,
  }),
  hammer: () => new ToolItem({
    id: 'hammer', name: 'Hammer',
    sprite: 'assets/items/Weapons/Hammer/Sprite.png',
    desc: 'Used for crafting and building.', toolType: 'hammer', damage: 5,
  }),

  // ── Resources ─────────────────────────────────────────────────────────────
  plank: () => new PlankItem(),
  branch: () => new ResourceItem({
    id: 'branch', name: 'Branch',
    sprite: 'assets/items/Resource/Branch.png',
    desc: 'A sturdy branch. Useful for crafting.',
  }),
  gem_red: () => new ResourceItem({
    id: 'gem_red', name: 'Red Gem',
    sprite: 'assets/items/Resource/GemRed.png',
    desc: 'A glowing red gemstone.',
  }),
  gem_green: () => new ResourceItem({
    id: 'gem_green', name: 'Green Gem',
    sprite: 'assets/items/Resource/GemGreen.png',
    desc: 'A verdant green gemstone.',
  }),
  bar_gold: () => new ResourceItem({
    id: 'bar_gold', name: 'Gold Bar',
    sprite: 'assets/items/Resource/BarGold.png',
    desc: 'Refined gold, highly valuable.',
  }),
  bar_iron: () => new ResourceItem({
    id: 'bar_iron', name: 'Iron Bar',
    sprite: 'assets/items/Resource/BarIron.png',
    desc: 'A solid iron ingot.',
  }),
  rock: () => new ResourceItem({
    id: 'rock', name: 'Rock',
    sprite: 'assets/items/Resource/Rock.png',
    desc: 'Just a plain rock.',
  }),
  grass: () => new ResourceItem({
    id: 'grass', name: 'Grass Clump',
    sprite: 'assets/items/Resource/Grass.png',
    desc: 'A handful of grass.',
  }),

  // ── Treasure ──────────────────────────────────────────────────────────────
  gold_coin: () => new TreasureItem({
    id: 'gold_coin', name: 'Gold Coin',
    sprite: 'assets/items/Treasure/GoldCoin.png',
    desc: 'Shiny gold coin.', value: 10,
  }),
  silver_coin: () => new TreasureItem({
    id: 'silver_coin', name: 'Silver Coin',
    sprite: 'assets/items/Treasure/SilverCoin.png',
    desc: 'A silver coin.', value: 5,
  }),
  gold_key: () => new TreasureItem({
    id: 'gold_key', name: 'Gold Key',
    sprite: 'assets/items/Treasure/GoldKey.png',
    desc: 'Opens something important.', value: 50, stackable: false,
  }),
  gold_cup: () => new TreasureItem({
    id: 'gold_cup', name: 'Gold Cup',
    sprite: 'assets/items/Treasure/GoldCup.png',
    desc: 'An ornate trophy.', value: 100, stackable: false,
  }),

  // ── Food ──────────────────────────────────────────────────────────────────
  meat: () => new FoodItem({
    id: 'meat', name: 'Meat',
    sprite: 'assets/items/Food/Meat.png',
    desc: 'Hearty meat. Restores 15 HP.', hpRestore: 15,
  }),
  fish: () => new FoodItem({
    id: 'fish', name: 'Fish',
    sprite: 'assets/items/Food/Fish.png',
    desc: 'Fresh fish. Restores 10 HP.', hpRestore: 10,
  }),
  honey: () => new FoodItem({
    id: 'honey', name: 'Honey',
    sprite: 'assets/items/Food/Honey.png',
    desc: 'Sweet honey. Restores 20 energy.', enRestore: 20,
  }),
};

export const ItemRegistry = {
  create(id) {
    const factory = REGISTRY[id];
    if (!factory) { console.warn(`ItemRegistry: unknown item id "${id}"`); return null; }
    return factory();
  },
  has(id) { return id in REGISTRY; },
  ids()   { return Object.keys(REGISTRY); },
};
