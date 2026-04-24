// Player owns all character stats and emits events when they change.
// Nothing in here touches Phaser directly — pure data + logic.

import { Inventory } from '../systems/Inventory.js';

export class Player {
  constructor({
    maxHp     = 100,
    maxEnergy = 100,
    energyCostInteract = 10,
    energyRegen        = 2,   // energy/sec in safe zones
    energyDrainRate    = 1,   // energy/sec in hostile zones
    healthDrainRate    = 1,   // hp/sec in hostile zones (on top of passive drain)
    healthRegenRate    = 1,   // hp/sec in safe zones (net positive after passive drain)
    healthPassiveDrain = 1,   // hp/120sec always — hunger-like mechanic (ticked by GameScene)
  } = {}) {
    this.maxHp     = maxHp;
    this.maxEnergy = maxEnergy;
    this.energyCostInteract = energyCostInteract;
    this.energyRegen      = energyRegen;
    this.energyDrainRate  = energyDrainRate;
    this.healthDrainRate  = healthDrainRate;
    this.healthRegenRate  = healthRegenRate;
    this.healthPassiveDrain = healthPassiveDrain;

    this.hp     = maxHp;
    this.energy = maxEnergy;
    this.alive  = true;

    this._listeners = {};
    this.inventory  = new Inventory(this, { slots: 24 });
  }

  // ── Observers ──────────────────────────────────────────────────────────────
  on(event, fn)  { (this._listeners[event] ??= []).push(fn); }
  off(event, fn) { this._listeners[event] = (this._listeners[event]||[]).filter(f => f!==fn); }
  _emit(event, data) { (this._listeners[event]||[]).forEach(fn => fn(data)); }

  // ── Stat helpers ───────────────────────────────────────────────────────────
  get hpPct()     { return this.hp     / this.maxHp; }
  get energyPct() { return this.energy / this.maxEnergy; }

  // ── Health ─────────────────────────────────────────────────────────────────
  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this._emit('statsChanged', this._snapshot());
    if (this.hp === 0) this._die();
  }

  heal(amount) {
    if (!this.alive) return;
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp !== prev) this._emit('statsChanged', this._snapshot());
  }

  // ── Energy ─────────────────────────────────────────────────────────────────

  // Returns true if energy was available and spent; false if not enough.
  spendEnergy(amount) {
    if (!this.alive) return false;
    if (this.energy < amount) {
      this._emit('notEnoughEnergy', { needed: amount, have: this.energy });
      return false;
    }
    this.energy -= amount;
    this._emit('statsChanged', this._snapshot());
    return true;
  }

  regenEnergy(amount) {
    if (!this.alive) return;
    const prev = this.energy;
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    if (this.energy !== prev) this._emit('statsChanged', this._snapshot());
  }

  // ── Tick (called every second by GameScene) ────────────────────────────────
  // zone: 'safe' | 'hostile'
  tick(zone) {
    if (!this.alive) return;
    // HP: zone modifier (passive hunger is handled separately by GameScene every 2 min)
    if (zone === 'hostile') {
      this.takeDamage(this.healthDrainRate);
    } else {
      this.heal(this.healthRegenRate);
    }
    // Energy: regens in safe, drains in hostile
    if (zone === 'hostile') {
      this._drainEnergy(this.energyDrainRate);
    } else {
      this.regenEnergy(this.energyRegen);
    }
  }

  _drainEnergy(amount) {
    if (!this.alive) return;
    const prev = this.energy;
    this.energy = Math.max(0, this.energy - amount);
    if (this.energy !== prev) this._emit('statsChanged', this._snapshot());
  }

  // ── Respawn ────────────────────────────────────────────────────────────────
  respawn() {
    this.hp     = this.maxHp;
    this.energy = this.maxEnergy;
    this.alive  = true;
    this._emit('respawn', this._snapshot());
    this._emit('statsChanged', this._snapshot());
  }

  // ── Internal ───────────────────────────────────────────────────────────────
  _die() {
    this.alive = false;
    this._emit('died', this._snapshot());
  }

  _snapshot() {
    return {
      hp: this.hp, maxHp: this.maxHp, hpPct: this.hpPct,
      energy: this.energy, maxEnergy: this.maxEnergy, energyPct: this.energyPct,
      alive: this.alive,
    };
  }
}
