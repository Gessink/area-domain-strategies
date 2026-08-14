# Area Domain Strategies

[![hacs][hacs-badge]][hacs-url]

Home Assistant dashboard strategies that build pages out of your areas and device types, using the same matching rules as [area-domain-chips][chips].

Everything they produce is a **native sections view**, so Home Assistant does the layout: `max_columns`, the responsive column count, the section grid, the tile cards. Nothing is reimplemented here.

- **`custom:area-domain-section`** generates one grid section: a device type across one or more areas, heading first, then a tile card per entity. Groups lead the list.
- **`custom:area-domain-areas`** generates a sections view: one section per area for a single device type.
- **`custom:area-domain-tabs`** generates one sections view with a chip per device type on top. Clicking a chip swaps what every section shows, through the URL hash.
- **`custom:area-domain-room`** generates a page for one room, or a combined set of rooms, with a section per kind of device: shortcuts, lights, covers, climate, media, other devices, sensors, and a catch-all that picks up whatever is left.

All three have a visual editor.

## Installation

HACS → three-dot menu → **Custom repositories** → `https://github.com/Gessink/area-domain-strategies`, category **Dashboard**. Install and reload your browser.

Manually: copy `dist/area-domain-strategies.js` to `<config>/www/` and add `/local/area-domain-strategies.js` as a JavaScript module under **Settings → Dashboards → Resources**.

## Tabs view

One view, one section per area, a chip per device type on top:

```yaml
views:
  - title: Huis
    strategy:
      type: custom:area-domain-tabs
      areas: [living_room, kitchen, bedroom, bathroom]
      chips:
        - domain: light
        - domain: cover
        - domain: climate
        - domain: media_player
        - domain: binary_sensor
          device_class: door
```

Leave `chips` out and the strategy detects which domains actually exist in the selected areas, in a sensible order.

The view is a plain Home Assistant sections view: `max_columns`, the responsive column count and the section grid are all its own. Clicking a chip sets the URL hash, so the tab is bookmarkable (`#covers`), the back button steps through the tabs, and a reload lands on the same one. Each chip shows how many of that type are currently active: `Lichten / 3 aan`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `areas` | list | all areas | Areas to show, in this order. |
| `area_groups` | list | `[]` | Areas that share one section. See [Combining areas](#combining-areas). |
| `chips` | list | auto-detected | One entry per tab. Takes `domain`, `device_class`, `label`, `name`, `icon`. |
| `columns` | number | `3` | `max_columns`: how many sections fit side by side. |
| `tile_columns` | number | `6` | Card width out of 12. `6` is two per row, `12` is full width. |
| `group_header` | boolean | `true` | Put a group covering the section on top, full width. See [Groups](#groups). |
| `sort_by_height` | boolean | `true` | Keep equally tall cards together. See [Card order](#card-order). |
| `hide_empty_areas` | boolean | `true` | Skip areas with no matching devices at all. |
| `show_counts` | boolean | `true` | Show how many are active under each chip. |
| `features` | boolean | `true` | Give tile cards their domain controls. |
| `groups` / `groups_first` | | | See [Groups](#groups). |
| `mode` | `all` \| `active` \| `inactive` \| `unavailable` | `all` | Which entities the sections list. |
| `exclude_*` / `include_*` | | | See the section options below. |

### Combining areas

Two areas can share one section:

```yaml
strategy:
  type: custom:area-domain-tabs
  areas: [living_room, kitchen, hallway, bedroom]
  area_groups:
    - areas: [living_room, kitchen]
      name: Beneden          # optional, defaults to "Woonkamer + Keuken"
      icon: mdi:sofa         # optional
```

Areas you leave out of `area_groups` keep a section of their own. A combined section takes the place of the first of its areas, so the order in `areas` still decides the layout. Works the same way on the areas view strategy.

## Room view

A page for one room. Everything below is the default, so this on its own is a working room page:

```yaml
views:
  - strategy:
      type: custom:area-domain-room
      areas: [living_room]
```

| Section | Contents |
| --- | --- |
| Shortcuts | Coloured buttons: turn every light in the room off, send the vacuum to this room, and one per scene assigned to the room |
| Lights | The covering group full width, then the lamps |
| Covers | Covers and valves |
| Climate | Thermostat cards for climate and water heaters |
| Laundry | A [WashData card][washdata-card] per WashData appliance in the room, when that card is installed |
| Media | Media players, as media control cards |
| Sensors | Temperature, humidity and air pressure, as sensor cards with a graph |
| Security | Alarm panels, locks, and the binary sensors that watch doors, windows, motion, smoke, gas, water and tampering |
| Other devices | Switches, fans, vacuums, mowers, sirens, humidifiers, remotes |
| Other | The catch-all: anything in the room the sections above did not take |

Sections with nothing in them are left out. The counters on top show active of total, so `0/7 aan` tells you there are seven lamps and none are on.

### The counters

They are their own list rather than one per section, because what you want a number for is not the same as how the page is divided up: doors, windows and motion each earn a counter even though all three live in the Security section below.

| Lights | Covers | Climate | Media | Doors | Windows | Motion | Switches |

A counter for something the room has none of is left out entirely, so an ordinary bedroom shows four and not eight. Replace the list with `badge_chips`, which takes the same matchers as a section:

```yaml
strategy:
  type: custom:area-domain-room
  areas: [living_room]
  badge_chips:
    - domain: light
    - domain: binary_sensor
      device_class: moisture
```

The catch-all is what keeps this maintainable: buy a device in a domain nobody thought of and it appears by itself instead of quietly going missing. It skips things that are not devices, scenes and scripts and automations and the like, and it also skips `sensor` and `binary_sensor`, because asking for three sensor classes and then getting every other one back under "Other" would defeat the point. Override the list with `exclude_domains` on the catch-all entry.

### Naming the view

The tab at the top of a dashboard is drawn from the **raw** view entry, before any strategy runs, so a `title` inside the `strategy:` block never reaches it. Home Assistant's own strategy documentation shows it in there, which is misleading. Put it one level up, next to `strategy:`:

```yaml
views:
  - title: Woonkamer
    icon: mdi:sofa
    path: woonkamer
    strategy:
      type: custom:area-domain-room
      areas: [living_room]
```

Used as a dashboard strategy the generated views *are* the config, so there `title`, `icon` and `path` on the strategy do work, and they default to the names of the areas and the icon of the first one. `title: false` and `icon: false` leave them off.

### Sensors

Only temperature, humidity and air pressure by default, drawn as [sensor cards](https://www.home-assistant.io/dashboards/sensor/) so you get the last day as a line under the value. `sensors: all` widens it to every sensor and binary sensor in the room, and a section of your own can filter however you like:

```yaml
strategy:
  type: custom:area-domain-room
  areas: [living_room]
  sensors: all
```

A sensor with no unit, or one whose state is not a number, falls back to a tile: there is nothing to graph.

### Companion cards

Some rooms deserve a card from another repository. A section can name one, and it appears only when that card is actually installed and the room actually has a device for it, so a room page never shows "custom element doesn't exist":

```yaml
- key: washdata
  companion: washdata
  card_options:
    log: 3          # passed straight to the card
```

Right now `washdata` is the one on offer, for [WashData Card][washdata-card]: one card per WashData appliance in the room, full width, placed after the thermostats. Installed is checked against the custom element and the card registry, the device against the entity registry's `platform`. With one appliance the heading is its name; with several it is the card's own name.

The card speaks for the whole appliance, so **every entity on that device is taken off the rest of the page**: its maintenance switch does not turn up again under other devices, nor its buttons under the catch-all. The lifetime energy total is switched off here too, since it says little next to a running cycle; `card_options: {show_energy: true}` puts it back.

It sits in the default set already, so a room with a washing machine gets it and every other room does not notice.

More generally, sections are now first-come: an entity an earlier section took does not appear again in a later one.

### Your own sections

`sections` replaces the default list. Each entry is either a generated section or one of your own, and they keep the order you write them in:

```yaml
strategy:
  type: custom:area-domain-room
  areas: [living_room]
  sections:
    - section:                       # passed through untouched
        type: grid
        cards:
          - type: button
            name: Bioscoop
            icon: mdi:movie-open
            tap_action: { action: perform-action, perform_action: script.cinema }
    - key: shortcuts
      buttons:
        - lights_off                 # the built-ins, in the order you want
        - scenes
        - name: Film                 # or your own, with icon and action
          icon: mdi:movie
          service: script.film
    - domain: light
      title: Verlichting             # override the heading
    - domain: climate
      card: thermostat
    - domain: sensor
      vertical: true
      tile_columns: 4                # three per row
    - labels: [favoriet]             # any matcher the other strategies take
      title: Favorieten
    - rest: true
```

| Section option | Description |
| --- | --- |
| `section` | A section config passed through as-is. Only its position is managed. |
| `key` | `shortcuts` for the shortcut buttons; otherwise just an identifier used for the badge. |
| `title` / `icon` | Override the heading. Empty means the translated domain or device class name. |
| `domain` / `domains`, `device_class`, `label` / `labels`, `entities` | What the section matches, the same keys as everywhere else. |
| `card` | `tile` (default), `thermostat`, `humidifier`, `media-control` or `sensor` (a graph under the value). The first four take the full section width unless `tile_columns` says otherwise. |
| `tile_columns` | Card width out of 12 for this section only. |
| `vertical` | Stack the tile's icon above its name. |
| `rest` | Make this the catch-all. It always runs last, wherever you put it. |
| `buttons` | Shortcuts only. Strings `lights_off`, `vacuum`, `scenes`, or an object with `name`, `icon`, `color` and `tap_action` / `service` / `entity`. |

### The shortcut buttons

Home Assistant's own button card has no colour option, and the tile card only colours itself while its entity is active, which a "turn everything off" button never is. So the shortcuts use `custom:area-domain-button`, a small card this repo ships:

```yaml
- key: shortcuts
  buttons:
    - lights_off                 # amber
    - vacuum                     # teal
    - scenes                     # purple
    - name: Film
      icon: mdi:movie
      color: deep-purple
      service: script.film
```

`color` takes the same values as everywhere else: a Home Assistant theme colour name or any CSS colour. The background is solid and the text picks black or white to stay readable on the theme colours; `text_color` overrides that, and `fill: false` gives the tinted look with a coloured icon instead. `lights_off_color`, `vacuum_color` and `scene_color` on the shortcuts entry recolour the built-ins, and `button_columns` / `button_rows` change how big they are.

You can also use the card by itself, anywhere:

```yaml
type: custom:area-domain-button
icon: mdi:party-popper
name: Feest
color: pink
tap_action:
  action: perform-action
  perform_action: script.party
```

### The vacuum button

Home Assistant 2026.3 added [`vacuum.clean_area`][clean-area], which sends a robot to the areas you already have instead of to vendor segment numbers.

Nothing about this is configured. Every entity in the `vacuum` domain is checked for the `CLEAN_AREA` feature in its `supported_features`, and the ones that have it become the target, wherever in the house they happen to dock: a robot is rarely parked in the room you are sending it to. The room the page is about goes in as `cleaning_area_id`. So on a living room page with one capable robot the button ends up calling:

```yaml
action: vacuum.clean_area
target:
  entity_id: <your capable vacuums, detected>
data:
  cleaning_area_id: [living_room]
```

A robot can only be sent to a room it has a **segment mapped to**, under *Map vacuum segments to areas* in the vacuum's entity settings. Rooms without one get no button at all: `vacuum.clean_area` would only answer `areas_not_mapped`, and quietly starting a whole-house run instead would be a nasty surprise from a button that says "clean this room". That mapping lives in the entity registry rather than in the state, so it is read once per page through `config/entity_registry/get_entries`. If that lookup cannot be answered the button is left alone rather than hidden on a guess.

With more than one capable robot they all get the call. Pin it to one with `vacuum_entity` on the shortcuts entry:

```yaml
- key: shortcuts
  vacuum_entity: vacuum.downstairs   # optional, only when you have several
  buttons: [lights_off, vacuum, scenes]
```

If no vacuum in the house supports area cleaning at all, the button falls back to `vacuum.start` on the vacuums in the room, which is a full run. In that case a custom button pointed at your own script is the better answer.

[clean-area]: https://www.home-assistant.io/actions/vacuum.clean_area/

## Areas view

One view, one device type, a section per area:

```yaml
views:
  - title: Verlichting
    strategy:
      type: custom:area-domain-areas
      domain: light
      columns: 3
```

Takes the same options as a section, plus `columns` for `max_columns`.

## Section strategy

Add a section to a `sections` view and give it a strategy instead of a card list:

```yaml
views:
  - type: sections
    sections:
      - strategy:
          type: custom:area-domain-section
          areas: [living_room]
          domain: light
      - strategy:
          type: custom:area-domain-section
          areas: [living_room, kitchen, hallway]
          domain: binary_sensor
          device_class: door
          title: Deuren beneden
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `areas` | list | all areas | Area ids to include. |
| `domain` / `domains` | string / list | – | Match one or more domains. |
| `device_class` / `device_classes` | string / list | – | Match on device class. |
| `label` / `labels` | string / list | – | Match on label: entity, device and area labels all count. |
| `title` | string / `false` | translated | The heading. `false` leaves it out. |
| `icon` | string | per domain | Heading icon. |
| `heading_style` | `title` \| `subtitle` | `title` | Passed to the heading card. |
| `mode` | `all` \| `active` \| `inactive` \| `unavailable` | `all` | Which entities to list. |
| `groups` | `auto` \| `strict` \| `exclude` \| `include` | `auto` | See [Groups](#groups). |
| `groups_first` | boolean | `true` | Put group entities at the top of the list. |
| `features` | boolean | `true` | Give the tile cards their domain controls. |
| `column_span` | number | – | Section width in the view grid. |
| `hide_when_empty` | boolean | `true` | Emit an empty section when nothing matches. |
| `exclude_areas` | list | `[]` | Area ids to skip. |
| `exclude_entities` | list | `[]` | Entity ids to skip. |
| `exclude_keywords` | list | `[]` | Skip entities whose id or name contains any of these. |
| `include_keywords` | list | `[]` | Only include entities whose id or name contains one of these. |
| `include_hidden` | boolean | `false` | Include entities hidden in the registry. |
| `include_diagnostic` | boolean | `false` | Include diagnostic and config entities. |

Without a `title`, the heading is the translated, pluralised device class or domain name, with the area appended when exactly one area is selected: `Lichten · Woonkamer`.

## Room section

A room's overview card: an [area-section-header](https://github.com/Gessink/area-domain-chips#area-section-header) followed by a hand-picked list of entities, each drawn as a tile with the right controls for its domain.

Unlike the section strategy above, this one never decides *which* entities show up, only how each one is drawn. That is the point: a room overview is usually curated on purpose, one thermostat instead of five radiator valves, a light group instead of every bulb, a specific speaker instead of every media player integration happens to expose, so the entity list stays explicit while the boilerplate (features, icon, tap actions) goes away.

```yaml
views:
  - type: sections
    sections:
      - strategy:
          type: custom:area-room-section
          area: keuken
          entities:
            - entity: light.lamp_keuken_plafond
              name: Plafondlamp
            - entity: light.lamp_keuken_aanrecht
              name: Aanrecht
            - entity: climate.keuken
              name: Verwarming
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `area` | string / list | – | Passed straight through to the header's `area`. |
| `entities` | list | `[]` | Entity ids, or objects with the options below. A plain string is the same as `{ entity: "..." }`. |
| `header` | object / `false` | `{}` | Extra options merged onto the generated `custom:area-section-header` (e.g. `tap_action`). `false` leaves the header out entirely. |
| `tile_columns` | number | `6` | Grid width for tiles that are not full width. |

Per-entity options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | – | Required. |
| `name` | string | entity's own name | Label override. |
| `icon` | string | domain default, else Home Assistant's own | `climate` defaults to `mdi:radiator`; every other domain is left to Home Assistant. Not used for `media_player`, see below. |
| `features` | list | auto-detected | Overrides feature detection entirely, same shape as a native tile card's `features`. Not used for `media_player`, see below. |
| `inline` | boolean | `true` | Home Assistant's own tile card default, several to a row. Set `false` to give a thermostat dial or a media player with artwork the section's full width instead. |
| anything else (`tap_action`, `icon_tap_action`, `state_content`, `features_position`, `vertical`, `color`, ...) | – | – | Any option not listed above is passed straight through to the card as-is. |

### Media players

`media_player` is the one domain that does not become a tile. A native tile spends one full row per feature, so a media player wanting both playback buttons and a volume slider ends up noticeably taller than before; there is no way to fit both into a single compact row the way a purpose-built media player card can. So `media_player` entries render as [`custom:mushroom-media-player-card`](https://github.com/piitaya/lovelace-mushroom) instead:

```yaml
entities:
  - entity: media_player.living_room_speaker
    name: Speakers
  - entity: media_player.bedroom_alarm_clock
    name: Alarm clock
    collapsible_controls: false
```

By default this asks for every `volume_controls` and `media_controls` value Mushroom knows (`volume_mute`/`volume_set`/`volume_buttons`, `on_off`/`shuffle`/`previous`/`play_pause_stop`/`next`/`repeat`), plus `use_media_info`, `show_volume_level`, `icon_type: entity-picture`, `fill_container: false`, and a `card_mod` that keeps a disabled icon in step with the tile colour theme. Mushroom itself filters both control lists down to whatever the entity's `supported_features` actually allows (`isVolumeControlVisible()` and its media_controls equivalent both gate this), so this is the same "derive from what the entity supports" approach the rest of the strategy already uses for lights, covers and climate, not a fixed guess. Pass a narrower `volume_controls`/`media_controls` to hide a control the entity can do but you don't want shown, and anything Mushroom-specific (`collapsible_controls`, `card_mod`, ...) overrides the default the same way `tap_action` does for a tile.

`volume_controls`, `media_controls`, `collapsible_controls`, `card_mod`, and every other Mushroom option pass straight through the same way `tap_action` does for a tile, since they are not this strategy's business either. This requires the Mushroom cards integration installed via HACS; without it a `media_player` entry shows Home Assistant's "custom element doesn't exist" placeholder instead of a card.

Feature detection reuses the same rules as every other card in this file (see [Tile card features](#tile-card-features)), except `climate` only ever gets `target-temperature`, never the mode selector, since a room overview wants a quick nudge to the target, not a mode switcher. `media_player` does not go through feature detection at all, see below.

## How the tabs work

Home Assistant strategies generate their config once and do not re-run on a click, and native `visibility` only takes the conditions Home Assistant knows: `state`, `numeric_state`, `screen`, `user`. There is no URL condition, so hash-driven tabs cannot be expressed in a native `visibility` block. Cards that work this way, Bubble Card for instance, read the hash in their own code.

So the strategy generates every tab's cards up front and wraps each one in a `custom:area-domain-hash-card`. That wrapper renders its card only while the hash matches, and builds the inner card lazily the first time it is needed. Everything around the wrappers is native: the view, the sections, `max_columns`, the 12 column grid, and the tile cards themselves.

One caveat worth knowing. A hidden element keeps its slot in a CSS grid, so collapsing only the wrapper would leave a hole where the card was. The wrapper therefore also collapses the grid item Home Assistant put around it, and once none of a section's cards are showing it collapses that section's grid item too, so an area with nothing on the active tab leaves no gap. Finding those items means climbing out of single-child wrappers until the parent is the grid itself, stopping at Home Assistant's `container` class. Every step is guarded: if a future release changes that shape, the tabs keep working and the worst case is a gap in the layout.

`grid_options` on the wrappers keeps the sizing native: `columns: full` for the area heading and the covering group, `tile_columns` for the tiles.

## Where is the editor?

Home Assistant offers a strategy editor for **dashboard** strategies. Its edit-view dialog does not do the same for view strategies, so `custom:area-domain-tabs` is registered both ways and the dashboard form is the one with a UI:

1. **Settings → Dashboards → Add dashboard → New dashboard from scratch**, open it
2. Pencil → three-dot menu → **Raw configuration editor**, and put in:
   ```yaml
   strategy:
     type: custom:area-domain-tabs
   ```
3. Save. From now on, pencil → the gear icon opens the editor: area pickers, combined areas, tabs, columns, all of it.

Inside an existing dashboard you can still use it as a view strategy (`views: - strategy: ...`), but there you configure it in YAML.

## Groups

Group helpers expose their members in the `entity_id` attribute. `groups` decides what happens to them, exactly as in [area-domain-chips][chips]:

| Value | Behaviour |
| --- | --- |
| `auto` (default) | Drop a group as soon as one member is listed separately, because from there on it is a duplicate. |
| `strict` | Drop a group only when every member is listed separately. |
| `exclude` | Never list group entities. |
| `include` | List groups like any other entity. |

`groups_first: true` puts whichever groups survive at the top of the list.

### The covering group

A group that `auto` or `strict` dropped from the list is not thrown away: if it **covers the whole section**, it comes back on top as a **full width** card, above the individual devices. So an area with a "Slaapkamer lampen" group gets that group as a master control across the section, with the individual lamps in two columns below it, and the group is never counted twice.

Covering means every device shown in that section is a member of the group, unavailable ones included. Groups inside groups count: a bedroom group that lists a nightstand group rather than the two lamps in it still covers them, because membership is followed all the way down. A group over half the lamps is not a master control, so it stays out, and under `auto` it was already dropped from the list, so it simply does not appear.

At most one group gets the spot. When several cover the section, the tightest one wins, so a per-area group beats a house-wide one. With combined areas a group only qualifies if it covers the devices of every area in the merged section.

Set `group_header: false` to leave those groups out entirely, or `groups: include` to list them as ordinary tiles instead.

## Card order

A tile grows a row per feature, so a light with a brightness slider and a colour temperature slider is taller than a plain on/off switch. Mixed heights side by side leave ragged holes down a column, so cards are ordered by height first: the tallest tiles at the top of the section, the plain ones at the bottom, alphabetically within each height.

The full order is: the covering group, then tall to short, then by name. Set `sort_by_height: false` for plain alphabetical order, or `groups_first: false` to stop groups being pulled to the front.

## Tile card features

| Domain | Features, when the entity supports them |
| --- | --- |
| `light` | brightness slider, colour temperature |
| `cover` | open/stop/close, position slider |
| `valve` | open/close |
| `fan` | speed |
| `climate` | target temperature, HVAC modes |
| `water_heater` | target temperature |
| `humidifier` | toggle, target humidity |
| `media_player` | volume slider |
| `lock` | lock and unlock |
| `vacuum` | start/pause, stop, return home |
| `lawn_mower` | start/pause, dock |
| `update` | update actions |

Everything is read from `supported_features` and `supported_color_modes`, so a non-dimmable light gets a plain tile and a cover without position support gets buttons but no slider. Set `features: false` for bare tiles.

## Notes

- Requires Home Assistant 2024.11 or newer for section strategies and the heading card.
- Home Assistant plugins cannot depend on each other at runtime, so the matching, group and translation rules are a copy of the ones in [area-domain-chips][chips] rather than a shared import. The two are kept in step by hand.
- Installing this alongside area-domain-chips is fine; they register different elements.

## License

MIT

[chips]: https://github.com/Gessink/area-domain-chips
[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
[hacs-url]: https://github.com/hacs/integration

[washdata-card]: https://github.com/Gessink/WashData-card
