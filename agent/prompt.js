// Builds the opening user message for a new LLM session.
// Gives a compact, readable snapshot + situation alerts.
export function buildObsPrompt(snap) {
  const { tileX, tileY, hp, maxHp, energy, maxEnergy, zone, direction } = snap.player;
  const goldBalance = snap.goldBalance ?? null;
  const inventory   = snap.inventory ?? [];
  const facing      = snap.facing;
  const nodes       = snap.nearbyNodes?.filter(n => !n.depleted) ?? [];
  const ammPrices   = snap.ammPrices ?? {};

  const FOOD     = new Set(['meat','fish','honey','heart','life_potion','milk_pot','water_pot']);
  const SELLABLE = new Set(['grass','plank','branch','rock','bar_iron','bar_gold','gem_red','gem_green']);
  const hasFood      = inventory.some(i => FOOD.has(i.id));
  const hasResources = inventory.some(i => SELLABLE.has(i.id));

  // ── Situation alerts ──────────────────────────────────────────────────────
  const alerts = [];

  if (hp <= 30)
    alerts.push(`⚠ CRITICAL HP ${hp}/${maxHp} — eat immediately or you will die`);
  else if (hp <= 60)
    alerts.push(`⚠ LOW HP ${hp}/${maxHp}`);

  if (energy <= 20)
    alerts.push(`⚠ LOW ENERGY ${energy}/${maxEnergy} — return to Shinobi Village to regen, or drink water_pot/honey`);

  if (facing && facing.type !== 'sign')
    alerts.push(`→ You are FACING a ${facing.type}${facing.resourceType ? ' ('+facing.resourceType+')' : facing.id ? ' ('+facing.id+')' : ''} — call interact() now`);

  if (!facing && hp <= 60 && hasFood)
    alerts.push(`→ Call eat() — you have food and HP is low`);

  if (!facing && hp <= 60 && !hasFood)
    alerts.push(`→ Low HP — call swap("fish","buy",1) or swap("meat","buy",1) to buy food, then eat()`);

  if (!facing && hasResources)
    alerts.push(`→ You have resources — call get_prices() then swap(resourceId,"sell",amount) to sell`);

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
  const goldLine = goldBalance !== null
    ? `GGLD: ${goldBalance} | `
    : '';
  const priceEntries = Object.entries(ammPrices);
  const pricesLine = priceEntries.length
    ? `AMM prices (GGLD/unit): ${priceEntries.map(([r, p]) => `${r}=${p}`).join(' ')}`
    : null;

  const lines = [
    `Position: (${tileX},${tileY}) facing ${direction} | Zone: ${zone}`,
    `HP: ${hp}/${maxHp} | Energy: ${energy}/${maxEnergy} | ${goldLine}`,
    `Inventory: ${inventory.length ? inventory.map(i => `${i.name}×${i.qty}`).join(', ') : 'empty'}`,
    `Facing: ${facing ? `${facing.type}${facing.resourceType ? ' ('+facing.resourceType+')' : facing.id ? ' ('+facing.id+')' : ''}` : 'nothing'}`,
    `Nearby nodes: ${nodes.length ? nodes.map(n => `${n.resourceType}@(${n.tileX},${n.tileY})`).join(', ') : 'none'}`,
    `Recent events: ${snap.recentEvents?.join('; ') || 'none'}`,
  ];
  if (pricesLine) lines.push(pricesLine);

  // Other agents presence and chat
  const others = snap.otherAgents ?? [];
  const agentChat = snap.agentChat ?? [];
  const whispers  = snap.whispers ?? [];
  if (others.length) {
    lines.push(`Other agents: ${others.map(a => {
      const id   = a.ensName || a.agentId;
      const peer = a.axlPeerId ? ` peer=${a.axlPeerId.slice(0, 8)}` : '';
      return `${id}@(${a.tileX},${a.tileY}) zone=${a.zone} hp=${a.hp}${peer}`;
    }).join(' | ')}`);
  }
  if (agentChat.length) {
    lines.push(`Agent chat (public): ${agentChat.map(c => `${c.agentId} says: "${c.message}"`).join(' | ')}`);
  }
  if (whispers.length) {
    lines.push(`Whispers (private, AXL): ${whispers.map(w => `${w.from} → you: "${w.text}"`).join(' | ')}`);
  }

  const situationBlock = alerts.length
    ? `SITUATION:\n${alerts.map(a => '  ' + a).join('\n')}\n\n`
    : '';

  return situationBlock + lines.join('\n');
}
