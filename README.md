# Area Domain Strategies

[![hacs][hacs-badge]][hacs-url]

Home Assistant dashboard strategies that build pages out of your areas and device types, using the same matching rules as [area-domain-chips][chips].

Everything they produce is a **native sections view**, so Home Assistant does the layout: `max_columns`, the responsive column count, the section grid, the tile cards. Nothing is reimplemented here.

- **`custom:area-domain-section`** generates one grid section: a device type across one or more areas, heading first, then a tile card per entity. Groups lead the list.
- **`custom:area-domain-areas`** generates a sections view: one section per area for a single device type.
- **`custom:area-domain-tabs`** generates one sections view with a chip per device type on top. Clicking a chip swaps what every section shows, through the URL hash.

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

A group that `auto` or `strict` dropped from the list is not thrown away: if its members overlap what the section shows, it comes back on top of that section as a **full width** card, above the individual devices. So an area with a "Slaapkamer lampen" group gets that group as a master control across the section, with the individual lamps in two columns below it, and the group is never counted twice.

With combined areas the same applies: a group covering the lamps of either area shows up on top of the merged section.

Set `group_header: false` to leave those groups out entirely, or `groups: include` to list them as ordinary tiles instead.

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
