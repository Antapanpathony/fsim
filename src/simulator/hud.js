// HTML overlay HUD

const STALL_COLOR = '#ff2200';
const WARN_COLOR  = '#ffaa00';
const GREEN = '#00ff88';
const WHITE = '#ffffff';
const DIM   = '#aaaaaa';

function styled(tag, css, html = '') {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (html) e.innerHTML = html;
  return e;
}

// Inject a single @keyframes blink rule the first time
let _blinkInjected = false;
function ensureBlinkKeyframe() {
  if (_blinkInjected) return;
  _blinkInjected = true;
  const s = document.createElement('style');
  s.textContent = '@keyframes hud-blink{0%,49%{opacity:1}50%,100%{opacity:0}}';
  document.head.appendChild(s);
}

export class HUD {
  constructor(container) {
    this._container = container;
    this._nightVision   = false;
    this._messages      = [];
    this._aircraftConfig = null;
    this._stallWarning  = false;
    this._frameCount    = 0;

    // Cache last-rendered values to avoid unnecessary DOM writes
    this._last = {};

    ensureBlinkKeyframe();
    this._build();
  }

  // ── Build DOM (once) ────────────────────────────────────────────────────────
  _build() {
    const c = this._container;

    this._hud = styled('div', `
      position:absolute; inset:0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: ${GREEN};
      pointer-events: none;
      user-select: none;
    `);
    c.appendChild(this._hud);

    // ── Compass strip ──────────────────────────────────────────
    this._compassBar = styled('div', `
      position:absolute; top:0; left:50%; transform:translateX(-50%);
      width:400px; height:30px;
      background:rgba(0,0,0,0.4);
      border-bottom: 1px solid ${GREEN};
      display:flex; align-items:center; justify-content:center;
      letter-spacing:4px; font-size:12px;
    `);
    this._hud.appendChild(this._compassBar);

    this._compassText = document.createElement('span');
    this._compassBar.appendChild(this._compassText);

    const headingTick = styled('div', `
      position:absolute; bottom:0; left:50%; transform:translateX(-50%);
      width:2px; height:6px; background:${GREEN};
    `);
    this._compassBar.appendChild(headingTick);

    // ── Flight data panel (pre-built rows) ─────────────────────
    this._flightData = styled('div', `
      position:absolute; bottom:80px; left:20px;
      background:rgba(0,0,0,0.45);
      border: 1px solid rgba(0,255,136,0.4);
      padding:8px 12px; border-radius:4px;
      line-height:1.8;
    `);
    this._hud.appendChild(this._flightData);

    this._fdName  = this._makeRow(this._flightData, null,
      'color:#aaa;margin-bottom:4px;font-size:11px');

    this._fdIAS   = this._makeLabelRow(this._flightData, 'IAS: ');
    this._fdALT   = this._makeLabelRow(this._flightData, 'ALT: ');
    this._fdHDG   = this._makeLabelRow(this._flightData, 'HDG: ');
    this._fdVS    = this._makeLabelRow(this._flightData, 'VS:  ');
    this._fdG     = this._makeLabelRow(this._flightData, 'G:   ');
    this._fdGear  = this._makeRow(this._flightData);
    this._fdFlaps = this._makeRow(this._flightData);
    this._fdAB    = this._makeRow(this._flightData, '⚡ AFTERBURNER',
      'color:#ff4400;display:none');
    this._fdVTOL  = this._makeRow(this._flightData, '⬆ VTOL MODE',
      'color:#ffaa00;display:none');
    this._fdCAPS  = this._makeRow(this._flightData, '⚠ CAPS ACTIVE',
      'color:#ff2200;display:none');
    this._fdAL    = this._makeRow(this._flightData, '✈ AUTOLAND',
      'color:#00ff88;display:none');

    // ── Weapon panel ───────────────────────────────────────────
    this._weaponPanel = styled('div', `
      position:absolute; bottom:80px; right:20px;
      background:rgba(0,0,0,0.45);
      border: 1px solid rgba(0,255,136,0.4);
      padding:8px 12px; border-radius:4px;
      line-height:1.8; display:none;
    `);
    this._hud.appendChild(this._weaponPanel);

    // ── Center overlay ─────────────────────────────────────────
    this._centerOverlay = styled('div', `
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
    `);
    this._hud.appendChild(this._centerOverlay);

    // SVG for horizon / pitch ladder / bank indicator
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;';
    this._hud.appendChild(this._svg);

    this._horizonLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this._horizonLine.setAttribute('stroke', GREEN);
    this._horizonLine.setAttribute('stroke-width', '1');
    this._horizonLine.setAttribute('opacity', '0.6');
    this._svg.appendChild(this._horizonLine);

    this._bankIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    this._bankIndicator.setAttribute('fill', GREEN);
    this._bankIndicator.setAttribute('opacity', '0.8');
    this._svg.appendChild(this._bankIndicator);

    this._pitchLines = [];
    for (let i = 0; i < 6; i++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', GREEN);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', '0.5');
      this._svg.appendChild(line);
      this._pitchLines.push(line);
    }

    // Crosshair reticle
    this._reticle = styled('div', `
      width:40px; height:40px;
      border: 1px solid rgba(0,255,136,0.7);
      border-radius:50%; position:relative;
    `);
    const reticleDot = styled('div', `
      position:absolute; top:50%; left:50%;
      width:4px; height:4px;
      border-radius:50%; background:${GREEN};
      transform:translate(-50%,-50%);
    `);
    this._reticle.appendChild(reticleDot);
    this._centerOverlay.appendChild(this._reticle);

    // ── Environment panel ──────────────────────────────────────
    this._envPanel = styled('div', `
      position:absolute; top:40px; right:20px;
      background:rgba(0,0,0,0.4);
      border:1px solid rgba(0,255,136,0.3);
      padding:6px 10px; border-radius:4px;
      line-height:1.7; font-size:12px;
    `);
    this._hud.appendChild(this._envPanel);
    this._envTime    = this._makeRow(this._envPanel);
    this._envWeather = this._makeRow(this._envPanel);
    this._envWind    = this._makeRow(this._envPanel);

    // ── Stall warning (CSS blink — no JS toggle) ───────────────
    this._stallWarningEl = styled('div', `
      position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      font-size:28px; font-weight:bold;
      color:${STALL_COLOR};
      display:none;
      text-shadow: 0 0 10px ${STALL_COLOR};
      letter-spacing:4px;
      animation: hud-blink 0.5s step-end infinite;
    `, 'STALL');
    this._hud.appendChild(this._stallWarningEl);

    // ── Gear / flap strip ──────────────────────────────────────
    this._gearFlapEl = styled('div', `
      position:absolute; bottom:20px; left:50%;
      transform:translateX(-50%);
      display:flex; gap:20px;
      background:rgba(0,0,0,0.4);
      padding:4px 12px; border-radius:4px;
      font-size:12px;
    `);
    this._hud.appendChild(this._gearFlapEl);
    this._gfGear   = this._makeRow(this._gearFlapEl);
    const sep = document.createTextNode(' | ');
    this._gearFlapEl.appendChild(sep);
    this._gfFlaps  = this._makeRow(this._gearFlapEl);
    this._gfGround = this._makeRow(this._gearFlapEl, '',
      `color:${WARN_COLOR};display:none`);

    // ── Message overlay ────────────────────────────────────────
    this._messageEl = styled('div', `
      position:absolute; top:100px; left:50%;
      transform:translateX(-50%);
      font-size:16px; color:${WHITE};
      background:rgba(0,0,0,0.5);
      padding:6px 18px; border-radius:4px;
      display:none;
    `);
    this._hud.appendChild(this._messageEl);

    // ── Night vision overlay ───────────────────────────────────
    this._nvgOverlay = styled('div', `
      position:absolute; inset:0;
      background:rgba(0,80,0,0.25);
      pointer-events:none; display:none;
    `);
    c.appendChild(this._nvgOverlay);

    // ── Target reticle ─────────────────────────────────────────
    this._targetReticle = styled('div', `
      position:absolute; width:50px; height:50px;
      border:2px solid #ff4400;
      pointer-events:none; display:none;
      transform:translate(-50%,-50%);
    `);
    this._hud.appendChild(this._targetReticle);
    for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const br = styled('div', `
        position:absolute; width:10px; height:10px;
        border-color:#ff4400; border-style:solid;
        border-width:${dy>0?'0 0 2px 0':'2px 0 0 0'};
        ${dx>0 ? 'right:0' : 'left:0'};
        ${dy>0 ? 'bottom:0' : 'top:0'};
      `);
      this._targetReticle.appendChild(br);
    }

    // ── Instructions ───────────────────────────────────────────
    this._instructions = styled('div', `
      position:absolute; bottom:20px; right:20px;
      background:rgba(0,0,0,0.6);
      border:1px solid rgba(255,255,255,0.2);
      padding:8px 14px; border-radius:4px;
      font-size:11px; color:#888; line-height:1.7;
    `, `
      WASD: Throttle/Rudder<br>
      Arrows: Pitch/Roll<br>
      G: Gear | F/C: Flaps | L: Autoland<br>
      Tab: Cycle weapon | Space: Fire<br>
      T: Lock target | V: View<br>
      1-8: Switch aircraft
    `);
    this._hud.appendChild(this._instructions);
    setTimeout(() => { this._instructions.style.display = 'none'; }, 10000);
  }

  // Creates a row div with optional initial text and optional CSS.
  // Returns the div (which is also the element you write textContent to).
  _makeRow(parent, text = '', css = '') {
    const d = document.createElement('div');
    if (css) d.style.cssText = css;
    if (text) d.textContent = text;
    parent.appendChild(d);
    return d;
  }

  // Creates "LABEL: <b>value</b>" row. Returns the <b> element for value updates.
  _makeLabelRow(parent, label) {
    const row = document.createElement('div');
    row.appendChild(document.createTextNode(label));
    const val = document.createElement('b');
    row.appendChild(val);
    parent.appendChild(row);
    return val;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  setAircraft(config) {
    this._aircraftConfig = config;
    this._weaponPanel.style.display = config && config.hasWeapons ? 'block' : 'none';
  }

  update(physics, weaponSystem, environment, autolandActive, capsActive) {
    this._frameCount++;

    const kts   = (physics.airspeed * 1.944).toFixed(0);
    const mph   = (physics.airspeed * 2.237).toFixed(0);
    const altFt = (physics.altitude * 3.281).toFixed(0);
    const vsFpm = (physics.verticalSpeed * 196.8).toFixed(0);
    const hdg   = physics.heading.toFixed(0).padStart(3, '0');
    const gForce = (physics.gForce || 1).toFixed(1);

    const config    = this._aircraftConfig;
    const stallSpeed = config ? (config.stallSpeed * 1.944) : 40;
    const isStalling = parseFloat(kts) < stallSpeed + 5
      && physics.altitude > (physics.groundHeight + 10);
    this._stallWarning = isStalling;

    // ── Flight data (fine-grained updates) ────────────────────
    this._setText(this._fdName, config ? config.name : '');

    const iasStr = `${kts} kts / ${mph} mph`;
    if (this._setVal(this._fdIAS, iasStr)) {
      // no color change needed
    }

    const altColor = parseFloat(altFt) < 200 ? WARN_COLOR : GREEN;
    if (this._last._altFt !== altFt || this._last._altColor !== altColor) {
      this._last._altFt = altFt;
      this._last._altColor = altColor;
      this._fdALT.textContent = altFt + ' ft';
      this._fdALT.style.color = altColor;
    }

    this._setVal(this._fdHDG, hdg + '°');

    const vsColor = parseFloat(vsFpm) >= 0 ? GREEN : '#ff4400';
    const vsStr   = (parseFloat(vsFpm) > 0 ? '+' : '') + vsFpm + ' fpm';
    if (this._last._vs !== vsStr || this._last._vsColor !== vsColor) {
      this._last._vs = vsStr;
      this._last._vsColor = vsColor;
      this._fdVS.textContent = vsStr;
      this._fdVS.style.color = vsColor;
    }

    this._setVal(this._fdG, gForce + 'g');

    const gearStr   = physics.gearDown ? '▼ GEAR DN' : '▲ GEAR UP';
    const gearColor = physics.gearDown ? WARN_COLOR : GREEN;
    if (this._last._gearStr !== gearStr || this._last._gearColor !== gearColor) {
      this._last._gearStr   = gearStr;
      this._last._gearColor = gearColor;
      this._fdGear.textContent   = gearStr;
      this._fdGear.style.color   = gearColor;
    }

    const flapsStr = 'FLAPS: ' + (['0','10','20','30'][physics.flaps || 0]) + '°';
    this._setText(this._fdFlaps, flapsStr);

    this._showIf(this._fdAB,   physics.afterburner);
    this._showIf(this._fdVTOL, physics.vtolMode);
    this._showIf(this._fdCAPS, !!capsActive);
    this._showIf(this._fdAL,   !!autolandActive);

    // ── Weapon panel ──────────────────────────────────────────
    if (weaponSystem) {
      const sel = weaponSystem.getSelectedWeapon();
      const all = weaponSystem.getAllWeapons();
      let wHtml = `<div style="color:#aaa;font-size:11px;margin-bottom:4px">WEAPONS</div>`;
      if (all.length > 0) {
        all.forEach(w => {
          const active    = sel && w.name === sel.name;
          const ammoColor = w.ammo === 0 ? '#ff2200'
            : (w.ammo < w.maxAmmo * 0.25 ? WARN_COLOR : GREEN);
          wHtml += `<div style="color:${active ? WHITE : DIM}">
            ${active ? '► ' : '  '}${w.name}: <b style="color:${ammoColor}">${w.ammo}</b>/${w.maxAmmo}
          </div>`;
        });
      } else {
        wHtml += '<div style="color:#555">No weapons</div>';
      }
      if (weaponSystem.isRearming()) {
        wHtml += `<div style="color:${WARN_COLOR}">♻ REARMING...</div>`;
      }
      // Weapon panel changes infrequently; only update on change
      if (this._last._wHtml !== wHtml) {
        this._last._wHtml = wHtml;
        this._weaponPanel.innerHTML = wHtml;
      }
    }

    // ── Compass ────────────────────────────────────────────────
    const compassStr = this._getCompassStrip(physics.heading);
    this._setText(this._compassText, compassStr);

    // ── SVG horizon ────────────────────────────────────────────
    this._updateHorizon(physics);

    // ── Stall warning (CSS animation handles blinking) ─────────
    this._showIf(this._stallWarningEl, isStalling);

    // ── Environment panel ─────────────────────────────────────
    if (environment) {
      const wind      = environment.getWind();
      const windSpeed = wind.length().toFixed(0);
      const windDir   = radToDeg(Math.atan2(wind.x, wind.z)).toFixed(0);
      const weather   = environment.getWeather();
      const tod  = environment.getTimeOfDay ? environment.getTimeOfDay() : 0;
      const hour = Math.floor(tod * 24).toString().padStart(2, '0');
      const min  = Math.floor((tod * 24 * 60) % 60).toString().padStart(2, '0');
      this._setText(this._envTime,    `🕐 ${hour}:${min}`);
      this._setText(this._envWeather, `WX: ${weather.toUpperCase()}`);
      this._setText(this._envWind,    `WIND: ${windSpeed}kts ${windDir}°`);
    }

    // ── Gear/flap strip ───────────────────────────────────────
    const gfGearStr   = `GEAR: ${physics.gearDown ? 'DN' : 'UP'}`;
    const gfGearColor = physics.gearDown ? WARN_COLOR : GREEN;
    if (this._last._gfGear !== gfGearStr || this._last._gfGearColor !== gfGearColor) {
      this._last._gfGear      = gfGearStr;
      this._last._gfGearColor = gfGearColor;
      this._gfGear.textContent   = gfGearStr;
      this._gfGear.style.color   = gfGearColor;
    }
    const flaps4 = ['0°','10°','20°','30°'];
    this._setText(this._gfFlaps, 'FLAPS: ' + flaps4[physics.flaps || 0]);
    this._showIf(this._gfGround, physics.onGround);
    if (physics.onGround) {
      const gndTxt = ' | ON GROUND';
      if (this._gfGround.textContent !== gndTxt) this._gfGround.textContent = gndTxt;
    }

    // ── Target reticle ─────────────────────────────────────────
    if (weaponSystem && weaponSystem.getLockedTarget()) {
      this._targetReticle.style.display = 'block';
      const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
      if (this._last._trL !== hw || this._last._trT !== hh - 60) {
        this._last._trL = hw; this._last._trT = hh - 60;
        this._targetReticle.style.left = hw + 'px';
        this._targetReticle.style.top  = (hh - 60) + 'px';
      }
    } else {
      this._targetReticle.style.display = 'none';
    }

    // ── Message fade ───────────────────────────────────────────
    this._updateMessages();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Set textContent only if changed
  _setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  // Set textContent on a <b> value element, keyed by element reference
  _setVal(el, text) {
    if (el.textContent !== text) { el.textContent = text; return true; }
    return false;
  }

  // Show/hide element based on condition, no-op if already in desired state
  _showIf(el, condition) {
    const want = condition ? 'block' : 'none';
    if (el.style.display !== want) el.style.display = want;
  }

  _getCompassStrip(hdg) {
    let str = '';
    for (let d = -4; d <= 4; d++) {
      const deg = ((hdg + d * 10) % 360 + 360) % 360;
      if (d === 0) {
        str += `|${Math.round(deg).toString().padStart(3,'0')}°|`;
      } else {
        str += ` ${Math.round(deg).toString().padStart(3,' ')} `;
      }
    }
    return str;
  }

  _updateHorizon(physics) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;

    const pitchOffset = -physics.rotation.x * 200;
    const rollRad     = physics.rotation.z;

    const len = 200;
    const dx  = Math.cos(rollRad) * len;
    const dy  = -Math.sin(rollRad) * len;
    const ox  = -Math.sin(rollRad) * pitchOffset;
    const oy  = -Math.cos(rollRad) * pitchOffset;

    this._horizonLine.setAttribute('x1', cx - dx + ox);
    this._horizonLine.setAttribute('y1', cy - dy + oy);
    this._horizonLine.setAttribute('x2', cx + dx + ox);
    this._horizonLine.setAttribute('y2', cy + dy + oy);

    const bx = cx, by = cy - 120;
    const ts = 8;
    const tr = -rollRad;
    const pts = [
      [bx + Math.cos(tr) * ts,         by + Math.sin(tr) * ts],
      [bx + Math.cos(tr + 2.2) * ts * 1.5, by + Math.sin(tr + 2.2) * ts * 1.5],
      [bx + Math.cos(tr - 2.2) * ts * 1.5, by + Math.sin(tr - 2.2) * ts * 1.5],
    ];
    this._bankIndicator.setAttribute('points', pts.map(p => p.join(',')).join(' '));

    const pitchIncrements = [-20, -10, 0, 10, 20, 30];
    for (let i = 0; i < this._pitchLines.length; i++) {
      const deg = pitchIncrements[i];
      if (deg === 0) { this._pitchLines[i].style.display = 'none'; continue; }
      this._pitchLines[i].style.display = '';
      const pOff = pitchOffset + deg * (200 / 90);
      const pox = -Math.sin(rollRad) * pOff;
      const poy = -Math.cos(rollRad) * pOff;
      const pLen = 60;
      const pdx = Math.cos(rollRad) * pLen;
      const pdy = -Math.sin(rollRad) * pLen;
      this._pitchLines[i].setAttribute('x1', cx - pdx + pox);
      this._pitchLines[i].setAttribute('y1', cy - pdy + poy);
      this._pitchLines[i].setAttribute('x2', cx + pdx + pox);
      this._pitchLines[i].setAttribute('y2', cy + pdy + poy);
    }
  }

  _updateMessages() {
    const now = Date.now();
    this._messages = this._messages.filter(m => m.expires > now);
    if (this._messages.length > 0) {
      const msg = this._messages[this._messages.length - 1];
      this._messageEl.style.display = 'block';
      if (this._messageEl.textContent !== msg.text) this._messageEl.textContent = msg.text;
    } else {
      this._messageEl.style.display = 'none';
    }
  }

  showMessage(text, duration = 2000) {
    this._messages.push({ text, expires: Date.now() + duration });
    this._messageEl.style.display = 'block';
    this._messageEl.textContent = text;
  }

  toggleNightVision() {
    this._nightVision = !this._nightVision;
    this._nvgOverlay.style.display = this._nightVision ? 'block' : 'none';
    this.showMessage(this._nightVision ? 'NVG ON' : 'NVG OFF', 1500);
  }

  dispose() {
    if (this._hud && this._hud.parentNode) {
      this._hud.parentNode.removeChild(this._hud);
    }
    if (this._nvgOverlay && this._nvgOverlay.parentNode) {
      this._nvgOverlay.parentNode.removeChild(this._nvgOverlay);
    }
  }
}

function radToDeg(r) { return r * (180 / Math.PI); }
