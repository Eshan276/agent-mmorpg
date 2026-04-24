// UIScene — runs on top of GameScene at 1:1 scale (no camera zoom).
// Receives all display data via the Phaser global event bus (this.game.events).
// Never imports GameScene directly — fully decoupled.

export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this._BAR_W    = 160;
    this._BAR_H    = 14;
    this._PAD      = 14;
    this._menuOpen = false;

    this._buildStatBars(W, H);
    this._buildZoneLabel(W, H);
    this._buildDialog(W, H);
    this._buildZoneBanner(W, H);
    this._buildHamburger(W, H);
    this._buildStatsPanel(W, H);
    this._buildDeathOverlay(W, H);
    this._buildHint(W, H);

    this._buildInventoryPanel(W, H);
    this._buildShopPanel(W, H);

    // ── Listen to game events ──
    this.game.events.on('ui:statsChanged',      d  => this._onStats(d),              this);
    this.game.events.on('ui:dialog',            d  => this._onDialog(d),             this);
    this.game.events.on('ui:zoneBanner',        d  => this._onZoneBanner(d),         this);
    this.game.events.on('ui:zoneLabel',         d  => this._onZoneLabel(d),          this);
    this.game.events.on('ui:died',              () => this._onDied(),                 this);
    this.game.events.on('ui:respawn',           () => this._onRespawn(),              this);
    this.game.events.on('ui:flashEnergy',       () => this._flashBar('en'),           this);
    this.game.events.on('ui:inventoryChanged',  slots => this._onInventory(slots),    this);
    this.game.events.on('ui:openShop',          d => this._openShop(d.shop, d.player), this);

    // I key toggles inventory, Escape closes shop
    this.input.keyboard.on('keydown-I',      () => this._toggleInventory());
    this.input.keyboard.on('keydown-ESC',    () => this._closeShop());

    this.events.once('shutdown', () => this.game.events.off(null, null, this));
  }

  // ==========================================================================
  // STAT BARS — top-left
  // ==========================================================================
  _buildStatBars(W, H) {
    const P  = this._PAD;
    const BW = this._BAR_W;
    const BH = this._BAR_H;

    // ── Panel background ──
    this._barPanel = this.add.graphics();
    this._barPanel.fillStyle(0x000000, 0.55);
    this._barPanel.fillRoundedRect(P - 6, P - 6, BW + 80, BH*2 + 24, 6);
    this._barPanel.setDepth(100);

    // ── HP bar ──
    const hpY = P + 8;
    this.add.text(P, hpY - 1, '♥', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ff5555',
    }).setDepth(101).setOrigin(0, 0.5);

    this._hpBg  = this.add.rectangle(P+18 + BW/2, hpY, BW, BH, 0x550000).setOrigin(0.5).setDepth(101);
    this._hpBar = this.add.rectangle(P+18,         hpY, BW, BH, 0xee3333).setOrigin(0, 0.5).setDepth(102);
    this._hpTxt = this.add.text(P+18 + BW + 6, hpY, '100/100', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffbbbb',
    }).setOrigin(0, 0.5).setDepth(103);

    // ── Energy bar ──
    const enY = hpY + BH + 8;
    this.add.text(P, enY - 1, '⚡', {
      fontSize: '13px', fontFamily: 'monospace', color: '#44aaff',
    }).setDepth(101).setOrigin(0, 0.5);

    this._enBg  = this.add.rectangle(P+18 + BW/2, enY, BW, BH, 0x002244).setOrigin(0.5).setDepth(101);
    this._enBar = this.add.rectangle(P+18,         enY, BW, BH, 0x2299ee).setOrigin(0, 0.5).setDepth(102);
    this._enTxt = this.add.text(P+18 + BW + 6, enY, '100/100', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaddff',
    }).setOrigin(0, 0.5).setDepth(103);
  }

  _onStats({ hp, maxHp, energy, maxEnergy }) {
    const hpPct = hp / maxHp;
    const enPct = energy / maxEnergy;

    this._hpBar.width = Math.max(0, this._BAR_W * hpPct);
    this._enBar.width = Math.max(0, this._BAR_W * enPct);
    this._hpTxt.setText(`${Math.ceil(hp)}/${maxHp}`);
    this._enTxt.setText(`${Math.ceil(energy)}/${maxEnergy}`);

    // Colour: green → yellow → red as hp drops
    const col = hpPct > 0.6 ? 0x44cc44 : hpPct > 0.3 ? 0xffaa00 : 0xee3333;
    this._hpBar.setFillStyle(col);

    // Mirror stats into the open panel too
    this._panelHpTxt?.setText(`HP      ${Math.ceil(hp)} / ${maxHp}`);
    this._panelEnTxt?.setText(`Energy  ${Math.ceil(energy)} / ${maxEnergy}`);
  }

  _flashBar(which) {
    const bar = which === 'en' ? this._enBar : this._hpBar;
    this.tweens.add({
      targets: bar, alpha: 0.15, yoyo: true, repeat: 3,
      duration: 70, ease: 'Linear',
      onComplete: () => bar.setAlpha(1),
    });
  }

  // ==========================================================================
  // ZONE LABEL — bottom-right
  // ==========================================================================
  _buildZoneLabel(W, H) {
    this._zoneLbl = this.add.text(W - this._PAD, H - this._PAD, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffcc88',
      backgroundColor: '#00000077', padding: { x:6, y:3 },
    }).setOrigin(1, 1).setDepth(100);
  }
  _onZoneLabel(name) { this._zoneLbl.setText(name); }

  // ==========================================================================
  // ZONE BANNER — top-center, fades out
  // ==========================================================================
  _buildZoneBanner(W, _H) {
    this._banner = this.add.text(W/2, 28, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#00000088', padding: { x:14, y:5 },
    }).setOrigin(0.5, 0).setDepth(100).setAlpha(0);
  }
  _onZoneBanner(name) {
    this._banner.setText(name).setAlpha(1);
    this.tweens.killTweensOf(this._banner);
    this.tweens.add({ targets: this._banner, alpha: 0, delay: 2200, duration: 900, ease: 'Quad.In' });
  }

  // ==========================================================================
  // DIALOG BOX — bottom-center
  // ==========================================================================
  _buildDialog(W, H) {
    const DH = 56, DW = W - 28;
    this._dlgBg = this.add.rectangle(W/2, H - 36, DW, DH, 0x000000, 0.88)
      .setOrigin(0.5).setDepth(110).setVisible(false).setStrokeStyle(2, 0xffcc44);
    this._dlgTxt = this.add.text(W/2, H - 36, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff',
      wordWrap: { width: DW - 24 }, align: 'center',
    }).setOrigin(0.5).setDepth(111).setVisible(false);
    this._dlgTimer = null;
  }
  _onDialog({ msg, speaker }) {
    const txt = speaker ? `[${speaker.toUpperCase()}]  ${msg}` : msg;
    this._dlgBg.setVisible(true);
    this._dlgTxt.setText(txt).setVisible(true);
    if (this._dlgTimer) this._dlgTimer.remove();
    this._dlgTimer = this.time.delayedCall(3500, () => {
      this._dlgBg.setVisible(false);
      this._dlgTxt.setVisible(false);
    });
  }

  // ==========================================================================
  // HINT — bottom-left
  // ==========================================================================
  _buildHint(_W, H) {
    this.add.text(this._PAD, H - this._PAD, 'WASD: Move   Space/E: Interact   I: Inventory', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffffff99',
      backgroundColor: '#00000055', padding: { x:5, y:3 },
    }).setOrigin(0, 1).setDepth(100);
  }

  // ==========================================================================
  // HAMBURGER BUTTON — top-right
  // ==========================================================================
  _buildHamburger(W, _H) {
    const SIZE = 36, P = this._PAD;

    // Button background
    this._burgerBg = this.add.rectangle(W - P - SIZE/2, P + SIZE/2, SIZE, SIZE, 0x000000, 0.7)
      .setDepth(120).setInteractive({ useHandCursor: true })
      .setStrokeStyle(1.5, 0xffcc44);

    // Three lines
    const bx = W - P - SIZE/2;
    const by = P + SIZE/2;
    this._burgerLines = this.add.graphics().setDepth(121);
    this._drawHamburgerLines(bx, by);

    this._burgerBg.on('pointerdown', () => this._toggleMenu());
    this._burgerBg.on('pointerover', () => this._burgerBg.setFillStyle(0x222222, 0.9));
    this._burgerBg.on('pointerout',  () => this._burgerBg.setFillStyle(0x000000, 0.7));

    this._burgerX = bx;
    this._burgerY = by;
  }

  _drawHamburgerLines(bx, by) {
    this._burgerLines.clear();
    this._burgerLines.lineStyle(2.5, 0xffffff, 1);
    for (const offset of [-7, 0, 7]) {
      this._burgerLines.moveTo(bx - 9, by + offset);
      this._burgerLines.lineTo(bx + 9, by + offset);
    }
    this._burgerLines.strokePath();
  }

  // ==========================================================================
  // STATS PANEL — slides in from the right
  // ==========================================================================
  _buildStatsPanel(W, H) {
    const PW = 240, PH = H - 40;
    const PX = W + PW/2; // starts off-screen right
    const PY = H/2;

    this._panel = this.add.container(PX, PY).setDepth(130);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.97);
    bg.fillRoundedRect(-PW/2, -PH/2, PW, PH, 8);
    bg.lineStyle(2, 0xffcc44, 1);
    bg.strokeRoundedRect(-PW/2, -PH/2, PW, PH, 8);

    // Title
    const title = this.add.text(0, -PH/2 + 18, '☰  Player Stats', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffcc44',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0xffcc44, 0.4);
    div.moveTo(-PW/2 + 12, -PH/2 + 34).lineTo(PW/2 - 12, -PH/2 + 34);
    div.strokePath();

    // Player name row
    const nameLabel = this.add.text(-PW/2 + 16, -PH/2 + 50, 'Player', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaaaa',
    });
    const nameVal = this.add.text(-PW/2 + 16, -PH/2 + 64, 'NinjaBlue', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
    });

    // Stats rows
    const rowY = (i) => -PH/2 + 100 + i * 30;
    const ROW_STYLE = { fontSize:'12px', fontFamily:'monospace', color:'#cccccc' };

    this._panelHpTxt = this.add.text(-PW/2 + 16, rowY(0), 'HP      100 / 100', { ...ROW_STYLE, color:'#ff8888' });
    this._panelEnTxt = this.add.text(-PW/2 + 16, rowY(1), 'Energy  100 / 100', { ...ROW_STYLE, color:'#88ccff' });
    this._panelZone  = this.add.text(-PW/2 + 16, rowY(2), 'Zone    —',         { ...ROW_STYLE, color:'#ffcc88' });
    this._panelAlive = this.add.text(-PW/2 + 16, rowY(3), 'Status  Alive ✓',   { ...ROW_STYLE, color:'#88ff88' });

    // Divider 2
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x444444, 0.6);
    div2.moveTo(-PW/2 + 12, rowY(4) + 4).lineTo(PW/2 - 12, rowY(4) + 4);
    div2.strokePath();

    // Party / players section (future multiplayer roster)
    const partyTitle = this.add.text(-PW/2 + 16, rowY(4) + 16, 'Party  (1 / 1)', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaaaa',
    });
    this._partyList = this.add.text(-PW/2 + 16, rowY(5) + 4, '• NinjaBlue (you)', {
      fontSize: '11px', fontFamily: 'monospace', color: '#44ff88',
    });

    this._panel.add([bg, title, div, nameLabel, nameVal,
      this._panelHpTxt, this._panelEnTxt, this._panelZone, this._panelAlive,
      div2, partyTitle, this._partyList]);

    this._panelW    = PW;
    this._panelOpenX  = W - PW/2 - 4;
    this._panelClosedX = W + PW/2 + 4;
    this._panel.x     = this._panelClosedX;
  }

  _toggleMenu() {
    this._menuOpen = !this._menuOpen;
    const targetX = this._menuOpen ? this._panelOpenX : this._panelClosedX;
    this.tweens.killTweensOf(this._panel);
    this.tweens.add({
      targets: this._panel, x: targetX,
      duration: 220, ease: 'Quad.Out',
    });
    // Animate burger to X when open
    this._burgerLines.clear();
    if (this._menuOpen) {
      this._burgerLines.lineStyle(2.5, 0xffcc44, 1);
      this._burgerLines.moveTo(this._burgerX - 8, this._burgerY - 8);
      this._burgerLines.lineTo(this._burgerX + 8, this._burgerY + 8);
      this._burgerLines.moveTo(this._burgerX + 8, this._burgerY - 8);
      this._burgerLines.lineTo(this._burgerX - 8, this._burgerY + 8);
      this._burgerLines.strokePath();
    } else {
      this._drawHamburgerLines(this._burgerX, this._burgerY);
    }
  }

  // ==========================================================================
  // DEATH OVERLAY
  // ==========================================================================
  _buildDeathOverlay(W, H) {
    this._deathBg = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0)
      .setDepth(200).setVisible(false);
    this._deathTitle = this.add.text(W/2, H/2 - 36, 'YOU DIED', {
      fontSize: '52px', fontFamily: 'monospace', color: '#cc2222',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(201).setVisible(false);
    this._deathSub = this.add.text(W/2, H/2 + 20, 'Press Space or E to respawn', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(201).setVisible(false);
  }

  _onDied() {
    this._deathBg.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this._deathBg, alpha: 0.78, duration: 900, ease: 'Quad.In' });
    this._deathTitle.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this._deathTitle, alpha: 1, delay: 600, duration: 500 });
    this._deathSub.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this._deathSub, alpha: 1, delay: 1100, duration: 500 });
    this._panelAlive?.setText('Status  Dead ✗').setStyle({ color: '#ff4444' });
  }

  _onRespawn() {
    this.tweens.add({
      targets: [this._deathBg, this._deathTitle, this._deathSub],
      alpha: 0, duration: 400,
      onComplete: () => {
        this._deathBg.setVisible(false);
        this._deathTitle.setVisible(false);
        this._deathSub.setVisible(false);
      },
    });
    this._panelAlive?.setText('Status  Alive ✓').setStyle({ color: '#88ff88' });
  }

  // Update zone in panel when zone changes
  _onZoneLabel(name) {
    this._zoneLbl.setText(name);
    this._panelZone?.setText(`Zone    ${name}`);
  }

  // ==========================================================================
  // INVENTORY PANEL — centre-screen grid, toggled with I key
  // ==========================================================================
  _buildInventoryPanel(W, H) {
    this._invOpen    = false;
    this._invSlots   = 24;
    this._invCols    = 6;
    this._invRows    = 4;
    this._invCellSz  = 40;
    this._invPad     = 12;

    const PW = this._invCols * this._invCellSz + this._invPad * 2;
    const PH = this._invRows * this._invCellSz + this._invPad * 2 + 36; // +36 for title

    this._invPanel = this.add.container(W/2, H/2).setDepth(160).setVisible(false);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.97);
    bg.fillRoundedRect(-PW/2, -PH/2, PW, PH, 8);
    bg.lineStyle(2, 0xffcc44, 1);
    bg.strokeRoundedRect(-PW/2, -PH/2, PW, PH, 8);

    // Title
    const title = this.add.text(0, -PH/2 + 16, '🎒  Inventory', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffcc44', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Close hint
    const hint = this.add.text(0, PH/2 - 10, 'Press I to close', {
      fontSize: '9px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5, 1);

    this._invPanel.add([bg, title, hint]);

    // Build slot cells and item display objects
    this._invSlotBgs   = [];
    this._invSlotPos   = []; // store {cx, cy} per slot for redraw
    this._invItemImgs  = [];
    this._invItemQtys  = [];
    this._invTooltip   = null;

    for (let i = 0; i < this._invSlots; i++) {
      const col = i % this._invCols;
      const row = Math.floor(i / this._invCols);
      const cx  = -PW/2 + this._invPad + col * this._invCellSz + this._invCellSz/2;
      const cy  = -PH/2 + 36 + this._invPad + row * this._invCellSz + this._invCellSz/2;
      this._invSlotPos.push({ cx, cy });

      // Slot background
      const cell = this.add.graphics();
      cell.fillStyle(0x1a1a2e, 1);
      cell.fillRoundedRect(cx - 17, cy - 17, 34, 34, 4);
      cell.lineStyle(1, 0x444466, 1);
      cell.strokeRoundedRect(cx - 17, cy - 17, 34, 34, 4);
      this._invSlotBgs.push(cell);

      // Item image (hidden until filled; '__DEFAULT' is Phaser's built-in white square)
      const img = this.add.image(cx, cy, '__DEFAULT').setDisplaySize(26, 26).setVisible(false);
      this._invItemImgs.push(img);

      // Quantity text
      const qty = this.add.text(cx + 12, cy + 12, '', {
        fontSize: '8px', fontFamily: 'monospace', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setVisible(false);
      this._invItemQtys.push(qty);

      // Make slot interactive for hover tooltip + click to use
      const hitArea = this.add.rectangle(cx, cy, 34, 34, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => this._showInvTooltip(i, cx, cy, PH));
      hitArea.on('pointerout',  () => this._hideInvTooltip());
      hitArea.on('pointerdown', () => this._useSlot(i));

      this._invPanel.add([cell, img, qty, hitArea]);
    }

    // Tooltip (built once, repositioned)
    this._invTipBg  = this.add.graphics().setDepth(165).setVisible(false);
    this._invTipTxt = this.add.text(0, 0, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#000000cc', padding: { x: 6, y: 4 },
      wordWrap: { width: 160 },
    }).setDepth(166).setVisible(false);

    this._invPanelPW = PW;
    this._invPanelPH = PH;
    this._invData    = [];
  }

  _toggleInventory() {
    this._invOpen = !this._invOpen;
    this._invPanel.setVisible(this._invOpen);
    if (!this._invOpen) this._hideInvTooltip();
  }

  _onInventory(slots) {
    this._invData = slots;
    for (let i = 0; i < this._invSlots; i++) {
      const item        = slots[i] ?? null;
      const img         = this._invItemImgs[i];
      const qty         = this._invItemQtys[i];
      const cell        = this._invSlotBgs[i];
      const { cx, cy }  = this._invSlotPos[i];

      cell.clear();
      if (item) {
        const texKey = `item_${item.id}`;
        if (this.textures.exists(texKey)) {
          img.setTexture(texKey).setVisible(true);
        } else {
          img.setVisible(false);
        }
        if (item.stackable && item.quantity > 1) {
          qty.setText(`${item.quantity}`).setVisible(true);
        } else {
          qty.setVisible(false);
        }
        cell.fillStyle(0x1e1e3a, 1);
        cell.fillRoundedRect(cx - 17, cy - 17, 34, 34, 4);
        cell.lineStyle(1, 0x6666aa, 1);
        cell.strokeRoundedRect(cx - 17, cy - 17, 34, 34, 4);
      } else {
        img.setVisible(false);
        qty.setVisible(false);
        cell.fillStyle(0x1a1a2e, 1);
        cell.fillRoundedRect(cx - 17, cy - 17, 34, 34, 4);
        cell.lineStyle(1, 0x444466, 1);
        cell.strokeRoundedRect(cx - 17, cy - 17, 34, 34, 4);
      }
    }
  }

  _useSlot(slotIndex) {
    const item = this._invData?.[slotIndex];
    if (!item) return;
    // Emit to GameScene which will call playerEntity.inventory.useAt()
    this.game.events.emit('ui:useItem', slotIndex);
    this._hideInvTooltip();
  }

  _showInvTooltip(slotIndex, cx, cy, _PH) {
    const item = this._invData?.[slotIndex];
    if (!item) { this._hideInvTooltip(); return; }

    const W = this.scale.width, H = this.scale.height;

    // Convert container-local coords to screen coords
    const screenX = W/2 + cx;
    const screenY = H/2 + cy;

    const usable = item.type === 'potion' || item.type === 'food';
    const action = usable ? '\n[Click to use]' : '';
    const text   = `${item.name}\n${item.desc}${action}`;
    this._invTipTxt.setText(text)
      .setPosition(screenX - 80, screenY - 58)
      .setVisible(true);
  }

  _hideInvTooltip() {
    this._invTipTxt.setVisible(false);
    this._invTipBg.setVisible(false);
  }

  // ==========================================================================
  // SHOP PANEL — full-screen overlay, opened when talking to a merchant NPC
  // ==========================================================================
  _buildShopPanel(W, H) {
    this._shopOpen    = false;
    this._shopRef     = null;  // current Shop instance
    this._shopPlayer  = null;  // current player reference
    this._shopTab     = 'buy'; // 'buy' | 'sell'

    const PW = Math.min(520, W - 40);
    const PH = Math.min(420, H - 60);
    this._shopPW = PW;
    this._shopPH = PH;

    this._shopPanel = this.add.container(W/2, H/2).setDepth(170).setVisible(false);

    // Dark overlay behind panel
    this._shopOverlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.5)
      .setDepth(169).setVisible(false);

    // Panel bg
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1f, 0.98);
    bg.fillRoundedRect(-PW/2, -PH/2, PW, PH, 10);
    bg.lineStyle(2, 0xffcc44, 1);
    bg.strokeRoundedRect(-PW/2, -PH/2, PW, PH, 10);

    // Title
    this._shopTitle = this.add.text(0, -PH/2 + 18, 'Shop', {
      fontSize: '15px', fontFamily: 'monospace', color: '#ffcc44', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Gold display — coin icon image + count text side by side
    const coinImg = this.add.image(PW/2 - 44, -PH/2 + 18, 'item_gold_coin')
      .setDisplaySize(14, 14).setOrigin(0.5);
    this._shopGoldTxt = this.add.text(PW/2 - 34, -PH/2 + 18, '0', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this._shopPanel.add(coinImg);

    // Tab buttons
    const tabY = -PH/2 + 42;
    this._shopBuyTabBg  = this.add.graphics();
    this._shopSellTabBg = this.add.graphics();
    this._shopBuyTab  = this.add.text(-PW/4, tabY, 'Buy',  { fontSize:'12px', fontFamily:'monospace', color:'#ffffff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._shopSellTab = this.add.text( PW/4, tabY, 'Sell', { fontSize:'12px', fontFamily:'monospace', color:'#aaaaaa' }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this._shopBuyTab.on('pointerdown',  () => this._setShopTab('buy'));
    this._shopSellTab.on('pointerdown', () => this._setShopTab('sell'));

    // Divider under tabs
    const tabDiv = this.add.graphics();
    tabDiv.lineStyle(1, 0x444466, 1);
    tabDiv.moveTo(-PW/2 + 12, tabY + 14).lineTo(PW/2 - 12, tabY + 14);
    tabDiv.strokePath();

    // Scrollable listing area — we'll use a mask + item rows
    this._shopListY   = -PH/2 + 68;
    this._shopListH   = PH - 140;
    this._shopRows    = [];   // array of row containers, rebuilt on open/tab switch
    this._shopScrollY = 0;

    // Close button
    const closeBtn = this.add.text(PW/2 - 10, -PH/2 + 10, '✕', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff6666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeShop());

    // Feedback text (shows buy/sell result briefly)
    this._shopFeedback = this.add.text(0, PH/2 - 16, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#88ff88',
      backgroundColor: '#00000088', padding: { x:6, y:3 },
    }).setOrigin(0.5, 1).setVisible(false);

    this._shopPanel.add([bg, this._shopTitle, this._shopGoldTxt,
      this._shopBuyTabBg, this._shopSellTabBg,
      this._shopBuyTab, this._shopSellTab, tabDiv, closeBtn, this._shopFeedback]);
    // coinImg already added above
  }

  _openShop(shop, player) {
    this._shopRef    = shop;
    this._shopPlayer = player;
    this._shopTab    = 'buy';
    this._shopTitle.setText(`🏪  ${shop.name}`);
    this._shopOverlay.setVisible(true);
    this._shopPanel.setVisible(true);
    this._shopOpen   = true;
    this._refreshShop();
  }

  _closeShop() {
    if (!this._shopOpen) return;
    this._shopOpen = false;
    this._shopPanel.setVisible(false);
    this._shopOverlay.setVisible(false);
    this._clearShopRows();
  }

  _setShopTab(tab) {
    this._shopTab = tab;
    this._shopBuyTab.setStyle({ color: tab === 'buy'  ? '#ffcc44' : '#aaaaaa' });
    this._shopSellTab.setStyle({ color: tab === 'sell' ? '#ffcc44' : '#aaaaaa' });
    this._refreshShop();
  }

  _refreshShop() {
    this._clearShopRows();
    this._updateGoldDisplay();

    const shop  = this._shopRef;
    const PW    = this._shopPW, PH = this._shopPH;
    const ROW_H = 42;

    let listings;
    if (this._shopTab === 'buy') {
      listings = shop.getStock().filter(l => l.buyPrice > 0);
    } else {
      // Sell tab: build from actual inventory — every item the player carries (except currency)
      const seen = new Set();
      listings = this._shopPlayer.inventory.slots
        .filter(s => s && s.id !== shop.currency && !seen.has(s.id) && seen.add(s.id))
        .map(s => ({
          itemId:    s.id,
          name:      s.name,
          desc:      s.desc,
          sprite:    s.sprite,
          sellPrice: shop.getSellPrice(s.id),
          _qty:      this._shopPlayer.inventory.slots
                       .filter(sl => sl?.id === s.id)
                       .reduce((n, sl) => n + sl.quantity, 0),
        }))
        .filter(l => l.sellPrice > 0);
    }

    if (listings.length === 0) {
      const emptyT = this.add.text(0, this._shopListY + 30,
        this._shopTab === 'sell' ? 'Nothing to sell.' : 'Out of stock.', {
        fontSize: '12px', fontFamily: 'monospace', color: '#666688',
      }).setOrigin(0.5, 0);
      this._shopRows.push(emptyT);
      this._shopPanel.add(emptyT);
      return;
    }

    listings.forEach((listing, i) => {
      const ry = this._shopListY + i * ROW_H;

      // Quantity badge (sell tab: how many player has)
      const invQty = this._shopTab === 'sell' ? (listing._qty ?? null) : null;

      // Row bg
      const rowBg = this.add.graphics();
      rowBg.fillStyle(0x1a1a35, 1);
      rowBg.fillRoundedRect(-PW/2 + 10, ry, PW - 20, ROW_H - 4, 4);
      this._shopPanel.add(rowBg);

      // Item sprite
      const texKey = `item_${listing.itemId}`;
      if (this.textures.exists(texKey)) {
        const img = this.add.image(-PW/2 + 30, ry + ROW_H/2 - 2, texKey)
          .setDisplaySize(22, 22).setOrigin(0.5);
        this._shopPanel.add(img);
        this._shopRows.push(img);
      }

      // Name
      const nameLabel = invQty !== null ? `${listing.name}  x${invQty}` : listing.name;
      const nameT = this.add.text(-PW/2 + 46, ry + 7, nameLabel, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
      });
      const descT = this.add.text(-PW/2 + 46, ry + 21, listing.desc.slice(0, 42), {
        fontSize: '9px', fontFamily: 'monospace', color: '#888888',
      });

      // Price — coin icon + number
      const priceVal = this._shopTab === 'buy' ? listing.buyPrice : listing.sellPrice;
      const coinI = this.add.image(PW/2 - 80, ry + ROW_H/2 - 2, 'item_gold_coin')
        .setDisplaySize(12, 12).setOrigin(0.5);
      const priceT = this.add.text(PW/2 - 72, ry + ROW_H/2 - 2, `${priceVal}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ffd700',
      }).setOrigin(0, 0.5);
      this._shopPanel.add(coinI);
      this._shopRows.push(coinI);

      // Action button
      const btnLabel = this._shopTab === 'buy' ? 'BUY' : 'SELL';
      const btn = this.add.text(PW/2 - 14, ry + ROW_H/2 - 2, btnLabel, {
        fontSize: '10px', fontFamily: 'monospace', color: '#000000',
        backgroundColor: this._shopTab === 'buy' ? '#44cc88' : '#ffcc44',
        padding: { x:5, y:3 },
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        if (this._shopTab === 'buy') {
          const res = this._shopRef.buy(this._shopPlayer, listing.itemId, 1);
          this._showShopFeedback(res.ok ? `Bought ${listing.name}!` : res.reason, res.ok);
        } else {
          const res = this._shopRef.sell(this._shopPlayer, listing.itemId, 1);
          this._showShopFeedback(res.ok ? `Sold for G${res.earned}` : res.reason, res.ok);
        }
        this._updateGoldDisplay();
        this.game.events.emit('ui:inventoryChanged', this._shopPlayer.inventory.slots);
        // Refresh sell tab so sold items disappear when qty hits 0
        if (this._shopTab === 'sell') this._refreshShop();
      });

      btn.on('pointerover',  () => { rowBg.clear(); rowBg.fillStyle(0x2a2a50,1); rowBg.fillRoundedRect(-PW/2+10, ry, PW-20, ROW_H-4, 4); });
      btn.on('pointerout',   () => { rowBg.clear(); rowBg.fillStyle(0x1a1a35,1); rowBg.fillRoundedRect(-PW/2+10, ry, PW-20, ROW_H-4, 4); });

      this._shopRows.push(rowBg, nameT, descT, priceT, btn);
      this._shopPanel.add([nameT, descT, priceT, btn]);
    });
  }

  _clearShopRows() {
    for (const obj of this._shopRows) obj.destroy();
    this._shopRows = [];
  }

  _updateGoldDisplay() {
    if (!this._shopPlayer) return;
    const gold = this._shopPlayer.inventory.slots
      .filter(s => s?.id === 'gold_coin')
      .reduce((n, s) => n + s.quantity, 0);
    this._shopGoldTxt.setText(`${gold}`);
  }

  _showShopFeedback(msg, ok) {
    this._shopFeedback
      .setText(msg)
      .setStyle({ color: ok ? '#88ff88' : '#ff8888' })
      .setVisible(true);
    this.time.delayedCall(2000, () => this._shopFeedback.setVisible(false));
  }
}
