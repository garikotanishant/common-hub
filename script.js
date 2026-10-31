/* Shared navigation, local collections, and the directory. No build step needed. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;
  const categories = [
    { name: "Government", label: "City services", icon: "building" },
    { name: "Public Safety", label: "Public safety", icon: "shield" },
    { name: "Parks and Outdoors", label: "Parks & outdoors", icon: "tree" },
    { name: "Education", label: "Schools & learning", icon: "book" },
    { name: "Health and Human Services", label: "Care & support", icon: "heart" },
    { name: "Transit and Travel", label: "Getting around", icon: "bus" },
    { name: "Utilities and Infrastructure", label: "Utilities", icon: "bolt" },
    { name: "Community Life", label: "Community life", icon: "people" },
  ];
  const category = (name) =>
    categories.find((item) => item.name === name) || { label: name, icon: "pin" };
  const storage = {
    read(key, fallback = []) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        return Array.isArray(value) ? value : fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
  const savedKey = "common.savedResources.v1";
  const suggestionsKey = "common.customResources.v1";
  const raw = Array.isArray(window.COMMON_RESOURCE_RECORDS) ? window.COMMON_RESOURCE_RECORDS : [];
  const local = storage
    .read(suggestionsKey)
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        /^suwanee-custom-\d+$/.test(item.id) &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        categories.some((c) => c.name === item.category),
    )
    .map((item) => ({ ...item, lat: null, lng: null, verificationStatus: "needs-review" }));
  const records = [...raw, ...local];
  const byId = new Map(records.map((item) => [item.id, item]));
  let saved = new Set(
    storage.read(savedKey).filter((id) => typeof id === "string" && byId.has(id)),
  );
  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const safeURL = (value) => {
    if (typeof value !== "string") return "";
    if (value.startsWith("Website%20Info%3AData/") || value.startsWith("Website%20Info_Data/"))
      return "Website%20Info_Data/" + value.split("/").pop();
    try {
      const u = new URL(value);
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  };
  const mapped = (record) =>
    Number.isFinite(record.lat) &&
    Number.isFinite(record.lng) &&
    Math.abs(record.lat) <= 90 &&
    Math.abs(record.lng) <= 180 &&
    /^(Exact |Hosted at )/.test(record.locationPrecision || "");
  const directions = (record) =>
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(record.address || record.name);
  let toastTimer;
  function toast(message) {
    const box = $("#toast");
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (box.hidden = true), 3200);
  }
  function updateSaved() {
    $$(".saved-count").forEach((el) => (el.textContent = saved.size));
    $$("[data-save]").forEach((button) => {
      const active = saved.has(button.dataset.save);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute(
        "aria-label",
        `${active ? "Unsave" : "Save"} ${byId.get(button.dataset.save)?.name || "resource"}`,
      );
      if (button.classList.contains("button"))
        button.innerHTML = icon("bookmark") + (active ? " Saved resource" : " Save resource");
    });
  }
  function toggleSaved(id) {
    if (!byId.has(id)) return;
    const next = new Set(saved);
    const removing = next.has(id);
    removing ? next.delete(id) : next.add(id);
    if (!storage.write(savedKey, [...next])) {
      toast("Your browser couldn’t save this. Check your storage settings.");
      return;
    }
    saved = next;
    updateSaved();
    toast(
      removing ? "Removed from your saved resources." : "Saved. Find it under Saved at the top.",
    );
    if (state?.savedOnly) renderResults();
  }
  $(".menu-button")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const menu = $("#mobile-menu");
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
    button.setAttribute("aria-label", menu.hidden ? "Open menu" : "Close menu");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#mobile-menu")?.hidden) {
      $("#mobile-menu").hidden = true;
      $(".menu-button").setAttribute("aria-expanded", "false");
      $(".menu-button").focus();
    }
  });
  $$(".category-count").forEach((el) => {
    const count = records.filter((r) => r.category === el.dataset.categoryCount).length;
    el.textContent = `${count} ${count === 1 ? "resource" : "resources"} to explore`;
  });
  const favorites = [
    ["town-center-park", "Town Center Park", "A little green space. A lot of possibility."],
    ["suwanee-library", "Suwanee Branch Library", "Your next chapter starts here."],
    ["suwanee-planning", "Suwanee City Hall", "A starting point for everyday city services."],
  ];
  if ($("#home-favorites"))
    $("#home-favorites").innerHTML = favorites
      .map(([id, title, desc]) => {
        const r = byId.get(id);
        return r
          ? `<article class="favorite-row"><span class="favorite-icon">${icon(category(r.category).icon)}</span><div class="favorite-copy"><p class="eyebrow">${escape(category(r.category).label)}</p><h3>${escape(title)}</h3><p>${escape(desc)}</p></div><button class="favorite-open" data-detail="${escape(id)}" aria-label="View ${escape(title)}">${icon("arrow")}</button></article>`
          : "";
      })
      .join("");
  let lastDetailTrigger;
  const dialog = $("#resource-dialog");
  function openDetail(id, trigger) {
    const r = byId.get(id);
    if (!r || !dialog) return;
    lastDetailTrigger = trigger || document.activeElement;
    const source = safeURL(r.sourceUrl);
    const phone = String(r.phone || "").match(
      /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
    )?.[0];
    const address = r.address && r.address !== "Not provided";
    $("#resource-detail").innerHTML =
      `<p class="detail-category">${icon(category(r.category).icon)} ${escape(category(r.category).label)}</p><h2 id="detail-title">${escape(r.name)}</h2><p class="detail-description">${escape(r.description)}</p><div class="detail-actions"><button class="button button-outline" data-save="${escape(r.id)}" aria-pressed="${saved.has(r.id)}">${icon("bookmark")} Save resource</button>${phone ? `<a class="button button-dark" href="tel:${phone.replace(/[^\d+]/g, "")}">${icon("phone")} Call</a>` : ""}${address ? `<a class="button button-outline" href="${escape(directions(r))}" target="_blank" rel="noopener">${icon("pin")} Directions</a>` : ""}</div><div class="detail-info"><p><strong>Address / service area</strong>${escape(r.address || "See official source")}</p><p><strong>Hours</strong>${escape(r.hours || "Check with the organization")}</p>${r.phone ? `<p><strong>Contact</strong>${escape(r.phone)}</p>` : ""}<p><strong>Location information</strong>${escape(r.locationPrecision || "Community suggestion; not mapped")}</p></div>${[
        ["Who it’s for", r.audience],
        ["Before you go", r.requirements],
        ["Services & programs", r.utility],
        ["Good to know", r.features],
      ]
        .filter(([, value]) => value)
        .map(
          ([title, value]) =>
            `<section class="detail-section"><h3>${title}</h3><p>${escape(value)}</p></section>`,
        )
        .join(
          "",
        )}<section class="detail-section"><h3>Source & information notes</h3><p class="verification-note">${escape(r.verificationNotes || "Community suggestion saved in this browser. Confirm details with the organization before visiting.")}</p>${source ? `<a class="text-link" href="${escape(source)}" target="_blank" rel="noopener">${source.startsWith("http") ? "Open the source" : "View project source (PDF)"} ${icon("external")}</a>` : ""}<p>${escape(r.sourceType || "Community suggestion")}</p></section>`;
    if (r.verificationStatus === "needs-review") {
      const section = document.createElement("section");
      section.className = "detail-section";
      const remove = document.createElement("button");
      remove.className = "quiet-link";
      remove.textContent = "Remove this suggestion from this browser";
      remove.addEventListener("click", () => {
        const entries = storage.read(suggestionsKey).filter((item) => item?.id !== r.id);
        if (!storage.write(suggestionsKey, entries)) {
          toast("Your browser couldn’t remove this suggestion.");
          return;
        }
        saved.delete(r.id);
        storage.write(savedKey, [...saved]);
        location.reload();
      });
      section.append(remove);
      $("#resource-detail").append(section);
    }
    updateSaved();
    if (!dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    }
  }
  function closeDetail() {
    dialog?.close();
  }
  dialog?.addEventListener("close", () => {
    document.body.style.overflow = "";
    if (lastDetailTrigger?.isConnected) lastDetailTrigger.focus({ preventScroll: true });
  });
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        closeDetail();
    }
  });
  $("[data-close-dialog]")?.addEventListener("click", closeDetail);
  document.addEventListener("click", (event) => {
    const save = event.target.closest("[data-save]");
    if (save) {
      toggleSaved(save.dataset.save);
      return;
    }
    const detail = event.target.closest("[data-detail]");
    if (detail) {
      openDetail(detail.dataset.detail, detail);
      return;
    }
    const locate = event.target.closest("[data-locate]");
    if (locate) {
      locateResource(locate.dataset.locate);
      return;
    }
    if (event.target.closest("[data-clear-filters]")) {
      state.query = "";
      state.category = "";
      state.savedOnly = false;
      $("#resource-search").value = "";
      renderResults();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === savedKey) {
      saved = new Set(storage.read(savedKey).filter((id) => byId.has(id)));
      updateSaved();
      if (state?.savedOnly) renderResults();
    }
  });
  let state = null;
  let map,
    markerLayer,
    markers = new Map(),
    filtered = [],
    limit = 12;
  const params = new URLSearchParams(location.search);
  function createMap(element, home = false) {
    if (!window.L) return null;
    const map = L.map(element, {
      zoomControl: !home,
      scrollWheelZoom: false,
      dragging: !home,
      touchZoom: !home,
      doubleClickZoom: !home,
      boxZoom: !home,
      keyboard: !home,
      attributionControl: true,
      zoomAnimation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    }).setView([34.0495, -84.0665], home ? 13 : 12);
    if (!home) map.zoomControl.setPosition("topright");
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (!home) {
      let errors = 0;
      tiles.on("tileerror", () => {
        errors++;
        if (errors > 2) $("#map-error").hidden = false;
      });
      tiles.on("tileload", () => {
        $("#map-error").hidden = true;
        errors = 0;
      });
    }
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>',
    );
    return map;
  }
  function fitMap() {
    if (!map) return;
    const points = filtered.filter(mapped).map((r) => [r.lat, r.lng]);
    if (points.length) map.fitBounds(points, { padding: [48, 48], maxZoom: 14, animate: false });
    else map.setView([34.0515, -84.0713], 12, { animate: false });
  }
  function updateMap() {
    const points = filtered.filter(mapped);
    $("#map-count").textContent =
      `${points.length} mapped ${points.length === 1 ? "place" : "places"} · Suwanee & Gwinnett`;
    if (!map) return;
    markerLayer.clearLayers();
    markers.clear();
    points.forEach((r) => {
      const html = `<span class="map-pin-inner">${icon(category(r.category).icon)}</span>`;
      const marker = L.marker([r.lat, r.lng], {
        icon: L.divIcon({ html, className: "map-pin", iconSize: [29, 35], iconAnchor: [14, 32] }),
        title: r.name,
        keyboard: true,
      }).addTo(markerLayer);
      const popup = document.createElement("div");
      popup.className = "map-popup";
      const title = document.createElement("h3");
      title.textContent = r.name;
      popup.append(title);
      const address = document.createElement("p");
      address.textContent = r.address;
      popup.append(address);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "View resource →";
      button.dataset.detail = r.id;
      popup.append(button);
      marker.bindPopup(popup, { maxWidth: 260 });
      marker.on("click", () => {
        $$(".resource-card").forEach((card) =>
          card.classList.toggle("is-selected", card.dataset.resource === r.id),
        );
      });
      markers.set(r.id, marker);
    });
    fitMap();
  }
  function locateResource(id) {
    const r = byId.get(id);
    if (!r) return;
    if (!map || !mapped(r)) {
      openDetail(id);
      return;
    }
    if (state.view === "list") {
      state.view = "map";
      setView();
    }
    map.invalidateSize();
    map.setView([r.lat, r.lng], 15, {
      animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    markers.get(id)?.openPopup();
    $$(".resource-card").forEach((card) =>
      card.classList.toggle("is-selected", card.dataset.resource === id),
    );
    if (innerWidth <= 800)
      $(".map-panel").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
  }
  const searchIndex = new Map(
    records.map((r) => [
      r.id,
      normalize(
        [
          r.name,
          r.category,
          category(r.category).label,
          r.description,
          r.address,
          r.utility,
          r.audience,
          r.gradeLevel,
          ...(Array.isArray(r.tags) ? r.tags : []),
        ].join(" "),
      ),
    ]),
  );
  const synonyms = {
    pantry: ["pantry", "food"],
    pantries: ["pantry", "food"],
    shelter: ["shelter", "housing"],
    housing: ["housing", "shelter"],
    doctor: ["doctor", "health", "clinic"],
    clinic: ["clinic", "health"],
    bus: ["bus", "transit"],
    transportation: ["transit", "transportation"],
    kids: ["children", "youth", "school"],
    school: ["school", "education"],
    schools: ["school", "education"],
    park: ["park", "outdoor"],
    parks: ["park", "outdoor"],
    help: ["help", "assistance", "support"],
    assistance: ["assistance", "support"],
  };
  function matches(r, q) {
    const hay = searchIndex.get(r.id);
    return normalize(q)
      .split(" ")
      .filter(Boolean)
      .every((word) => (synonyms[word] || [word]).some((term) => hay.includes(term)));
  }
  function updateURL() {
    const url = new URL(location.href);
    url.search = "";
    if (state.query) url.searchParams.set("q", state.query);
    if (state.category) url.searchParams.set("category", state.category);
    if (state.savedOnly) url.searchParams.set("saved", "1");
    if (state.view === "list") url.searchParams.set("view", "list");
    if (state.sort !== "recommended") url.searchParams.set("sort", state.sort);
    history.replaceState(null, "", url);
  }
  function setView() {
    document.body.classList.toggle("list-only", state.view === "list");
    $("#view-split").setAttribute("aria-pressed", String(state.view !== "list"));
    $("#view-list").setAttribute("aria-pressed", String(state.view === "list"));
    if (map && state.view !== "list")
      requestAnimationFrame(() => {
        map.invalidateSize();
        fitMap();
      });
    updateURL();
  }
  function resourceCard(r) {
    return `<article class="resource-card" data-resource="${escape(r.id)}"><div class="resource-card-top"><p class="resource-category">${icon(category(r.category).icon)} ${escape(category(r.category).label)}</p><button class="save-button" data-save="${escape(r.id)}" aria-label="${saved.has(r.id) ? "Unsave" : "Save"} ${escape(r.name)}" aria-pressed="${saved.has(r.id)}">${icon("bookmark")}</button></div><h2><button data-detail="${escape(r.id)}">${escape(r.name)}</button></h2><p class="resource-description">${escape(r.description)}</p><p class="resource-address">${icon("pin")}${escape(r.address || "See source for service area")}</p><div class="resource-card-bottom"><span>${r.verificationStatus === "needs-review" ? "Your suggestion" : mapped(r) ? "Location in project dataset" : "Service area / see source"}</span><button ${mapped(r) ? "data-locate" : "data-detail"}="${escape(r.id)}">${mapped(r) ? "Show on map" : "View details"} ${icon("arrow")}</button></div></article>`;
  }
  function paintCards() {
    $("#resource-results").innerHTML = filtered.length
      ? filtered.slice(0, limit).map(resourceCard).join("")
      : `<div class="empty-state">${icon(state.savedOnly ? "bookmark" : "search")}<h2>${state.savedOnly ? "Your next good find awaits." : "No matches just yet."}</h2><p>${state.savedOnly ? "Tap the bookmark on a resource to keep it here. Your collection stays in this browser." : "Try a shorter search, a different category, or clear your filters to start again."}</p><button class="button button-dark" data-clear-filters>Explore all resources ${icon("arrow")}</button></div>`;
    $("#load-more").hidden = filtered.length <= limit;
    if (filtered.length > limit)
      $("#load-more").innerHTML =
        `Show ${Math.min(12, filtered.length - limit)} more resources ${icon("plus")}`;
    updateSaved();
  }
  function renderResults() {
    limit = 12;
    filtered = records.filter(
      (r) =>
        (!state.category || r.category === state.category) &&
        (!state.savedOnly || saved.has(r.id)) &&
        matches(r, state.query),
    );
    if (state.sort === "az") filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (state.sort === "za") filtered.sort((a, b) => b.name.localeCompare(a.name));
    $("#results-count").innerHTML =
      `<strong>${filtered.length}</strong> ${filtered.length === 1 ? "resource" : "resources"}${state.savedOnly ? " saved on this device" : " to explore"}`;
    $$("#category-chips .chip").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.category === state.category)),
    );
    $("#saved-filter").setAttribute("aria-pressed", String(state.savedOnly));
    paintCards();
    updateMap();
    updateURL();
  }
  if ($("#resource-results")) {
    state = {
      query: (params.get("q") || "").slice(0, 200),
      category: categories.some((c) => c.name === params.get("category"))
        ? params.get("category")
        : "",
      savedOnly: params.get("saved") === "1",
      view: params.get("view") === "list" ? "list" : "map",
      sort: ["az", "za"].includes(params.get("sort")) ? params.get("sort") : "recommended",
    };
    $("#resource-search").value = state.query;
    $("#sort-order").value = state.sort;
    $("#category-chips").innerHTML =
      `<button class="chip" data-category="" aria-pressed="true">All resources</button>` +
      categories
        .map(
          (c) =>
            `<button class="chip" data-category="${escape(c.name)}" aria-pressed="false">${escape(c.label)}</button>`,
        )
        .join("");
    $("#category-chips").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (button) {
        state.category = button.dataset.category;
        renderResults();
      }
    });
    $("#directory-search").addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = $("#resource-search").value.trim();
      renderResults();
    });
    let searchTimer;
    $("#resource-search").addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = $("#resource-search").value.trim();
        renderResults();
      }, 180);
    });
    $("#saved-filter").addEventListener("click", () => {
      state.savedOnly = !state.savedOnly;
      renderResults();
    });
    $("#sort-order").addEventListener("change", (event) => {
      state.sort = event.target.value;
      renderResults();
    });
    $("#view-split").addEventListener("click", () => {
      state.view = "map";
      setView();
    });
    $("#view-list").addEventListener("click", () => {
      state.view = "list";
      setView();
    });
    $("#load-more").addEventListener("click", () => {
      const oldCount = limit;
      limit += 12;
      paintCards();
      $$(".resource-card h2 button")[oldCount]?.focus({ preventScroll: true });
    });
    $("#fit-map").addEventListener("click", fitMap);
    try {
      map = createMap("resource-map");
      if (map) markerLayer = L.layerGroup().addTo(map);
      else $("#map-error").hidden = false;
    } catch {
      $("#map-error").hidden = false;
    }
    renderResults();
    setView();
    if (params.get("resource") && byId.has(params.get("resource")))
      openDetail(params.get("resource"));
  }
  if ($("#home-map")) {
    try {
      const homeMap = createMap("home-map", true);
      if (homeMap) {
        L.circleMarker([34.0525, -84.0711], {
          radius: 8,
          fillColor: "#123e35",
          color: "#fff",
          weight: 3,
          fillOpacity: 1,
        }).addTo(homeMap);
        L.circleMarker([34.0368, -84.0512], {
          radius: 6,
          fillColor: "#123e35",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(homeMap);
      }
    } catch {
      /* The map link remains available when tiles cannot load. */
    }
  }
  updateSaved();
  window.COMMON = { records, categories, storage, toast, escape, icon };
})();
