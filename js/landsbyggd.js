/*
  Kort af torfbæjum á landsbyggðinni.

  Les gögn úr window.BAEIR (skrárnar data/baeir*.js). Sjá data/LEIDBEININGAR.md.
  Þarf: js/vendor/leaflet og js/vendor/markercluster.
  Allur texti úr gögnunum er settur inn með textContent, svo gæsalappir
  eða sérstafir í texta geta ekki brotið síðuna.
*/
(function () {
  "use strict";

  var CONFIG = {
    imageRoot: "Myndir/Baeir/",
    center: [64.95, -18.6],
    zoom: 6,
    bounds: [[62.3, -26.5], [67.7, -10.5]],
    focusZoom: 10,
    maxSuggestions: 8
  };
  /*
    Kortaveitur. Kortið velur sjálfgefna veitu eftir því hvernig síðan er opnuð:
      - birt á vefnum (http/https): OpenStreetMap (opinber flísaþjónn, ætlaður fyrir minni vefi)
      - opnuð með tvísmelli úr skrá (file://): Esri, því OpenStreetMap lokar á beiðnir án „Referer“-hauss (403)
    Hægt er að velja aðra veitu í stikunni eða með ?kort=osm, ?kort=esri eða ?kort=topo aftan við slóðina.
    Ath.: CARTO er ekki notað lengur því það krefst nú API-lykils.
    Heimildartextinn er skrifaður í upprunalegri mynd því leyfisskilmálar krefjast hans.
  */
  var PROVIDERS = {
    osm: {
      name: "OpenStreetMap",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: { maxZoom: 19 },
      credit: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-þátttakendur'
    },
    esri: {
      name: "Götukort (Esri)",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      options: { maxZoom: 19 },
      credit: "Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012"
    },
    topo: {
      name: "Landslag (OpenTopoMap)",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      options: { subdomains: "abc", maxNativeZoom: 17, maxZoom: 18 },
      credit: 'Gögn: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-þátttakendur, SRTM | Kort: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    }
  };
  var DEFAULT_PROVIDER = location.protocol === "file:" ? "esri" : "osm";
  var LANDSHLUTAR = [
    "Höfuðborgarsvæðið", "Suðurnes", "Vesturland", "Vestfirðir",
    "Norðurland vestra", "Norðurland eystra", "Austurland", "Suðurland"
  ];

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var narrow = window.matchMedia("(max-width: 820px)");

  /* ---------- hjálparföll ---------- */

  function $(id) { return document.getElementById(id); }

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === "text") { n.textContent = v; }
      else if (k === "class") { n.className = v; }
      else if (k.slice(0, 2) === "on") { n.addEventListener(k.slice(2), v); }
      else { n.setAttribute(k, v); }
    });
    (kids || []).forEach(function (c) {
      if (c) { n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
    });
    return n;
  }

  // Leit sem þolir íslenska stafi: „thingholt“ finnur „Þingholt“, „abaer“ finnur „Ábær“.
  function fold(s) {
    return String(s).toLowerCase()
      .replace(/þ/g, "th").replace(/ð/g, "d").replace(/æ/g, "ae").replace(/ö/g, "o")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function countText(n) {
    // 1 bær, 2 bæir, 11 bæir, 21 bær ...
    return n + ((n % 10 === 1 && n % 100 !== 11) ? " bær" : " bæir");
  }

  /* ---------- gögn ---------- */

  var farms = [];
  var byId = {};
  (Array.isArray(window.BAEIR) ? window.BAEIR : []).forEach(function (f, i) {
    var ok = f && typeof f.id === "string" && typeof f.nafn === "string" &&
      typeof f.lat === "number" && isFinite(f.lat) && typeof f.lng === "number" && isFinite(f.lng);
    if (!ok) { console.warn("Bær sleppt (vantar id, nafn eða hnit): færsla " + (i + 1), f); return; }
    if (byId[f.id]) { console.warn("Auðkennið „" + f.id + "“ er notað tvisvar – seinni færslu sleppt"); return; }
    var item = {
      id: f.id, nafn: f.nafn, lat: f.lat, lng: f.lng,
      landshluti: f.landshluti || "", svaedi: f.svaedi || "", lysing: f.lysing || "", sida: f.sida || "",
      myndir: []
    };
    (Array.isArray(f.myndir) ? f.myndir : []).forEach(function (m) {
      if (!m || typeof m.src !== "string") { return; }
      item.myndir.push({
        url: CONFIG.imageRoot + encodeURIComponent(f.id) + "/" + encodeURIComponent(m.src),
        texti: m.texti || "",
        heimild: m.heimild || ""
      });
    });
    item.leit = fold([item.nafn, item.svaedi, item.landshluti].join(" "));
    farms.push(item);
    byId[item.id] = item;
  });
  var collator = new Intl.Collator("is");
  farms.sort(function (a, b) { return collator.compare(a.nafn, b.nafn); });

  function placeOf(f) { return [f.svaedi, f.landshluti].filter(Boolean).join(" · "); }

  /* ---------- síður og kort ---------- */

  var mapEl = $("map"), stageEl = $("stage"), panel = $("panel");
  var searchEl = $("search"), resultsEl = $("search-results"), regionEl = $("region"), countEl = $("count"),
      basemapEl = $("basemap"), creditEl = $("credit");

  if (typeof L === "undefined") {
    mapEl.appendChild(el("p", { class: "map-message", text: "Ekki tókst að hlaða kortasafninu. Athugaðu skrárnar í js/vendor/." }));
    return;
  }
  if (!farms.length) {
    mapEl.appendChild(el("p", { class: "map-message", text: "Engir bæir fundust í gagnaskránni (data/baeir.js)." }));
  }

  var map = L.map(mapEl, {
    minZoom: 5, maxZoom: 18,
    maxBounds: CONFIG.bounds, maxBoundsViscosity: 0.8,
    zoomControl: false, attributionControl: false
  });
  L.control.zoom({ zoomInTitle: "Þysja inn", zoomOutTitle: "Þysja út" }).addTo(map);
  map.setView(CONFIG.center, CONFIG.zoom);

  var baseLayer = null;
  function setBasemap(key) {
    var p = PROVIDERS[key] || PROVIDERS[DEFAULT_PROVIDER];
    if (baseLayer) { map.removeLayer(baseLayer); }
    baseLayer = L.tileLayer(p.url, Object.assign({ maxZoom: 18 }, p.options)).addTo(map);
    creditEl.innerHTML = "Kort: " + p.credit; // fastir strengir úr þessari skrá, aldrei gögn frá notanda
    basemapEl.value = PROVIDERS[key] ? key : DEFAULT_PROVIDER;
  }
  Object.keys(PROVIDERS).forEach(function (k) {
    basemapEl.appendChild(el("option", { value: k, text: PROVIDERS[k].name }));
  });
  basemapEl.addEventListener("change", function () { setBasemap(basemapEl.value); });
  var wanted = new URLSearchParams(location.search).get("kort");
  setBasemap(PROVIDERS[wanted] ? wanted : DEFAULT_PROVIDER);

  function pinIcon(active) {
    return L.divIcon({
      className: "map-pin",
      html: '<span class="pin-dot' + (active ? " is-active" : "") + '"></span>',
      iconSize: [24, 24], iconAnchor: [12, 12]
    });
  }

  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 44,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: function (c) {
      var span = document.createElement("span");
      span.className = "cluster-dot";
      span.textContent = c.getChildCount();
      return L.divIcon({ className: "map-cluster", html: span.outerHTML, iconSize: L.point(40, 40) });
    }
  });
  map.addLayer(cluster);

  farms.forEach(function (f) {
    f.marker = L.marker([f.lat, f.lng], { icon: pinIcon(false), title: f.nafn, keyboard: true, riseOnHover: true });
    f.marker.on("click", function () { openFarm(f.id); });
    f.marker.on("add", function () {
      var node = f.marker.getElement();
      if (node) { node.setAttribute("aria-label", f.nafn); }
    });
  });

  var state = { region: "", current: null };

  function visibleFarms() {
    return farms.filter(function (f) { return !state.region || f.landshluti === state.region; });
  }

  function applyFilter() {
    var list = visibleFarms();
    cluster.clearLayers();
    cluster.addLayers(list.map(function (f) { return f.marker; }));
    countEl.textContent = countText(list.length);
  }

  function fitAll() {
    var list = visibleFarms();
    if (!list.length) { map.setView(CONFIG.center, CONFIG.zoom); return; }
    map.fitBounds(L.latLngBounds(list.map(function (f) { return [f.lat, f.lng]; })), { padding: [60, 60], maxZoom: 9 });
  }

  /* ---------- landshlutasía ---------- */

  (function buildRegionFilter() {
    var counts = {};
    farms.forEach(function (f) { if (f.landshluti) { counts[f.landshluti] = (counts[f.landshluti] || 0) + 1; } });
    regionEl.appendChild(el("option", { value: "", text: "Allir landshlutar" }));
    var names = LANDSHLUTAR.filter(function (r) { return counts[r]; })
      .concat(Object.keys(counts).filter(function (r) { return LANDSHLUTAR.indexOf(r) < 0; }));
    names.forEach(function (r) {
      regionEl.appendChild(el("option", { value: r, text: r + " (" + counts[r] + ")" }));
    });
    regionEl.addEventListener("change", function () {
      state.region = regionEl.value;
      if (state.current && state.region && state.current.landshluti !== state.region) { closeFarm(); }
      applyFilter();
      fitAll();
      runSearch();
    });
  })();

  /* ---------- leit ---------- */

  var matches = [];
  var activeIdx = -1;

  function runSearch() {
    var q = fold(searchEl.value.trim());
    matches = [];
    activeIdx = -1;
    if (q) {
      matches = visibleFarms()
        .filter(function (f) { return f.leit.indexOf(q) !== -1; })
        .sort(function (a, b) {
          var ap = fold(a.nafn).indexOf(q) === 0 ? 0 : 1, bp = fold(b.nafn).indexOf(q) === 0 ? 0 : 1;
          return (ap - bp) || collator.compare(a.nafn, b.nafn);
        })
        .slice(0, CONFIG.maxSuggestions);
    }
    renderResults(q);
  }

  function renderResults(q) {
    resultsEl.textContent = "";
    searchEl.removeAttribute("aria-activedescendant");
    if (!q) { resultsEl.hidden = true; searchEl.setAttribute("aria-expanded", "false"); return; }
    if (!matches.length) {
      resultsEl.appendChild(el("li", { class: "search-empty", text: "Enginn bær fannst" }));
    }
    matches.forEach(function (f, i) {
      var li = el("li", { role: "option", id: "sr-" + i, "aria-selected": "false" }, [
        el("span", { class: "sr-name", text: f.nafn }),
        el("span", { class: "sr-place", text: placeOf(f) })
      ]);
      li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(f.id); });
      resultsEl.appendChild(li);
    });
    resultsEl.hidden = false;
    searchEl.setAttribute("aria-expanded", "true");
  }

  function highlight(i) {
    var items = resultsEl.querySelectorAll("[role=option]");
    Array.prototype.forEach.call(items, function (n, k) {
      n.setAttribute("aria-selected", k === i ? "true" : "false");
      n.classList.toggle("is-active", k === i);
    });
    activeIdx = i;
    if (i >= 0) { searchEl.setAttribute("aria-activedescendant", "sr-" + i); }
    else { searchEl.removeAttribute("aria-activedescendant"); }
  }

  function pick(id) {
    searchEl.value = byId[id].nafn;
    resultsEl.hidden = true;
    searchEl.setAttribute("aria-expanded", "false");
    openFarm(id);
  }

  searchEl.addEventListener("input", runSearch);
  searchEl.addEventListener("focus", function () { if (searchEl.value.trim()) { runSearch(); } });
  searchEl.addEventListener("blur", function () { resultsEl.hidden = true; searchEl.setAttribute("aria-expanded", "false"); });
  searchEl.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && matches.length) { e.preventDefault(); highlight((activeIdx + 1) % matches.length); }
    else if (e.key === "ArrowUp" && matches.length) { e.preventDefault(); highlight((activeIdx - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter") {
      var f = matches[activeIdx >= 0 ? activeIdx : 0];
      if (f) { e.preventDefault(); pick(f.id); }
    } else if (e.key === "Escape") {
      if (!resultsEl.hidden) { resultsEl.hidden = true; e.stopPropagation(); }
      else if (searchEl.value) { searchEl.value = ""; runSearch(); }
    }
  });

  /* ---------- spjald með myndum ---------- */

  var view = { farm: null, index: 0 };
  var galleryNodes = null;

  function openFarm(id) {
    var f = byId[id];
    if (!f) { return; }
    if (state.region && f.landshluti !== state.region) {
      state.region = ""; regionEl.value = ""; applyFilter();
    }
    if (state.current && state.current.marker) { state.current.marker.setIcon(pinIcon(false)); }
    state.current = f;
    f.marker.setIcon(pinIcon(true));
    renderPanel(f);
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    stageEl.classList.add("has-panel");
    setHash(f.id);
    focusOnMap(f);
    var title = $("panel-title");
    if (title) { title.focus({ preventScroll: true }); }
  }

  function closeFarm() {
    if (!state.current) { return; }
    state.current.marker.setIcon(pinIcon(false));
    state.current = null;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    stageEl.classList.remove("has-panel");
    setHash(null);
  }

  function focusOnMap(f) {
    var ll = L.latLng(f.lat, f.lng);
    var pad = narrow.matches ? [0, panel.offsetHeight] : [panel.offsetWidth, 0];
    var opts = {
      paddingBottomRight: pad,
      maxZoom: Math.max(map.getZoom(), CONFIG.focusZoom),
      animate: !reduceMotion, duration: 0.9
    };
    var bounds = L.latLngBounds([ll, ll]);
    if (reduceMotion) { map.fitBounds(bounds, opts); } else { map.flyToBounds(bounds, opts); }
    map.once("moveend", function () {
      if (state.current === f && cluster.getVisibleParent(f.marker) !== f.marker) { cluster.zoomToShowLayer(f.marker); }
    });
  }

  function setHash(id) {
    try {
      history.replaceState(null, "", id ? "#" + encodeURIComponent(id) : location.pathname + location.search);
    } catch (e) {
      if (id) { location.hash = id; }
    }
  }

  function renderPanel(f) {
    panel.textContent = "";
    view = { farm: f, index: 0 };
    galleryNodes = null;

    panel.appendChild(el("button", { type: "button", class: "text-button panel-close", onclick: closeFarm, "aria-label": "Loka spjaldi", text: "Loka ×" }));
    panel.appendChild(el("h2", { id: "panel-title", tabindex: "-1", text: f.nafn }));
    if (placeOf(f)) { panel.appendChild(el("p", { class: "panel-place", text: placeOf(f) })); }
    if (f.lysing) { panel.appendChild(el("p", { class: "panel-text", text: f.lysing })); }

    if (!f.myndir.length) {
      panel.appendChild(el("p", { class: "panel-empty", text: "Engar myndir ennþá." }));
    } else {
      panel.appendChild(buildGallery(f));
      showImage(0);
    }
    if (f.sida) {
      panel.appendChild(el("a", { class: "panel-link", href: f.sida, text: "Lesa meira" }));
    }
    panel.scrollTop = 0;
  }

  function buildGallery(f) {
    var n = galleryNodes = {};
    n.img = el("img", { alt: "", decoding: "async" });
    n.img.addEventListener("error", function () { n.frame.classList.add("is-broken"); });
    n.img.addEventListener("load", function () { n.frame.classList.remove("is-broken"); });
    n.frame = el("button", {
      type: "button", class: "gallery-frame", "aria-label": "Stækka mynd",
      onclick: function () { openLightbox(view.index); }
    }, [n.img, el("span", { class: "broken-note", text: "Myndin finnst ekki" })]);
    n.text = el("span", { class: "gallery-text" });
    n.credit = el("span", { class: "gallery-credit" });
    var caption = el("p", { class: "gallery-caption" }, [n.text, n.credit]);
    var gallery = el("div", { class: "gallery" }, [n.frame, caption]);

    if (f.myndir.length > 1) {
      n.counter = el("span", { class: "gallery-counter", "aria-live": "polite" });
      gallery.appendChild(el("div", { class: "gallery-nav" }, [
        el("button", { type: "button", class: "text-button", text: "← Fyrri", onclick: function () { stepImage(-1); } }),
        n.counter,
        el("button", { type: "button", class: "text-button", text: "Næsta →", onclick: function () { stepImage(1); } })
      ]));
      n.thumbs = [];
      var strip = el("div", { class: "gallery-thumbs" });
      f.myndir.forEach(function (m, i) {
        var b = el("button", {
          type: "button", class: "thumb", "aria-label": "Mynd " + (i + 1) + " af " + f.myndir.length,
          onclick: function () { showImage(i); }
        }, [el("img", { src: m.url, alt: "", loading: "lazy", decoding: "async" })]);
        n.thumbs.push(b);
        strip.appendChild(b);
      });
      gallery.appendChild(strip);
    }
    return gallery;
  }

  function imageAlt(f, i) {
    return f.myndir[i].texti || (f.nafn + " – mynd " + (i + 1));
  }

  function showImage(i) {
    var f = view.farm, n = galleryNodes, m = f.myndir[i];
    view.index = i;
    n.frame.classList.remove("is-broken");
    n.img.src = m.url;
    n.img.alt = imageAlt(f, i);
    n.text.textContent = m.texti;
    n.credit.textContent = m.heimild;
    n.credit.hidden = !m.heimild;
    if (n.counter) { n.counter.textContent = (i + 1) + " / " + f.myndir.length; }
    if (n.thumbs) {
      n.thumbs.forEach(function (b, k) {
        if (k === i) { b.setAttribute("aria-current", "true"); } else { b.removeAttribute("aria-current"); }
      });
    }
    var next = f.myndir[(i + 1) % f.myndir.length];
    if (next && f.myndir.length > 1) { new Image().src = next.url; }
  }

  function stepImage(d) {
    var len = view.farm.myndir.length;
    showImage((view.index + d + len) % len);
  }

  /* ---------- stækkuð mynd (lightbox) ---------- */

  var lightbox = $("lightbox"), lbImg = $("lightbox-img"), lbText = $("lightbox-caption"),
      lbCount = $("lightbox-count"), lbClose = $("lightbox-close"), lbPrev = $("lightbox-prev"), lbNext = $("lightbox-next");
  var lbOpener = null;

  function lightboxOpen() { return !lightbox.hidden; }

  function renderLightbox() {
    var f = view.farm, m = f.myndir[view.index], multi = f.myndir.length > 1;
    lbImg.src = m.url;
    lbImg.alt = imageAlt(f, view.index);
    lbText.textContent = [m.texti, m.heimild].filter(Boolean).join(" — ");
    lbCount.textContent = multi ? (view.index + 1) + " / " + f.myndir.length : "";
    lbPrev.hidden = lbNext.hidden = !multi;
  }

  function openLightbox(i) {
    if (!view.farm || !view.farm.myndir.length) { return; }
    view.index = i;
    lbOpener = document.activeElement;
    renderLightbox();
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    lbImg.removeAttribute("src");
    if (galleryNodes) { showImage(view.index); }
    if (lbOpener && lbOpener.focus) { lbOpener.focus(); }
  }

  function stepLightbox(d) {
    var len = view.farm.myndir.length;
    if (len < 2) { return; }
    view.index = (view.index + d + len) % len;
    renderLightbox();
  }

  lbClose.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", function () { stepLightbox(-1); });
  lbNext.addEventListener("click", function () { stepLightbox(1); });
  lightbox.addEventListener("click", function (e) { if (e.target === lightbox || e.target.classList.contains("lightbox-main")) { closeLightbox(); } });

  document.addEventListener("keydown", function (e) {
    if (lightboxOpen()) {
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowLeft") { stepLightbox(-1); }
      else if (e.key === "ArrowRight") { stepLightbox(1); }
      else if (e.key === "Tab") {
        var items = [lbClose, lbPrev, lbNext].filter(function (b) { return !b.hidden; });
        var i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    } else if (e.key === "Escape" && state.current) {
      closeFarm();
    }
  });

  map.on("click", closeFarm);

  /* ---------- slóð (#auðkenni) ---------- */

  function openFromHash() {
    var id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = ""; }
    if (id && byId[id]) {
      if (!state.current || state.current.id !== id) { openFarm(id); }
    } else if (!id && state.current) {
      closeFarm();
    }
  }
  window.addEventListener("hashchange", openFromHash);

  /* ---------- ræsing ---------- */

  applyFilter();
  fitAll();
  openFromHash();
})();
