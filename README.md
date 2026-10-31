# COMMON

A community resource guide for Suwanee and Gwinnett County, rebuilt with plain HTML, CSS, and JavaScript.

## Open the website

On this computer, double-click **Start website.cmd**, then open **http://127.0.0.1:4173**. Keep the server window open while viewing the site. Node.js is required to use the launcher. If that address is already serving COMMON, you can use it directly.

For hosting, upload the HTML, CSS, JavaScript, `assets`, and `Website Info_Data` folders to any static web host. There is no installation, account, API key, or build step required to run the website.

## What’s included

- A continuously rotating Earth drawn from actual geographic data, with pause/resume and reduced-motion support.
- A real Leaflet/OpenStreetMap directory map with category icons and resource popups.
- All 100 original resources, search with common synonyms, eight categories, sorting, and more-results controls.
- Saved resources stored on the visitor’s device.
- Resource details with source links, phone links, address directions, eligibility, and information notes.
- A local suggestion form with an optional email draft and JSON download. Email is opened only when the visitor clicks its button; nothing is automatically sent.
- Consistent home, directory, story, contact, and suggestion pages, plus the old homepage URL as a compatibility redirect.

## Edit the catalog

Edit `resources-data.js`. Keep IDs unique and use `resource-template.json` as a field reference. Search includes the name, category, description, address, audience, services, and tags. Only records with finite coordinates and an `Exact ...` or `Hosted at ...` location description appear on the map. Service-area coordinates are intentionally excluded. Project data has not been independently reverified; each detail panel carries its original source notes.

## Maps and third-party assets

Leaflet 1.9.4, D3 7.9.0, and TopoJSON Client 3.1.0 are bundled under `assets/vendor`, with their licenses. World Atlas 2.0.2 supplies Natural Earth geographic data. DM Sans loads from Google Fonts, with a system font fallback. No generated imagery is used.

The real map needs an internet connection for map tiles. Globe rendering uses bundled geography and does not request moving map tiles. OpenStreetMap’s public tile service is intended for ordinary interactive viewing, has no API key, and offers best-effort availability. Do not add offline tile downloads or automatic tile prefetching. Before substantial traffic, review the tile policy and select suitable hosting for tiles if needed.

- https://leafletjs.com
- https://operations.osmfoundation.org/policies/tiles/
- https://www.openstreetmap.org/copyright
- https://www.naturalearthdata.com/about/terms-of-use/
- https://github.com/topojson/world-atlas

## Privacy

Saved resources and suggestions use localStorage in the current browser and site origin. They do not sync across devices. Suggestions can be removed from their detail panel. The website does not request geolocation or include analytics. Map tiles and fonts are fetched directly from their respective providers.
