// Builds the opening user message for a new LLM session.
// Gives a compact, readable snapshot + situation alerts.
export function buildObsPrompt(snap) {
  const { tileX, tileY, hp, maxHp, energy, maxEnergy, zone, direction } = snap.player;
  const gold      = snap.gold ?? 0;
  const inventory = snap.inventory ?? [];
  const facing    = snap.facing;
  const nodes     = snap.nearbyNodes?.filter(n => !n.depleted) ?? [];

  const FOOD    = new Set(['meat','fish','honey','heart','life_potion','milk_pot','water_pot']);
  const SELLABLE = new Set(['grass','plank','branch','rock','bar_iron','bar_gold','gem_red','gem_green']);
  const hasFood      = inventory.some(i => FOOD.has(i.id));
  const hasResources = inventory.some(i => SELLABLE.has(i.id));
  const hasAxe       = inventory.some(i => i.id === 'axe');
  const hasPickaxe   = inventory.some(i => i.id === 'pickaxe');

  // ── Situation alerts ──────────────────────────────────────────────────────
  const alerts = [];

  if (hp <= 30)
    alerts.push(`⚠ CRITICAL HP ${hp}/${maxHp} — eat immediately or you will die`);
  else if (hp <= 60)
    alerts.push(`⚠ LOW HP ${hp}/${maxHp}`);

  if (facing && facing.type !== 'sign')
    alerts.push(`→ You are FACING a ${facing.type}${facing.resourceType ? ' ('+facing.resourceType+')' : facing.id ? ' ('+facing.id+')' : ''} — call interact() now`);

  if (!facing && hp <= 60 && hasFood)
    alerts.push(`→ Call eat() — you have food and HP is low`);

  if (!facing && hp <= 60 && !hasFood && gold >= 3)
    alerts.push(`→ go_to(34,34,up) then buy food — you have ${gold}g`);

  if (!facing && hasResources)
    alerts.push(`→ go_to(34,34,up) then interact() to sell resources`);

  if (!facing && !hasAxe && !hasPickaxe)
    alerts.push(`→ go_to(38,34,up) then interact() to open chest and get tools`);

  const node = nodes.length
    ? nodes.reduce((a, b) => {
        const da = Math.abs(a.tileX - tileX) + Math.abs(a.tileY - tileY);
        const db = Math.abs(b.tileX - tileX) + Math.abs(b.tileY - tileY);
        return da <= db ? a : b;
      })
    : null;
  if (!facing && node && !hasResources)
    alerts.push(`→ Nearest ${node.resourceType} at (${node.tileX},${node.tileY}) — go_to(${node.tileX},${node.tileY + 1},up) then interact()`);

  if (!facing && zone === 'Shinobi Village' && !hasResources && !node)
    alerts.push(`→ No nodes in Shinobi Village — go_to(24,35,down) to enter Forest of Whispers`);

  // ── Compact state ─────────────────────────────────────────────────────────
  const lines = [
    `Position: (${tileX},${tileY}) facing ${direction} | Zone: ${zone}`,
    `HP: ${hp}/${maxHp} | Energy: ${energy}/${maxEnergy} | Gold: ${gold}g`,
    `Inventory: ${inventory.length ? inventory.map(i => `${i.name}×${i.qty}`).join(', ') : 'empty'}`,
    `Facing: ${facing ? `${facing.type}${facing.resourceType ? ' ('+facing.resourceType+')' : facing.id ? ' ('+facing.id+')' : ''}` : 'nothing'}`,
    `Nearby nodes: ${nodes.length ? nodes.map(n => `${n.resourceType}@(${n.tileX},${n.tileY})`).join(', ') : 'none'}`,
    `Recent events: ${snap.recentEvents?.join('; ') || 'none'}`,
  ];

  const situationBlock = alerts.length
    ? `SITUATION:\n${alerts.map(a => '  ' + a).join('\n')}\n\n`
    : '';

  return situationBlock + lines.join('\n');
}
