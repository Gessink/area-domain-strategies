/*
 * Area Domain Strategies
 * ----------------------
 * Home Assistant dashboard strategies built on the same area + domain + label
 * + device class matching as area-domain-chips. Everything they produce is a
 * native sections view, so Home Assistant owns the layout:
 *
 *   custom:area-domain-section   a grid section for one device type across one
 *                                or more areas, groups first
 *
 *   custom:area-room-section     a room's overview section: a header, then a
 *                                hand-picked list of entities as tiles
 *
 *   custom:area-domain-areas     a sections view with one section per area for
 *                                a single device type
 *
 *   custom:area-domain-tabs      one such view with a chip per device type on
 *                                top, switching what the sections show through
 *                                the URL hash
 *
 * https://github.com/Gessink/area-domain-strategies
 */

const VERSION = "1.8.4";

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

// Groups hold groups: a bedroom group can list a nightstand group rather than
// the two lamps in it. Walking through gives everything it really controls.
// The guard keeps a group that somehow contains itself from looping.
function allGroupMembers(hass, entityId, seen) {
  const guard = seen || new Set();
  if (guard.has(entityId)) return [];
  guard.add(entityId);

  const stateObj = hass.states[entityId];
  const members = stateObj ? groupMembers(stateObj) : null;
  if (!members) return [];

  const out = [];
  members.forEach((member) => {
    out.push(member);
    allGroupMembers(hass, member, guard).forEach((nested) => out.push(nested));
  });
  return out;
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

// Keys that describe *what* to match, as opposed to where to look or how to
// render it. A config that doubles as its own chip must hand over only these:
// carrying `areas` along would override the per-area scoping the callers do.
const CHIP_KEYS = [
  "domain", "domains", "device_class", "device_classes", "label", "labels",
  "label_match", "entities", "name", "icon", "active_states", "inactive_states",
  "use_action", "state_text", "exclude_keywords", "include_keywords", "key",
  "device_class_exempt_domains",
];

function chipFromConfig(cfg) {
  const chip = {};
  CHIP_KEYS.forEach((key) => {
    if (cfg[key] !== undefined) chip[key] = cfg[key];
  });
  return chip;
}

// Stable id used in the URL path and to key the tabs.
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
    // Some domains carry no device class at all. A section like security wants
    // those alongside the classed ones, so they can be exempted rather than
    // needing a second section.
    const exempt = asArray(chip.device_class_exempt_domains);
    if (!exempt.includes(entityId.split(".")[0])) {
      const dc = stateObj.attributes ? stateObj.attributes.device_class : undefined;
      if (!dc || !deviceClasses.includes(dc)) return false;
    }
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
    if (!groupMembers(hass.states[id])) return true;
    if (groups === "exclude") return false;

    // Judge on everything the group reaches. A group whose only member is
    // another group would otherwise look like it controls nothing that is
    // listed, and survive as a tile among the very lamps it switches.
    const members = allGroupMembers(hass, id);
    if (!members.length) return true;

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
// A tile grows a row per feature, so a dimmable light with a colour slider is
// taller than a plain switch. Sorting on that first keeps equally tall cards
// side by side instead of leaving ragged holes down the column.
function cardRows(hass, entityId, withFeatures) {
  if (withFeatures === false) return 0;
  const stateObj = hass.states[entityId];
  return stateObj ? featuresFor(stateObj).length : 0;
}

function sortEntities(hass, ids, cfg) {
  const options = cfg || {};
  const groupsFirst = options.groups_first !== false;
  const byHeight = options.sort_by_height !== false;
  const withFeatures = options.features !== false;

  return ids.slice().sort((a, b) => {
    if (groupsFirst) {
      const ga = groupMembers(hass.states[a]) ? 0 : 1;
      const gb = groupMembers(hass.states[b]) ? 0 : 1;
      if (ga !== gb) return ga - gb;
    }
    if (byHeight) {
      const ra = cardRows(hass, a, withFeatures);
      const rb = cardRows(hass, b, withFeatures);
      if (ra !== rb) return rb - ra;
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
// VacuumEntityFeature.CLEAN_AREA, added in Home Assistant 2026.3.
const VACUUM_CLEAN_AREA = 16384;

const BRIGHTNESS_MODES = ["brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww", "white"];

/* ------------------------------------------------------------------ *
 * Colours
 *
 * Same values as Home Assistant's own colour picker: a theme colour name or
 * any CSS colour. Kept in step with area-domain-chips.
 * ------------------------------------------------------------------ */

const THEME_COLORS = [
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "light-grey", "grey",
  "dark-grey", "blue-grey", "black", "white", "disabled",
];

function resolveColor(color) {
  if (!color || color === "none") return "var(--primary-text-color)";
  if (THEME_COLORS.includes(color)) return `var(--${color}-color)`;
  return color;
}

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

// climate gets its own feature set here rather than in featuresFor()
// itself, so the existing detail-room pages this shares code with keep
// showing exactly what they always have. media_player never reaches this:
// it renders as a Mushroom card instead of a tile (see roomSectionTile).
function roomSectionFeatures(stateObj) {
  const domain = stateObj.entity_id.split(".")[0];

  // A room overview wants a quick way to nudge the target temperature, not
  // a mode switcher, so this drops the climate-hvac-modes feature that
  // featuresFor() adds whenever the entity happens to list hvac_modes.
  if (domain === "climate") return [{ type: "target-temperature" }];

  return featuresFor(stateObj);
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
 * Area groups
 *
 * Two areas can share one section. An area that is not named in `area_groups`
 * keeps its own section, and a merged section takes the place of the first of
 * its areas so the configured order survives.
 * ================================================================== */

function resolveAreaGroups(hass, cfg) {
  const areas = resolveAreas(hass, cfg);
  const configured = asArray(cfg.area_groups).map((entry) =>
    Array.isArray(entry) ? { areas: entry } : entry || {}
  );

  const out = [];
  const placed = new Set();

  areas.forEach((areaId) => {
    if (placed.has(areaId)) return;

    const group = configured.find((g) => asArray(g.areas).includes(areaId));
    if (!group) {
      placed.add(areaId);
      out.push({ areas: [areaId] });
      return;
    }

    const members = asArray(group.areas).filter((id) => areas.includes(id));
    members.forEach((id) => placed.add(id));
    out.push({ areas: members, name: group.name, icon: group.icon });
  });

  return out;
}

function areaGroupName(hass, group) {
  if (group.name) return group.name;
  return group.areas.map((id) => areaName(hass, id)).join(" + ");
}

function areaGroupIcon(hass, group) {
  if (group.icon) return group.icon;
  return group.areas.length === 1 ? areaIcon(hass, group.areas[0]) : undefined;
}

/* ================================================================== *
 * Section strategy: custom:area-domain-section
 * ================================================================== */

// Splits what a section shows into the group that covers it, which goes on top
// across the full width, and the individual devices below it. The covering
// group is one the group rules already dropped from the list, so it is shown
// once as a master control rather than counted twice.
function sectionEntities(hass, cfg, chip) {
  const kept = candidates(hass, cfg, chip);
  const keptSet = new Set(kept);
  const items = sortEntities(hass, filterByMode(hass, chip, kept, cfg.mode), cfg);

  const rule = cfg.groups || "auto";
  if (cfg.group_header === false || (rule !== "auto" && rule !== "strict")) {
    return { headers: [], items };
  }

  // Only a group that covers the whole section earns the spot on top: it has
  // to hold every device shown below it. A group over half the lamps is not a
  // master control, so it stays out. Of the groups that do cover, the tightest
  // one wins, so an area group beats a house-wide group.
  if (items.length < 2) return { headers: [], items };

  const withGroups = candidates(hass, Object.assign({}, cfg, { groups: "include" }), chip);
  // Coverage is judged on everything a group reaches, nested groups included,
  // so a bedroom group listing a nightstand group still covers both lamps.
  const reach = {};
  const reachOf = (id) => {
    if (!reach[id]) reach[id] = allGroupMembers(hass, id);
    return reach[id];
  };

  const covering = withGroups
    .filter((id) => {
      if (keptSet.has(id)) return false;
      const members = reachOf(id);
      if (!members.length) return false;
      const memberSet = new Set(members);
      return items.every((item) => memberSet.has(item));
    })
    .sort((a, b) => reachOf(a).length - reachOf(b).length);

  return { headers: covering.slice(0, 1), items };
}

function buildSection(config, hass) {
  const cfg = Object.assign({ groups: "auto", groups_first: true, mode: "all", features: true }, config || {});
  const chip = cfg.chip || chipFromConfig(cfg);
  const areas = resolveAreas(hass, cfg);
  const scoped = Object.assign({}, cfg, { areas });

  const { headers, items } = sectionEntities(hass, scoped, chip);
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

  headers.forEach((id) =>
    cards.push(Object.assign(tileCard(hass, id, cfg.features), { grid_options: { columns: "full" } }))
  );
  items.forEach((id) => cards.push(tileCard(hass, id, cfg.features)));

  const section = { type: "grid", cards };
  if (cfg.column_span) section.column_span = cfg.column_span;
  if (!items.length && !headers.length && cfg.hide_when_empty !== false) section.cards = [];
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

  static async getConfigElement() {
    return document.createElement("area-domain-section-strategy-editor");
  }
}

customElements.define("ll-strategy-section-area-domain-section", AreaDomainSectionStrategy);

/* ================================================================== *
 * Room section strategy: custom:area-room-section
 *
 * One section for a room's overview card: an area-section-header, then a
 * hand-picked list of entities. Unlike area-domain-room this never chooses
 * which entities show up, only how each one is drawn, so the room's own
 * curation (a light group instead of every bulb, one thermostat, which
 * media player) stays exactly as configured.
 * ================================================================== */

// Curated deviations from Home Assistant's own default tile icon. Kept to
// domains where every existing room in Home.yml already drew the same icon
// by hand, so nothing here is a guess.
const ROOM_SECTION_DEFAULT_ICON = {
  climate: "mdi:radiator",
};

// Consumed by the strategy itself. Everything else on an entity entry (
// tap_action, state_content, features_position, vertical, volume_controls,
// media_controls, collapsible_controls, card_mod, ...) is not this
// strategy's business and goes straight through to the card, so an option
// added to either card kind after this file was written still works.
const ROOM_SECTION_OWN_KEYS = ["entity", "name", "icon", "features", "inline"];

// A native tile spends one full row per feature, so a media player wanting
// both playback buttons and a volume control ends up noticeably taller than
// the compact, single-row control strip Mushroom draws for the same thing.
// Requires the Mushroom cards integration (HACS: lovelace-mushroom).
const MUSHROOM_MEDIA_PLAYER_DEFAULTS = {
  use_media_info: true,
  show_volume_level: true,
  icon_type: "entity-picture",
  fill_container: false,
};

function roomSectionEntry(entry) {
  return typeof entry === "string" ? { entity: entry } : entry || {};
}

function roomSectionOverrides(card, opts) {
  Object.keys(opts).forEach((key) => {
    if (!ROOM_SECTION_OWN_KEYS.includes(key)) card[key] = opts[key];
  });
  return card;
}

function roomSectionTile(hass, entry, tileColumns) {
  const opts = roomSectionEntry(entry);
  const id = opts.entity;
  const stateObj = id ? hass.states[id] : undefined;
  if (!stateObj) return null;

  const domain = id.split(".")[0];

  // Home Assistant's own tile card default is columns: 6, and Mushroom's
  // own base card defaults to the same, so that is this strategy's default
  // too: inline unless the room's own author asks for a thermostat dial or
  // media player to take the section's full width instead.
  const inline = opts.inline !== false;
  const gridOptions = { columns: inline ? tileColumns : "full" };

  if (domain === "media_player") {
    const card = Object.assign({ type: "custom:mushroom-media-player-card", entity: id }, MUSHROOM_MEDIA_PLAYER_DEFAULTS);
    if (opts.name !== undefined) card.name = opts.name;
    roomSectionOverrides(card, opts);
    card.grid_options = gridOptions;
    return card;
  }

  const card = { type: "tile", entity: id };

  if (opts.name !== undefined) card.name = opts.name;
  if (opts.icon !== undefined) card.icon = opts.icon;
  else if (ROOM_SECTION_DEFAULT_ICON[domain]) card.icon = ROOM_SECTION_DEFAULT_ICON[domain];

  const features = Array.isArray(opts.features) ? opts.features : roomSectionFeatures(stateObj);
  if (features.length) card.features = features;

  roomSectionOverrides(card, opts);
  card.grid_options = gridOptions;

  return card;
}

function buildRoomSection(config, hass) {
  const cfg = config || {};
  const cards = [];

  if (cfg.header !== false) {
    cards.push(Object.assign({ type: "custom:area-section-header", area: cfg.area }, cfg.header || {}));
  }

  const tileColumns = cfg.tile_columns || 6;
  asArray(cfg.entities).forEach((entry) => {
    const card = roomSectionTile(hass, entry, tileColumns);
    if (card) cards.push(card);
  });

  return { type: "grid", cards };
}

class AreaRoomSectionStrategy {
  static async generate(config, hass) {
    return buildRoomSection(config, hass);
  }

  // Older Home Assistant releases call this instead.
  static async generateSection(info) {
    return buildRoomSection(info.config, info.hass);
  }
}

customElements.define("ll-strategy-section-area-room-section", AreaRoomSectionStrategy);

/* ================================================================== *
 * Areas view strategy: custom:area-domain-areas
 *
 * A native sections view: one section per area for a single device type.
 * ================================================================== */

function areaSections(config, hass, chip) {
  const cfg = config;
  return resolveAreaGroups(hass, cfg)
    .map((group) =>
      buildSection(
        Object.assign({}, cfg, {
          areas: group.areas,
          chip,
          title: areaGroupName(hass, group),
          icon: cfg.area_icons === false ? undefined : areaGroupIcon(hass, group),
        }),
        hass
      )
    )
    .filter((section) => section.cards.length || cfg.hide_empty_areas === false);
}

function buildAreasView(config, hass) {
  const cfg = Object.assign({ columns: 3 }, config || {});
  const chip = cfg.chip || chipFromConfig(cfg);
  return {
    type: "sections",
    max_columns: cfg.columns,
    sections: areaSections(cfg, hass, chip),
  };
}

class AreaDomainAreasStrategy {
  static async generate(config, hass) {
    return buildAreasView(config, hass);
  }

  static async generateView(info) {
    return buildAreasView(info.config, info.hass);
  }

  static async getConfigElement() {
    return document.createElement("area-domain-areas-strategy-editor");
  }
}

customElements.define("ll-strategy-view-area-domain-areas", AreaDomainAreasStrategy);

/* ================================================================== *
 * Tabs view strategy: custom:area-domain-tabs
 *
 * One native sections view, one section per area. Every card in it is wrapped
 * in a hash card that only renders when the URL hash matches its device type,
 * so switching tabs swaps the contents of the sections without leaving the
 * view. Home Assistant still owns the layout: max_columns, the responsive
 * column count and the 12 column section grid are all its own.
 * ================================================================== */

function hashCard(slug, isDefault, gridColumns, card) {
  const wrapper = {
    type: "custom:area-domain-hash-card",
    hash: slug,
    card,
  };
  if (isDefault) wrapper.default = true;
  if (gridColumns !== undefined) wrapper.grid_options = { columns: gridColumns };
  return wrapper;
}

function buildTabsView(config, hass) {
  const cfg = Object.assign(
    {
      columns: 3,
      tile_columns: 6,
      hide_empty_areas: true,
      show_counts: true,
      groups: "auto",
      groups_first: true,
      features: true,
      mode: "all",
    },
    config || {}
  );

  const chips = Array.isArray(cfg.chips) && cfg.chips.length ? cfg.chips : autoChips(hass, cfg);
  const tabs = chips.map((chip, i) => ({
    slug: chipSlug(chip, i),
    name: chipName(hass, chip),
    icon: chipIcon(chip),
    chip,
  }));

  const sections = resolveAreaGroups(hass, cfg)
    .map((group) => {
      const scoped = Object.assign({}, cfg, { areas: group.areas });
      const cards = [];

      tabs.forEach((tab, i) => {
        const { headers, items } = sectionEntities(hass, scoped, tab.chip);
        if (!items.length && !headers.length) return;

        cards.push(
          hashCard(tab.slug, i === 0, "full", {
            type: "heading",
            heading: areaGroupName(hass, group),
            heading_style: "title",
            icon: cfg.area_icons === false ? undefined : areaGroupIcon(hass, group),
          })
        );
        // A group covering the whole section sits on top, full width.
        headers.forEach((id) => {
          cards.push(hashCard(tab.slug, i === 0, "full", tileCard(hass, id, cfg.features)));
        });
        items.forEach((id) => {
          cards.push(hashCard(tab.slug, i === 0, cfg.tile_columns, tileCard(hass, id, cfg.features)));
        });
      });

      return { type: "grid", cards };
    })
    .filter((section) => section.cards.length || cfg.hide_empty_areas === false);

  const badge = Object.assign({}, cfg, {
    type: "custom:area-domain-tab-chips",
    tabs: tabs.map((t) => ({ slug: t.slug, name: t.name, icon: t.icon, chip: t.chip })),
  });
  delete badge.chips;

  return {
    type: "sections",
    max_columns: cfg.columns,
    badges: [badge],
    sections,
  };
}

class AreaDomainTabsStrategy {
  static async generate(config, hass) {
    return buildTabsView(config, hass);
  }

  static async generateView(info) {
    return buildTabsView(info.config, info.hass);
  }

  static async getConfigElement() {
    return document.createElement("area-domain-tabs-strategy-editor");
  }
}

customElements.define("ll-strategy-view-area-domain-tabs", AreaDomainTabsStrategy);

// The same page as a dashboard strategy: one dashboard, one view, the same
// config. Home Assistant offers a strategy editor for dashboards, which the
// edit-view dialog does not do for view strategies, so this is the route to
// configuring it without touching YAML.
function buildTabsDashboard(config, hass) {
  const cfg = config || {};
  const view = buildTabsView(cfg, hass);
  if (cfg.title) view.title = cfg.title;
  return { views: [view] };
}

class AreaDomainTabsDashboardStrategy {
  static async generate(config, hass) {
    return buildTabsDashboard(config, hass);
  }

  static async generateDashboard(info) {
    return buildTabsDashboard(info.config, info.hass);
  }

  static async getConfigElement() {
    return document.createElement("area-domain-tabs-strategy-editor");
  }
}

customElements.define("ll-strategy-dashboard-area-domain-tabs", AreaDomainTabsDashboardStrategy);

/* ================================================================== *
 * Hash plumbing
 *
 * Home Assistant's own visibility conditions cover state, numeric_state,
 * screen and user; there is no URL condition, so the hash has to be read by an
 * element. The chips write it, the hash cards read it.
 * ================================================================== */

const hashListeners = new Set();
let hashWired = false;

function currentHash() {
  return (window.location.hash || "").replace(/^#/, "");
}

function onHashChange(fn) {
  hashListeners.add(fn);
  if (!hashWired) {
    window.addEventListener("hashchange", () => hashListeners.forEach((l) => l()));
    hashWired = true;
  }
}

function offHashChange(fn) {
  hashListeners.delete(fn);
}

// A hidden element keeps its slot in a CSS grid, so whatever Home Assistant
// placed in that slot has to collapse too. Climb out of any single-child
// wrappers until the parent is the grid itself: a grid container has many
// children, a wrapper has one. Stops at Home Assistant's `container` class and
// after four hops, so an unexpected shape means a gap, not a hidden page.
function gridItemFor(startEl) {
  let node = startEl;
  for (let i = 0; i < 5; i++) {
    const root = node.getRootNode();
    const parent = node.parentElement || (root && root.host) || null;
    if (!parent) break;
    if (parent.classList && parent.classList.contains("container")) break;
    if (parent.children && parent.children.length !== 1) break;
    node = parent;
  }
  return node;
}

const gridItemOf = gridItemFor;

// The section a card sits in, so an area with nothing on this tab can collapse
// instead of leaving an empty column. Climbs through both ordinary parents and
// shadow roots, because whether a card ends up in the light or shadow DOM of
// its section is Home Assistant's business, not something to rely on.
function sectionOf(el) {
  let node = el;
  for (let i = 0; i < 20 && node; i++) {
    const root = node.getRootNode();
    node = node.parentElement || (root && root.host) || null;
    if (node && node.tagName === "HUI-SECTION") return node;
  }
  return null;
}

// Hash cards report in per section so the section itself can be hidden when
// none of its cards are showing.
const sectionMembers = new WeakMap();

function reportVisibility(sectionEl, card, visible) {
  if (!sectionEl) return;
  let members = sectionMembers.get(sectionEl);
  if (!members) {
    members = new Map();
    sectionMembers.set(sectionEl, members);
  }
  members.set(card, visible);

  const any = Array.from(members.values()).some(Boolean);
  // Collapse the section's own grid item as well, otherwise an area with
  // nothing on this tab leaves an empty column behind.
  const item = gridItemFor(sectionEl);
  sectionEl.style.display = any ? "" : "none";
  if (item !== sectionEl) item.style.display = any ? "" : "none";
}

/* ================================================================== *
 * The hash card
 * ================================================================== */

class AreaDomainHashCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._inner = null;
    this._visible = null;
    this._onHash = () => this._apply();
  }

  setConfig(config) {
    if (!config || !config.card) throw new Error("`card` is required");
    this._config = config;
    if (this._inner) {
      this._inner.remove();
      this._inner = null;
    }
    this._visible = null;
    if (this.isConnected) this._apply();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._inner) this._inner.hass = hass;
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return this._inner && this._inner.getCardSize ? this._inner.getCardSize() : 1;
  }

  connectedCallback() {
    onHashChange(this._onHash);
    this._apply();
  }

  disconnectedCallback() {
    offHashChange(this._onHash);
  }

  _matches() {
    const hash = currentHash();
    if (!hash) return !!this._config.default;
    return hash === this._config.hash;
  }

  async _apply() {
    if (!this._config) return;
    const visible = this._matches();
    if (visible === this._visible) return;
    this._visible = visible;

    if (visible && !this._inner) {
      const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
      let el;
      if (helpers && helpers.createCardElement) {
        try {
          el = helpers.createCardElement(this._config.card);
        } catch (err) {
          el = undefined;
        }
      }
      if (!el) {
        el = document.createElement(`hui-${this._config.card.type}-card`);
        if (el.setConfig) el.setConfig(this._config.card);
      }
      el.hass = this._hass;
      this._inner = el;
      this.appendChild(el);
    }

    this.style.display = visible ? "" : "none";
    const item = gridItemOf(this);
    if (item && item !== this) item.style.display = visible ? "" : "none";
    reportVisibility(sectionOf(this), this, visible);
  }
}

customElements.define("area-domain-hash-card", AreaDomainHashCard);

/* ================================================================== *
 * The tab chips badge
 *
 * One chip per device type with the number that is currently active. Clicking
 * one writes the URL hash, which the hash cards pick up. Only the chips and
 * those wrappers are custom; the page around them is a plain sections view.
 * ================================================================== */

class AreaDomainTabChips extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._built = false;
    this._chipEls = [];
    this._lastRender = null;
    this._onHash = () => this._update();
  }

  static getStubConfig() {
    return { type: "custom:area-domain-tab-chips", tabs: [] };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (config.tabs !== undefined && !Array.isArray(config.tabs)) {
      throw new Error("`tabs` must be a list");
    }
    this._config = Object.assign({ show_counts: true, tabs: [] }, config);
    this._built = false;
    this._lastRender = null;
    if (this._hass) this._build();
  }

  connectedCallback() {
    onHashChange(this._onHash);
  }

  disconnectedCallback() {
    offHashChange(this._onHash);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    this._update();
  }

  get hass() {
    return this._hass;
  }

  _activeSlug() {
    const hash = currentHash();
    const tabs = this._config.tabs || [];
    if (hash && tabs.some((t) => t.slug === hash)) return hash;
    return tabs.length ? tabs[0].slug : "";
  }

  _select(slug) {
    if (currentHash() === slug) return;
    // Assigning the hash adds a history entry, so the back button steps back
    // through the tabs.
    window.location.hash = slug;
  }

  _build() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = CHIP_STYLES;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    root.appendChild(wrap);

    this._chipEls = (this._config.tabs || []).map((tab) => {
      const el = document.createElement("button");
      el.className = "chip";
      el.type = "button";

      const icon = document.createElement("ha-icon");
      icon.icon = tab.icon || "mdi:shape-outline";

      const labels = document.createElement("span");
      labels.className = "labels";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = tab.name || tab.slug;
      const value = document.createElement("span");
      value.className = "value";
      labels.appendChild(name);
      labels.appendChild(value);

      el.appendChild(icon);
      el.appendChild(labels);
      // The room view uses these as counters, not as tabs.
      if (this._config.navigate === false) {
        el.classList.add("static");
        el.disabled = true;
      } else {
        el.addEventListener("click", () => this._select(tab.slug));
      }

      wrap.appendChild(el);
      return { el, value, tab };
    });

    this._built = true;
  }

  _update() {
    const cfg = this._config;
    const hass = this._hass;
    if (!hass || !this._built) return;
    const active = this._activeSlug();

    const counts = this._chipEls.map((parts) => {
      if (!cfg.show_counts) return "";
      const chip = parts.tab.chip || {};
      const ids = candidates(hass, cfg, chip);
      const on = filterByMode(hass, chip, ids, "active").length;
      const word = chipStateWord(hass, chip);
      // `0/7 on` says more than `0 on`: it also tells you there are seven.
      const number = cfg.show_total ? `${on}/${ids.length}` : String(on);
      return word ? `${number} ${word}` : number;
    });

    const key = `${active}|${counts.join(",")}`;
    if (this._lastRender === key) return;
    this._lastRender = key;

    this._chipEls.forEach((parts, i) => {
      parts.el.classList.toggle("active", cfg.navigate !== false && parts.tab.slug === active);
      parts.value.textContent = counts[i];
    });
  }
}

const CHIP_STYLES = `
  :host { display: block; }
  .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: var(--ha-badge-size, 36px);
    box-sizing: border-box;
    padding: 0 12px;
    border-radius: var(--ha-badge-border-radius, calc(var(--ha-badge-size, 36px) / 2));
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border: var(--ha-card-border-width, 1px) solid
            var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--primary-text-color);
    font: inherit;
    font-family: var(--ha-font-family-body, inherit);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .chip:hover { background: var(--secondary-background-color, rgba(0, 0, 0, 0.04)); }
  .chip.static { cursor: default; }
  .chip.static:hover { background: var(--ha-card-background, var(--card-background-color, #fff)); }
  .chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .chip.active {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 14%, var(--ha-card-background, var(--card-background-color, #fff)));
  }
  .chip.active ha-icon { color: var(--primary-color); }
  ha-icon { --mdc-icon-size: 18px; display: inline-flex; color: var(--secondary-text-color); }
  .labels { display: flex; flex-direction: column; align-items: flex-start; white-space: nowrap; }
  .name { font-size: 10px; font-weight: 500; line-height: 10px; letter-spacing: 0.1px; }
  .value {
    font-size: var(--ha-badge-font-size, 12px);
    font-weight: 500;
    line-height: 16px;
    letter-spacing: 0.1px;
  }
  .value:empty { display: none; }
`;

customElements.define("area-domain-tab-chips", AreaDomainTabChips);


/* ================================================================== *
 * The shortcut button
 *
 * Home Assistant's own button card has no colour option, and the tile card
 * only colours itself while its entity is active, which a "turn everything
 * off" button never is. So the shortcuts get their own small card.
 * ================================================================== */

// Theme colours light enough that white text on them is unreadable.
const DARK_TEXT_COLORS = [
  "amber", "yellow", "lime", "light-green", "white", "light-grey", "orange",
];

function buttonColors(color, fill, textColor) {
  const base = color ? resolveColor(color) : "var(--primary-color)";
  if (!fill) {
    return { bg: `color-mix(in srgb, ${base} 20%, transparent)`, fg: base };
  }
  let fg = textColor;
  if (!fg) {
    fg = DARK_TEXT_COLORS.includes(color) ? "rgba(0, 0, 0, 0.87)" : "#fff";
  } else if (THEME_COLORS.includes(fg)) {
    fg = `var(--${fg}-color)`;
  }
  return { bg: base, fg };
}

class AreaDomainButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
  }

  static getStubConfig() {
    return { type: "custom:area-domain-button", icon: "mdi:lightbulb-off", color: "amber" };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = Object.assign({ fill: true, show_name: true }, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._state) this._updateState();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 3, rows: 2, min_columns: 2, min_rows: 1 };
  }

  _act(action) {
    const hass = this._hass;
    if (!hass || !action) return;
    const kind = action.action || "none";

    if (kind === "none") return;

    if (kind === "toggle") {
      const entity = action.entity || this._config.entity;
      if (entity) hass.callService("homeassistant", "toggle", {}, { entity_id: entity });
      return;
    }

    if (kind === "more-info") {
      const entity = action.entity || this._config.entity;
      if (!entity) return;
      this.dispatchEvent(
        new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true })
      );
      return;
    }

    if (kind === "navigate") {
      if (!action.navigation_path) return;
      history.pushState(null, "", action.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
      return;
    }

    if (kind === "url") {
      if (action.url_path) window.open(action.url_path, "_blank", "noopener");
      return;
    }

    if (kind === "perform-action" || kind === "call-service") {
      const service = action.perform_action || action.service;
      if (!service) return;
      const [domain, name] = service.split(".");
      if (!domain || !name) return;
      hass.callService(domain, name, action.data || action.service_data || {}, action.target);
    }
  }

  _updateState() {
    const entity = this._config.entity;
    if (!entity || !this._hass) return;
    const stateObj = this._hass.states[entity];
    if (!stateObj) return;
    if (!this._config.name) {
      this._label.textContent = (stateObj.attributes && stateObj.attributes.friendly_name) || entity;
    }
    if (!this._config.icon && stateObj.attributes && stateObj.attributes.icon) {
      this._icon.icon = stateObj.attributes.icon;
    }
  }

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = BUTTON_STYLES;
    root.appendChild(style);

    const cfg = this._config;
    const colors = buttonColors(cfg.color, cfg.fill !== false, cfg.text_color);

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.style.setProperty("--adb-bg", colors.bg);
    btn.style.setProperty("--adb-fg", colors.fg);

    const icon = document.createElement("ha-icon");
    icon.icon = cfg.icon || "mdi:gesture-tap-button";
    btn.appendChild(icon);
    this._icon = icon;

    const label = document.createElement("span");
    label.className = "name";
    label.textContent = cfg.name || "";
    if (cfg.show_name === false) label.classList.add("hidden");
    btn.appendChild(label);
    this._label = label;

    btn.addEventListener("click", () => this._act(cfg.tap_action || { action: "none" }));
    if (cfg.hold_action) {
      let timer = null;
      btn.addEventListener("pointerdown", () => {
        timer = window.setTimeout(() => this._act(cfg.hold_action), 500);
      });
      const clear = () => {
        if (timer) window.clearTimeout(timer);
        timer = null;
      };
      btn.addEventListener("pointerup", clear);
      btn.addEventListener("pointerleave", clear);
    }

    root.appendChild(btn);
    this._state = true;
    this._updateState();
  }
}

const BUTTON_STYLES = `
  :host { display: block; height: 100%; }
  .btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    height: 100%;
    min-height: 56px;
    box-sizing: border-box;
    padding: 10px 8px;
    border: none;
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--adb-bg, var(--primary-color));
    color: var(--adb-fg, #fff);
    font: inherit;
    font-family: var(--ha-font-family-body, inherit);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: filter 120ms ease-in-out;
  }
  .btn:hover { filter: brightness(1.06); }
  .btn:active { filter: brightness(0.94); }
  .btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  ha-icon { --mdc-icon-size: 28px; display: inline-flex; }
  .name {
    font-size: 12px;
    font-weight: 500;
    line-height: 14px;
    text-align: center;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .name:empty, .hidden { display: none; }
`;

customElements.define("area-domain-button", AreaDomainButton);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "area-domain-button",
  name: "Area Domain Button",
  description: "A coloured shortcut button that runs an action.",
  preview: false,
  documentationURL: "https://github.com/Gessink/area-domain-strategies",
});

/* ================================================================== *
 * Room view strategy: custom:area-domain-room
 *
 * One area, or a combined set of areas, laid out as a native sections view
 * with a section per kind of device. The shortcuts section comes first, the
 * catch-all last, so a device in a domain nobody thought of still shows up.
 * ================================================================== */

// Headings Home Assistant has no translation for. Everything else asks hass.
const SECTION_TITLES = {
  shortcuts: { en: "Shortcuts", nl: "Snelkoppelingen", de: "Verknüpfungen", fr: "Raccourcis" },
  security: { en: "Security", nl: "Beveiliging", de: "Sicherheit", fr: "Sécurité" },
  other: { en: "Other devices", nl: "Andere apparaten", de: "Andere Geräte", fr: "Autres appareils" },
  rest: { en: "Other", nl: "Overig", de: "Sonstiges", fr: "Autre" },
};

function builtinTitle(hass, key) {
  const entry = SECTION_TITLES[key];
  if (!entry) return "";
  const lang = ((hass && hass.language) || "en").slice(0, 2);
  return entry[lang] || entry.en;
}

// The sensors worth a graph on a room page. Everything else is noise there,
// so `sensors: all` is opt-in.
const COMMON_SENSOR_CLASSES = ["temperature", "humidity", "atmospheric_pressure", "pressure"];

const SECURITY_DEVICE_CLASSES = [
  "door", "garage_door", "window", "opening", "motion", "occupancy", "presence",
  "smoke", "gas", "carbon_monoxide", "moisture", "tamper", "safety", "problem",
];

// `alarm_control_panel` and `lock` have no device class, so the security
// section has to match on domain OR device class rather than both.
const ANY_DEVICE_CLASS_DOMAINS = ["alarm_control_panel", "lock"];

/* -------------------- optional companion cards -------------------- */

// Cards from other repositories that a room can use when they happen to be
// installed. Nothing is emitted for one that is missing, so the page never
// shows "custom element doesn't exist".
const COMPANIONS = {
  washdata: {
    card: "washdata-card",
    platform: "ha_washdata",
    icon: "mdi:washing-machine",
    // The lifetime total is a nice figure on a dedicated page, but on a room
    // page it is noise next to a running cycle.
    defaults: { show_energy: false },
  },
};

// The name the companion card registered itself under, so the section heading
// follows whatever that card calls itself.
function companionName(name) {
  const spec = COMPANIONS[name];
  const listed = (window.customCards || []).find((entry) => entry && entry.type === spec.card);
  return (listed && listed.name) || spec.card;
}

function companionInstalled(name) {
  const spec = COMPANIONS[name];
  if (!spec) return false;
  if (typeof customElements !== "undefined" && customElements.get(spec.card)) return true;
  // Resources load before a dashboard renders, but the element may not be
  // upgraded yet when a strategy runs, so accept the card registry too.
  const listed = window.customCards || [];
  return listed.some((entry) => entry && entry.type === spec.card);
}

// Devices in these areas that belong to the companion's integration.
function companionDevices(hass, cfg, name, areas) {
  const spec = COMPANIONS[name];
  if (!spec || !hass.entities) return [];
  const scope = new Set(areas);
  const found = [];

  Object.keys(hass.entities).forEach((entityId) => {
    const reg = hass.entities[entityId];
    if (!reg || reg.platform !== spec.platform || !reg.device_id) return;
    if (found.indexOf(reg.device_id) >= 0) return;
    const areaId = entityAreaId(hass, entityId);
    if (!areaId || !scope.has(areaId)) return;
    found.push(reg.device_id);
  });

  return found;
}

// Vacuums that can be sent to a Home Assistant area at all.
function areaCapableVacuums(hass) {
  return Object.keys(hass.states).filter((id) => {
    if (id.split(".")[0] !== "vacuum") return false;
    const attrs = hass.states[id].attributes || {};
    return !!((attrs.supported_features || 0) & VACUUM_CLEAN_AREA);
  });
}

// Which areas each vacuum has segments mapped to. That mapping lives in the
// entity registry options rather than in the state, so it takes a round trip.
// A null result means the question could not be answered, which is different
// from an answer of "none".
async function vacuumAreaMapping(hass, entityIds) {
  if (!entityIds.length || !hass.callWS) return null;
  try {
    const entries = await hass.callWS({
      type: "config/entity_registry/get_entries",
      entity_ids: entityIds,
    });
    if (!entries) return null;
    const out = {};
    entityIds.forEach((id) => {
      const entry = entries[id];
      const options = (entry && entry.options && entry.options.vacuum) || {};
      const mapping = options.area_mapping;
      out[id] = mapping && typeof mapping === "object" ? Object.keys(mapping) : [];
    });
    return out;
  } catch (err) {
    return null;
  }
}

// Every entity belonging to those devices, whatever its domain, so a companion
// card can take the whole appliance off the rest of the page.
function companionEntities(hass, devices) {
  if (!hass.entities || !devices.length) return [];
  const scope = new Set(devices);
  return Object.keys(hass.entities).filter((entityId) => {
    const reg = hass.entities[entityId];
    return !!reg && scope.has(reg.device_id);
  });
}

// What the counters on a room page count. Deliberately not the section list:
// doors, windows and motion are worth a number at the top even though they all
// live in one Security section below.
// Cards that replace a tile entirely and are given the full section width.
const FULL_WIDTH_CARDS = ["thermostat", "humidifier", "media-control"];

const DEFAULT_ROOM_BADGES = [
  { key: "light", domain: "light" },
  { key: "cover", domains: ["cover", "valve"] },
  { key: "climate", domains: ["climate", "water_heater"] },
  { key: "media_player", domain: "media_player" },
  { key: "door", domain: "binary_sensor", device_class: "door" },
  { key: "window", domain: "binary_sensor", device_class: "window" },
  { key: "motion", domain: "binary_sensor", device_class: "motion" },
  { key: "switch", domain: "switch" },
];

const DEFAULT_ROOM_SECTIONS = [
  { key: "shortcuts" },
  { key: "light", domain: "light" },
  { key: "cover", domains: ["cover", "valve"] },
  { key: "climate", domains: ["climate", "water_heater"], card: "thermostat" },
  { key: "washdata", companion: "washdata" },
  { key: "media_player", domain: "media_player", card: "media-control" },
  { key: "sensor", domain: "sensor", device_classes: COMMON_SENSOR_CLASSES, card: "sensor" },
  {
    key: "security",
    domains: ["alarm_control_panel", "lock", "binary_sensor"],
    device_classes: SECURITY_DEVICE_CLASSES,
    device_class_exempt_domains: ANY_DEVICE_CLASS_DOMAINS,
  },
  { key: "other", domains: ["switch", "fan", "vacuum", "lawn_mower", "siren", "humidifier", "remote"] },
  { key: "rest", rest: true },
];

function roomSections(hass, cfg) {
  if (Array.isArray(cfg.sections) && cfg.sections.length) return cfg.sections;
  return DEFAULT_ROOM_SECTIONS.map((entry) => {
    if (entry.key === "sensor" && cfg.sensors === "all") {
      const all = Object.assign({}, entry);
      delete all.device_classes;
      all.domains = ["sensor", "binary_sensor"];
      return all;
    }
    return entry;
  });
}

// Domains the catch-all leaves alone: things that are not devices, plus the
// readings the sensor and security sections deliberately filtered out. Asking
// for three sensor classes and then getting every other one back under "Other"
// would defeat the point.
const REST_EXCLUDED_DOMAINS = [
  "sensor", "binary_sensor",
  "scene", "script", "automation", "person", "device_tracker", "zone", "sun",
  "todo", "calendar", "tag", "event", "conversation", "stt", "tts", "image",
  "update", "input_boolean", "input_select", "input_number", "input_text",
  "input_datetime", "input_button", "timer", "counter", "schedule",
];

// `{ rest: true }` written by hand carries no key, so derive one.
function sectionKey(entry) {
  return entry.key || (entry.rest ? "rest" : undefined);
}

function sectionHeading(hass, entry) {
  if (entry.title !== undefined) return entry.title;

  const key = sectionKey(entry);
  const builtin = builtinTitle(hass, key);
  if (builtin) return builtin;

  // A section keyed on a domain is named after that domain, not after the
  // first device class it happens to filter on: the sensor section is
  // "Sensors", not "Temperature".
  if (key && hass && hass.states && DOMAIN_ICONS[key] !== undefined) {
    return chipName(hass, { domain: key });
  }
  if (key && asArray(entry.domains).concat(asArray(entry.domain)).includes(key)) {
    return chipName(hass, { domain: key });
  }

  return chipName(hass, chipFromConfig(entry));
}

function sectionIcon(hass, entry) {
  if (entry.icon !== undefined) return entry.icon;
  const key = sectionKey(entry);
  if (key === "shortcuts") return "mdi:gesture-tap-button";
  if (key === "security") return "mdi:shield-home";
  if (key === "rest") return "mdi:shape-outline";
  return chipIcon(chipFromConfig(entry));
}

/* -------------------- shortcuts -------------------- */

const SHORTCUT_COLORS = {
  lights_off: "amber",
  vacuum: "teal",
  scenes: "purple",
};

function serviceButton(name, icon, color, service, target, data) {
  const card = {
    type: "custom:area-domain-button",
    name,
    icon,
    color,
    tap_action: { action: "perform-action", perform_action: service, target },
  };
  if (data) card.tap_action.data = data;
  return card;
}

function customButton(button) {
  const card = { type: "custom:area-domain-button" };
  if (button.name !== undefined) card.name = button.name;
  if (button.icon) card.icon = button.icon;
  if (button.entity) card.entity = button.entity;
  if (button.color) card.color = button.color;
  if (button.text_color) card.text_color = button.text_color;
  if (button.fill === false) card.fill = false;
  if (button.show_name === false) card.show_name = false;

  const action = button.tap_action || button.action;
  if (action) {
    card.tap_action = action;
  } else if (button.service || button.perform_action) {
    card.tap_action = {
      action: "perform-action",
      perform_action: button.perform_action || button.service,
      target: button.target,
      data: button.data,
    };
  } else if (button.entity) {
    card.tap_action = { action: "toggle" };
  }
  if (button.hold_action) card.hold_action = button.hold_action;
  return card;
}

// The scenes assigned to these areas, in name order.
function areaScenes(hass, cfg, areas) {
  const ids = Object.keys(hass.states).filter((id) => {
    if (id.split(".")[0] !== "scene") return false;
    const reg = hass.entities ? hass.entities[id] : undefined;
    if (reg && !cfg.include_hidden && reg.hidden) return false;
    const areaId = entityAreaId(hass, id);
    return !!areaId && areas.includes(areaId);
  });
  return ids.sort((a, b) => friendlyName(hass, a).localeCompare(friendlyName(hass, b)));
}

function shortcutCards(hass, cfg, entry, areas) {
  const scoped = Object.assign({}, cfg, { areas });
  const cards = [];
  const used = [];
  const wanted = Array.isArray(entry.buttons) && entry.buttons.length
    ? entry.buttons
    : ["lights_off", "vacuum", "scenes"];

  wanted.forEach((button) => {
    if (typeof button !== "string") {
      cards.push(button.card ? button.card : customButton(button));
      if (button.entity) used.push(button.entity);
      return;
    }

    if (button === "lights_off") {
      if (!candidates(hass, scoped, { domain: "light" }).length) return;
      const name = `${chipName(hass, { domain: "light" })} ${lowerFirst(hass, stateName(hass, "light", undefined, "off"))}`;
      cards.push(serviceButton(name, "mdi:lightbulb-off", entry.lights_off_color || SHORTCUT_COLORS.lights_off, "light.turn_off", { area_id: areas }));
      return;
    }

    if (button === "vacuum") {
      // Home Assistant 2026.3 added vacuum.clean_area, which sends the robot to
      // the areas you already have rather than to vendor segment numbers. Use
      // it when the vacuum reports CLEAN_AREA, wherever in the house it docks.
      const areaCapable = areaCapableVacuums(hass);
      let capable = entry.vacuum_entity ? asArray(entry.vacuum_entity) : areaCapable;

      // A robot can only be sent to a room it has a segment mapped to. Where
      // the mapping is known, drop the ones this room is not in; where the
      // lookup failed, leave the button as it was rather than hide it wrongly.
      const mapping = cfg._vacuum_areas;
      if (mapping) {
        capable = capable.filter((id) => (mapping[id] || []).some((area) => areas.includes(area)));
      }

      if (capable.length) {
        const name = tr(hass, "component.vacuum.services.clean_area.name") || "Clean area";
        cards.push(
          serviceButton(
            name,
            "mdi:robot-vacuum",
            entry.vacuum_color || SHORTCUT_COLORS.vacuum,
            "vacuum.clean_area",
            { entity_id: capable },
            { cleaning_area_id: areas }
          )
        );
        return;
      }

      // In a home where area cleaning exists, a room without a mapping simply
      // gets no button: falling back to a whole-house run would be a nasty
      // surprise from a button that says "clean this room".
      if (areaCapable.length) return;

      // No robot can clean a single area at all: start whatever vacuum lives
      // here, which is a full run.
      const vacuums = candidates(hass, scoped, { domain: "vacuum" });
      if (!vacuums.length) return;
      const name = tr(hass, "ui.card.vacuum.actions.start_cleaning") || "Start cleaning";
      cards.push(serviceButton(name, "mdi:robot-vacuum", entry.vacuum_color || SHORTCUT_COLORS.vacuum, "vacuum.start", { entity_id: vacuums }));
      return;
    }

    if (button === "scenes") {
      areaScenes(hass, cfg, areas).forEach((id) => {
        cards.push({
          type: "custom:area-domain-button",
          entity: id,
          color: entry.scene_color || SHORTCUT_COLORS.scenes,
          icon: (hass.states[id].attributes || {}).icon,
          tap_action: { action: "toggle" },
        });
        used.push(id);
      });
    }
  });

  return { cards, used };
}

/* -------------------- sections -------------------- */

function roomSectionCards(hass, cfg, entry, areas, claimed) {
  const chip = chipFromConfig(entry);
  const scoped = Object.assign({}, cfg, entry, { areas, chip });
  const found = sectionEntities(hass, scoped, chip);

  // First section wins. An entity an earlier section already took, or that a
  // companion card covers whole, does not appear a second time.
  const free = (id) => !claimed || !claimed.has(id);
  const headers = found.headers.filter(free);
  const items = found.items.filter(free);

  const tileColumns = entry.tile_columns || cfg.tile_columns || 6;
  const cards = [];
  const used = headers.concat(items);

  const tileFor = (id, fullWidth) => {
    const card = tileCard(hass, id, scoped.features);
    if (entry.vertical) card.vertical = true;
    card.grid_options = { columns: fullWidth ? "full" : tileColumns };
    return card;
  };

  // Cards that speak for a whole device and want the width to do it: a
  // thermostat dial, or media controls with artwork and a volume slider.
  if (FULL_WIDTH_CARDS.includes(entry.card)) {
    headers.concat(items).forEach((id) => {
      cards.push({
        type: entry.card,
        entity: id,
        grid_options: { columns: entry.tile_columns || "full" },
      });
    });
    return { cards, used };
  }

  // The sensor card draws the last day as a line under the value. Only useful
  // for something numeric, so anything else stays a tile.
  if (entry.card === "sensor") {
    headers.concat(items).forEach((id) => {
      const stateObj = hass.states[id];
      const attrs = (stateObj && stateObj.attributes) || {};
      const numeric = attrs.unit_of_measurement !== undefined && !isNaN(parseFloat(stateObj.state));
      if (numeric) {
        cards.push({
          type: "sensor",
          entity: id,
          graph: entry.graph === false ? "none" : "line",
          detail: entry.detail || 1,
          grid_options: { columns: tileColumns },
        });
      } else {
        cards.push(tileFor(id, false));
      }
    });
    return { cards, used };
  }

  headers.forEach((id) => cards.push(tileFor(id, true)));
  items.forEach((id) => cards.push(tileFor(id, false)));
  return { cards, used };
}

function restCards(hass, cfg, entry, areas, claimed) {
  const excluded = new Set(asArray(entry.exclude_domains).length
    ? asArray(entry.exclude_domains)
    : REST_EXCLUDED_DOMAINS);
  const scoped = Object.assign({}, cfg, { areas });
  const ids = candidates(hass, scoped, {}).filter(
    (id) => !claimed.has(id) && !excluded.has(id.split(".")[0])
  );

  const tileColumns = entry.tile_columns || cfg.tile_columns || 6;
  return sortEntities(hass, ids, scoped).map((id) => {
    const card = tileCard(hass, id, scoped.features);
    if (entry.vertical) card.vertical = true;
    card.grid_options = { columns: tileColumns };
    return card;
  });
}

async function buildRoomView(config, hass) {
  const cfg = Object.assign(
    {
      columns: 3,
      tile_columns: 6,
      groups: "auto",
      groups_first: true,
      features: true,
      mode: "all",
      badges: true,
      show_total: true,
      hide_empty_sections: true,
    },
    config || {}
  );

  const areas = resolveAreas(hass, cfg);
  const entries = roomSections(hass, cfg);

  // Answered once for the page, so the shortcut builder stays synchronous.
  if (entries.some((entry) => entry.key === "shortcuts" && !entry.section)) {
    cfg._vacuum_areas = await vacuumAreaMapping(hass, areaCapableVacuums(hass));
  }

  const claimed = new Set();
  const sections = [];
  let restSlot = -1;
  let restEntry = null;

  entries.forEach((entry) => {
    // A literal section is passed straight through, so hand-built cards keep
    // their place between the generated ones.
    if (entry.section) {
      sections.push(entry.section);
      return;
    }

    if (entry.rest) {
      restSlot = sections.length;
      restEntry = entry;
      sections.push(null);
      return;
    }

    const heading = {
      type: "heading",
      heading: sectionHeading(hass, entry),
      heading_style: entry.heading_style || "title",
      icon: sectionIcon(hass, entry),
    };

    let cards;
    if (entry.companion) {
      if (!companionInstalled(entry.companion)) return;
      const spec = COMPANIONS[entry.companion];
      const devices = companionDevices(hass, cfg, entry.companion, areas);
      cards = devices.map((deviceId) =>
        Object.assign(
          { type: `custom:${spec.card}`, device: deviceId },
          spec.defaults || {},
          entry.card_options || {},
          { grid_options: { columns: entry.tile_columns || "full" } }
        )
      );
      // The card speaks for the whole appliance, so its entities should not
      // turn up again as loose tiles further down the page.
      companionEntities(hass, devices).forEach((id) => claimed.add(id));
      // One appliance names the section after itself; several fall back to the
      // card's own name, so neither needs a translation here.
      if (entry.title === undefined) {
        const device = devices.length === 1 ? hass.devices[devices[0]] : undefined;
        heading.heading = device
          ? device.name_by_user || device.name
          : companionName(entry.companion);
      }
      if (entry.icon === undefined) heading.icon = spec.icon;
    } else if (entry.key === "shortcuts") {
      const result = shortcutCards(hass, cfg, entry, areas);
      result.used.forEach((id) => claimed.add(id));
      cards = result.cards.map((card) =>
        Object.assign({ grid_options: { columns: entry.button_columns || 3, rows: entry.button_rows || 2 } }, card)
      );
    } else {
      const result = roomSectionCards(hass, cfg, entry, areas, claimed);
      result.used.forEach((id) => claimed.add(id));
      cards = result.cards;
    }

    if (!cards.length && cfg.hide_empty_sections !== false) return;
    sections.push({ type: "grid", cards: [heading].concat(cards) });
  });

  // The catch-all runs last whatever its position, then drops into its slot.
  if (restSlot >= 0) {
    const cards = restCards(hass, cfg, restEntry, areas, claimed);
    if (!cards.length && cfg.hide_empty_sections !== false) {
      sections.splice(restSlot, 1);
    } else {
      sections[restSlot] = {
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: sectionHeading(hass, restEntry),
            heading_style: restEntry.heading_style || "title",
            icon: sectionIcon(hass, restEntry),
          },
        ].concat(cards),
      };
    }
  }

  const view = {
    type: "sections",
    max_columns: cfg.columns,
    sections,
  };

  if (cfg.badges !== false) {
    // The counters answer "what is going on in here", which is a different
    // question from how the page is divided up, so they have their own list.
    // One that the room has nothing of is left out entirely.
    const wanted = Array.isArray(cfg.badge_chips) && cfg.badge_chips.length
      ? cfg.badge_chips
      : DEFAULT_ROOM_BADGES;

    const tabs = wanted
      .map((entry, i) => ({
        slug: chipSlug(chipFromConfig(entry), i),
        name: sectionHeading(hass, entry),
        icon: sectionIcon(hass, entry),
        chip: chipFromConfig(entry),
      }))
      .filter((tab) => candidates(hass, Object.assign({}, cfg, { areas }), tab.chip).length);

    const badge = Object.assign({}, cfg, {
      type: "custom:area-domain-tab-chips",
      tabs,
      navigate: false,
      show_total: cfg.show_total !== false,
    });
    delete badge.sections;
    view.badges = [badge];
  }

  // Name and icon: yours if you set them, otherwise the areas this page is
  // about and the icon of the first of them.
  if (cfg.title !== undefined) {
    if (cfg.title !== false) view.title = cfg.title;
  } else if (areas.length) {
    view.title = areas.map((id) => areaName(hass, id)).join(" + ");
  }
  if (cfg.icon !== undefined) {
    if (cfg.icon !== false) view.icon = cfg.icon;
  } else if (areas.length) {
    const icon = areaIcon(hass, areas[0]);
    if (icon) view.icon = icon;
  }
  if (cfg.path) view.path = cfg.path;

  return view;
}

class AreaDomainRoomStrategy {
  static async generate(config, hass) {
    return buildRoomView(config, hass);
  }

  static async generateView(info) {
    return buildRoomView(info.config, info.hass);
  }

  static async getConfigElement() {
    return document.createElement("area-domain-room-strategy-editor");
  }
}

customElements.define("ll-strategy-view-area-domain-room", AreaDomainRoomStrategy);

// Same page as a dashboard strategy, which is the route that gets a UI editor.
class AreaDomainRoomDashboardStrategy {
  static async generate(config, hass) {
    return { views: [await buildRoomView(config, hass)] };
  }

  static async generateDashboard(info) {
    return { views: [await buildRoomView(info.config, info.hass)] };
  }

  static async getConfigElement() {
    return document.createElement("area-domain-room-strategy-editor");
  }
}

customElements.define("ll-strategy-dashboard-area-domain-room", AreaDomainRoomDashboardStrategy);

/* ================================================================== *
 * Editors
 *
 * Strategies take a config element the same way cards do, through a static
 * getConfigElement(). The elements below are shared between the strategies and
 * the standalone card, since they configure the same options.
 * ================================================================== */

const DOMAIN_OPTIONS = [
  "light", "switch", "fan", "cover", "valve", "lock", "binary_sensor", "sensor",
  "climate", "water_heater", "humidifier", "media_player", "vacuum", "lawn_mower",
  "input_boolean", "automation", "script", "scene", "person", "device_tracker",
  "alarm_control_panel", "remote", "siren", "camera", "update", "button",
];

const GROUPS_SELECTOR = {
  select: {
    mode: "dropdown",
    options: [
      { value: "auto", label: "Skip a group as soon as one member is listed" },
      { value: "strict", label: "Skip a group only when every member is listed" },
      { value: "exclude", label: "Never list groups" },
      { value: "include", label: "List groups like any other entity" },
    ],
  },
};

const DOMAIN_SELECTOR = {
  select: {
    mode: "dropdown",
    custom_value: true,
    options: DOMAIN_OPTIONS.map((d) => ({ value: d, label: d })),
  },
};

const SECTION_SCHEMA = [
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "domain", selector: DOMAIN_SELECTOR },
      { name: "device_class", selector: { text: {} } },
    ],
  },
  { name: "labels", selector: { label: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "title", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "mode",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "all", label: "All" },
              { value: "active", label: "Active only" },
              { value: "inactive", label: "Inactive only" },
              { value: "unavailable", label: "Unavailable only" },
            ],
          },
        },
      },
      {
        name: "heading_style",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "title", label: "Title" },
              { value: "subtitle", label: "Subtitle" },
            ],
          },
        },
      },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "features", selector: { boolean: {} } },
      { name: "groups_first", selector: { boolean: {} } },
    ],
  },
  { name: "groups", selector: GROUPS_SELECTOR },
  { name: "column_span", selector: { number: { min: 1, max: 4, mode: "box" } } },
  { name: "exclude_keywords", selector: { text: { multiple: true } } },
  { name: "include_keywords", selector: { text: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "include_hidden", selector: { boolean: {} } },
      { name: "include_diagnostic", selector: { boolean: {} } },
    ],
  },
];

const TABS_SCHEMA = [
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
      { name: "show_counts", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "features", selector: { boolean: {} } },
      { name: "hide_empty_areas", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "tile_columns", selector: { number: { min: 1, max: 12, mode: "box" } } },
      { name: "group_header", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "sort_by_height", selector: { boolean: {} } },
      { name: "groups_first", selector: { boolean: {} } },
    ],
  },
  { name: "groups", selector: GROUPS_SELECTOR },
  { name: "exclude_keywords", selector: { text: { multiple: true } } },
  { name: "include_keywords", selector: { text: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "include_hidden", selector: { boolean: {} } },
      { name: "include_diagnostic", selector: { boolean: {} } },
    ],
  },
];

const AREA_GROUP_SCHEMA = [
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
];

const CHIP_SCHEMA = [
  {
    name: "",
    type: "grid",
    schema: [
      { name: "domain", selector: DOMAIN_SELECTOR },
      { name: "device_class", selector: { text: {} } },
    ],
  },
  { name: "labels", selector: { label: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
];

const LABELS = {
  areas: "Areas (empty = every area)",
  domain: "Domain",
  device_class: "Device class (door, window, motion, ...)",
  labels: "Labels",
  title: "Heading (empty = translated domain or device class)",
  icon: "Icon",
  mode: "Which entities",
  heading_style: "Heading style",
  features: "Give tile cards their domain controls",
  groups: "Group entities",
  groups_first: "Put groups at the top of the list",
  column_span: "Section width in columns",
  columns: "Maximum sections side by side",
  tile_columns: "Card width, out of 12 (6 = two per row)",
  group_header: "Put a covering group on top, full width",
  sort_by_height: "Keep equally tall cards together",
  show_counts: "Show how many are active under each tab",
  area_group_name: "Heading (empty = the area names joined)",
  hide_empty_areas: "Hide areas without matching devices",
  exclude_keywords: "Skip entities whose id or name contains",
  include_keywords: "Only include entities whose id or name contains",
  include_hidden: "Include hidden entities",
  include_diagnostic: "Include diagnostic/config entities",
  name: "Name (empty = translated domain or device class)",
};

const EDITOR_STYLES = `
  :host { display: block; }
  .section { margin-bottom: 16px; }
  ha-expansion-panel { display: block; margin-bottom: 8px; --expansion-panel-content-padding: 12px; }
  .panel-icons { display: flex; align-items: center; gap: 4px; padding-right: 8px; }
  .chip-box {
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }
  .chip-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 500; }
  .chip-head .spacer { flex: 1; }
  .btn {
    border: 1px solid var(--divider-color, #e0e0e0);
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 13px;
  }
  .btn:hover:not(:disabled) { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .add-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
  h4 { margin: 16px 0 8px; }
  .hint { color: var(--secondary-text-color); font-size: 13px; margin: 0 0 12px; }
`;

class BaseEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._forms = [];
    this._lastEmitted = null;
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    this._prepare();

    // Home Assistant hands the config straight back after every edit. Skipping
    // the rebuild there keeps panels open and the focused field focused. The
    // comparison runs on the prepared config so defaults filled in by _prepare
    // do not read as a change.
    const normalized = JSON.stringify(this._config);
    if (normalized === this._lastEmitted) return;
    this._render();
  }

  _prepare() {}

  set hass(hass) {
    this._hass = hass;
    this._forms.forEach((f) => (f.hass = hass));
  }

  get hass() {
    return this._hass;
  }

  _emit() {
    this._lastEmitted = JSON.stringify(this._config);
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _makeForm(data, schema, onChange) {
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.schema = schema;
    form.data = data;
    form.computeLabel = (s) => LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      onChange(ev.detail.value);
    });
    this._forms.push(form);
    return form;
  }

  _button(label, fn, disabled) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener("click", (ev) => {
      ev.preventDefault();
      fn();
    });
    return b;
  }

  _startRender() {
    const root = this.shadowRoot;
    root.innerHTML = "";
    this._forms = [];
    const style = document.createElement("style");
    style.textContent = EDITOR_STYLES;
    root.appendChild(style);
    return root;
  }

  // A reorderable list of collapsible panels, one per entry, each holding its
  // own ha-form. Used for both the tabs and the combined areas.
  _panelList(root, opts) {
    const usePanel = !!customElements.get("ha-expansion-panel");
    const items = opts.items;
    const open = opts.open;

    items.forEach((item, i) => {
      const swap = (a, b) => {
        [items[a], items[b]] = [items[b], items[a]];
        [open[a], open[b]] = [open[b], open[a]];
        this._emit();
        this._render();
      };
      const buttons = [
        this._button("↑", () => swap(i, i - 1), i === 0),
        this._button("↓", () => swap(i, i + 1), i === items.length - 1),
        this._button("✕", () => {
          items.splice(i, 1);
          open.splice(i, 1);
          this._emit();
          this._render();
        }),
      ];

      const title = opts.title(item, i);
      let box;
      let titleEl;

      if (usePanel) {
        box = document.createElement("ha-expansion-panel");
        box.outlined = true;
        box.header = title;
        box.expanded = !!open[i];
        box.addEventListener("expanded-changed", (ev) => {
          open[i] = !!ev.detail.expanded;
        });
        const icons = document.createElement("div");
        icons.slot = "icons";
        icons.className = "panel-icons";
        buttons.forEach((b) => {
          b.addEventListener("click", (ev) => ev.stopPropagation());
          icons.appendChild(b);
        });
        box.appendChild(icons);
        titleEl = { set textContent(value) { box.header = value; } };
      } else {
        box = document.createElement("div");
        box.className = "chip-box";
        const head = document.createElement("div");
        head.className = "chip-head";
        titleEl = document.createElement("span");
        titleEl.textContent = title;
        const spacer = document.createElement("span");
        spacer.className = "spacer";
        head.appendChild(titleEl);
        head.appendChild(spacer);
        buttons.forEach((b) => head.appendChild(b));
        box.appendChild(head);
      }

      box.appendChild(
        this._makeForm(opts.data(item, i), opts.schema, (value) => {
          items[i] = opts.apply(value, item, i);
          titleEl.textContent = opts.title(items[i], i);
          this._emit();
        })
      );

      root.appendChild(box);
    });
  }

  _heading(root, text, hint) {
    const h = document.createElement("h4");
    h.textContent = text;
    root.appendChild(h);
    if (hint) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = hint;
      root.appendChild(p);
    }
  }
}

/* -------------------- section strategy editor -------------------- */

class AreaDomainSectionStrategyEditor extends BaseEditor {
  // The areas view takes the same options bar one: how many sections fit side
  // by side, which is a view setting rather than a section setting.
  get _isView() {
    return false;
  }

  _schema() {
    if (!this._isView) return SECTION_SCHEMA;
    return SECTION_SCHEMA.filter((row) => row.name !== "column_span").concat([
      { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
    ]);
  }

  _render() {
    const root = this._startRender();
    const cfg = this._config;

    root.appendChild(
      this._makeForm(
        {
          columns: cfg.columns || 3,
          areas: cfg.areas || [],
          domain: cfg.domain || "",
          device_class: cfg.device_class || "",
          labels: cfg.labels || (cfg.label ? [cfg.label] : []),
          title: typeof cfg.title === "string" ? cfg.title : "",
          icon: cfg.icon || "",
          mode: cfg.mode || "all",
          heading_style: cfg.heading_style || "title",
          features: cfg.features !== false,
          groups_first: cfg.groups_first !== false,
          groups: cfg.groups || "auto",
          column_span: cfg.column_span,
          exclude_keywords: cfg.exclude_keywords || [],
          include_keywords: cfg.include_keywords || [],
          include_hidden: !!cfg.include_hidden,
          include_diagnostic: !!cfg.include_diagnostic,
        },
        this._schema(),
        (value) => {
          const next = { type: cfg.type };
          if (this._isView && value.columns && value.columns !== 3) next.columns = value.columns;
          if (value.areas && value.areas.length) next.areas = value.areas;
          if (value.domain) next.domain = value.domain;
          if (value.device_class) next.device_class = value.device_class;
          if (value.labels && value.labels.length) next.labels = value.labels;
          if (value.title) next.title = value.title;
          if (value.icon) next.icon = value.icon;
          if (value.mode && value.mode !== "all") next.mode = value.mode;
          if (value.heading_style && value.heading_style !== "title") {
            next.heading_style = value.heading_style;
          }
          if (value.features === false) next.features = false;
          if (value.groups_first === false) next.groups_first = false;
          if (value.groups && value.groups !== "auto") next.groups = value.groups;
          if (value.column_span) next.column_span = value.column_span;
          if (value.exclude_keywords && value.exclude_keywords.length) {
            next.exclude_keywords = value.exclude_keywords;
          }
          if (value.include_keywords && value.include_keywords.length) {
            next.include_keywords = value.include_keywords;
          }
          if (value.include_hidden) next.include_hidden = true;
          if (value.include_diagnostic) next.include_diagnostic = true;

          this._config = next;
          this._emit();
        }
      )
    );
  }
}

customElements.define("area-domain-section-strategy-editor", AreaDomainSectionStrategyEditor);

class AreaDomainAreasStrategyEditor extends AreaDomainSectionStrategyEditor {
  get _isView() {
    return true;
  }
}

customElements.define("area-domain-areas-strategy-editor", AreaDomainAreasStrategyEditor);

/* -------------------- tabs editor -------------------- */

class AreaDomainTabsEditor extends BaseEditor {
  constructor() {
    super();
    this._open = [];
    this._openAreas = [];
  }

  _prepare() {
    if (!Array.isArray(this._config.chips)) this._config.chips = [];
    if (!Array.isArray(this._config.area_groups)) this._config.area_groups = [];
    this._open.length = this._config.chips.length;
    this._openAreas.length = this._config.area_groups.length;
  }

  _areaGroupTitle(group, i) {
    if (group.name) return group.name;
    const list = asArray(group.areas);
    if (this._hass && list.length) return list.map((id) => areaName(this._hass, id)).join(" + ");
    return `Combined area ${i + 1}`;
  }

  _chipTitle(chip, i) {
    if (chip.name) return chip.name;
    if (this._hass && (chip.domain || chip.device_class)) return chipName(this._hass, chip);
    return chip.device_class || chip.domain || `Tab ${i + 1}`;
  }

  _render() {
    const root = this._startRender();
    const cfg = this._config;

    root.appendChild(
      this._makeForm(
        {
          areas: cfg.areas || [],
          columns: cfg.columns || 3,
          show_counts: cfg.show_counts !== false,
          features: cfg.features !== false,
          hide_empty_areas: cfg.hide_empty_areas !== false,
          tile_columns: cfg.tile_columns || 6,
          group_header: cfg.group_header !== false,
          sort_by_height: cfg.sort_by_height !== false,
          groups: cfg.groups || "auto",
          groups_first: cfg.groups_first !== false,
          exclude_keywords: cfg.exclude_keywords || [],
          include_keywords: cfg.include_keywords || [],
          include_hidden: !!cfg.include_hidden,
          include_diagnostic: !!cfg.include_diagnostic,
        },
        TABS_SCHEMA,
        (value) => {
          cfg.areas = value.areas || [];
          cfg.columns = value.columns || 3;
          cfg.show_counts = value.show_counts !== false;
          cfg.features = value.features !== false;
          cfg.hide_empty_areas = value.hide_empty_areas !== false;
          cfg.tile_columns = value.tile_columns || 6;
          cfg.group_header = value.group_header !== false;
          cfg.sort_by_height = value.sort_by_height !== false;
          cfg.groups = value.groups || "auto";
          cfg.groups_first = value.groups_first !== false;
          cfg.exclude_keywords = value.exclude_keywords || [];
          cfg.include_keywords = value.include_keywords || [];
          cfg.include_hidden = !!value.include_hidden;
          cfg.include_diagnostic = !!value.include_diagnostic;
          this._emit();
        }
      )
    );

    this._heading(
      root,
      "Combined areas",
      "Put two or more areas in one section. Areas you leave out keep a section of their own."
    );

    this._panelList(root, {
      items: cfg.area_groups,
      open: this._openAreas,
      schema: AREA_GROUP_SCHEMA,
      title: (group, i) => this._areaGroupTitle(group, i),
      data: (group) => ({
        areas: group.areas || [],
        name: group.name || "",
        icon: group.icon || "",
      }),
      apply: (value) => {
        const next = {};
        if (value.areas && value.areas.length) next.areas = value.areas;
        if (value.name) next.name = value.name;
        if (value.icon) next.icon = value.icon;
        return next;
      },
    });

    const addAreaRow = document.createElement("div");
    addAreaRow.className = "add-row";
    addAreaRow.appendChild(
      this._button("+ Combine areas", () => {
        cfg.area_groups.push({ areas: [] });
        this._openAreas[cfg.area_groups.length - 1] = true;
        this._emit();
        this._render();
      })
    );
    root.appendChild(addAreaRow);

    this._heading(
      root,
      "Tabs",
      cfg.chips.length
        ? "Each tab matches a device type."
        : "No tabs configured: the domains found in the selected areas are used automatically."
    );

    this._panelList(root, {
      items: cfg.chips,
      open: this._open,
      schema: CHIP_SCHEMA,
      title: (chip, i) => this._chipTitle(chip, i),
      data: (chip) => ({
        domain: chip.domain || "",
        device_class: chip.device_class || "",
        labels: chip.labels || (chip.label ? [chip.label] : []),
        name: chip.name || "",
        icon: chip.icon || "",
      }),
      apply: (value) => {
        const next = {};
        if (value.domain) next.domain = value.domain;
        if (value.device_class) next.device_class = value.device_class;
        if (value.labels && value.labels.length) next.labels = value.labels;
        if (value.name) next.name = value.name;
        if (value.icon) next.icon = value.icon;
        return next;
      },
    });

    const addRow = document.createElement("div");
    addRow.className = "add-row";
    addRow.appendChild(
      this._button("+ Add tab", () => {
        cfg.chips.push({ domain: "light" });
        this._open[cfg.chips.length - 1] = true;
        this._emit();
        this._render();
      })
    );
    if (!cfg.chips.length) {
      addRow.appendChild(
        this._button("+ Add every detected domain", () => {
          if (!this._hass) return;
          cfg.chips = autoChips(this._hass, cfg);
          this._emit();
          this._render();
        })
      );
    }
    root.appendChild(addRow);
  }
}

customElements.define("area-domain-tabs-strategy-editor", AreaDomainTabsEditor);

/* -------------------- room strategy editor -------------------- */

const ROOM_SCHEMA = [
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
      { name: "tile_columns", selector: { number: { min: 1, max: 12, mode: "box" } } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "badges", selector: { boolean: {} } },
      { name: "show_total", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "features", selector: { boolean: {} } },
      { name: "group_header", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "sort_by_height", selector: { boolean: {} } },
      { name: "hide_empty_sections", selector: { boolean: {} } },
    ],
  },
  { name: "groups", selector: GROUPS_SELECTOR },
  { name: "exclude_keywords", selector: { text: { multiple: true } } },
  { name: "include_keywords", selector: { text: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "include_hidden", selector: { boolean: {} } },
      { name: "include_diagnostic", selector: { boolean: {} } },
    ],
  },
];

const ROOM_SECTION_SCHEMA = [
  {
    name: "",
    type: "grid",
    schema: [
      { name: "title", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "domain", selector: DOMAIN_SELECTOR },
      { name: "device_class", selector: { text: {} } },
    ],
  },
  { name: "labels", selector: { label: { multiple: true } } },
  { name: "entities", selector: { entity: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "card",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "tile", label: "Tile cards" },
              { value: "thermostat", label: "Thermostat cards" },
              { value: "humidifier", label: "Humidifier cards" },
              { value: "media-control", label: "Media player cards" },
            ],
          },
        },
      },
      { name: "tile_columns", selector: { number: { min: 1, max: 12, mode: "box" } } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "vertical", selector: { boolean: {} } },
      { name: "rest", selector: { boolean: {} } },
    ],
  },
];

Object.assign(LABELS, {
  badges: "Show the counters on top",
  show_total: "Count as active of total, e.g. 0/7",
  hide_empty_sections: "Hide sections with nothing in them",
  vertical: "Stack icon above name",
  rest: "Catch-all: everything not in an earlier section",
  card: "Card type",
  entities: "Entities (empty = everything that matches)",
});

class AreaDomainRoomEditor extends BaseEditor {
  constructor() {
    super();
    this._open = [];
  }

  _prepare() {
    if (!Array.isArray(this._config.sections)) this._config.sections = [];
    this._open.length = this._config.sections.length;
  }

  _sectionTitle(entry, i) {
    if (entry.section) return entry.title || `Own section ${i + 1}`;
    if (entry.title) return entry.title;
    if (this._hass) {
      const builtin = builtinTitle(this._hass, sectionKey(entry));
      if (builtin) return builtin;
      if (entry.domain || entry.device_class) return chipName(this._hass, chipFromConfig(entry));
    }
    if (entry.rest) return "Catch-all";
    return entry.key || `Section ${i + 1}`;
  }

  _render() {
    const root = this._startRender();
    const cfg = this._config;

    root.appendChild(
      this._makeForm(
        {
          areas: cfg.areas || [],
          columns: cfg.columns || 3,
          tile_columns: cfg.tile_columns || 6,
          badges: cfg.badges !== false,
          show_total: cfg.show_total !== false,
          features: cfg.features !== false,
          group_header: cfg.group_header !== false,
          sort_by_height: cfg.sort_by_height !== false,
          hide_empty_sections: cfg.hide_empty_sections !== false,
          groups: cfg.groups || "auto",
          exclude_keywords: cfg.exclude_keywords || [],
          include_keywords: cfg.include_keywords || [],
          include_hidden: !!cfg.include_hidden,
          include_diagnostic: !!cfg.include_diagnostic,
        },
        ROOM_SCHEMA,
        (value) => {
          cfg.areas = value.areas || [];
          cfg.columns = value.columns || 3;
          cfg.tile_columns = value.tile_columns || 6;
          cfg.badges = value.badges !== false;
          cfg.show_total = value.show_total !== false;
          cfg.features = value.features !== false;
          cfg.group_header = value.group_header !== false;
          cfg.sort_by_height = value.sort_by_height !== false;
          cfg.hide_empty_sections = value.hide_empty_sections !== false;
          cfg.groups = value.groups || "auto";
          cfg.exclude_keywords = value.exclude_keywords || [];
          cfg.include_keywords = value.include_keywords || [];
          cfg.include_hidden = !!value.include_hidden;
          cfg.include_diagnostic = !!value.include_diagnostic;
          this._emit();
        }
      )
    );

    this._heading(
      root,
      "Sections",
      cfg.sections.length
        ? "In this order. A section with the catch-all switch collects whatever the others left."
        : "Nothing configured, so the standard set is used: shortcuts, lights, covers, climate, media, other devices, sensors and a catch-all."
    );

    this._panelList(root, {
      items: cfg.sections,
      open: this._open,
      schema: ROOM_SECTION_SCHEMA,
      title: (entry, i) => this._sectionTitle(entry, i),
      data: (entry) => ({
        title: entry.title || "",
        icon: entry.icon || "",
        domain: entry.domain || "",
        device_class: entry.device_class || "",
        labels: entry.labels || [],
        entities: entry.entities || [],
        card: entry.card || "tile",
        tile_columns: entry.tile_columns,
        vertical: !!entry.vertical,
        rest: !!entry.rest,
      }),
      apply: (value, entry) => {
        // A hand-written `section:` keeps its cards; only its heading is edited.
        const next = entry.section ? { section: entry.section } : {};
        if (entry.key) next.key = entry.key;
        if (value.title) next.title = value.title;
        if (value.icon) next.icon = value.icon;
        if (entry.section) return next;

        if (value.domain) next.domain = value.domain;
        if (value.device_class) next.device_class = value.device_class;
        if (value.labels && value.labels.length) next.labels = value.labels;
        if (value.entities && value.entities.length) next.entities = value.entities;
        if (value.card && value.card !== "tile") next.card = value.card;
        if (value.tile_columns) next.tile_columns = value.tile_columns;
        if (value.vertical) next.vertical = true;
        if (value.rest) next.rest = true;
        return next;
      },
    });

    const addRow = document.createElement("div");
    addRow.className = "add-row";
    addRow.appendChild(
      this._button("+ Add section", () => {
        cfg.sections.push({ domain: "light" });
        this._open[cfg.sections.length - 1] = true;
        this._emit();
        this._render();
      })
    );
    if (!cfg.sections.length) {
      addRow.appendChild(
        this._button("+ Start from the standard set", () => {
          cfg.sections = JSON.parse(JSON.stringify(DEFAULT_ROOM_SECTIONS));
          this._emit();
          this._render();
        })
      );
    }
    root.appendChild(addRow);
  }
}

customElements.define("area-domain-room-strategy-editor", AreaDomainRoomEditor);

/* ================================================================== *
 * Registration
 * ================================================================== */

// The chip row is a badge. The strategy adds it to every view it generates,
// but listing it makes it available in the badge picker as well.
window.customBadges = window.customBadges || [];
window.customBadges.push({
  type: "area-domain-tab-chips",
  name: "Area Domain Tab Chips",
  description: "A chip per device type that navigates between the views of the tabs dashboard.",
  preview: false,
  documentationURL: "https://github.com/Gessink/area-domain-strategies",
});

console.info(
  `%c AREA-DOMAIN-STRATEGIES %c v${VERSION} `,
  "color:#fff;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:#fff;font-weight:700"
);
