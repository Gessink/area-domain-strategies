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
| Shortcuts | A button to turn every light in the room off, one to send the vacuum to this room, and the scenes assigned to the room |
| Lights | The covering group full width, then the lamps |
| Covers | Covers and valves |
| Climate | Thermostat cards for climate and water heaters |
| Media | Media players |
| Other devices | Switches, fans, vacuums, locks, mowers, sirens, humidifiers, remotes |
| Sensors | Sensors and binary sensors, as vertical tiles |
| Other | The catch-all: anything in the room the sections above did not take |

Sections with nothing in them are left out. The counters on top show active of total, so `0/7 aan` tells you there are seven lamps and none are on.

The catch-all is what keeps this maintainable: buy a device in a domain nobody thought of and it appears by itself instead of quietly going missing. It skips things that are not devices, scenes and scripts and automations and the like; override that with `exclude_domains` on the catch-all entry.

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
| `card` | `tile` (default), `thermostat` or `humidifier`. |
| `tile_columns` | Card width out of 12 for this section only. |
| `vertical` | Stack the tile's icon above its name. |
| `rest` | Make this the catch-all. It always runs last, wherever you put it. |
| `buttons` | Shortcuts only. Strings `lights_off`, `vacuum`, `scenes`, or an object with `name`, `icon` and `tap_action` / `service` / `entity`. |

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

With more than one capable robot they all get the call. Pin it to one with `vacuum_entity` on the shortcuts entry:

```yaml
- key: shortcuts
  vacuum_entity: vacuum.downstairs   # optional, only when you have several
  buttons: [lights_off, vacuum, scenes]
```

If no vacuum supports area cleaning, the button falls back to `vacuum.start` on the vacuums in the room, which is a full run. In that case a custom button pointed at your own script is the better answer.

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

Covering means every device shown in that section is a member of the group, unavailable ones included. A group over half the lamps is not a master control, so it stays out, and under `auto` it was already dropped from the list, so it simply does not appear.

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
