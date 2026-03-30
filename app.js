const LINE_COLS = 32;
const LINE_ROWS = 48;
const DEST_COLS = 160;
const DEST_ROWS = 48;
const ACAPELA_TOKEN_URL = "https://www.acapela-group.com/wp-json/acapela/v1/get_accldcfg";
const ACAPELA_API_URL = "https://www.acapela-cloud.com/api/command/";
const ACAPELA_VOICE = "Klaus22k_NV";

const SIZE_PRESETS = {
  line: { width: 16, height: 25 },
  small: { width: 8, height: 8 },
  medium: { width: 12, height: 14 },
  large: { width: 16, height: 16 }
};

const tabDeviceEl = document.getElementById("tabDevice");
const tabFontEl = document.getElementById("tabFont");
const deviceViewEl = document.getElementById("deviceView");
const fontViewEl = document.getElementById("fontView");

const lineFieldEl = document.getElementById("lineField");
const destinationFieldEl = document.getElementById("destinationField");
const displayLayoutEl = document.getElementById("displayLayout");
const destinationSideEl = document.getElementById("destinationSide");
const rowDestinationSideEl = document.getElementById("rowDestinationSide");
const lineInputEl = document.getElementById("lineInput");
const rowLineInputEl = document.getElementById("rowLineInput");
const rowModeSelectEl = document.getElementById("rowModeSelect");
const dataModeSelectEl = document.getElementById("dataModeSelect");
const deviceLocationSelectEl = document.getElementById("deviceLocationSelect");
const rowDeviceLocationEl = document.getElementById("rowDeviceLocation");
const platformSelectEl = document.getElementById("platformSelect");
const rowPlatformEl = document.getElementById("rowPlatform");
const destinationSelectEl = document.getElementById("destinationSelect");
const rowDestinationSelectEl = document.getElementById("rowDestinationSelect");
const destinationInputEl = document.getElementById("destinationInput");
const rowDestinationInputEl = document.getElementById("rowDestinationInput");
const routeStopsInputEl = document.getElementById("routeStopsInput");
const rowRouteStopsEl = document.getElementById("rowRouteStops");
const autoRouteFromDataEl = document.getElementById("autoRouteFromData");
const rowAutoRouteEl = document.getElementById("rowAutoRoute");
const kursInputEl = document.getElementById("kursInput");
const rowKursEl = document.getElementById("rowKurs");
const ibisInputEl = document.getElementById("ibisInput");
const ibisSendBtnEl = document.getElementById("ibisSendBtn");
const ibisControlsEl = document.getElementById("ibisControls");
const renderDeviceEl = document.getElementById("renderDevice");
const rowRenderButtonEl = document.getElementById("rowRenderButton");

const fontSizePresetEl = document.getElementById("fontSizePreset");
const canvasWidthEl = document.getElementById("canvasWidth");
const canvasHeightEl = document.getElementById("canvasHeight");
const fontCanvasEl = document.getElementById("fontCanvas");
const fontCanvasMetaEl = document.getElementById("fontCanvasMeta");
const fontEditorToggleEl = document.getElementById("fontEditorToggle");
const glyphCharEl = document.getElementById("glyphChar");
const glyphListEl = document.getElementById("glyphList");
const newGlyphEl = document.getElementById("newGlyph");
const deleteGlyphEl = document.getElementById("deleteGlyph");
const saveGlyphEl = document.getElementById("saveGlyph");
const clearFontCanvasEl = document.getElementById("clearFontCanvas");
const saveStatusEl = document.getElementById("saveStatus");

function createMatrix(rows, cols, factory) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, factory));
}

function clampNum(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function createEmptyGlyphStore() {
  return { line: {}, small: {}, medium: {}, large: {} };
}

const glyphLibrary = createEmptyGlyphStore();

const state = {
  view: "device",
  mode: "manual",
  fontBuilderAvailable: false,
  fontEditorMode: true,
  destinationSide: "right",
  lineSelectedColor: "#00ff66",
  dataConfig: null,
  activeAudio: null,
  livePollingInterval: null,
  currentLiveTrip: null,
  liveFetchInFlight: false,
  ibis: { line: null, kurs: null, zielNum: null },
  linePixels: createMatrix(LINE_ROWS, LINE_COLS, () => ({ on: false, color: "#00ff66" })),
  destinationPixels: createMatrix(DEST_ROWS, DEST_COLS, () => ({ on: false })),
  font: {
    size: "medium",
    canvasWidth: SIZE_PRESETS.medium.width,
    canvasHeight: SIZE_PRESETS.medium.height,
    pixels: createMatrix(SIZE_PRESETS.medium.height, SIZE_PRESETS.medium.width, () => ({ on: false }))
  },
  selectedGlyphChar: "",
  drag: {
    active: false,
    mode: "paint"
  }
};

function setStatus(message, isError = false) {
  saveStatusEl.textContent = message;
  saveStatusEl.style.color = isError ? "#ff9e9e" : "#b4d9ff";
}

async function checkLocalServerHealth() {
  if (window.location.protocol === "file:") {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch("api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (response.ok) {
      return true;
    }

    const fallback = await fetch("api/glyphs", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    return fallback.ok;
  } catch (error) {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function applyFontBuilderAvailability(isAvailable) {
  state.fontBuilderAvailable = Boolean(isAvailable);
  tabFontEl.style.display = state.fontBuilderAvailable ? "" : "none";

  if (!state.fontBuilderAvailable && state.view === "font") {
    state.view = "device";
  }
  renderView();
}

function createLedGrid(fieldEl, rows, cols, type) {
  if (!fieldEl) {
    console.warn(`Missing field element for grid type '${type}'.`);
    return;
  }

  const frag = document.createDocumentFragment();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const led = document.createElement("button");
      led.className = `led ${type}`;
      led.type = "button";
      led.dataset.row = String(row);
      led.dataset.col = String(col);
      frag.appendChild(led);
    }
  }

  fieldEl.innerHTML = "";
  fieldEl.appendChild(frag);
}

function renderView() {
  const deviceActive = state.view === "device";
  tabDeviceEl.classList.toggle("active", deviceActive);
  tabFontEl.classList.toggle("active", state.fontBuilderAvailable && !deviceActive);
  deviceViewEl.classList.toggle("hidden", !deviceActive);
  fontViewEl.classList.toggle("hidden", deviceActive || !state.fontBuilderAvailable);
}

function renderDeviceLayout() {
  displayLayoutEl.classList.toggle("destination-left", state.destinationSide === "left");
}

function renderLineField() {
  lineFieldEl.querySelectorAll(".led").forEach((led) => {
    const row = Number(led.dataset.row);
    const col = Number(led.dataset.col);
    const px = state.linePixels[row][col];
    led.classList.toggle("on", px.on);
    led.style.color = px.color;
    led.disabled = true;
    led.classList.add("disabled");
  });
}

function renderDestinationField() {
  destinationFieldEl.querySelectorAll(".led").forEach((led) => {
    const row = Number(led.dataset.row);
    const col = Number(led.dataset.col);
    const px = state.destinationPixels[row][col];
    led.classList.toggle("on", px.on);
    led.disabled = true;
    led.classList.add("disabled");
  });
}

function resetFontCanvasPixels() {
  state.font.pixels = createMatrix(state.font.canvasHeight, state.font.canvasWidth, () => ({ on: false }));
}

function rebuildFontCanvas() {
  const cols = state.font.canvasWidth;
  const rows = state.font.canvasHeight;

  fontCanvasEl.style.gridTemplateColumns = `repeat(${cols}, 10px)`;
  fontCanvasEl.style.gridTemplateRows = `repeat(${rows}, 10px)`;
  createLedGrid(fontCanvasEl, rows, cols, "font-line");
  renderFontCanvas();

  fontCanvasMetaEl.textContent = `${state.font.size} | ${cols}x${rows}`;
}

function renderFontCanvas() {
  fontCanvasEl.querySelectorAll(".led").forEach((led) => {
    const row = Number(led.dataset.row);
    const col = Number(led.dataset.col);
    const px = state.font.pixels[row][col];

    led.classList.toggle("on", px.on);
    led.style.color = "";
    led.disabled = !state.fontEditorMode;
    led.classList.toggle("disabled", !state.fontEditorMode);
  });
}

function createGlyphPreview(glyph) {
  const wrapper = document.createElement("div");
  wrapper.className = "glyph-preview";

  const rows = Number(glyph?.height || 0);
  const cols = Number(glyph?.charWidth || glyph?.width || 0);
  const pixels = getGlyphPixels(glyph);

  if (!rows || !cols) {
    wrapper.textContent = "No preview";
    return wrapper;
  }

  wrapper.style.gridTemplateColumns = `repeat(${cols}, 5px)`;
  wrapper.style.gridTemplateRows = `repeat(${rows}, 5px)`;

  for (let row = 0; row < rows; row += 1) {
    const rowPixels = Array.isArray(pixels[row]) ? pixels[row] : [];
    for (let col = 0; col < cols; col += 1) {
      const px = rowPixels[col] || { on: false };
      const dot = document.createElement("span");
      dot.className = "glyph-dot";
      dot.style.background = px.on ? "#ff9d00" : "#151515";
      wrapper.appendChild(dot);
    }
  }

  return wrapper;
}

function getCharacterCatalog() {
  return [
    ..."0123456789",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ..."abcdefghijklmnopqrstuvwxyz",
    ..."ÄÖÜ",
    ..."äöü",
    "ß",
    ".",
    ",",
    "-",
    "/",
    ":",
    "🚌",
    " "
  ];
}

function firstChar(value) {
  return [...String(value || "").trim()][0] || "";
}

function renderGlyphList() {
  glyphListEl.innerHTML = "";
  const bucket = glyphLibrary[state.font.size] || {};
  const chars = getCharacterCatalog();

  chars.forEach((char) => {
    const glyph = bucket[char] || null;
    const li = document.createElement("li");
    li.className = "glyph-list-item";
    li.dataset.char = char;
    li.addEventListener("click", () => loadGlyphIntoCanvas(char));

    const meta = document.createElement("div");
    meta.className = "glyph-meta";
    meta.textContent = char === " " ? "[space]" : `'${char}'`;

    const status = document.createElement("div");
    status.className = "glyph-meta";
    status.textContent = glyph ? "saved" : "new";
    status.style.opacity = glyph ? "1" : "0.6";

    li.appendChild(meta);
    li.appendChild(status);

    if (char === state.selectedGlyphChar) {
      li.classList.add("active");
    }
    li.classList.toggle("unsaved", !glyph);

    glyphListEl.appendChild(li);
  });
}

function loadGlyphIntoCanvas(char, options = {}) {
  const { silent = false } = options;
  state.selectedGlyphChar = char;
  glyphCharEl.value = char;
  const glyph = glyphLibrary[state.font.size]?.[char];
  if (!glyph) {
    applyCanvasNumbers();
    renderGlyphList();
    if (!silent) {
      setStatus(`New glyph '${char}' (${state.font.size}).`);
    }
    return;
  }

  state.font.canvasWidth = clampNum(glyph.width || glyph.charWidth || SIZE_PRESETS[state.font.size].width, 1, 64);
  state.font.canvasHeight = clampNum(glyph.height || SIZE_PRESETS[state.font.size].height, 6, 64);

  canvasWidthEl.value = String(state.font.canvasWidth);
  canvasHeightEl.value = String(state.font.canvasHeight);

  state.font.pixels = createMatrix(state.font.canvasHeight, state.font.canvasWidth, () => ({ on: false }));
  const glyphPixels = getGlyphPixels(glyph);

  for (let row = 0; row < state.font.canvasHeight; row += 1) {
    for (let col = 0; col < state.font.canvasWidth; col += 1) {
      const px = glyphPixels?.[row]?.[col];
      if (px?.on) {
        state.font.pixels[row][col].on = true;
      }
    }
  }

  rebuildFontCanvas();
  renderGlyphList();
  if (!silent) {
    setStatus(`Loaded '${char}' (${state.font.size}).`);
  }
}

function loadFirstGlyphForCurrentSize() {
  const chars = Object.keys(glyphLibrary[state.font.size] || {}).sort((a, b) => a.localeCompare(b));
  if (!chars.length) {
    const catalog = getCharacterCatalog();
    loadGlyphIntoCanvas(catalog[0], { silent: true });
    return false;
  }
  loadGlyphIntoCanvas(chars[0], { silent: true });
  return true;
}

function getSerializedGlyphBits() {
  const width = clampNum(state.font.canvasWidth, 1, 64);
  const height = clampNum(state.font.canvasHeight, 1, 64);
  let bits = "";
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      bits += state.font.pixels[row][col]?.on ? "1" : "0";
    }
  }
  return bits;
}

function clearFontCanvas() {
  resetFontCanvasPixels();
  renderFontCanvas();
}

function applyPreset(presetName) {
  const normalizedSize = String(presetName || "").toLowerCase();
  const preset = SIZE_PRESETS[normalizedSize] || SIZE_PRESETS.medium;
  state.font.size = SIZE_PRESETS[normalizedSize] ? normalizedSize : "medium";
  fontSizePresetEl.value = state.font.size;
  state.font.canvasWidth = preset.width;
  state.font.canvasHeight = preset.height;
  state.selectedGlyphChar = "";
  glyphCharEl.value = "";

  canvasWidthEl.value = String(state.font.canvasWidth);
  canvasHeightEl.value = String(state.font.canvasHeight);

  resetFontCanvasPixels();
  rebuildFontCanvas();
  renderGlyphList();
  loadFirstGlyphForCurrentSize();
}

function applyCanvasNumbers() {
  state.font.canvasWidth = clampNum(canvasWidthEl.value, 1, 64);
  state.font.canvasHeight = clampNum(canvasHeightEl.value, 6, 64);

  canvasWidthEl.value = String(state.font.canvasWidth);
  canvasHeightEl.value = String(state.font.canvasHeight);

  resetFontCanvasPixels();
  rebuildFontCanvas();
}

async function saveGlyphsToFile() {
  setStatus("Saving glyphs.json...");

  try {
    const response = await fetch("api/glyphs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(glyphLibrary)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Save failed.");
    }

    setStatus(`Saved to ${payload.path}`);
  } catch (error) {
    setStatus(`Save failed: ${error.message}`, true);
  }
}

async function saveGlyphsToFileSilent() {
  try {
    const response = await fetch("api/glyphs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(glyphLibrary)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function normalizeGlyphStore(rawGlyphs) {
  const normalized = createEmptyGlyphStore();

  ["line", "small", "medium", "large"].forEach((size) => {
    const sourceBucket = rawGlyphs && typeof rawGlyphs === "object" ? rawGlyphs[size] : null;
    const bucket = sourceBucket && typeof sourceBucket === "object" ? sourceBucket : {};
    const outBucket = {};

    Object.keys(bucket).forEach((char) => {
      const glyph = bucket[char];
      if (!glyph || typeof glyph !== "object") {
        return;
      }
      const charWidth = clampNum(glyph.charWidth || glyph.width || 1, 1, 64);
      const height = clampNum(glyph.height || 1, 1, 64);
      const bitsLength = charWidth * height;
      const bits = String(glyph.bits || "")
        .replace(/[^01]/g, "")
        .slice(0, bitsLength)
        .padEnd(bitsLength, "0");

      outBucket[char] = {
        size: glyph.size || size,
        width: charWidth,
        charWidth,
        height,
        bits
      };
    });

    normalized[size] = outBucket;
  });

  return normalized;
}

function getGlyphPixels(glyph) {
  if (!glyph || typeof glyph !== "object") {
    return [];
  }

  const width = clampNum(glyph.charWidth || glyph.width || 1, 1, 64);
  const height = clampNum(glyph.height || 1, 1, 64);
  const total = width * height;
  const bits = String(glyph.bits || "")
    .replace(/[^01]/g, "")
    .slice(0, total)
    .padEnd(total, "0");

  const pixels = createMatrix(height, width, () => ({ on: false }));
  let idx = 0;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      pixels[row][col].on = bits[idx] === "1";
      idx += 1;
    }
  }
  return pixels;
}

function applyGlyphStore(rawGlyphs) {
  const normalized = normalizeGlyphStore(rawGlyphs || {});
  Object.keys(glyphLibrary).forEach((size) => {
    glyphLibrary[size] = normalized[size] || {};
  });

  renderGlyphList();
  loadFirstGlyphForCurrentSize();
  renderDeviceFromInputs();

  return Object.values(glyphLibrary).reduce((sum, bucket) => sum + Object.keys(bucket).length, 0);
}

async function loadDataConfig() {
  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) {
      return false;
    }
    state.dataConfig = await response.json();
    populateDeviceLocationOptions();
    populateDestinationOptions();
    renderDeviceFromInputs();
    return true;
  } catch (error) {
    console.warn("Failed to load data config:", error);
    return false;
  }
}

function populateDeviceLocationOptions() {
  if (!deviceLocationSelectEl) {
    return;
  }

  const current = deviceLocationSelectEl.value;
  const cfg = state.dataConfig;
  const stops = cfg?.stops && typeof cfg.stops === "object" ? cfg.stops : {};
  const allowedLocations = ["RTH", "JPL", "HBF"];
  const keys = allowedLocations.filter((code) => Boolean(stops[code]));

  deviceLocationSelectEl.innerHTML = "";
  const manual = document.createElement("option");
  manual.value = "";
  manual.textContent = "(manual)";
  deviceLocationSelectEl.appendChild(manual);

  keys.forEach((code) => {
    const option = document.createElement("option");
    const stopName = stops[code]?.name || code;
    option.value = code;
    option.textContent = `${code} - ${stopName}`;
    deviceLocationSelectEl.appendChild(option);
  });

  const preferred = cfg?.deviceLocation && stops[cfg.deviceLocation] ? cfg.deviceLocation : "";
  deviceLocationSelectEl.value = keys.includes(current) ? current : keys.includes(preferred) ? preferred : "";
  updatePlatformOptions(deviceLocationSelectEl.value);
}

function populateDestinationOptions() {
  if (!destinationSelectEl) {
    return;
  }

  const current = destinationSelectEl.value;
  const cfg = state.dataConfig;
  const destinations = Array.isArray(cfg?.destinations) ? cfg.destinations : [];

  destinationSelectEl.innerHTML = "";
  const manual = document.createElement("option");
  manual.value = "";
  manual.textContent = "(manual)";
  destinationSelectEl.appendChild(manual);

  destinations.forEach((dest) => {
    const option = document.createElement("option");
    option.value = String(dest.id || "");
    option.textContent = String(dest.label || dest.name || dest.id || "");
    destinationSelectEl.appendChild(option);
  });

  const ids = destinations.map((d) => String(d.id || ""));
  destinationSelectEl.value = ids.includes(current) ? current : "";
}

function updatePlatformOptions(locationCode) {
  if (!platformSelectEl) {
    return;
  }

  const loc = String(locationCode || "").toUpperCase();
  let count = 1;
  if (loc === "HBF") {
    count = 4;
  } else if (loc === "JPL" || loc === "RTH") {
    count = 2;
  }

  const previous = platformSelectEl.value;
  platformSelectEl.innerHTML = "";
  for (let i = 1; i <= count; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    platformSelectEl.appendChild(option);
  }
  platformSelectEl.value = previous && Number(previous) <= count ? previous : "1";
}

function setMode(modeValue) {
  const nextMode = ["manual", "live", "ibis"].includes(modeValue) ? modeValue : "manual";
  state.mode = nextMode;
  dataModeSelectEl.value = nextMode;
  ibisControlsEl.style.display = nextMode === "ibis" ? "grid" : "none";

  const show = (el, visible, as = "") => {
    if (!el) return;
    el.style.display = visible ? as : "none";
  };

  show(rowModeSelectEl, true, "grid");
  show(rowDestinationSideEl, true, "grid");
  show(rowDeviceLocationEl, true, "grid");
  show(rowPlatformEl, true, "grid");

  const isManual = nextMode === "manual";
  const isIbis = nextMode === "ibis";

  show(rowLineInputEl, isManual, "grid");
  show(rowDestinationSelectEl, isManual, "grid");
  show(rowDestinationInputEl, isManual, "grid");
  show(rowRouteStopsEl, isManual, "grid");
  show(rowAutoRouteEl, isManual, "grid");
  show(rowRenderButtonEl, isManual, "flex");
  show(rowKursEl, isManual || isIbis, "grid");
  show(ibisControlsEl, isIbis, "grid");

  updateManualInputVisibility();

  if (nextMode === "live") {
    startLivePolling();
  } else {
    stopLivePolling();
  }
}

function updateManualInputVisibility() {
  if (state.mode !== "manual") {
    return;
  }

  const hasSelectedDestination = String(destinationSelectEl.value || "").trim().length > 0;
  const hideManualRouteFields = hasSelectedDestination;

  if (rowDestinationInputEl) {
    rowDestinationInputEl.style.display = hideManualRouteFields ? "none" : "grid";
  }
  if (rowRouteStopsEl) {
    rowRouteStopsEl.style.display = hideManualRouteFields ? "none" : "grid";
  }
}

function parseIbisTelegram(raw) {
  const result = { line: null, kurs: null, zielNum: null };
  const tokens = String(raw || "").trim().split(/\s+/).filter(Boolean);
  tokens.forEach((token) => {
    const lower = token.toLowerCase();
    const lineMatch = lower.match(/^l(\d+)$/);
    if (lineMatch) {
      result.line = String(parseInt(lineMatch[1], 10));
      return;
    }
    const kursMatch = lower.match(/^k(\d+)$/);
    if (kursMatch) {
      result.kurs = String(parseInt(kursMatch[1], 10));
      return;
    }
    const zielMatch = lower.match(/^z(\d{1,3})$/);
    if (zielMatch) {
      result.zielNum = parseInt(zielMatch[1], 10);
    }
  });
  return result;
}

function applyIbisInput(raw) {
  if (!state.dataConfig) {
    return;
  }
  const parsed = parseIbisTelegram(raw);
  if (parsed.line !== null) {
    state.ibis.line = parsed.line;
  }
  if (parsed.kurs !== null) {
    state.ibis.kurs = parsed.kurs;
    kursInputEl.value = parsed.kurs;
  }
  if (parsed.zielNum !== null) {
    state.ibis.zielNum = parsed.zielNum;
  }

  const destinations = Array.isArray(state.dataConfig.destinations) ? state.dataConfig.destinations : [];
  if (state.ibis.kurs !== null) {
    const kursNum = Number(state.ibis.kurs);
    const special = destinations.find((d) => Array.isArray(d?.ibis?.kurs) && d.ibis.kurs.includes(kursNum));
    if (special?.id) {
      destinationSelectEl.value = special.id;
      destinationInputEl.value = special.id;
    }
  }

  if (state.ibis.zielNum !== null) {
    const matched = destinations.find((d) => Array.isArray(d?.ibis?.ziel) && d.ibis.ziel.includes(state.ibis.zielNum));
    if (matched?.id) {
      destinationSelectEl.value = matched.id;
      destinationInputEl.value = matched.id;
    }
  }

  if (state.ibis.line !== null) {
    lineInputEl.value = state.ibis.line;
  }
  renderDeviceFromInputs();
}

function getSelectedLocationCode() {
  const value = String(deviceLocationSelectEl.value || "").trim().toUpperCase();
  if (value) {
    return value;
  }
  const fallback = String(state.dataConfig?.deviceLocation || "").trim().toUpperCase();
  return fallback;
}

function generateRouteTextFromConfig(lineRaw, destinationRaw) {
  if (!state.dataConfig || !autoRouteFromDataEl.checked) {
    return null;
  }
  const cfg = state.dataConfig;
  const trips = Array.isArray(cfg.trips) ? cfg.trips : [];
  const routes = Array.isArray(cfg.routes) ? cfg.routes : [];
  const stopsByCode = cfg.stops && typeof cfg.stops === "object" ? cfg.stops : {};
  const destId = String(destinationRaw || "").trim();

  const trip = resolveTripForLineAndDestination(lineRaw, destinationRaw, true);

  const routeId = trip?.flaps?.route;
  if (!routeId) {
    return null;
  }
  const route = routes.find((r) => r.id === routeId);
  if (!route || !Array.isArray(route.stops)) {
    return null;
  }

  const currentLoc = getSelectedLocationCode();
  let descriptors = route.stops.map((entry) => resolveRouteStopObject(entry, stopsByCode));
  if (currentLoc) {
    const idx = descriptors.findIndex((item) => item.stopId === currentLoc);
    if (idx >= 0) {
      descriptors = descriptors.slice(idx + 1);
    }
  }

  const displayText = descriptors
    .filter((item) => item.showOnDisplay && item.displayName)
    .map((item) => (item.hasBusConnection ? `${item.displayName} 🚌` : item.displayName))
    .join(" - ");
  const displayStops = descriptors
    .filter((item) => item.showOnDisplay && item.displayName)
    .map((item) => (item.hasBusConnection ? `${item.displayName} 🚌` : item.displayName));
  const announcementText = descriptors
    .filter((item) => item.playAnnouncement && item.spokenName)
    .map((item) => item.spokenName)
    .join(", ");

  return { displayText, displayStops, announcementText };
}

function resolveTripForLineAndDestination(lineRaw, destinationRaw, allowDestFallback = false) {
  const cfg = state.dataConfig;
  if (!cfg) {
    return null;
  }

  const destId = String(destinationRaw || "").trim();
  if (!destId) {
    return null;
  }

  const trips = Array.isArray(cfg.trips) ? cfg.trips : [];
  const lineObj = resolveLineRender(lineRaw);
  const lineTextNorm = String(lineObj.text || "").trim();
  const lineInputNorm = String(lineRaw || "").trim();
  const normalizeLine = (value) => {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (/^\d+$/.test(raw)) {
      return String(parseInt(raw, 10));
    }
    return raw.toUpperCase();
  };
  const candidateLines = new Set([normalizeLine(lineInputNorm), normalizeLine(lineTextNorm)].filter(Boolean));

  const strictTrip = trips.find((t) => {
    const tripDest = String(t?.dest || "").trim();
    const tripLine = normalizeLine(t?.line || "");
    return tripDest === destId && candidateLines.has(tripLine);
  });

  if (strictTrip) {
    return strictTrip;
  }

  if (!allowDestFallback) {
    return null;
  }

  return trips.find((t) => String(t.dest || "").trim() === destId) || null;
}

function hasTripForLineAndDestination(lineRaw, destinationRaw) {
  const cfg = state.dataConfig;
  if (!cfg) {
    return false;
  }

  const destId = String(destinationRaw || "").trim();
  if (!destId) {
    return false;
  }

  const trips = Array.isArray(cfg.trips) ? cfg.trips : [];
  const normalizeLine = (value) => {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (/^\d+$/.test(raw)) {
      return String(parseInt(raw, 10));
    }
    return raw.toUpperCase();
  };

  const lineRender = resolveLineRender(lineRaw);
  const candidates = new Set([
    normalizeLine(lineRaw),
    normalizeLine(lineRender.text),
    String(lineRaw || "").trim(),
    String(lineRender.text || "").trim()
  ].filter(Boolean));

  return trips.some((t) => {
    const tripDest = String(t?.dest || "").trim();
    if (tripDest !== destId) {
      return false;
    }
    const tripLineRaw = String(t?.line || "").trim();
    const tripLineNorm = normalizeLine(tripLineRaw);
    return candidates.has(tripLineRaw) || candidates.has(tripLineNorm);
  });
}

function resolveSpecialDestinationByKurs(kursRaw) {
  const cfg = state.dataConfig;
  if (!cfg) {
    return null;
  }

  const digits = String(kursRaw || "").replace(/\D/g, "").slice(0, 2);
  if (!digits) {
    return null;
  }

  const kursNum = Number(digits);
  if (!Number.isFinite(kursNum)) {
    return null;
  }

  const destinations = Array.isArray(cfg.destinations) ? cfg.destinations : [];
  const matched = destinations.find((d) => Array.isArray(d?.ibis?.kurs) && d.ibis.kurs.includes(kursNum));
  return matched?.id || null;
}

function hasKursValue(kursRaw) {
  return String(kursRaw || "").replace(/\D/g, "").slice(0, 2).length > 0;
}

function getEffectiveDestinationId(rawDestination, kursRaw) {
  const specialDestId = resolveSpecialDestinationByKurs(kursRaw);
  if (hasKursValue(kursRaw)) {
    return String(specialDestId || "").trim();
  }

  const raw = String(rawDestination || "").trim();
  if (!raw) {
    return "";
  }

  const cfg = state.dataConfig;
  const destinations = Array.isArray(cfg?.destinations) ? cfg.destinations : [];
  const matched = destinations.find((d) => d.id === raw || d.label === raw || d.name === raw);
  return String(matched?.id || raw).trim();
}

function isKnownDestinationRaw(rawDestination) {
  const raw = String(rawDestination || "").trim();
  if (!raw) {
    return true;
  }

  const cfg = state.dataConfig;
  const destinations = Array.isArray(cfg?.destinations) ? cfg.destinations : [];
  return destinations.some((d) => d.id === raw || d.label === raw || d.name === raw);
}

function isSpecialDestinationId(destinationId) {
  const id = String(destinationId || "").trim();
  if (!id) {
    return false;
  }

  const cfg = state.dataConfig;
  const destinations = Array.isArray(cfg?.destinations) ? cfg.destinations : [];
  const match = destinations.find((d) => String(d?.id || "").trim() === id);
  return Boolean(match && Array.isArray(match?.ibis?.kurs) && match.ibis.kurs.length > 0);
}

function getRawDestinationSelection() {
  const selected = String(destinationSelectEl?.value || "").trim();
  if (selected) {
    if (destinationInputEl && destinationInputEl.value !== selected) {
      destinationInputEl.value = selected;
    }
    return selected;
  }
  return String(destinationInputEl?.value || "").trim();
}

function isTerminusForSelection(lineRaw, destinationRaw, locationCode) {
  const loc = String(locationCode || "").trim().toUpperCase();
  const destId = String(destinationRaw || "").trim().toUpperCase();
  if (!loc || !destId) {
    return false;
  }

  if (destId === loc) {
    return true;
  }

  const cfg = state.dataConfig;
  if (!cfg) {
    return false;
  }

  const trip = resolveTripForLineAndDestination(lineRaw, destinationRaw, true);
  const routeId = trip?.flaps?.route;
  if (!routeId) {
    return false;
  }

  const routes = Array.isArray(cfg.routes) ? cfg.routes : [];
  const stopsByCode = cfg.stops && typeof cfg.stops === "object" ? cfg.stops : {};
  const route = routes.find((r) => r.id === routeId);
  if (!route || !Array.isArray(route.stops) || !route.stops.length) {
    return false;
  }

  const descriptors = route.stops.map((entry) => resolveRouteStopObject(entry, stopsByCode));
  const lastStop = descriptors[descriptors.length - 1];
  return String(lastStop?.stopId || "").trim().toUpperCase() === loc;
}

function mapLiveDestinationToId(destName) {
  const cfg = state.dataConfig;
  if (!cfg) {
    return null;
  }
  const destinations = Array.isArray(cfg.destinations) ? cfg.destinations : [];
  const normalized = String(destName || "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/g, "");
  if (!normalized) {
    return null;
  }
  const match = destinations.find((d) => {
    const candidate = String(d.name || d.label || d.id || "")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]/g, "");
    return candidate && (candidate.includes(normalized) || normalized.includes(candidate));
  });
  return match?.id || null;
}

function applyLiveIdleState() {
  lineInputEl.value = "";
  destinationSelectEl.value = "";
  destinationInputEl.value = "";
  routeStopsInputEl.value = "";
  state.currentLiveTrip = null;
  renderDeviceFromInputs();
}

function resetInputsOnLoad() {
  lineInputEl.value = "";
  destinationSelectEl.value = "";
  destinationInputEl.value = "";
  routeStopsInputEl.value = "";
  kursInputEl.value = "";
  ibisInputEl.value = "";
  state.ibis = { line: null, kurs: null, zielNum: null };
}

async function fetchLiveDataOnce() {
  if (state.liveFetchInFlight) {
    return;
  }
  state.liveFetchInFlight = true;

  const cfg = state.dataConfig;
  if (!cfg || !cfg.efaEndpoint) {
    state.liveFetchInFlight = false;
    applyLiveIdleState();
    return;
  }
  const locCode = getSelectedLocationCode();
  const stop = cfg.stops?.[locCode];
  if (!stop?.efaId) {
    state.liveFetchInFlight = false;
    applyLiveIdleState();
    return;
  }

  const url = new URL(cfg.efaEndpoint);
  url.searchParams.set("outputFormat", "rapidJSON");
  url.searchParams.set("type_dm", "any");
  url.searchParams.set("name_dm", stop.efaId);
  url.searchParams.set("useRealtime", "1");
  url.searchParams.set("deleteAssignedStops_dm", "1");
  url.searchParams.set("mode", "direct");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const events = Array.isArray(data.stopEvents) ? data.stopEvents : [];
    const selectedPlatform = String(platformSelectEl.value || "1");
    const active = events
      .filter((event) => {
        const status = event?.realtimeStatus;
        if (Array.isArray(status) && status.includes("CANCELLED")) {
          return false;
        }
        const p1 = String(event?.location?.properties?.platform || "").toLowerCase();
        const p2 = String(event?.location?.properties?.platformName || "").toLowerCase();
        const sel = selectedPlatform.toLowerCase();
        return p1 === sel || p2 === sel || p2.includes(`gleis ${sel}`) || p2.includes(`steig ${sel}`);
      })
      .sort((a, b) => {
        const ta = new Date(a.departureTimeEstimated || a.departureTimePlanned || 0).getTime();
        const tb = new Date(b.departureTimeEstimated || b.departureTimePlanned || 0).getTime();
        return ta - tb;
      });

    if (!active.length) {
      applyLiveIdleState();
      return;
    }

    const trip = active[0];
    const depTimeMs = new Date(trip?.departureTimeEstimated || trip?.departureTimePlanned || 0).getTime();
    const nowMs = Date.now();
    const timeToDepartureMs = depTimeMs - nowMs;
    const inDisplayWindow = timeToDepartureMs <= 30000 && timeToDepartureMs >= -10000;
    const tripId = `${String(trip?.transportation?.id || "")}_${String(trip?.departureTimePlanned || depTimeMs)}`;

    if (!inDisplayWindow) {
      applyLiveIdleState();
      return;
    }

    if (state.currentLiveTrip === tripId) {
      return;
    }

    const line = String(trip?.transportation?.disassembledName || "").trim();
    const destName = String(trip?.transportation?.destination?.name || "").trim();
    if (!line) {
      return;
    }

    lineInputEl.value = line;
    const destId = mapLiveDestinationToId(destName);
    if (destId) {
      destinationSelectEl.value = destId;
      destinationInputEl.value = destId;
    } else {
      destinationSelectEl.value = "";
      destinationInputEl.value = destName;
    }

    renderDeviceFromInputs();
    state.currentLiveTrip = tripId;
    try {
      await synthesizeAndPlayAnnouncement();
    } catch (error) {
      // Ignore TTS errors in live mode.
    }
  } catch (error) {
    // Ignore polling errors; next tick retries.
  } finally {
    state.liveFetchInFlight = false;
  }
}

function startLivePolling() {
  stopLivePolling();
  fetchLiveDataOnce();
  state.livePollingInterval = window.setInterval(fetchLiveDataOnce, 5000);
}

function stopLivePolling() {
  if (state.livePollingInterval) {
    window.clearInterval(state.livePollingInterval);
    state.livePollingInterval = null;
  }
  state.currentLiveTrip = null;
  state.liveFetchInFlight = false;
}

async function loadGlyphsFromFile() {
  setStatus("Loading glyphs.json...");

  try {
    const response = await fetch("glyphs.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Load failed.");
    }

    const payload = await response.json();
    const count = applyGlyphStore(payload || {});
    setStatus(`Loaded ${count} glyph(s).`);
  } catch (error) {
    setStatus(`Load failed: ${error.message}`, true);
  }
}

function resolveLineRender(inputValue) {
  const raw = String(inputValue || "").trim();
  const fallback = { text: raw, bg: state.lineSelectedColor, fg: "#ffffff" };
  const cfg = state.dataConfig;
  if (!cfg) {
    return fallback;
  }

  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const trips = Array.isArray(cfg.trips) ? cfg.trips : [];
  let lineObj = lines.find((line) => line.id === raw || line.text === raw) || null;

  if (!lineObj) {
    const trip = trips.find((t) => String(t.line || "").trim() === raw);
    const flapsLineId = trip?.flaps?.line;
    if (flapsLineId) {
      lineObj = lines.find((line) => line.id === flapsLineId) || null;
    }
  }

  if (!lineObj) {
    return fallback;
  }

  return {
    text: String(lineObj.text ?? raw),
    bg: String(lineObj.backgroundColor || state.lineSelectedColor),
    fg: String(lineObj.textColor || "#ffffff")
  };
}

function hasConfiguredLineForInput(inputValue) {
  const raw = String(inputValue || "").trim();
  if (!raw) {
    return false;
  }

  const cfg = state.dataConfig;
  if (!cfg) {
    return false;
  }

  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const trips = Array.isArray(cfg.trips) ? cfg.trips : [];
  let lineObj = lines.find((line) => line.id === raw || line.text === raw) || null;

  if (!lineObj) {
    const trip = trips.find((t) => String(t.line || "").trim() === raw);
    const flapsLineId = trip?.flaps?.line;
    if (flapsLineId) {
      lineObj = lines.find((line) => line.id === flapsLineId) || null;
    }
  }

  if (!lineObj) {
    return false;
  }

  return Boolean(String(lineObj.backgroundColor || "").trim() && String(lineObj.textColor || "").trim());
}

function resolveDestinationRender(inputValue) {
  const raw = String(inputValue || "").trim();
  const cfg = state.dataConfig;
  if (!cfg) {
    return raw;
  }

  const destinations = Array.isArray(cfg.destinations) ? cfg.destinations : [];
  const dest = destinations.find((d) => d.id === raw || d.label === raw || d.name === raw);
  return dest ? String(dest.name || dest.label || raw) : raw;
}

function resolveDestinationPhonetic(inputValue) {
  const raw = String(inputValue || "").trim();
  if (raw === "NICHT_EINSTEIGEN") {
    return "Bitte nicht einsteigen";
  }
  const cfg = state.dataConfig;
  if (!cfg) {
    return raw;
  }

  const destinations = Array.isArray(cfg.destinations) ? cfg.destinations : [];
  const dest = destinations.find((d) => d.id === raw || d.label === raw || d.name === raw);
  return dest ? String(dest.ttsPhonetic || dest.name || dest.label || raw) : raw;
}

function resolveRouteStopObject(stopEntry, stopsByCode) {
  const defaults = {
    stopId: null,
    displayName: "",
    spokenName: "",
    hasBusConnection: false,
    showOnDisplay: true,
    playAnnouncement: true
  };

  if (typeof stopEntry === "string") {
    const code = String(stopEntry).trim();
    const stop = stopsByCode[code];
    if (stop) {
      return {
        ...defaults,
        stopId: code,
        displayName: String(stop.name || code),
        spokenName: String(stop.ttsPhonetic || stop.name || code),
        hasBusConnection: Boolean(stop.busConnection)
      };
    }
    return {
      ...defaults,
      displayName: code,
      spokenName: code
    };
  }

  if (!stopEntry || typeof stopEntry !== "object") {
    return defaults;
  }

  const stopId = stopEntry.stopId ? String(stopEntry.stopId) : null;
  const stop = stopId ? stopsByCode[stopId] : null;
  const displayName = String(stopEntry.name || stop?.name || stopId || "").trim();
  const spokenName = String(stopEntry.ttsPhonetic || stop?.ttsPhonetic || displayName).trim();

  return {
    ...defaults,
    stopId,
    displayName,
    spokenName,
    hasBusConnection: stopEntry.busConnection === true || Boolean(stop?.busConnection),
    showOnDisplay: stopEntry.showOnDisplay !== false,
    playAnnouncement: stopEntry.playAnnouncement !== false
  };
}

function resolveRouteStopsRender(inputValue) {
  const raw = String(inputValue || "");
  const cfg = state.dataConfig;
  if (!cfg) {
    return raw;
  }

  const routeId = raw.trim();
  const routes = Array.isArray(cfg.routes) ? cfg.routes : [];
  const stops = cfg.stops && typeof cfg.stops === "object" ? cfg.stops : {};
  const route = routes.find((r) => r.id === routeId);
  if (!route || !Array.isArray(route.stops)) {
    return raw;
  }

  const descriptors = route.stops
    .map((stopEntry) => resolveRouteStopObject(stopEntry, stops))
    .filter((item) => item.showOnDisplay && item.displayName);
  return descriptors
    .map((item) => (item.hasBusConnection ? `${item.displayName} 🚌` : item.displayName))
    .join(" - ");
}

function getGlyph(size, char) {
  const bucket = glyphLibrary[size] || {};
  return bucket[char] || bucket[char.toUpperCase()] || bucket[char.toLowerCase()] || null;
}

function getFallbackCharWidth(size) {
  if (size === "line") {
    return 8;
  }
  if (size === "small") {
    return 4;
  }
  if (size === "medium") {
    return 6;
  }
  return 8;
}

function getSpaceWidth(size) {
  if (size === "line") {
    return 4;
  }
  if (size === "small") {
    return 2;
  }
  if (size === "medium") {
    return 3;
  }
  return 4;
}

function estimateGlyphHeight(size) {
  return SIZE_PRESETS[size].height;
}

function getLetterSpacing(size) {
  return size === "large" || size === "medium" || size === "line" ? 2 : 1;
}

function measureTextWidth(text, size) {
  let width = 0;
  const chars = [...String(text || "")];
  const spacing = getLetterSpacing(size);

  chars.forEach((ch, idx) => {
    if (ch === " ") {
      width += getSpaceWidth(size);
    } else {
      const glyph = getGlyph(size, ch);
      width += Number(glyph?.charWidth || glyph?.width || getFallbackCharWidth(size));
    }

    if (idx < chars.length - 1) {
      width += spacing;
    }
  });

  return width;
}

function measureTextHeight(text, size) {
  let h = estimateGlyphHeight(size);
  [...String(text || "")].forEach((ch) => {
    const glyph = getGlyph(size, ch);
    if (glyph && Number(glyph.height) > h) {
      h = Number(glyph.height);
    }
  });
  return h;
}

function canRenderTextInSize(text, size) {
  return [...String(text || "")].every((ch) => ch === " " || Boolean(getGlyph(size, ch)));
}

function pickRenderableTextSize(text, preferredSizes) {
  for (const size of preferredSizes) {
    if (canRenderTextInSize(text, size)) {
      return size;
    }
  }
  return preferredSizes[preferredSizes.length - 1];
}

function clearDevicePixels() {
  for (let row = 0; row < LINE_ROWS; row += 1) {
    for (let col = 0; col < LINE_COLS; col += 1) {
      state.linePixels[row][col].on = false;
      state.linePixels[row][col].color = state.lineSelectedColor;
    }
  }

  for (let row = 0; row < DEST_ROWS; row += 1) {
    for (let col = 0; col < DEST_COLS; col += 1) {
      state.destinationPixels[row][col].on = false;
    }
  }
}

function colorToRgb(color) {
  const raw = String(color || "").trim().toLowerCase();
  const named = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    navy: { r: 0, g: 0, b: 128 }
  };
  if (named[raw]) {
    return named[raw];
  }

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1];
    if (value.length === 3) {
      return {
        r: parseInt(value[0] + value[0], 16),
        g: parseInt(value[1] + value[1], 16),
        b: parseInt(value[2] + value[2], 16)
      };
    }
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  const rgb = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
  if (rgb) {
    return {
      r: clampNum(rgb[1], 0, 255),
      g: clampNum(rgb[2], 0, 255),
      b: clampNum(rgb[3], 0, 255)
    };
  }

  return { r: 0, g: 0, b: 0 };
}

function dimColor(color, factor = 0.22) {
  const { r, g, b } = colorToRgb(color);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

function fillLineFieldBackground(color) {
  const bg = String(color || "#000000");
  for (let row = 0; row < LINE_ROWS; row += 1) {
    for (let col = 0; col < LINE_COLS; col += 1) {
      state.linePixels[row][col].on = true;
      state.linePixels[row][col].color = bg;
    }
  }
}

function renderNoSmokingIconFromConfig() {
  const cfg = state.dataConfig;
  const icon = cfg?.noSmokingLineIcon;
  if (!icon || !Array.isArray(icon.rows)) {
    return false;
  }

  const width = Math.min(LINE_COLS, Number(icon.width || LINE_COLS));
  const height = Math.min(LINE_ROWS, Number(icon.height || LINE_ROWS));
  const palette = icon.palette && typeof icon.palette === "object" ? icon.palette : {};

  for (let row = 0; row < height; row += 1) {
    const rowSpec = String(icon.rows[row] || "");
    for (let col = 0; col < width; col += 1) {
      const code = rowSpec[col];
      const color = palette[code];
      if (!color) {
        continue;
      }
      setLinePixel(row, col, String(color));
    }
  }
  return true;
}

function setLinePixel(row, col, color) {
  if (row < 0 || col < 0 || row >= LINE_ROWS || col >= LINE_COLS) {
    return;
  }
  state.linePixels[row][col].on = true;
  state.linePixels[row][col].color = color;
}

function setDestinationPixel(row, col) {
  if (row < 0 || col < 0 || row >= DEST_ROWS || col >= DEST_COLS) {
    return;
  }
  state.destinationPixels[row][col].on = true;
}

function drawGlyphToField(field, glyph, x, y, color) {
  if (!glyph) {
    return;
  }

  const pixels = getGlyphPixels(glyph);
  const maxWidth = Number(glyph.charWidth || glyph.width || 0);
  const maxHeight = Number(glyph.height || pixels.length || 0);

  for (let row = 0; row < maxHeight; row += 1) {
    const rowPixels = Array.isArray(pixels[row]) ? pixels[row] : [];
    for (let col = 0; col < maxWidth; col += 1) {
      const px = rowPixels[col];
      if (!px || !px.on) {
        continue;
      }

      if (field === "line") {
        setLinePixel(y + row, x + col, color || px.color || state.lineSelectedColor);
      } else {
        setDestinationPixel(y + row, x + col);
      }
    }
  }
}

function drawTextToField(field, text, size, x, y, color, maxWidth) {
  const chars = [...String(text || "")];
  let cursorX = x;
  const spacing = getLetterSpacing(size);

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === " ") {
      cursorX += getSpaceWidth(size) + spacing;
      if (cursorX >= maxWidth) {
        break;
      }
      continue;
    }

    const glyph = getGlyph(size, ch);
    const glyphWidth = Number(glyph?.charWidth || glyph?.width || getFallbackCharWidth(size));

    if (cursorX + glyphWidth > maxWidth) {
      break;
    }

    if (glyph) {
      drawGlyphToField(field, glyph, cursorX, y, color);
    }

    cursorX += glyphWidth + spacing;
  }
}

function splitWordToFit(word, size, maxWidth) {
  const pieces = [];
  let rest = word;

  while (rest.length) {
    let part = rest;
    while (part.length > 1 && measureTextWidth(part, size) > maxWidth) {
      part = part.slice(0, -1);
    }

    if (measureTextWidth(part, size) > maxWidth) {
      break;
    }

    pieces.push(part);
    rest = rest.slice(part.length);
  }

  if (!pieces.length) {
    pieces.push(word);
  }

  return pieces;
}

function wrapTextToLines(text, size, maxWidth) {
  const tokens = String(text || "")
    .replace(/\t/g, "    ")
    .match(/ +|[^ ]+/g) || [];

  const lines = [];
  let current = "";

  tokens.forEach((token) => {
    const candidate = `${current}${token}`;
    if (measureTextWidth(candidate, size) <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (measureTextWidth(token, size) <= maxWidth) {
      current = token;
      return;
    }

    const parts = splitWordToFit(token, size, maxWidth);
    parts.forEach((part, idx) => {
      if (idx < parts.length - 1) {
        lines.push(part);
      } else {
        current = part;
      }
    });
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function parseRouteParagraphs(rawValue) {
  const normalized = String(rawValue || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n");

  return normalized
    .split("\n")
    .map((line) => {
      const expanded = line.replace(/\t/g, "    ");
      const leadingSpaces = (expanded.match(/^\s*/) || [""])[0];
      const content = expanded.slice(leadingSpaces.length);

      const joined = content
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" - ");

      return `${leadingSpaces}${joined}`;
    })
    .filter(Boolean);
}

function getWrappedRouteLines(rawValue, maxWidth) {
  const paragraphs = parseRouteParagraphs(rawValue);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    const wrapped = wrapTextToLines(paragraph, "small", maxWidth);
    wrapped.forEach((line) => lines.push(line));
  });

  return lines;
}

function getWrappedRouteStopLines(stops, maxWidth) {
  const labels = Array.isArray(stops) ? stops.filter(Boolean).map((s) => String(s)) : [];
  if (!labels.length) {
    return [];
  }

  const lines = [];
  let current = "";

  labels.forEach((label) => {
    const candidate = current ? `${current} - ${label}` : label;
    if (measureTextWidth(candidate, "small") <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (measureTextWidth(label, "small") <= maxWidth) {
      current = label;
      return;
    }

    const wrapped = wrapTextToLines(label, "small", maxWidth);
    if (wrapped.length) {
      lines.push(...wrapped.slice(0, -1));
      current = wrapped[wrapped.length - 1];
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function stopActiveAudio() {
  if (!state.activeAudio) {
    return;
  }
  try {
    state.activeAudio.pause();
  } catch (error) {
    // Ignore.
  }
  if (state.activeAudio._objectUrl) {
    URL.revokeObjectURL(state.activeAudio._objectUrl);
  }
  state.activeAudio = null;
}

function playAudioBuffer(arrayBuffer) {
  stopActiveAudio();
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  audio._objectUrl = objectUrl;
  audio.onended = () => {
    if (audio._objectUrl) {
      URL.revokeObjectURL(audio._objectUrl);
      audio._objectUrl = null;
    }
    if (state.activeAudio === audio) {
      state.activeAudio = null;
    }
  };
  state.activeAudio = audio;
  return audio.play();
}

function buildAnnouncementText() {
  const lineRender = resolveLineRender(lineInputEl.value);
  const lineText = String(lineRender.text || "").trim();
  const specialDestId = resolveSpecialDestinationByKurs(kursInputEl.value);
  const destinationId = getEffectiveDestinationId(getRawDestinationSelection(), kursInputEl.value);
  const locationCode = getSelectedLocationCode();
  const isTerminus = isTerminusForSelection(lineInputEl.value, destinationId, locationCode);
  const isSpecialKurs = Boolean(specialDestId) || isSpecialDestinationId(destinationId);
  const canUseEinsatzFallback = hasConfiguredLineForInput(lineInputEl.value);
  const isEinsatzwagen =
    canUseEinsatzFallback &&
    !isSpecialKurs &&
    Boolean(destinationId) &&
    !hasTripForLineAndDestination(lineInputEl.value, destinationId);
  const lineAnnouncement = isEinsatzwagen ? "Einsatzwagen" : `Linie ${lineText}`;
  const destinationText = resolveDestinationPhonetic(destinationId);
  const autoRoute = generateRouteTextFromConfig(lineInputEl.value, destinationId);
  const routeStopsRaw = autoRoute?.announcementText ?? resolveRouteStopsRender(routeStopsInputEl.value);

  let routePhrase = String(routeStopsRaw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, ", ")
    .replace(/\s*-\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  const destPhrase = String(destinationText || "").trim();
  if (destPhrase) {
    const routeNorm = routePhrase.toLowerCase().replace(/[^a-z0-9äöüß]/gi, "");
    const destNorm = destPhrase.toLowerCase().replace(/[^a-z0-9äöüß]/gi, "");
    if (!routeNorm || !destNorm || !routeNorm.includes(destNorm)) {
      routePhrase = routePhrase ? `${routePhrase}, ${destPhrase}` : destPhrase;
    }
  }

  if (isTerminus) {
    return "\\spd=170\\\\vct=95\\Bitte nicht einsteigen. Dieser Zug endet hier.";
  }

  if (isSpecialKurs) {
    return destinationText ? `\\spd=170\\\\vct=95\\${destinationText}` : null;
  }

  if ((!isEinsatzwagen && !lineText) || !routePhrase) {
    return null;
  }

  return `\\spd=170\\\\vct=95\\${lineAnnouncement} \\pau=300\\ Richtung: \\pau=150\\ ${routePhrase}`;
}

async function synthesizeAndPlayAnnouncement() {
  const text = buildAnnouncementText();
  if (!text) {
    return;
  }

  const tokenResponse = await fetch(ACAPELA_TOKEN_URL, {
    headers: { Accept: "application/json" }
  });
  if (!tokenResponse.ok) {
    throw new Error(`Token request failed (${tokenResponse.status}).`);
  }
  const tokenPayload = await tokenResponse.json();
  const token = tokenPayload?.token;
  if (!token) {
    throw new Error("No TTS token returned.");
  }

  const params = new URLSearchParams({
    voice: ACAPELA_VOICE,
    text,
    output: "stream",
    type: "mp3",
    samplerate: "22050",
    token
  });

  const audioResponse = await fetch(`${ACAPELA_API_URL}?${params.toString()}`, {
    headers: {
      Referer: "https://www.acapela-group.com/",
      Origin: "https://www.acapela-group.com"
    }
  });
  if (!audioResponse.ok) {
    throw new Error(`TTS synthesis failed (${audioResponse.status}).`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  await playAudioBuffer(audioBuffer);
}

async function handleRenderDisplayClick() {
  renderDeviceFromInputs();
  try {
    await synthesizeAndPlayAnnouncement();
  } catch (error) {
    console.warn("Announcement synthesis/playback failed:", error.message);
  }
}

function renderDeviceFromInputs() {
  clearDevicePixels();

  const rawLineInput = String(lineInputEl.value || "").trim();
  const rawDestinationSelection = getRawDestinationSelection();
  const kursActive = hasKursValue(kursInputEl.value);

  const lineRender = resolveLineRender(lineInputEl.value);
  const lineText = String(lineRender.text || "").trim();
  const specialDestId = resolveSpecialDestinationByKurs(kursInputEl.value);
  const destinationId = getEffectiveDestinationId(rawDestinationSelection, kursInputEl.value);
  const locationCode = getSelectedLocationCode();
  const platformCode = String(platformSelectEl.value || "").trim();
  const isRthPlatform2Default =
    !lineText &&
    !destinationId &&
    locationCode === "RTH" &&
    platformCode === "2";
  if (isRthPlatform2Default) {
    drawTextToField("destination", "StadtBahnen in Richtung", "small", 5, 4, "#ff9d00", DEST_COLS - 1);

    const defaultDest = "Jahnplatz - HBF";
    const size = "medium";
    const textHeight = measureTextHeight(defaultDest, size);
    const y = Math.max(0, DEST_ROWS - textHeight - 1);
    drawTextToField("destination", defaultDest, size, 5, y, "#ff9d00", DEST_COLS - 1);

    renderLineField();
    renderDestinationField();
    return;
  }

  const isNoSmokingDefault =
    !lineText &&
    !destinationId &&
    (locationCode === "HBF" || locationCode === "JPL");
  if (isNoSmokingDefault && renderNoSmokingIconFromConfig()) {
    renderLineField();
    renderDestinationField();
    return;
  }

  const isTerminus = isTerminusForSelection(lineInputEl.value, destinationId, locationCode);
  const isSpecialKurs = Boolean(specialDestId) || isSpecialDestinationId(destinationId);
  const isSpecialNichtEinsteigen = destinationId === "NICHT_EINSTEIGEN";
  const hasInvalidLine = Boolean(rawLineInput) && !hasConfiguredLineForInput(rawLineInput);
  const hasInvalidDestination = Boolean(String(rawDestinationSelection || "").trim()) && !isKnownDestinationRaw(rawDestinationSelection);
  const isInvalidInputState = !kursActive && (hasInvalidLine || hasInvalidDestination);
  const canUseEinsatzFallback = hasConfiguredLineForInput(lineInputEl.value);
  const isEinsatzwagen =
    !isInvalidInputState &&
    canUseEinsatzFallback &&
    !isSpecialKurs &&
    Boolean(destinationId) &&
    !hasTripForLineAndDestination(lineInputEl.value, destinationId);
  const displayLineText = isInvalidInputState ? "" : isTerminus ? "" : isSpecialKurs ? "" : isEinsatzwagen ? "E" : lineText;
  const lineBgColor = lineRender.bg || state.lineSelectedColor;
  const lineFgColor = lineRender.fg || "#ffffff";

  const terminusLines = ["NICHT EINSTEIGEN", "ZUG ENDET HIER"];
  const invalidInputText =
    String(state.dataConfig?.messages?.invalidInputText || "") ||
    "Bitte auf Lautsprecherdurchsagen und Wagenbeschilderung achten";
  const destinationText = isInvalidInputState
    ? invalidInputText
    : isTerminus
      ? terminusLines.join("\n")
      : resolveDestinationRender(destinationId);
  const autoRoute = generateRouteTextFromConfig(lineInputEl.value, destinationId);
  const routeStopsRaw = isInvalidInputState
    ? ""
    : isTerminus
      ? ""
      : isSpecialKurs
        ? ""
        : autoRoute?.displayText ?? resolveRouteStopsRender(routeStopsInputEl.value);
  const routeStopsSegments = isInvalidInputState || isTerminus || isSpecialKurs ? null : autoRoute?.displayStops || null;
  const destinationHeight = destinationText ? measureTextHeight(destinationText, "large") : 0;
  const destinationStartY = destinationText ? Math.max(0, DEST_ROWS - destinationHeight - 1) : DEST_ROWS;
  const topAreaMaxY = Math.max(0, destinationStartY - 1);

  if (displayLineText) {
    state.lineSelectedColor = lineBgColor;
    fillLineFieldBackground(lineBgColor);

    const size = "line";
    const textWidth = measureTextWidth(displayLineText, size);
    const textHeight = measureTextHeight(displayLineText, size);
    const x = Math.max(0, Math.floor((LINE_COLS - textWidth) / 2));
    const y = Math.max(0, Math.floor((LINE_ROWS - textHeight) / 2));
    drawTextToField("line", displayLineText, size, x, y, lineFgColor, LINE_COLS - 1);
  }

  const routeLines = routeStopsSegments
    ? getWrappedRouteStopLines(routeStopsSegments, DEST_COLS - 2)
    : getWrappedRouteLines(routeStopsRaw, DEST_COLS - 2);
  const routeLineHeight = measureTextHeight("A", "small") + 2;
  let routeY = 4;

  routeLines.forEach((routeLine) => {
    if (!routeLine) {
      routeY += routeLineHeight;
      return;
    }

    const lineHeight = measureTextHeight(routeLine, "small");
    if (routeY + lineHeight > topAreaMaxY) {
      return;
    }

    drawTextToField("destination", routeLine, "small", 5, routeY, "#ff9d00", DEST_COLS - 1);
    routeY += routeLineHeight;
  });

  if (destinationText) {
    if (isInvalidInputState) {
      const x = 5;
      const size = "small";
      const lineHeight = measureTextHeight("A", size);
      const lineGap = 2;
      let y = 4;
      const normalized = String(destinationText)
        .replace(/\r\n/g, "\n")
        .replace(/\\n/g, "\n");
      const paragraphs = normalized
        .split("\n")
        .filter((line) => line.length > 0);
      const lines = [];
      paragraphs.forEach((paragraph) => {
        const wrapped = wrapTextToLines(paragraph, size, DEST_COLS - 2);
        wrapped.forEach((line) => lines.push(line));
      });
      lines.forEach((line) => {
        if (y + lineHeight > DEST_ROWS - 1) {
          return;
        }
        drawTextToField("destination", line, size, x, y, "#ff9d00", DEST_COLS - 1);
        y += lineHeight + lineGap;
      });
    } else if (isTerminus) {
      const x = 5;
      const size = "medium";
      const lineHeight = measureTextHeight("A", size);
      const lineGap = 2;
      const totalHeight = lineHeight * terminusLines.length + lineGap * (terminusLines.length - 1);
      let y = Math.max(0, DEST_ROWS - totalHeight - 1);

      terminusLines.forEach((line, idx) => {
        drawTextToField("destination", line, size, x, y, "#ff9d00", DEST_COLS - 1);
        if (idx < terminusLines.length - 1) {
          y += lineHeight + lineGap;
        }
      });
    } else if (isSpecialNichtEinsteigen) {
      const x = 5;
      const size = "large";
      const lines = ["NICHT", "EINSTEIGEN"];
      const lineHeight = measureTextHeight("A", size);
      const lineGap = 2;
      const totalHeight = lineHeight * lines.length + lineGap * (lines.length - 1);
      let y = Math.max(0, DEST_ROWS - totalHeight - 1);

      lines.forEach((line, idx) => {
        drawTextToField("destination", line, size, x, y, "#ff9d00", DEST_COLS - 1);
        if (idx < lines.length - 1) {
          y += lineHeight + lineGap;
        }
      });
    } else {
      const destinationLines = String(destinationText)
        .replace(/\r\n/g, "\n")
        .replace(/\\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const destinationLength = destinationText.length;
      const bottomSize = destinationLength > 12 ? "medium" : "large";
      const hasRouteInfo = String(routeStopsRaw || "").trim().length > 0;
      const lineGap = bottomSize === "large" && !hasRouteInfo ? 8 : 2;
      const lines = destinationLines.length ? destinationLines : [destinationText];
      const lineHeight = measureTextHeight("A", bottomSize);
      const totalHeight = lineHeight * lines.length + lineGap * Math.max(0, lines.length - 1);
      const x = 5;
      const bottomOffset = bottomSize === "large" ? 4 : 1;
      let y = Math.max(0, DEST_ROWS - totalHeight - bottomOffset);

      lines.forEach((line, idx) => {
        drawTextToField("destination", line, bottomSize, x, y, "#ff9d00", DEST_COLS - 1);
        if (idx < lines.length - 1) {
          y += lineHeight + lineGap;
        }
      });
    }
  }

  renderLineField();
  renderDestinationField();
}

function getLedFromEvent(event, selector) {
  return event.target.closest(selector);
}

function applyDragToFontPixel(row, col) {
  const px = state.font.pixels[row][col];
  if (state.drag.mode === "paint") {
    px.on = true;
  } else {
    px.on = false;
  }
  renderFontCanvas();
}

function startFontDrag(row, col) {
  if (!state.fontEditorMode) {
    return;
  }

  const px = state.font.pixels[row][col];
  state.drag.mode = px.on ? "erase" : "paint";
  state.drag.active = true;
  applyDragToFontPixel(row, col);
}

function dragOverFont(event) {
  if (!state.drag.active) {
    return;
  }

  const target = getLedFromEvent(event, ".led.font-line");
  if (!target) {
    return;
  }

  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  applyDragToFontPixel(row, col);
}

function stopDrag() {
  state.drag.active = false;
}

function setupEvents() {
  tabDeviceEl.addEventListener("click", () => {
    state.view = "device";
    renderView();
  });

  tabFontEl.addEventListener("click", () => {
    if (!state.fontBuilderAvailable) {
      return;
    }
    state.view = "font";
    renderView();
  });

  destinationSideEl.addEventListener("change", () => {
    state.destinationSide = destinationSideEl.value;
    renderDeviceLayout();
  });

  dataModeSelectEl.addEventListener("change", () => {
    setMode(dataModeSelectEl.value);
  });

  [lineInputEl, destinationInputEl, routeStopsInputEl].forEach((el) =>
    el.addEventListener("input", () => {
      updateManualInputVisibility();
      renderDeviceFromInputs();
    })
  );
  deviceLocationSelectEl.addEventListener("change", () => {
    if (state.dataConfig) {
      state.dataConfig.deviceLocation = deviceLocationSelectEl.value || state.dataConfig.deviceLocation;
    }
    updatePlatformOptions(deviceLocationSelectEl.value);
    if (state.mode === "live") {
      fetchLiveDataOnce();
    } else {
      renderDeviceFromInputs();
    }
  });
  platformSelectEl.addEventListener("change", () => {
    if (state.mode === "live") {
      fetchLiveDataOnce();
    } else {
      renderDeviceFromInputs();
    }
  });
  destinationSelectEl.addEventListener("change", () => {
    const selected = destinationSelectEl.value;
    if (selected) {
      destinationInputEl.value = selected;
    }
    updateManualInputVisibility();
    renderDeviceFromInputs();
  });
  autoRouteFromDataEl.addEventListener("change", renderDeviceFromInputs);
  kursInputEl.addEventListener("input", () => {
    kursInputEl.value = kursInputEl.value.replace(/\D/g, "").slice(0, 2);
    state.ibis.kurs = kursInputEl.value ? String(parseInt(kursInputEl.value, 10)) : null;
  });
  ibisSendBtnEl.addEventListener("click", () => {
    applyIbisInput(ibisInputEl.value);
    ibisInputEl.value = "";
  });
  ibisInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyIbisInput(ibisInputEl.value);
      ibisInputEl.value = "";
    }
  });
  renderDeviceEl.addEventListener("click", handleRenderDisplayClick);

  fontCanvasEl.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    const target = getLedFromEvent(event, ".led.font-line");
    if (!target) {
      return;
    }
    event.preventDefault();
    startFontDrag(Number(target.dataset.row), Number(target.dataset.col));
  });

  fontCanvasEl.addEventListener("mouseover", dragOverFont);
  fontCanvasEl.addEventListener("dragstart", (event) => event.preventDefault());
  document.addEventListener("mouseup", stopDrag);
  window.addEventListener("blur", stopDrag);

  fontSizePresetEl.addEventListener("change", () => {
    applyPreset(fontSizePresetEl.value);
    setStatus(`Switched to ${fontSizePresetEl.value} preset.`);
  });

  glyphCharEl.addEventListener("input", () => {
    const char = firstChar(glyphCharEl.value);
    glyphCharEl.value = char;
    state.selectedGlyphChar = char;
    renderGlyphList();
  });

  newGlyphEl.addEventListener("click", () => {
    const char = firstChar(glyphCharEl.value);
    if (!char) {
      setStatus("Enter a character first.", true);
      return;
    }

    if (glyphLibrary[state.font.size]?.[char]) {
      loadGlyphIntoCanvas(char);
      return;
    }

    state.selectedGlyphChar = char;
    applyCanvasNumbers();
    setStatus(`New glyph '${char}' ready on canvas (${state.font.size}).`);
    renderGlyphList();
  });

  [canvasWidthEl, canvasHeightEl].forEach((el) => {
    el.addEventListener("change", () => {
      applyCanvasNumbers();
      setStatus("Canvas settings applied.");
    });
  });

  fontEditorToggleEl.addEventListener("change", () => {
    state.fontEditorMode = fontEditorToggleEl.checked;
    renderFontCanvas();
  });

  saveGlyphEl.addEventListener("click", async () => {
    let char = firstChar(glyphCharEl.value) || state.selectedGlyphChar;
    if (!char) {
      char = firstChar(prompt("Enter the character to save this painted glyph as:", "") || "");
      if (char) {
        glyphCharEl.value = char;
      }
    }

    if (!char) {
      setStatus("Enter one character for the glyph key.", true);
      return;
    }

    glyphLibrary[state.font.size][char] = {
      size: state.font.size,
      width: state.font.canvasWidth,
      charWidth: state.font.canvasWidth,
      height: state.font.canvasHeight,
      bits: getSerializedGlyphBits()
    };

    state.selectedGlyphChar = char;
    renderGlyphList();
    renderDeviceFromInputs();

    const autoSaved = await saveGlyphsToFileSilent();
    if (autoSaved) {
      setStatus(`Saved '${char}' in ${state.font.size} and wrote glyphs.json.`);
    } else if (window.location.protocol === "file:") {
      setStatus(`Saved '${char}' in memory. Start with node server.js to write glyphs.json.`, true);
    } else {
      setStatus(`Saved '${char}' in memory. File save endpoint unavailable.`, true);
    }
  });

  clearFontCanvasEl.addEventListener("click", () => {
    clearFontCanvas();
    setStatus("Font canvas cleared.");
  });

  deleteGlyphEl.addEventListener("click", async () => {
    const char = firstChar(glyphCharEl.value) || String(state.selectedGlyphChar || "").trim();
    if (!char) {
      setStatus("Select a character to delete.", true);
      return;
    }

    if (!glyphLibrary[state.font.size]?.[char]) {
      setStatus(`'${char}' does not exist in ${state.font.size}.`, true);
      return;
    }

    const ok = confirm(`Delete '${char}' from ${state.font.size}?`);
    if (!ok) {
      return;
    }

    delete glyphLibrary[state.font.size][char];
    state.selectedGlyphChar = "";
    glyphCharEl.value = "";
    resetFontCanvasPixels();
    rebuildFontCanvas();
    renderGlyphList();
    renderDeviceFromInputs();

    const autoSaved = await saveGlyphsToFileSilent();
    if (autoSaved) {
      setStatus(`Deleted '${char}' and updated glyphs.json.`);
    } else {
      setStatus(`Deleted '${char}' in memory.`, true);
    }
  });

}

async function init() {
  const serverReachable = await checkLocalServerHealth();
  applyFontBuilderAvailability(serverReachable);

  createLedGrid(lineFieldEl, LINE_ROWS, LINE_COLS, "line");
  createLedGrid(destinationFieldEl, DEST_ROWS, DEST_COLS, "destination");

  applyPreset(state.font.size);

  setupEvents();
  resetInputsOnLoad();
  setMode("manual");
  renderDeviceLayout();
  renderGlyphList();
  renderDeviceFromInputs();
  if (serverReachable) {
    setStatus("Ready. Device and Font Builder are available.");
  } else {
    setStatus("Ready. Local server unavailable, Font Builder is hidden.", true);
  }

  loadDataConfig();

  loadGlyphsFromFile();
}

init();
