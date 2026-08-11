/*
 * Area Domain Strategies
 * ----------------------
 * Two Home Assistant dashboard strategies built on the same area + domain +
 * label + device class matching as area-domain-chips:
 *
 *   custom:area-domain-section   a native grid section for one device type
 *                                across one or more areas, groups first
 *
 *   custom:area-domain-tabs      a page with a chip per device type at the top;
 *                                clicking a chip switches tabs through the URL
 *                                hash and each area shows only that device type
 *
 * https://github.com/Gessink/area-domain-strategies
 */

const VERSION = "1.0.0";

/* ================================================================== *
 * Shared core
 *
 * Kept in step with area-domain-chips. HACS plugins cannot depend on one
 * another at runtime, so the matching, group and translation rules live here
 * as a copy rather than an import.
 * ================================================================== */

const UNAVAILABLE = ["unavailable", "unknown"];

const DOMAIN_ACTIVE_STATES = {
  alarm_control_panel: ["triggered", "armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass", "arming", "pending"],
  automation: ["on"],
  binary_sensor: ["on"],
  camera: ["recording", "streaming"],
  climate: ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"],
  cover: ["open", "opening"],
  device_tracker: ["home"],
  fan: ["on"],
  group: ["on", "home", "open", "unlocked", "playing"],
  humidifier: ["on"],
  input_boolean: ["on"],
  lawn_mower: ["mowing", "returning", "error"],
  light: ["on"],
  lock: ["unlocked", "open", "opening", "unlocking"],
  media_player: ["playing", "buffering", "on"],
  person: ["home"],
  remote: ["on"],
  script: ["on"],
  siren: ["on"],
  sun: ["above_horizon"],
  switch: ["on"],
  timer: ["active", "paused"],
  update: ["on"],
  vacuum: ["cleaning", "returning", "error"],
  valve: ["open", "opening"],
  water_heater: ["eco", "electric", "performance", "high_demand", "heat_pump", "gas", "on"],
};

const OFF_LIKE = [
  "off", "closed", "locked", "docked", "idle", "standby", "disarmed",
  "not_home", "below_horizon", "unavailable", "unknown", "",
];

// Domains that report what they are really doing separately from their mode.
const ACTIVITY_ATTRIBUTES = {
  climate: { attribute: "hvac_action", idle: ["off", "idle"] },
  humidifier: { attribute: "action", idle: ["off", "idle"] },
};

function isActive(stateObj, chip) {
  const state = stateObj.state;
  if (UNAVAILABLE.includes(state)) return false;

  if (Array.isArray(chip.inactive_states) && chip.inactive_states.length) {
    return !chip.inactive_states.includes(state);
  }
  if (Array.isArray(chip.active_states) && chip.active_states.length) {
    return chip.active_states.includes(state);
  }

  const domain = stateObj.entity_id.split(".")[0];

  const activity = ACTIVITY_ATTRIBUTES[domain];
  if (activity && chip.use_action !== false) {
    const action = stateObj.attributes ? stateObj.attributes[activity.attribute] : undefined;
    if (action !== undefined && action !== null) return !activity.idle.includes(action);
  }

  const known = DOMAIN_ACTIVE_STATES[domain];
  if (known) return known.includes(state);

  return !OFF_LIKE.includes(state);
}

function isUnavailable(stateObj) {
  return UNAVAILABLE.includes(stateObj.state);
}

function groupMembers(stateObj) {
  const attrs = stateObj.attributes || {};
  return Array.isArray(attrs.entity_id) ? attrs.entity_id : null;
}

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value.slice() : [value];
}

function entityAreaId(hass, entityId) {
  const ent = hass.entities ? hass.entities[entityId] : undefined;
  if (!ent) return undefined;
  if (ent.area_id) return ent.area_id;
  if (ent.device_id && hass.devices) {
    const dev = hass.devices[ent.device_id];
    if (dev) return dev.area_id;
  }
  return undefined;
}

function entityLabelSet(hass, entityId) {
  const out = new Set();
  const ent = hass.entities ? hass.entities[entityId] : undefined;
  if (!ent) return out;
  (ent.labels || []).forEach((l) => out.add(l));

  let areaId = ent.area_id;
  if (ent.device_id && hass.devices) {
    const dev = hass.devices[ent.device_id];
    if (dev) {
      (dev.labels || []).forEach((l) => out.add(l));
      if (!areaId) areaId = dev.area_id;
    }
  }
  if (areaId && hass.areas) {
    const area = hass.areas[areaId];
    if (area) (area.labels || []).forEach((l) => out.add(l));
  }
  return out;
}

/* -------------------- localisation -------------------- */

function tr(hass, key) {
  if (!hass || !hass.localize || !key) return "";
  try {
    return hass.localize(key) || "";
  } catch (err) {
    return "";
  }
}

function domainName(hass, domain) {
  return (
    tr(hass, `component.${domain}.entity_component._.name`) ||
    tr(hass, `component.${domain}.title`) ||
    domain
  );
}

function deviceClassName(hass, domain, deviceClass) {
  return (
    tr(hass, `component.${domain}.entity_component.${deviceClass}.name`) ||
    tr(hass, `component.sensor.entity_component.${deviceClass}.name`) ||
    deviceClass
  );
}

function stateName(hass, domain, deviceClass, state) {
  if (deviceClass) {
    const withClass = tr(hass, `component.${domain}.entity_component.${deviceClass}.state.${state}`);
    if (withClass) return withClass;
  }
  return (
    tr(hass, `component.${domain}.entity_component._.state.${state}`) ||
    tr(hass, `state.default.${state}`) ||
    state
  );
}

function lowerFirst(hass, text) {
  if (!text) return text;
  const lang = hass && hass.language ? hass.language : undefined;
  return text.charAt(0).toLocaleLowerCase(lang) + text.slice(1);
}

const PLURALS_NL = {
  alarmpaneel: "alarmpanelen", apparaat: "apparaten", automatisering: "automatiseringen",
  batterij: "batterijen", beweging: "bewegingen", "binaire sensor": "binaire sensoren",
  bevochtiger: "bevochtigers", boiler: "boilers", camera: "camera's", deur: "deuren",
  garagedeur: "garagedeuren", gordijn: "gordijnen", grasmaaier: "grasmaaiers",
  klep: "kleppen", knop: "knoppen", lamp: "lampen", licht: "lichten",
  luchtontvochtiger: "luchtontvochtigers", mediaspeler: "mediaspelers", persoon: "personen",
  raam: "ramen", rolluik: "rolluiken", schakelaar: "schakelaars", scherm: "schermen",
  script: "scripts", sensor: "sensoren", sirene: "sirenes", slot: "sloten",
  stofzuiger: "stofzuigers", stopcontact: "stopcontacten", thermostaat: "thermostaten",
  update: "updates", ventilator: "ventilatoren", zonwering: "zonweringen",
};

function pluralEn(word) {
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function matchCase(source, target) {
  if (!source || !target) return target;
  const first = source.charAt(0);
  if (first !== first.toLowerCase()) return target.charAt(0).toUpperCase() + target.slice(1);
  return target;
}

function pluralize(hass, word) {
  if (!word) return word;
  const lang = (hass && hass.language) || "en";
  const key = word.toLocaleLowerCase(lang);
  if (lang.startsWith("nl")) {
    const known = PLURALS_NL[key];
    return known ? matchCase(word, known) : word;
  }
  if (lang.startsWith("en")) return matchCase(word, pluralEn(key));
  return word;
}

/* -------------------- matching -------------------- */

function chipDomain(chip) {
  const domains = asArray(chip.domains).concat(asArray(chip.domain));
  return domains.length ? domains[0] : undefined;
}

function chipDeviceClass(chip) {
  const dc = asArray(chip.device_classes).concat(asArray(chip.device_class));
  return dc.length ? dc[0] : undefined;
}

function chipName(hass, chip, plural) {
  if (chip.name) return chip.name;
  const domain = chipDomain(chip);
  const deviceClass = chipDeviceClass(chip);
  let name;
  if (deviceClass) name = deviceClassName(hass, domain || "sensor", deviceClass);
  else if (domain) name = domainName(hass, domain);
  else return tr(hass, "ui.panel.config.entities.caption") || "Entities";
  return plural === false ? name : pluralize(hass, name);
}

function chipStateWord(hass, chip) {
  if (chip.state_text !== undefined) return chip.state_text;
  const domain = chipDomain(chip);
  if (!domain) return "";
  const deviceClass = chipDeviceClass(chip);
  const states = Array.isArray(chip.active_states) && chip.active_states.length
    ? chip.active_states
    : DOMAIN_ACTIVE_STATES[domain] || ["on"];
  return lowerFirst(hass, stateName(hass, domain, deviceClass, states[0]));
}

// Stable id used in the URL hash and to key the tabs.
function chipSlug(chip, index) {
  if (chip.key) return String(chip.key);
  const parts = [chipDomain(chip), chipDeviceClass(chip)].filter(Boolean);
  if (!parts.length) parts.push(`tab${index + 1}`);
  return parts.join("-").replace(/[^a-z0-9_-]/gi, "");
}

function matches(hass, cfg, chip, entityId, stateObj, ignoreArea) {
  const domains = asArray(chip.domains).concat(asArray(chip.domain));
  if (domains.length && !domains.includes(entityId.split(".")[0])) return false;

  const deviceClasses = asArray(chip.device_classes).concat(asArray(chip.device_class));
  if (deviceClasses.length) {
    const dc = stateObj.attributes ? stateObj.attributes.device_class : undefined;
    if (!dc || !deviceClasses.includes(dc)) return false;
  }

  if (!ignoreArea) {
    const areas = asArray(chip.areas).length ? asArray(chip.areas) : asArray(cfg.areas);
    const areaId = entityAreaId(hass, entityId);
    if (areas.length && (!areaId || !areas.includes(areaId))) return false;
    const excluded = asArray(cfg.exclude_areas);
    if (excluded.length && areaId && excluded.includes(areaId)) return false;
  }

  const labels = asArray(chip.labels).concat(asArray(chip.label));
  if (labels.length) {
    const owned = entityLabelSet(hass, entityId);
    const ok = (chip.label_match || "any") === "all"
      ? labels.every((l) => owned.has(l))
      : labels.some((l) => owned.has(l));
    if (!ok) return false;
  }

  const excludeWords = asArray(cfg.exclude_keywords).concat(asArray(chip.exclude_keywords));
  const includeWords = asArray(chip.include_keywords).length
    ? asArray(chip.include_keywords)
    : asArray(cfg.include_keywords);
  if (excludeWords.length || includeWords.length) {
    const name = (stateObj.attributes && stateObj.attributes.friendly_name) || "";
    const haystack = `${entityId} ${name}`.toLowerCase();
    const hit = (w) => haystack.includes(String(w).toLowerCase());
    if (excludeWords.some(hit)) return false;
    if (includeWords.length && !includeWords.some(hit)) return false;
  }

  const only = asArray(chip.entities);
  if (only.length && !only.includes(entityId)) return false;

  return true;
}

function memberCounted(hass, cfg, chip, memberId, present) {
  if (present.has(memberId)) return true;
  const stateObj = hass.states[memberId];
  if (!stateObj) return false;
  if (entityAreaId(hass, memberId)) return false;
  return matches(hass, cfg, chip, memberId, stateObj, true);
}

function memberNotBlocking(hass, cfg, chip, memberId, present) {
  if (!hass.states[memberId]) return true;
  return memberCounted(hass, cfg, chip, memberId, present);
}

// Every entity in scope for one chip, group rules applied.
function candidates(hass, cfg, chip) {
  const exclude = new Set(asArray(cfg.exclude_entities));
  const ids = [];

  Object.keys(hass.states).forEach((entityId) => {
    if (exclude.has(entityId)) return;
    const reg = hass.entities ? hass.entities[entityId] : undefined;
    if (reg) {
      if (!cfg.include_hidden && reg.hidden) return;
      if (!cfg.include_diagnostic && reg.entity_category) return;
    }
    if (matches(hass, cfg, chip, entityId, hass.states[entityId])) ids.push(entityId);
  });

  const groups = cfg.groups || "auto";
  if (groups === "include") return ids;

  const present = new Set(ids);
  return ids.filter((id) => {
    const members = groupMembers(hass.states[id]);
    if (!members || !members.length) return true;
    if (groups === "exclude") return false;
    if (groups === "strict") {
      return !members.every((m) => memberNotBlocking(hass, cfg, chip, m, present));
    }
    return !members.some((m) => memberCounted(hass, cfg, chip, m, present));
  });
}

function filterByMode(hass, chip, ids, mode) {
  if (!mode || mode === "all") return ids;
  return ids.filter((id) => {
    const stateObj = hass.states[id];
    if (!stateObj) return false;
    if (mode === "unavailable") return isUnavailable(stateObj);
    if (mode === "inactive") return !isUnavailable(stateObj) && !isActive(stateObj, chip);
    return isActive(stateObj, chip);
  });
}

function friendlyName(hass, entityId) {
  const stateObj = hass.states[entityId];
  return (stateObj && stateObj.attributes && stateObj.attributes.friendly_name) || entityId;
}

// Groups first, then alphabetically. Keeps "All living room lights" above the
// individual bulbs it controls.
function sortEntities(hass, ids, groupsFirst) {
  return ids.slice().sort((a, b) => {
    if (groupsFirst !== false) {
      const ga = groupMembers(hass.states[a]) ? 0 : 1;
      const gb = groupMembers(hass.states[b]) ? 0 : 1;
      if (ga !== gb) return ga - gb;
    }
    return friendlyName(hass, a).localeCompare(friendlyName(hass, b));
  });
}

/* ================================================================== *
 * Tile card features
 * ================================================================== */

const COVER_OPEN = 1;
const COVER_CLOSE = 2;
const COVER_SET_POSITION = 4;
const FAN_SET_SPEED = 1;
const MEDIA_VOLUME_SET = 4;

const BRIGHTNESS_MODES = ["brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww", "white"];

// Relevant controls per domain, derived from what the entity actually supports.
function featuresFor(stateObj) {
  const domain = stateObj.entity_id.split(".")[0];
  const attrs = stateObj.attributes || {};
  const supported = attrs.supported_features || 0;
  const out = [];

  switch (domain) {
    case "light": {
      const modes = attrs.supported_color_modes || [];
      if (modes.some((m) => BRIGHTNESS_MODES.includes(m))) out.push({ type: "light-brightness" });
      if (modes.includes("color_temp")) out.push({ type: "light-color-temp" });
      break;
    }
    case "cover":
      if (supported & (COVER_OPEN | COVER_CLOSE)) out.push({ type: "cover-open-close" });
      if (supported & COVER_SET_POSITION) out.push({ type: "cover-position" });
      break;
    case "valve":
      if (supported & (COVER_OPEN | COVER_CLOSE)) out.push({ type: "valve-open-close" });
      break;
    case "fan":
      if (supported & FAN_SET_SPEED) out.push({ type: "fan-speed" });
      break;
    case "climate":
      out.push({ type: "target-temperature" });
      if (Array.isArray(attrs.hvac_modes) && attrs.hvac_modes.length) {
        out.push({ type: "climate-hvac-modes", hvac_modes: attrs.hvac_modes });
      }
      break;
    case "water_heater":
      out.push({ type: "target-temperature" });
      break;
    case "humidifier":
      out.push({ type: "humidifier-toggle" });
      out.push({ type: "target-humidity" });
      break;
    case "media_player":
      if (supported & MEDIA_VOLUME_SET) out.push({ type: "media-player-volume-slider" });
      break;
    case "lock":
      out.push({ type: "lock-commands" });
      break;
    case "vacuum":
      out.push({ type: "vacuum-commands", commands: ["start_pause", "stop", "return_home"] });
      break;
    case "lawn_mower":
      out.push({ type: "lawn-mower-commands", commands: ["start_pause", "dock"] });
      break;
    case "update":
      out.push({ type: "update-actions" });
      break;
    default:
      break;
  }
  return out;
}

function tileCard(hass, entityId, withFeatures) {
  const card = { type: "tile", entity: entityId };
  if (withFeatures === false) return card;
  const stateObj = hass.states[entityId];
  if (!stateObj) return card;
  const features = featuresFor(stateObj);
  if (features.length) card.features = features;
  return card;
}

/* ================================================================== *
 * Areas
 * ================================================================== */

function resolveAreas(hass, cfg) {
  const wanted = asArray(cfg.areas);
  const excluded = new Set(asArray(cfg.exclude_areas));
  const all = hass.areas || {};

  if (wanted.length) return wanted.filter((id) => all[id] && !excluded.has(id));

  return Object.keys(all)
    .filter((id) => !excluded.has(id))
    .sort((a, b) => (all[a].name || a).localeCompare(all[b].name || b));
}

function areaName(hass, areaId) {
  const area = hass.areas ? hass.areas[areaId] : undefined;
  return (area && area.name) || areaId;
}

function areaIcon(hass, areaId) {
  const area = hass.areas ? hass.areas[areaId] : undefined;
  return area && area.icon ? area.icon : undefined;
}

const DOMAIN_ICONS = {
  binary_sensor: "mdi:radiobox-blank",
  climate: "mdi:thermostat",
  cover: "mdi:window-shutter",
  fan: "mdi:fan",
  humidifier: "mdi:air-humidifier",
  light: "mdi:lightbulb",
  lock: "mdi:lock",
  media_player: "mdi:cast",
  switch: "mdi:toggle-switch-variant",
  vacuum: "mdi:robot-vacuum",
  valve: "mdi:pipe-valve",
  water_heater: "mdi:water-boiler",
};

const DEVICE_CLASS_ICONS = {
  door: "mdi:door-open",
  garage_door: "mdi:garage-open",
  window: "mdi:window-open-variant",
  motion: "mdi:motion-sensor",
  moisture: "mdi:water-alert",
  smoke: "mdi:smoke-detector-variant-alert",
  shade: "mdi:roller-shade",
  blind: "mdi:blinds-horizontal",
  curtain: "mdi:curtains",
};

function chipIcon(chip) {
  if (chip.icon) return chip.icon;
  const dc = chipDeviceClass(chip);
  if (dc && DEVICE_CLASS_ICONS[dc]) return DEVICE_CLASS_ICONS[dc];
  return DOMAIN_ICONS[chipDomain(chip)] || "mdi:shape-outline";
}

// Domains worth showing when no chips are configured, in a sensible order.
const AUTO_DOMAINS = [
  "light", "switch", "cover", "climate", "fan", "media_player", "lock",
  "vacuum", "humidifier", "water_heater", "valve", "lawn_mower", "camera",
];

function autoChips(hass, cfg) {
  const areas = new Set(resolveAreas(hass, cfg));
  const found = new Set();

  Object.keys(hass.states).forEach((entityId) => {
    const reg = hass.entities ? hass.entities[entityId] : undefined;
    if (reg) {
      if (!cfg.include_hidden && reg.hidden) return;
      if (!cfg.include_diagnostic && reg.entity_category) return;
    }
    const areaId = entityAreaId(hass, entityId);
    if (!areaId || !areas.has(areaId)) return;
    found.add(entityId.split(".")[0]);
  });

  return AUTO_DOMAINS.filter((d) => found.has(d)).map((d) => ({ domain: d }));
}

/* ================================================================== *
 * Section strategy: custom:area-domain-section
 * ================================================================== */

function buildSection(config, hass) {
  const cfg = Object.assign({ groups: "auto", groups_first: true, mode: "all", features: true }, config || {});
  const chip = cfg.chip || cfg;
  const areas = resolveAreas(hass, cfg);

  const ids = sortEntities(
    hass,
    filterByMode(hass, chip, candidates(hass, Object.assign({}, cfg, { areas }), chip), cfg.mode),
    cfg.groups_first
  );

  const cards = [];

  if (cfg.title !== false) {
    let title = cfg.title;
    if (!title) {
      title = chipName(hass, chip);
      if (areas.length === 1) title = `${title} · ${areaName(hass, areas[0])}`;
    }
    cards.push({
      type: "heading",
      heading: title,
      heading_style: cfg.heading_style || "title",
      icon: cfg.icon || chipIcon(chip),
    });
  }

  ids.forEach((id) => cards.push(tileCard(hass, id, cfg.features)));

  const section = { type: "grid", cards };
  if (cfg.column_span) section.column_span = cfg.column_span;
  if (!ids.length && cfg.hide_when_empty !== false) section.cards = [];
  return section;
}

class AreaDomainSectionStrategy {
  static async generate(config, hass) {
    return buildSection(config, hass);
  }

  // Older Home Assistant releases call this instead.
  static async generateSection(info) {
    return buildSection(info.config, info.hass);
  }
}

customElements.define("ll-strategy-section-area-domain-section", AreaDomainSectionStrategy);

/* ================================================================== *
 * View strategy: custom:area-domain-tabs
 * ================================================================== */

function buildView(config, hass) {
  const cfg = Object.assign({}, config || {});
  delete cfg.type;

  return {
    type: "panel",
    cards: [Object.assign({ type: "custom:area-domain-tabs-card" }, cfg)],
  };
}

class AreaDomainTabsStrategy {
  static async generate(config, hass) {
    return buildView(config, hass);
  }

  static async generateView(info) {
    return buildView(info.config, info.hass);
  }
}

customElements.define("ll-strategy-view-area-domain-tabs", AreaDomainTabsStrategy);

/* ================================================================== *
 * The page card
 *
 * Renders the tab chips and, per area, a heading plus real Home Assistant tile
 * cards. The active tab lives in the URL hash so it survives a reload and
 * works with the browser's back button.
 * ================================================================== */

class AreaDomainTabsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._helpers = null;
    this._chips = null;
    this._active = null;
    this._cards = [];
    this._chipEls = [];
    this._built = false;
    this._onHashChange = () => this._applyHash();
  }

  static getStubConfig() {
    return { type: "custom:area-domain-tabs-card" };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = Object.assign(
      {
        areas: [],
        exclude_areas: [],
        exclude_entities: [],
        exclude_keywords: [],
        include_keywords: [],
        groups: "auto",
        groups_first: true,
        include_hidden: false,
        include_diagnostic: false,
        features: true,
        hide_empty_areas: true,
        show_counts: true,
        columns: 2,
      },
      config
    );
    this._chips = null;
    this._active = null;
    this._built = false;
    if (this.isConnected) this._render();
  }

  getCardSize() {
    return 12;
  }

  connectedCallback() {
    window.addEventListener("hashchange", this._onHashChange);
    if (this._config && !this._built) this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this._onHashChange);
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (first || !this._built) {
      this._render();
      return;
    }
    this._cards.forEach((card) => {
      card.hass = hass;
    });
    this._updateChipCounts();
  }

  get hass() {
    return this._hass;
  }

  _resolveChips() {
    if (this._chips) return this._chips;
    const cfg = this._config;
    const list = Array.isArray(cfg.chips) && cfg.chips.length ? cfg.chips : autoChips(this._hass, cfg);
    this._chips = list.map((chip, i) => Object.assign({}, chip, { _slug: chipSlug(chip, i) }));
    return this._chips;
  }

  _hashSlug() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    return raw ? decodeURIComponent(raw) : "";
  }

  _applyHash() {
    const chips = this._resolveChips();
    if (!chips.length) return;
    const wanted = this._hashSlug();
    const found = chips.find((c) => c._slug === wanted);
    const next = found ? found._slug : chips[0]._slug;
    if (next === this._active) return;
    this._active = next;
    this._renderBody();
    this._updateChipCounts();
  }

  _selectTab(slug) {
    if (window.location.hash.replace(/^#/, "") === slug) {
      // Same tab: nothing to do, but keep the hash canonical.
      return;
    }
    // Pushing through the hash keeps the browser's back button working.
    window.location.hash = slug;
  }

  async _render() {
    if (!this._hass || !this._config) return;

    if (!this._helpers && window.loadCardHelpers) {
      this._helpers = await window.loadCardHelpers();
    }

    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "page";

    const tabs = document.createElement("div");
    tabs.className = "tabs";
    wrap.appendChild(tabs);
    this._tabs = tabs;

    const body = document.createElement("div");
    body.className = "sections";
    wrap.appendChild(body);
    this._body = body;

    root.appendChild(wrap);

    this._built = true;
    this._renderTabs();
    this._active = null;
    this._applyHash();
  }

  _renderTabs() {
    const chips = this._resolveChips();
    this._tabs.innerHTML = "";
    this._chipEls = chips.map((chip) => {
      const el = document.createElement("button");
      el.className = "tab";
      el.type = "button";

      const icon = document.createElement("ha-icon");
      icon.icon = chipIcon(chip);

      const labels = document.createElement("span");
      labels.className = "tab-labels";
      const name = document.createElement("span");
      name.className = "tab-name";
      name.textContent = chipName(this._hass, chip);
      const count = document.createElement("span");
      count.className = "tab-count";
      labels.appendChild(name);
      labels.appendChild(count);

      el.appendChild(icon);
      el.appendChild(labels);
      el.addEventListener("click", () => this._selectTab(chip._slug));

      this._tabs.appendChild(el);
      return { el, count, chip };
    });
  }

  _updateChipCounts() {
    if (!this._chipEls) return;
    const cfg = this._config;
    this._chipEls.forEach((parts) => {
      const active = parts.chip._slug === this._active;
      parts.el.classList.toggle("active", active);

      if (!cfg.show_counts) {
        parts.count.textContent = "";
        return;
      }
      const ids = candidates(this._hass, cfg, parts.chip);
      const on = filterByMode(this._hass, parts.chip, ids, "active").length;
      const word = chipStateWord(this._hass, parts.chip);
      parts.count.textContent = word ? `${on} ${word}` : String(on);
    });
  }

  _renderBody() {
    const cfg = this._config;
    const hass = this._hass;
    const chips = this._resolveChips();
    const chip = chips.find((c) => c._slug === this._active) || chips[0];

    this._cards = [];
    this._body.innerHTML = "";
    if (!chip) return;

    const areas = resolveAreas(hass, cfg);

    areas.forEach((areaId) => {
      const scoped = Object.assign({}, cfg, { areas: [areaId] });
      const ids = sortEntities(hass, candidates(hass, scoped, chip), cfg.groups_first);
      if (!ids.length && cfg.hide_empty_areas !== false) return;

      const section = document.createElement("div");
      section.className = "section";

      const heading = document.createElement("div");
      heading.className = "section-heading";
      const icon = areaIcon(hass, areaId);
      if (icon) {
        const iconEl = document.createElement("ha-icon");
        iconEl.icon = icon;
        heading.appendChild(iconEl);
      }
      const title = document.createElement("span");
      title.textContent = areaName(hass, areaId);
      heading.appendChild(title);
      section.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "grid";
      grid.style.setProperty("--adc-columns", String(cfg.columns || 2));

      ids.forEach((id) => {
        const card = this._createCard(tileCard(hass, id, cfg.features));
        if (card) grid.appendChild(card);
      });

      section.appendChild(grid);
      this._body.appendChild(section);
    });

    if (!this._body.children.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = tr(hass, "ui.panel.lovelace.cards.empty_state.title") || "Nothing to show";
      this._body.appendChild(empty);
    }
  }

  _createCard(config) {
    let el;
    if (this._helpers && this._helpers.createCardElement) {
      try {
        el = this._helpers.createCardElement(config);
      } catch (err) {
        el = undefined;
      }
    }
    if (!el) {
      el = document.createElement("hui-tile-card");
      if (el.setConfig) {
        try {
          el.setConfig(config);
        } catch (err) {
          return undefined;
        }
      }
    }
    el.hass = this._hass;
    this._cards.push(el);
    return el;
  }
}

const STYLES = `
  :host { display: block; }
  .page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 8px 4px 24px;
    box-sizing: border-box;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 8px 0 20px;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--lovelace-background, var(--primary-background-color, transparent));
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: var(--ha-badge-size, 36px);
    padding: 0 12px;
    border-radius: var(--ha-badge-border-radius, calc(var(--ha-badge-size, 36px) / 2));
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border: var(--ha-card-border-width, 1px) solid
            var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--primary-text-color);
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tab:hover { background: var(--secondary-background-color, rgba(0, 0, 0, 0.04)); }
  .tab.active {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 14%, var(--ha-card-background, var(--card-background-color, #fff)));
  }
  .tab.active ha-icon { color: var(--primary-color); }
  .tab ha-icon { --mdc-icon-size: 18px; display: inline-flex; color: var(--secondary-text-color); }
  .tab-labels { display: flex; flex-direction: column; align-items: flex-start; white-space: nowrap; }
  .tab-name { font-size: 10px; font-weight: 500; line-height: 10px; letter-spacing: 0.1px; }
  .tab-count {
    font-size: var(--ha-badge-font-size, 12px);
    font-weight: 500;
    line-height: 16px;
    letter-spacing: 0.1px;
  }
  .tab-count:empty { display: none; }

  .sections {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px 32px;
    align-items: start;
  }
  .section-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px 12px;
    font-size: 20px;
    font-weight: 400;
    color: var(--primary-text-color);
  }
  .section-heading ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--adc-columns, 2), minmax(0, 1fr));
    gap: 8px;
  }
  @media (max-width: 480px) {
    .grid { grid-template-columns: 1fr; }
  }
  .empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--secondary-text-color);
    padding: 32px 0;
  }
`;

customElements.define("area-domain-tabs-card", AreaDomainTabsCard);

/* ================================================================== *
 * Registration
 * ================================================================== */

window.customCards = window.customCards || [];
window.customCards.push({
  type: "area-domain-tabs-card",
  name: "Area Domain Tabs",
  description: "A page of tile cards per area, with a chip per device type acting as tabs.",
  preview: false,
  documentationURL: "https://github.com/Gessink/area-domain-strategies",
});

console.info(
  `%c AREA-DOMAIN-STRATEGIES %c v${VERSION} `,
  "color:#fff;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:#fff;font-weight:700"
);
