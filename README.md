# Area Domain Strategies

[![hacs][hacs-badge]][hacs-url]

Two Home Assistant dashboard strategies that build pages out of your areas and device types, using the same matching rules as [area-domain-chips][chips].

- **`custom:area-domain-section`** generates a native grid section: one device type across one or more areas, with a heading and a Home Assistant tile card per entity. Groups come first in the list.
- **`custom:area-domain-tabs`** generates a whole page: a chip per device type at the top that works as tabs, and below it one section per area showing that device type's tile cards. The active tab lives in the URL hash, so it survives a reload and works with the browser's back button.

Tile cards get the controls that fit them: a brightness slider for dimmable lights, open/stop/close plus a position slider for covers, target temperature and HVAC modes for thermostats, a volume slider for media players, and so on.

## Installation

### HACS

1. HACS → three-dot menu → **Custom repositories**
2. Add `https://github.com/Gessink/area-domain-strategies`, category **Dashboard**
3. Install, then reload your browser (Ctrl+F5)

### Manual

Copy `dist/area-domain-strategies.js` to `<config>/www/` and add it under **Settings → Dashboards → Resources** as a JavaScript module pointing at `/local/area-domain-strategies.js`.

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
          areas: [living_room]
          domain: cover
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

## Tabs page strategy

Give a whole view over to the strategy:

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

Leave `chips` out and the strategy detects which domains actually exist in the selected areas and offers those, in a sensible order.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `areas` | list | all areas | Areas to show, in this order. |
| `chips` | list | auto-detected | One entry per tab. Takes the same `domain`, `device_class`, `label`, `name` and `icon` keys as a section. |
| `columns` | number | `2` | Tile cards per row inside an area. |
| `features` | boolean | `true` | Give the tile cards their domain controls. |
| `groups` / `groups_first` | | | As above. |
| `hide_empty_areas` | boolean | `true` | Skip areas with no devices of the active type. |
| `show_counts` | boolean | `true` | Show how many are active under each tab name. |
| `exclude_*` / `include_*` | | | As above. |

Each chip shows the device type and how many of them are currently active, so `Lichten / 3 aan` while you are on the covers tab.

### How the tabs work

Home Assistant strategies generate their config once, when the dashboard loads; they do not re-run when you click something. Native section `visibility` can hide and show, but only on conditions Home Assistant knows: `state`, `numeric_state`, `screen`, `user`. There is no URL or hash condition, so hash-driven tabs cannot be expressed in native sections. Other cards that work this way, Bubble Card for instance, do the hash matching inside their own card code.

So the view strategy hands the page to one card, `custom:area-domain-tabs-card`, which renders the tab chips, an area heading per area and real Home Assistant tile cards underneath. The cards are created through `loadCardHelpers()`, so they are the same `hui-tile-card` elements Home Assistant would build itself: same look, same features, same more-info dialogs.

What you give up compared to native sections is editing the page in the UI, which a strategy-generated view does not offer anyway. What you get is a tab switch with no helper entity, no page reload, a bookmarkable `#covers` URL and a working back button.

If you would rather have native sections, use the section strategy and put one section per area in a normal `sections` view.

You can also use the card directly, without the strategy:

```yaml
type: custom:area-domain-tabs-card
areas: [living_room, kitchen]
chips:
  - domain: light
  - domain: cover
```

## Groups

Group helpers expose their members in the `entity_id` attribute. `groups` decides what happens to them, exactly as in [area-domain-chips][chips]:

| Value | Behaviour |
| --- | --- |
| `auto` (default) | Drop a group as soon as one member is listed separately, because from there on it is a duplicate. |
| `strict` | Drop a group only when every member is listed separately. |
| `exclude` | Never list group entities. |
| `include` | List groups like any other entity. |

`groups_first: true` puts whichever groups survive at the top of the list, above the individual devices they control. Combine `groups: include` with `groups_first: true` when you want the group as a master control above its members.

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
