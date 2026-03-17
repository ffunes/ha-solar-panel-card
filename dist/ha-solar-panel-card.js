// ─────────────────────────────────────────────────────────────────────────────
// VISUAL CONFIGURATION EDITOR
// ─────────────────────────────────────────────────────────────────────────────
class SolarPanelCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  set hass(hass) {
    this._hass = hass;
    this._validateEntities();
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  _render() {
    const c = this._config;
    const isString = (c.mode || 'string') === 'string';

    this.shadowRoot.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
        label { font-size: 0.85em; color: var(--secondary-text-color, #888); margin-bottom: 2px; display: block; }
        input, select, textarea {
          width: 100%;
          box-sizing: border-box;
          background: var(--card-background-color, #1c1c1e);
          color: var(--primary-text-color, #fff);
          border: 1px solid var(--divider-color, #333);
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 0.95em;
          font-family: inherit;
        }
        input:focus, select:focus, textarea:focus {
          outline: 2px solid var(--primary-color, #4CAF50);
          border-color: transparent;
        }
        select option { background: var(--card-background-color, #1c1c1e); }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { display: flex; flex-direction: column; }
        textarea { resize: vertical; min-height: 80px; }
        .hint {
          font-size: 0.78em;
          color: var(--secondary-text-color, #888);
          margin-top: 4px;
        }
        .hidden { display: none; }
        .error-msg {
          font-size: 0.78em;
          color: #ef4444;
          margin-top: 2px;
        }
        input.invalid, textarea.invalid {
          border-color: #ef4444;
        }
        .section-title {
          font-size: 0.8em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary-color, #4CAF50);
          margin-top: 4px;
        }
      </style>

      <div class="form">
        <div class="section-title">General</div>

        <div class="field">
          <label>Card name (optional)</label>
          <input name="name" type="text" placeholder="My solar installation"
            value="${c.name || ''}">
        </div>

        <div class="row">
          <div class="field">
            <label>Rows</label>
            <input name="rows" type="number" min="1" placeholder="3"
              value="${c.rows || ''}">
          </div>
          <div class="field">
            <label>Columns</label>
            <input name="columns" type="number" min="1" placeholder="5"
              value="${c.columns || ''}">
          </div>
        </div>

        <div class="field">
          <label>Max power per panel (W)</label>
          <input name="panel_max_power" type="number" min="1" placeholder="400"
            value="${c.panel_max_power || ''}">
          <span class="hint">Defines the 100% fill level.</span>
        </div>

        <div class="section-title">Installation mode</div>

        <div class="field">
          <label>Mode</label>
          <select name="mode">
            <option value="string"    ${isString ? 'selected' : ''}>String — Central inverter</option>
            <option value="microinverter" ${!isString ? 'selected' : ''}>Microinverter — One sensor per panel</option>
          </select>
        </div>

        <!-- String mode -->
        <div class="field ${isString ? '' : 'hidden'}" id="field-entity">
          <label>Total production entity</label>
          <input name="entity" type="text" placeholder="sensor.total_solar_power"
            value="${c.entity || ''}">
          <span class="hint">Automatically detects W or kW.</span>
        </div>

        <!-- Microinverter mode -->
        <div class="field ${!isString ? '' : 'hidden'}" id="field-entities">
          <label>Per-panel entities</label>
          <textarea name="entities" placeholder="sensor.panel_1&#10;sensor.panel_2&#10;..."
          >${Array.isArray(c.entities) ? c.entities.join('\n') : (c.entities || '')}</textarea>
          <span class="hint">One entity per line, ordered left→right, top→bottom.<br>
            Required total: ${(c.rows || 0) * (c.columns || 0) || '(rows × columns)'} entities.</span>
        </div>
      </div>
    `;

    // Bind change events on all inputs/selects/textareas
    this.shadowRoot.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('change', (e) => this._valueChanged(e));
    });

    // Toggle field visibility based on mode selection
    this.shadowRoot.querySelector('select[name="mode"]').addEventListener('change', (e) => {
      const isStr = e.target.value === 'string';
      this.shadowRoot.getElementById('field-entity').classList.toggle('hidden', !isStr);
      this.shadowRoot.getElementById('field-entities').classList.toggle('hidden', isStr);
    });
  }

  _valueChanged(ev) {
    const el = ev.target;
    let value = el.value.trim();

    // Type conversions
    if (el.name === 'rows' || el.name === 'columns' || el.name === 'panel_max_power') {
      value = value === '' ? undefined : parseInt(value, 10);
    }
    if (el.name === 'entities') {
      value = value.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (el.name === 'name' && value === '') {
      value = undefined;
    }

    const newConfig = { ...this._config };
    if (value === undefined) {
      delete newConfig[el.name];
    } else {
      newConfig[el.name] = value;
    }

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
    this._validateEntities();
  }

  _validateEntities() {
    if (!this._hass || !this.shadowRoot) return;
    const states = this._hass.states;

    // Validate single entity (string mode)
    const entityInput = this.shadowRoot.querySelector('input[name="entity"]');
    if (entityInput) {
      const prev = entityInput.parentElement.querySelector('.error-msg');
      if (prev) prev.remove();
      const val = entityInput.value.trim();
      if (val && !states[val]) {
        entityInput.classList.add('invalid');
        const msg = document.createElement('span');
        msg.className = 'error-msg';
        msg.textContent = `Entity "${val}" not found in Home Assistant.`;
        entityInput.parentElement.appendChild(msg);
      } else {
        entityInput.classList.remove('invalid');
      }
    }

    // Validate entity list (microinverter mode)
    const entitiesTA = this.shadowRoot.querySelector('textarea[name="entities"]');
    if (entitiesTA) {
      const prev = entitiesTA.parentElement.querySelector('.error-msg');
      if (prev) prev.remove();
      const lines = entitiesTA.value.split('\n').map(s => s.trim()).filter(Boolean);
      const missing = lines.filter(e => !states[e]);
      if (missing.length > 0) {
        entitiesTA.classList.add('invalid');
        const msg = document.createElement('span');
        msg.className = 'error-msg';
        msg.textContent = `Not found: ${missing.join(', ')}`;
        entitiesTA.parentElement.appendChild(msg);
      } else {
        entitiesTA.classList.remove('invalid');
      }
    }
  }
}

customElements.define('ha-solar-panel-card-editor', SolarPanelCardEditor);


// ─────────────────────────────────────────────────────────────────────────────
// MAIN CARD
// ─────────────────────────────────────────────────────────────────────────────
class SolarPanelCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
  }

  // ── Visual editor ─────────────────────────────────────────────────────────
  static getConfigElement() {
    return document.createElement('ha-solar-panel-card-editor');
  }

  static getStubConfig() {
    return {
      rows: 3,
      columns: 5,
      panel_max_power: 400,
      mode: 'string',
      entity: 'sensor.total_solar_power',
    };
  }

  // ── Configuration ─────────────────────────────────────────────────────────
  setConfig(config) {
    if (!config.rows || !Number.isInteger(config.rows) || config.rows < 1) {
      throw new Error('[Solar Panel Card] "rows" must be a positive integer.');
    }
    if (!config.columns || !Number.isInteger(config.columns) || config.columns < 1) {
      throw new Error('[Solar Panel Card] "columns" must be a positive integer.');
    }
    if (!config.panel_max_power || config.panel_max_power <= 0) {
      throw new Error('[Solar Panel Card] "panel_max_power" must be a positive number (in Watts).');
    }
    if (!config.mode || !['string', 'microinverter'].includes(config.mode)) {
      throw new Error('[Solar Panel Card] "mode" must be "string" or "microinverter".');
    }
    if (config.mode === 'string' && !config.entity) {
      throw new Error('[Solar Panel Card] "entity" is required in "string" mode.');
    }
    if (config.mode === 'microinverter') {
      if (!config.entities || !Array.isArray(config.entities)) {
        throw new Error('[Solar Panel Card] "entities" (array) is required in "microinverter" mode.');
      }
      const expected = config.rows * config.columns;
      if (config.entities.length !== expected) {
        throw new Error(
          `[Solar Panel Card] Expected ${expected} entities ` +
          `(${config.rows} rows × ${config.columns} columns), ` +
          `but received ${config.entities.length}.`
        );
      }
    }

    this._config = config;
    this._initialized = false;
  }

  // ── Reactivity lifecycle ──────────────────────────────────────────────────
  set hass(hass) {
    this._hass = hass;

    if (!this._initialized) {
      this._buildDOM();
      this._initialized = true;
    }

    this._updatePanels();
  }

  // ── Initial DOM construction ──────────────────────────────────────────────
  _buildDOM() {
    const { rows, columns, name } = this._config;
    const totalPanels = rows * columns;

    // Resolve the entity associated with each panel (for click → more-info)
    const panelsHTML = Array.from({ length: totalPanels }, (_, i) => {
      const eid = this._config.mode === 'microinverter'
        ? this._config.entities[i]
        : (this._config.entity || '');
      return `
        <div class="panel" data-index="${i}" data-entity="${eid}">
          <div class="fill-bar"></div>
          <span class="panel-label">--</span>
        </div>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card { padding: 16px; }

        .card-header {
          font-size: 1.1em;
          font-weight: 600;
          color: var(--primary-text-color, #fff);
          margin-bottom: 12px;
        }

        /* Grid: dark background visible in gaps simulates the mounting rack */
        .grid {
          display: grid;
          grid-template-columns: repeat(${columns}, 1fr);
          gap: 5px;
          background: #1a1a1a;
          padding: 5px;
          border-radius: 6px;
        }

        /* Panel: dark glass + aluminum frame */
        .panel {
          position: relative;
          overflow: hidden;
          aspect-ratio: 1 / 1.7;
          background: #111827;
          border-radius: 3px;
          border: 2px solid #5a6070;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 2px 6px rgba(0,0,0,0.6);
          cursor: pointer;
        }
        .panel:active {
          filter: brightness(1.15);
        }

        /* Diagonal shine: simulates anti-reflective coating */
        .panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(100, 149, 237, 0.10) 0%,
            transparent 55%
          );
          z-index: 2;
          pointer-events: none;
        }

        /* Cell grid: 6×10 nearly-square cells (aspect 1:1.7) */
        .panel::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(to right,  rgba(255,255,255,0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px);
          background-size: calc(100% / 6) calc(100% / 10);
          z-index: 3;
          pointer-events: none;
        }

        /* Green fill bar (produced energy) */
        .fill-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 0%;
          background: linear-gradient(to top, #14532d, #16a34a, #4ade80);
          transition: height 0.4s ease-out;
          z-index: 1;
        }

        /* Power label */
        .panel-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-size: 0.68em;
          font-weight: 700;
          text-shadow: 0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8);
          white-space: nowrap;
          pointer-events: none;
          z-index: 4;
        }
      </style>

      <ha-card>
        ${name ? `<div class="card-header">${name}</div>` : ''}
        <div class="grid">${panelsHTML}</div>
      </ha-card>
    `;

    // Click on panel → open more-info dialog for the entity
    this.shadowRoot.querySelectorAll('.panel').forEach(panel => {
      panel.addEventListener('click', () => {
        const entityId = panel.dataset.entity;
        if (!entityId) return;
        const event = new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId },
        });
        this.dispatchEvent(event);
      });
    });
  }

  // ── Real-time update ──────────────────────────────────────────────────────
  _updatePanels() {
    const { mode, entity, entities, rows, columns, panel_max_power } = this._config;
    const hass = this._hass;
    const totalPanels = rows * columns;

    const panels = this.shadowRoot.querySelectorAll('.panel');
    if (!panels.length) return;

    let powers;

    if (mode === 'string') {
      const state = hass.states[entity];
      let totalPower = state ? parseFloat(state.state) : 0;
      if (isNaN(totalPower)) totalPower = 0;
      // Auto-detect kW via unit_of_measurement
      const unit = state?.attributes?.unit_of_measurement || '';
      if (unit.toLowerCase() === 'kw') totalPower *= 1000;
      const perPanel = totalPower / totalPanels;
      powers = Array(totalPanels).fill(perPanel);
    } else {
      powers = entities.map((eid) => {
        const state = hass.states[eid];
        let val = state ? parseFloat(state.state) : 0;
        if (isNaN(val)) val = 0;
        const unit = state?.attributes?.unit_of_measurement || '';
        if (unit.toLowerCase() === 'kw') val *= 1000;
        return val;
      });
    }

    panels.forEach((panel, i) => {
      const raw = powers[i] || 0;
      const clamped = Math.max(0, Math.min(raw, panel_max_power));
      const pct = (clamped / panel_max_power) * 100;

      panel.querySelector('.fill-bar').style.height = `${pct.toFixed(1)}%`;

      // Smart formatting: kW if ≥1000, one decimal if <10, integer otherwise
      let label;
      if (raw >= 1000) {
        label = `${(raw / 1000).toFixed(2)} kW`;
      } else if (raw > 0 && raw < 10) {
        label = `${raw.toFixed(1)} W`;
      } else {
        label = `${Math.round(raw)} W`;
      }
      panel.querySelector('.panel-label').textContent = label;
    });
  }

  getCardSize() {
    if (!this._config) return 3;
    return Math.ceil(this._config.rows * 1.5) + 1;
  }
}

customElements.define('ha-solar-panel-card', SolarPanelCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-solar-panel-card',
  name: 'Solar Panel Card',
  description: 'Displays a real-time solar panel array with per-panel power visualization.',
  preview: false,
});
