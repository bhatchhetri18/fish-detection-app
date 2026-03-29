/**
 * app.js — AquaDetect v2.0 Main Application Logic
 * ═════════════════════════════════════════════════
 * Handles:
 *   • File upload, queue, drag-and-drop
 *   • Per-image View / Crop / Remove queue actions
 *   • Detection API calls
 *   • Results rendered as clickable thumbnail gallery
 *   • Fullscreen lightbox with zoom + prev/next navigation
 *   • Per-image before/after comparison sliders
 *   • Image cropping via Cropper.js before detection
 *   • AI Insights panel
 *   • Dashboard charts
 *   • Detection history
 *   • Theme switching
 *   • Keyboard shortcuts (Esc, ←/→, +/-)
 */

"use strict";

// ── Config ──────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// ── State ───────────────────────────────────────────────────
let pendingFiles   = [];
let lastScanFiles  = [];   // snapshot of pendingFiles at scan time (for comparison)
let allResults     = [];   // results from last scan
let chartDonut     = null;
let chartBar       = null;

// Lightbox state
let lightboxItems  = [];   // filtered allResults with images
let lightboxIndex  = 0;
let lightboxZoom   = 1;

// Cropper state
let cropperInstance = null;
let cropperFileIdx  = -1;
let _cropperFlipX   = 1;   // track horizontal flip state

// Global comparison-slider drag state (one active drag at a time)
let activeDrag = null; // { wrap, before, handle }

// ── Fish facts database — flat array (non-repeating random selection) ──────
// ── Fish facts — species-specific + general fallback pool ───
// Keys are lowercase first-word of the detected label (e.g. "clownfish", "tuna")
const FISH_FACTS_BY_SPECIES = {
  angelfish:    [
    "Angelfish can recognise individual fish and remember them for months.",
    "Angelfish are protogynous hermaphrodites — females can become males when needed.",
    "Angelfish form monogamous pairs and are devoted, long-term partners.",
    "Freshwater angelfish originate from the Amazon Basin and prefer slow, warm waters.",
    "Marine angelfish can live up to 15 years in the wild.",
  ],
  clownfish:    [
    "Clownfish are sequential hermaphrodites — all are born male, and the dominant fish can change to female.",
    "Clownfish are immune to sea anemone stings thanks to a protective mucus coating.",
    "Clownfish never stray more than a few metres from their host anemone.",
    "When the female clownfish dies, the dominant male changes sex to replace her.",
    "Clownfish communicate with each other using popping and clicking sounds.",
  ],
  tuna:         [
    "Bluefin Tuna can swim at speeds exceeding 70 km/h and migrate across entire ocean basins.",
    "Tuna are warm-blooded, allowing them to maintain body temperature above the surrounding water.",
    "A single Bluefin Tuna can weigh over 680 kg — roughly the weight of a grand piano.",
    "Tuna must swim constantly to breathe — they use 'ram ventilation' to force water over their gills.",
    "Tuna travel in schools that are highly organised by size, helping them hunt cooperatively.",
  ],
  shark:        [
    "Sharks have existed for over 450 million years — longer than trees! They have no bones, only cartilage.",
    "Sharks can detect one part of blood per million parts of water — sensing it from over 400 metres away.",
    "Some sharks must keep moving at all times to breathe; stopping means suffocation.",
    "The whale shark is the largest fish in the ocean, growing up to 12 metres long.",
    "Sharks have electroreceptors called ampullae of Lorenzini to detect the electric fields of prey.",
  ],
  salmon:       [
    "Salmon navigate back to their exact birthplace using the Earth's magnetic field and their keen sense of smell.",
    "Pacific salmon die shortly after spawning, their bodies fertilising the very streams where they were born.",
    "Salmon can jump up to 3.7 metres vertically to clear waterfalls during their upstream migration.",
    "Salmon change colour dramatically during spawning season, turning red to attract mates.",
    "Some salmon travel over 1,600 km upstream to reach their spawning grounds.",
  ],
  goldfish:     [
    "Goldfish can live over 25 years and have a memory span far longer than the popular '3-second' myth.",
    "Goldfish can see ultraviolet and infrared light — wavelengths invisible to humans.",
    "Goldfish do not have stomachs; food passes directly from gullet to intestine.",
    "Wild goldfish are olive-green — the golden colour was developed through centuries of selective breeding.",
    "Goldfish can recognise their owner's face and will respond differently to familiar people.",
  ],
  damselfish:   [
    "Damselfish are fiercely territorial and will aggressively chase fish many times their size.",
    "Some damselfish farm algae patches, weeding out unwanted species to cultivate their preferred food.",
    "Threestripedamselfish use chirping sounds to communicate during spawning.",
    "Damselfish eggs are guarded by the male, who fans them with his fins to keep them oxygenated.",
    "Damselfish have been known to nip at scuba divers who enter their territory.",
  ],
  cod:          [
    "Atlantic Cod were once so abundant they were called 'the fish that changed the world' due to their role in colonisation.",
    "Cod can grow up to 2 metres long and live for over 25 years.",
    "A female cod can release up to 9 million eggs in a single spawning season.",
    "Cod use a chin barbel — a whisker-like organ — to sense prey on the ocean floor.",
    "Cod are voracious predators and will eat almost any living thing smaller than themselves.",
  ],
  bass:         [
    "Largemouth Bass can detect sound frequencies as low as 100 Hz, sensing vibrations through their lateral line system.",
    "Bass are ambush predators, hiding in vegetation before striking prey at high speed.",
    "Largemouth Bass can live up to 23 years in the wild.",
    "Male Bass guard the nest aggressively after females lay eggs, fanning the eggs with their fins.",
    "Bass can consume prey up to half their own body length in a single strike.",
  ],
  snapper:      [
    "Red Snapper can live up to 50 years and are a keystone species in reef ecosystems.",
    "Snapper form large aggregations to spawn, sometimes numbering in the thousands.",
    "Young snapper live in shallow estuaries and seagrass beds before moving to deeper reefs.",
    "Red Snapper have sharp spines on their dorsal fin used for defence against predators.",
    "Snapper use their large eyes to hunt at low-light conditions near the reef.",
  ],
  catfish:      [
    "Catfish have taste buds covering their entire body, effectively making them a giant swimming tongue.",
    "Some catfish can produce electric fields to navigate murky waters and communicate.",
    "The Mekong Giant Catfish is one of the largest freshwater fish, reaching up to 3 metres.",
    "Catfish are mostly nocturnal, using their sensitive barbels to find food in the dark.",
    "Certain catfish species can make sounds by grinding their teeth or vibrating their swim bladder.",
  ],
  trout:        [
    "Rainbow Trout are native to the Pacific slope of North America but are now found on every continent except Antarctica.",
    "Trout are highly sensitive to water temperature and are an indicator species for water quality.",
    "Brown Trout can live for over 20 years and grow to enormous sizes in large lakes.",
    "Trout have exceptional eyesight and can see in near-total darkness.",
    "Trout use precise memory to return to the same feeding spots in a river day after day.",
  ],
  seahorse:     [
    "Seahorses are the only vertebrates where the male carries and gives birth to the young.",
    "Seahorses have no stomach; food passes through their digestive system so quickly they must eat constantly.",
    "Seahorse pairs greet each other every morning with a dance, holding tails and changing colour.",
    "Seahorses are the slowest fish, propelled only by a tiny dorsal fin beating 35 times per second.",
    "Seahorse eyes can move independently, allowing them to look in two directions at once.",
  ],
  pufferfish:   [
    "Pufferfish can inflate to three times their normal size by rapidly ingesting water.",
    "Pufferfish contain tetrodotoxin — a toxin 1,200 times more potent than cyanide.",
    "Despite their toxicity, pufferfish are considered a delicacy in Japan, where only licensed chefs can prepare them.",
    "Pufferfish males create intricate geometric patterns in the sand to attract females.",
    "Pufferfish have a beak-like mouth strong enough to crush shellfish and coral.",
  ],
  parrotfish:   [
    "Parrotfish produce significant amounts of the white sand found on tropical beaches — from digested coral.",
    "Parrotfish can change sex and colour multiple times throughout their lives.",
    "Parrotfish secrete a mucus sleeping bag around themselves at night to mask their scent from predators.",
    "A single large parrotfish can produce over 90 kg of sand per year.",
    "Parrotfish use their fused, beak-like teeth to scrape algae and coral from reef surfaces.",
  ],
  lionfish:     [
    "Lionfish venom is delivered through 18 needle-like spines — painful but rarely fatal to humans.",
    "Lionfish are invasive in the Atlantic, having no natural predators outside their native Pacific range.",
    "Lionfish can go months without eating and still actively hunt when prey is available.",
    "Lionfish use their pectoral fins like wings to corner prey against rocks or coral.",
    "A single lionfish can reduce juvenile fish populations on a reef by up to 79% in just five weeks.",
  ],
  manta:        [
    "Manta rays have the largest brain-to-body ratio of any fish — and show signs of self-awareness.",
    "Manta rays can leap completely out of the water, possibly to communicate or remove parasites.",
    "Manta rays visit cleaning stations on reefs, queuing patiently for small fish to remove parasites.",
    "Manta rays can grow to over 7 metres across and weigh up to 1,350 kg.",
    "Manta rays are filter feeders, consuming enormous quantities of tiny zooplankton.",
  ],
};

// General facts shown when the detected species has no specific entry
const FISH_FACTS_GENERAL = [
  "Marine fish have been evolving for over 500 million years — one of the oldest vertebrate groups on Earth.",
  "Fish existed before dinosaurs — the first fish-like vertebrates appeared over 530 million years ago.",
  "The ocean is estimated to contain over 33,000 known species of fish — and many more undiscovered.",
  "Some fish can sleep with their eyes wide open — they lack eyelids entirely.",
  "Certain fish communicate using low-frequency vibrations that travel through the water column.",
  "The sailfish is the fastest fish in the ocean, reaching speeds of over 110 km/h.",
  "Some species of wrasse and parrotfish can change sex multiple times throughout their lives.",
  "The tusk fish uses rocks as anvils to crack open clams — one of the few documented tool-using fish.",
  "Fish can remember events and locations for months, challenging the myth of a '3-second memory'.",
  "Many deep-sea fish produce their own bioluminescence to attract prey or find mates.",
  "The lungfish can survive out of water for months by burrowing into mud.",
  "Male jawfish brood eggs in their mouths, fasting for the entire incubation period.",
  "Fish hear using an inner ear and a lateral line — a row of pressure-sensitive cells along their sides.",
  "The ocean sunfish (Mola mola) is the heaviest bony fish, sometimes exceeding 2,300 kg.",
  "The archerfish spits precisely aimed jets of water to knock insects from overhanging branches.",
  "Electric eels can generate jolts of up to 600 volts — enough to stun large prey.",
  "Some fish, like the mudskipper, can breathe through their skin and walk on land using their fins.",
  "Fish scales can reveal a fish's age like tree rings — each year adds a new growth ring.",
  "The deepest-living fish ever recorded was found at 8,336 metres in the Mariana Trench.",
  "Certain cleaner fish set up 'cleaning stations' where other fish line up to have parasites removed.",
];

// Tracks the last displayed fact to avoid immediate repetition
let _lastFact = "";

/**
 * Returns a fact tailored to the detected species.
 * Falls back to a random general fact if no species-specific facts exist.
 * Never repeats the same fact consecutively.
 *
 * @param {string} [speciesName] - The detected species label (e.g. "Angelfish")
 */
function getFactForSpecies(speciesName) {
  const key = speciesName ? speciesName.toLowerCase().split(" ")[0] : "";
  const pool = FISH_FACTS_BY_SPECIES[key] || FISH_FACTS_GENERAL;

  // If only one fact available just return it
  if (pool.length === 1) { _lastFact = pool[0]; return pool[0]; }

  let fact;
  let attempts = 0;
  do {
    fact = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
    // Safety: if all facts in pool are the same as lastFact somehow, break after 10 tries
  } while (fact === _lastFact && attempts < 10);
  _lastFact = fact;
  return fact;
}

// Keep getRandomFact() as alias for when no species is known (history items, etc.)
function getRandomFact() { return getFactForSpecies(null); }

// Legacy stub — retained to avoid reference errors
const FISH_FACTS = {};

const FISH_SCIENTIFIC = {
  tuna:       "Thunnus thynnus",
  shark:      "Selachimorpha (various)",
  salmon:     "Salmo salar",
  clownfish:  "Amphiprioninae (various)",
  goldfish:   "Carassius auratus",
  cod:        "Gadus morhua",
  bass:       "Micropterus salmoides",
  snapper:    "Lutjanidae (various)",
  catfish:    "Siluriformes (various)",
  trout:      "Oncorhynchus mykiss",
};

const FISH_EMOJI = {
  tuna: "🐟", shark: "🦈", salmon: "🐠", clownfish: "🐠",
  goldfish: "🐡", cod: "🐟", bass: "🐟", snapper: "🐠",
  catfish: "🐡", trout: "🐟", default: "🐟",
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  checkApiStatus();
  setInterval(checkApiStatus, 12_000);
  initGlobalSliderDrag();
  initTooltipSystem();
  initKeyboardShortcuts();
});

// ── API Status ───────────────────────────────────────────────
async function checkApiStatus() {
  const dot    = document.getElementById("statusDot");
  const text   = document.getElementById("statusText");
  const bar    = document.getElementById("statusBarFill");

  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(4_000) });
    if (res.ok) {
      dot.className    = "status-dot online";
      text.textContent = "API Online";
      if (bar) bar.style.width = "100%";
    } else throw new Error();
  } catch {
    dot.className    = "status-dot offline";
    text.textContent = "API Offline";
    if (bar) bar.style.width = "0%";
  }
}

// ── Theme ────────────────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });
  if (chartDonut || chartBar) setTimeout(loadDashboard, 50);
}

// ── View Navigation ──────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  document.querySelector(`[data-view="${name}"]`).classList.add("active");
  if (name === "dashboard") loadDashboard();
  if (name === "history")   loadHistory();
}

// ── File Handling ────────────────────────────────────────────
function handleFileSelect(e) {
  addFiles(Array.from(e.target.files));
  e.target.value = "";
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.add("dragging");
}

function handleDragLeave() {
  document.getElementById("dropZone").classList.remove("dragging");
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.remove("dragging");
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
  addFiles(files);
}

function addFiles(files) {
  files.forEach(f => {
    if (!pendingFiles.find(p => p.name === f.name && p.size === f.size)) {
      pendingFiles.push(f);
    }
  });
  renderQueue();
}

// ── Queue Rendering (with View / Crop / Remove) ─────────────
function renderQueue() {
  const section = document.getElementById("queueSection");
  const grid    = document.getElementById("queueGrid");
  const count   = document.getElementById("queueCount");
  const btn     = document.getElementById("btnScan");

  if (pendingFiles.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  count.textContent     = `${pendingFiles.length} image${pendingFiles.length > 1 ? "s" : ""} ready`;
  grid.innerHTML        = "";
  btn.disabled          = false;

  pendingFiles.forEach((file, idx) => {
    // Wrapper: thumbnail + actions
    const wrap = document.createElement("div");
    wrap.className = "queue-item-wrap";

    // Thumbnail
    const item = document.createElement("div");
    item.className = "queue-item";
    item.id = `qi-${idx}`;

    const doneEl = document.createElement("div");
    doneEl.className = "queue-item-done";
    doneEl.textContent = "✓";

    const reader = new FileReader();
    reader.onload = e2 => {
      const img = document.createElement("img");
      img.src = e2.target.result;
      img.alt = file.name;
      img.title = file.name;
      item.appendChild(img);
      item.appendChild(doneEl);
    };
    reader.readAsDataURL(file);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "queue-item-actions";
    // Using data-idx attribute so indices stay correct after re-renders
    actions.innerHTML = `
      <button class="qi-action-btn qi-view"   data-idx="${idx}" title="Preview image">VIEW</button>
      <button class="qi-action-btn qi-crop"   data-idx="${idx}" title="Crop before scan">CROP</button>
      <button class="qi-action-btn qi-remove" data-idx="${idx}" title="Remove from queue">✕</button>`;

    actions.querySelector(".qi-view").addEventListener("click",   (e) => { e.stopPropagation(); viewQueueItem(idx); });
    actions.querySelector(".qi-crop").addEventListener("click",   (e) => { e.stopPropagation(); openCropperForIdx(idx); });
    actions.querySelector(".qi-remove").addEventListener("click", (e) => { e.stopPropagation(); removeQueueItem(idx); });

    wrap.appendChild(item);
    wrap.appendChild(actions);
    grid.appendChild(wrap);
  });
}

function clearQueue() {
  pendingFiles = [];
  renderQueue();
}

// ── Clear Detection Results ──────────────────────────────────
function clearResults() {
  allResults    = [];
  lightboxItems = [];
  lastScanFiles = [];

  // Gallery grid
  const resultsList = document.getElementById("resultsList");
  if (resultsList) { resultsList.innerHTML = ""; resultsList.style.display = "none"; }

  // Empty state
  const resultsEmpty = document.getElementById("resultsEmpty");
  if (resultsEmpty) resultsEmpty.style.display = "flex";
  const emptyTitle = document.getElementById("emptyTitle");
  const emptySub   = document.getElementById("emptySub");
  if (emptyTitle) emptyTitle.textContent = "No Detection Results";
  if (emptySub)   emptySub.textContent   = "Upload an image to begin detection.";

  // Badge + clear button
  const resultBadge     = document.getElementById("resultBadge");
  const btnClearResults = document.getElementById("btnClearResults");
  if (resultBadge)     { resultBadge.textContent = "0"; resultBadge.style.display = "none"; }
  if (btnClearResults)   btnClearResults.style.display = "none";

  // Comparison panel
  const compSlidersList = document.getElementById("compSlidersList");
  const compPanel       = document.getElementById("compPanel");
  if (compSlidersList) compSlidersList.innerHTML = "";
  if (compPanel)       compPanel.style.display   = "none";

  // AI / Species panel
  const aiPanel = document.getElementById("aiPanel");
  if (aiPanel) aiPanel.style.display = "none";

  // Re-sync header counters
  updateHeaderStats();
}

// ── Queue Actions ────────────────────────────────────────────

/** Preview a queue item in the lightbox */
function viewQueueItem(idx) {
  const file = pendingFiles[idx];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    // Temporarily hijack lightbox for preview
    lightboxItems = [{ _previewSrc: e.target.result, filename: file.name, detections: [] }];
    lightboxIndex = 0;
    lightboxZoom  = 1;

    const img = document.getElementById("lbImg");
    img.src = e.target.result;
    img.style.transform = "scale(1)";
    img.classList.remove("zoomed");

    document.getElementById("lbCounter").textContent = "PREVIEW";
    document.getElementById("lbFname").textContent   = file.name;
    document.getElementById("lbDetections").innerHTML = `<span class="lb-no-det">Original upload · ${(file.size / 1024).toFixed(0)} KB</span>`;
    document.getElementById("lbPrev").disabled = true;
    document.getElementById("lbNext").disabled = true;

    document.getElementById("lightboxOverlay").style.display = "flex";
    document.body.style.overflow = "hidden";
  };
  reader.readAsDataURL(file);
}

/** Remove a file from the pending queue */
function removeQueueItem(idx) {
  pendingFiles.splice(idx, 1);
  renderQueue();
}

// ── Detection ────────────────────────────────────────────────
async function runDetection() {
  if (!pendingFiles.length) return;

  document.getElementById("btnScan").disabled = true;

  // Snapshot files for comparison sliders (order matches allResults)
  lastScanFiles = [...pendingFiles];

  // Reset UI
  const resultsList  = document.getElementById("resultsList");
  const resultsEmpty = document.getElementById("resultsEmpty");
  const resultBadge  = document.getElementById("resultBadge");

  resultsList.innerHTML  = "";
  resultsList.style.display = "none";
  resultsEmpty.style.display = "flex";
  resultBadge.style.display  = "none";
  allResults  = [];
  lightboxItems = [];

  // Reset empty state text and hide Clear Results button
  const emptyTitle      = document.getElementById("emptyTitle");
  const emptySub        = document.getElementById("emptySub");
  const btnClearResults = document.getElementById("btnClearResults");
  if (emptyTitle)       emptyTitle.textContent = "Awaiting Scan";
  if (emptySub)         emptySub.textContent   = "Upload images and run detection";
  if (btnClearResults)  btnClearResults.style.display = "none";

  document.getElementById("compPanel").style.display  = "none";
  document.getElementById("aiPanel").style.display    = "none";

  for (let i = 0; i < pendingFiles.length; i++) {
    const file = pendingFiles[i];

    showRadar(file.name);
    document.getElementById("radarSub").textContent =
      `Scanning ${i + 1} of ${pendingFiles.length}: ${file.name}`;

    try {
      const result = await detectFile(file);
      allResults.push(result);

      const qi = document.getElementById(`qi-${i}`);
      if (qi) qi.classList.add("done");

      if (i === 0) {
        resultsEmpty.style.display = "none";
        resultsList.style.display  = "grid";
      }

      renderResultCard(result, allResults.length - 1);
      updateHeaderStats();

    } catch (err) {
      console.error(`Detection error for ${file.name}:`, err);
      renderErrorCard(file.name, "Could not reach the API. Is the backend running on port 8000?");
    }
  }

  hideRadar();

  if (allResults.length) {
    resultBadge.textContent   = allResults.length;
    resultBadge.style.display = "inline-block";
    // Reveal the Clear Results button now there are results to clear
    const btnClear = document.getElementById("btnClearResults");
    if (btnClear) btnClear.style.display = "inline-flex";
  }

  // Build lightbox index from results that have images
  lightboxItems = allResults.filter(r => r.annotated_image_url);

  if (allResults.length > 0) {
    setupAllComparisonSliders(allResults);
    updateAiInsights(allResults);
    setReportData(allResults);
  }

  document.getElementById("btnScan").disabled = false;
}

async function detectFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/detect`, { method: "POST", body: fd });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "API error"); }
  return res.json();
}

// ── Result Card — Clickable Thumbnail Gallery ────────────────
function renderResultCard(result, index) {
  const list = document.getElementById("resultsList");

  const statusMap = {
    fish_detected: { cls: "badge-fish",      label: "FISH DETECTED" },
    unknown_fish:  { cls: "badge-unknown",   label: "UNKNOWN SPECIES" },
    non_marine:    { cls: "badge-nonmarine", label: "NON-MARINE" },
    no_detection:  { cls: "badge-none",      label: "NO DETECTION" },
  };
  const si       = statusMap[result.status] || statusMap.no_detection;
  const imgUrl   = result.annotated_image_url ? `${API_BASE}${result.annotated_image_url}` : null;
  const fishDets = (result.detections || []).filter(d => d.is_fish);

  // Index within the lightbox items array (only results with images)
  const lbIdx = allResults.slice(0, index + 1).filter(r => r.annotated_image_url).length - 1;

  const card = document.createElement("div");
  card.className = "result-card";

  if (imgUrl) {
    // Clickable thumbnail
    card.onclick = () => openLightbox(lbIdx);

    const speciesTags = fishDets.map(d =>
      `<span class="det-species-tag">${d.label} <em>${(d.confidence * 100).toFixed(0)}%</em></span>`
    ).join("");

    card.innerHTML = `
      <div class="result-thumb-img">
        <img src="${imgUrl}" alt="Detection result" loading="lazy" />
        <span class="result-status-badge ${si.cls}">${si.label}</span>
        <div class="result-thumb-overlay">
          <div class="result-thumb-zoom-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6M11 8v6"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="result-thumb-info">
        <div class="result-fname">${result.filename || "image"}</div>
        ${speciesTags ? `<div class="result-thumb-species">${speciesTags}</div>` : ""}
      </div>`;
  } else {
    // No image — non-clickable placeholder card
    card.style.cursor = "default";
    card.innerHTML = `
      <div class="result-no-img">
        <div class="result-no-img-icon">🔍</div>
        <span class="result-status-badge ${si.cls}">${si.label}</span>
      </div>
      <div class="result-thumb-info">
        <div class="result-fname">${result.filename || "image"}</div>
        <div class="result-msg">${result.message}</div>
      </div>`;
  }

  list.appendChild(card);
}

function renderErrorCard(filename, message) {
  const list = document.getElementById("resultsList");
  list.style.display = "grid";
  document.getElementById("resultsEmpty").style.display = "none";

  const card = document.createElement("div");
  card.className = "result-card";
  card.style.cursor = "default";
  card.innerHTML = `
    <div class="result-no-img" style="min-height:120px">
      <div class="result-no-img-icon">⚠</div>
    </div>
    <div class="result-thumb-info">
      <div class="result-fname">${filename}</div>
      <div class="result-msg" style="color:var(--danger);font-size:0.72rem">${message}</div>
    </div>`;
  list.appendChild(card);
}

// ── Header stats ─────────────────────────────────────────────
function updateHeaderStats() {
  fetch(`${API_BASE}/stats`).then(r => r.json()).then(s => {
    const tv = document.getElementById("hsTotalVal");
    const fv = document.getElementById("hsFishVal");
    if (tv) tv.textContent = s.total_processed;
    if (fv) fv.textContent = s.fish_detected;
  }).catch(() => {});
}

// ── LIGHTBOX — Full-resolution Detection Viewer ──────────────

/** Open the lightbox at a given index within lightboxItems */
function openLightbox(index) {
  lightboxItems = allResults.filter(r => r.annotated_image_url);
  if (!lightboxItems.length) return;

  lightboxIndex = Math.max(0, Math.min(lightboxItems.length - 1, index));
  lightboxZoom  = 1;

  document.getElementById("lightboxOverlay").style.display = "flex";
  document.body.style.overflow = "hidden";
  updateLightboxView();
}

/** Sync lightbox UI to the current lightboxIndex */
function updateLightboxView() {
  const item = lightboxItems[lightboxIndex];
  if (!item) return;

  const img = document.getElementById("lbImg");

  if (item._previewSrc) {
    img.src = item._previewSrc;
  } else {
    img.src = `${API_BASE}${item.annotated_image_url}`;
  }

  // Reset zoom
  lightboxZoom = 1;
  img.style.transform = "scale(1)";
  img.classList.remove("zoomed");

  // Counter
  document.getElementById("lbCounter").textContent =
    `${lightboxIndex + 1} / ${lightboxItems.length}`;

  // Footer — filename + detection tags
  const fishDets = (item.detections || []).filter(d => d.is_fish);
  document.getElementById("lbFname").textContent = item.filename || "image";

  const detEl = document.getElementById("lbDetections");
  if (fishDets.length) {
    detEl.innerHTML = fishDets.map(d =>
      `<span class="lb-det-tag fish">${d.label} · ${(d.confidence * 100).toFixed(0)}%</span>`
    ).join("");
  } else {
    detEl.innerHTML = `<span class="lb-no-det">No fish detections</span>`;
  }

  // Nav arrows
  document.getElementById("lbPrev").disabled = lightboxIndex === 0;
  document.getElementById("lbNext").disabled = lightboxIndex === lightboxItems.length - 1;
}

function closeLightbox() {
  document.getElementById("lightboxOverlay").style.display = "none";
  document.body.style.overflow = "";
}

function navLightbox(dir) {
  lightboxIndex = Math.max(0, Math.min(lightboxItems.length - 1, lightboxIndex + dir));
  updateLightboxView();
}

function zoomLightbox(delta) {
  lightboxZoom = Math.max(0.25, Math.min(5, lightboxZoom + delta));
  const img = document.getElementById("lbImg");
  img.style.transform = `scale(${lightboxZoom})`;
  img.classList.toggle("zoomed", lightboxZoom > 1);
}

function resetLightboxZoom() {
  lightboxZoom = 1;
  const img = document.getElementById("lbImg");
  img.style.transform = "scale(1)";
  img.classList.remove("zoomed");
}

/** Click the image to toggle 2x zoom */
function toggleLightboxZoom() {
  if (lightboxZoom > 1) {
    resetLightboxZoom();
  } else {
    zoomLightbox(1);
  }
}

// ── CROPPER — Image crop before detection ───────────────────

/** Open the Cropper.js modal for a queue item */
function openCropperForIdx(idx) {
  const file = pendingFiles[idx];
  if (!file) return;

  cropperFileIdx = idx;
  _cropperFlipX  = 1;

  const reader = new FileReader();
  reader.onload = e => {
    const cropImg = document.getElementById("cropperImg");
    cropImg.src   = e.target.result;

    document.getElementById("cropperOverlay").style.display = "flex";
    document.body.style.overflow = "hidden";

    // Destroy any existing instance first
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

    // Wait for image to load before initialising Cropper
    cropImg.onload = () => {
      cropperInstance = new Cropper(cropImg, {
        viewMode: 1,
        autoCropArea: 0.8,
        responsive:   true,
        background:   false,
        guides:       true,
        highlight:    true,
        movable:      true,
        rotatable:    true,
        scalable:     true,
        zoomable:     true,
      });
    };
  };
  reader.readAsDataURL(file);
}

function closeCropper() {
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  document.getElementById("cropperOverlay").style.display = "none";
  document.body.style.overflow = "";
  cropperFileIdx = -1;
}

function applyCrop() {
  if (!cropperInstance || cropperFileIdx < 0) return;

  const canvas = cropperInstance.getCroppedCanvas({
    maxWidth:              4096,
    maxHeight:             4096,
    fillColor:             "#000814",
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });

  if (!canvas) { closeCropper(); return; }

  canvas.toBlob(blob => {
    if (!blob) { closeCropper(); return; }
    const origFile = pendingFiles[cropperFileIdx];
    // Preserve original filename & MIME type
    const newFile  = new File([blob], origFile.name, { type: origFile.type || "image/jpeg" });
    pendingFiles[cropperFileIdx] = newFile;
    closeCropper();
    renderQueue(); // refresh thumbnails with cropped version
  }, "image/jpeg", 0.95);
}

// Cropper helper functions (called from HTML buttons)
function cropperRotate(deg) { if (cropperInstance) cropperInstance.rotate(deg); }
function cropperReset()     { if (cropperInstance) cropperInstance.reset(); _cropperFlipX = 1; }
function cropperFlipH()     {
  if (!cropperInstance) return;
  _cropperFlipX = -_cropperFlipX;
  cropperInstance.scaleX(_cropperFlipX);
}

// ── MULTI-IMAGE COMPARISON SLIDERS ──────────────────────────

/**
 * Renders one before/after slider per result that has an annotated image.
 * Maps result[i] → lastScanFiles[i] for the "before" image.
 */
async function setupAllComparisonSliders(results) {
  const panel = document.getElementById("compPanel");
  const list  = document.getElementById("compSlidersList");

  const hasSliders = results.some(r => r.annotated_image_url);
  if (!hasSliders) { panel.style.display = "none"; return; }

  list.innerHTML  = "";
  panel.style.display = "block";

  for (let i = 0; i < results.length; i++) {
    const result   = results[i];
    const origFile = lastScanFiles[i];

    if (!result.annotated_image_url || !origFile) continue;

    // Read original file as data URL
    const origUrl = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = ev => resolve(ev.target.result);
      r.readAsDataURL(origFile);
    });

    const afterSrc = `${API_BASE}${result.annotated_image_url}`;
    const fname    = result.filename || origFile.name;

    const item = document.createElement("div");
    item.className = "comp-item";
    item.innerHTML = `
      <div class="comp-item-header">
        <span class="comp-item-fname">${fname}</span>
        <span class="comp-item-hint">← Drag handle →</span>
      </div>
      <div class="comp-wrap-item">
        <div class="comp-after-item">
          <img src="${afterSrc}" alt="Detection Result" />
          <span class="comp-lbl comp-lbl-r">DETECTION RESULT</span>
        </div>
        <div class="comp-before-item">
          <img src="${origUrl}" alt="Original" />
          <span class="comp-lbl comp-lbl-l">ORIGINAL</span>
        </div>
        <div class="comp-handle-item">
          <div class="comp-handle-bar-item"></div>
          <div class="comp-handle-knob-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12">
              <path d="M8 5l-5 7 5 7M16 5l5 7-5 7"/>
            </svg>
          </div>
        </div>
      </div>`;

    list.appendChild(item);

    // Attach drag for this slider
    const wrap   = item.querySelector(".comp-wrap-item");
    const before = item.querySelector(".comp-before-item");
    const handle = item.querySelector(".comp-handle-item");
    bindSliderDrag(wrap, before, handle);
  }
}

/**
 * Binds mousedown / touchstart on a wrap element to activate the
 * global drag state for that slider.
 */
function bindSliderDrag(wrap, before, handle) {
  const activate = (clientX) => {
    activeDrag = { wrap, before, handle };
    handle.classList.add("dragging");
    moveSlider(activeDrag, clientX);
  };

  handle.addEventListener("mousedown",  e => { e.preventDefault(); activate(e.clientX); });
  handle.addEventListener("touchstart", e => activate(e.touches[0].clientX), { passive: true });
  wrap.addEventListener("mousedown",    e => activate(e.clientX));
  wrap.addEventListener("touchstart",   e => activate(e.touches[0].clientX), { passive: true });
}

function moveSlider({ wrap, before, handle }, clientX) {
  const rect = wrap.getBoundingClientRect();
  let pct    = ((clientX - rect.left) / rect.width) * 100;
  pct = Math.max(2, Math.min(98, pct));
  before.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  handle.style.left     = `${pct}%`;
}

/** Document-level drag listeners — shared by all sliders */
function initGlobalSliderDrag() {
  document.addEventListener("mouseup", () => {
    if (activeDrag) activeDrag.handle.classList.remove("dragging");
    activeDrag = null;
  });
  document.addEventListener("touchend", () => {
    if (activeDrag) activeDrag.handle.classList.remove("dragging");
    activeDrag = null;
  });
  document.addEventListener("mousemove", e => {
    if (activeDrag) moveSlider(activeDrag, e.clientX);
  });
  document.addEventListener("touchmove", e => {
    if (activeDrag && e.touches[0]) moveSlider(activeDrag, e.touches[0].clientX);
  }, { passive: true });
}

// ── Keyboard Shortcuts ───────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener("keydown", e => {
    const lbOpen      = document.getElementById("lightboxOverlay").style.display   !== "none";
    const cropperOpen = document.getElementById("cropperOverlay").style.display    !== "none";
    const historyOpen = document.getElementById("historyModalOverlay").style.display !== "none";

    if (lbOpen) {
      switch (e.key) {
        case "ArrowLeft":  navLightbox(-1);     e.preventDefault(); break;
        case "ArrowRight": navLightbox(1);      e.preventDefault(); break;
        case "Escape":     closeLightbox();     break;
        case "+":
        case "=":          zoomLightbox(0.25);  break;
        case "-":          zoomLightbox(-0.25); break;
        case "0":          resetLightboxZoom(); break;
      }
    } else if (cropperOpen) {
      if (e.key === "Escape") closeCropper();
      if (e.key === "Enter")  applyCrop();
    } else if (historyOpen) {
      if (e.key === "Escape") closeHistoryModal();
    }
  });
}

// ── AI Insights Panel ────────────────────────────────────────
function updateAiInsights(results) {
  const panel = document.getElementById("aiPanel");
  if (!panel) return;

  panel.style.display = "block";

  let topDet     = null;
  let topSpecies = "Unknown";

  results.forEach(r => {
    (r.detections || []).forEach(d => {
      if (d.is_fish && (!topDet || d.confidence > topDet.confidence)) {
        topDet     = d;
        topSpecies = d.label;
      }
    });
  });

  const key   = topSpecies.toLowerCase().split(" ")[0];
  const fact  = getFactForSpecies(topDet ? topSpecies : null); // species fact if detected, else random
  const sci   = FISH_SCIENTIFIC[key] || "Species classification pending";
  const emoji = FISH_EMOJI[key]      || FISH_EMOJI.default;
  const conf  = topDet ? (topDet.confidence * 100).toFixed(1) + "%" : "—";

  document.getElementById("aiEmoji").textContent       = emoji;
  document.getElementById("aiSpeciesName").textContent = topSpecies;
  document.getElementById("aiSpeciesSci").textContent  = sci;
  document.getElementById("aiConfBadge").textContent   = conf;
  document.getElementById("aiFact").textContent        = fact;

  const metricsEl = document.getElementById("aiMetrics");
  const allFish   = results.flatMap(r => (r.detections || []).filter(d => d.is_fish));

  if (allFish.length) {
    metricsEl.innerHTML = allFish.slice(0, 4).map(d => `
      <div class="ai-metric-item">
        <div class="ai-metric-head">
          <span class="ai-metric-label">${d.label}</span>
          <span class="ai-metric-val">${(d.confidence * 100).toFixed(1)}%</span>
        </div>
        <div class="ai-metric-bar">
          <div class="ai-metric-fill" style="width:${(d.confidence * 100).toFixed(1)}%"></div>
        </div>
      </div>`).join("");
  } else {
    metricsEl.innerHTML = `<p style="font-size:0.75rem;color:var(--txt3);">No fish metrics available.</p>`;
  }

  const btnReport = document.getElementById("btnReport");
  if (btnReport) btnReport.style.display = allFish.length ? "flex" : "none";
}

// ── Tooltip System ───────────────────────────────────────────
function initTooltipSystem() {
  const tip = document.getElementById("detTooltip");
  if (!tip) return;

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (!target) return;
    tip.textContent = target.dataset.tooltip;
    tip.classList.add("visible");
  });

  document.addEventListener("mouseout", (e) => {
    if (!e.target.closest("[data-tooltip]")) return;
    tip.classList.remove("visible");
  });

  document.addEventListener("mousemove", (e) => {
    if (!tip.classList.contains("visible")) return;
    tip.style.left = `${e.clientX + 14}px`;
    tip.style.top  = `${e.clientY - 28}px`;
  });
}

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const s = await fetch(`${API_BASE}/stats`).then(r => r.json());
    document.getElementById("scTotal").textContent   = s.total_processed;
    document.getElementById("scFish").textContent    = s.fish_detected;
    document.getElementById("scUnknown").textContent = s.unknown_objects;
    document.getElementById("scEmpty").textContent   = s.no_detection;
    animateNumbers();
    renderDashCharts(s);
  } catch {
    console.warn("[Dashboard] API offline or no data.");
  }
}

function animateNumbers() {
  document.querySelectorAll(".sc-num").forEach(el => {
    const target = parseInt(el.textContent) || 0;
    let   cur    = 0;
    const step   = Math.max(1, Math.ceil(target / 30));
    const t      = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur;
      if (cur >= target) clearInterval(t);
    }, 40);
  });
}

function renderDashCharts(s) {
  const c1   = cssVar("--accent-1");
  const c2   = cssVar("--accent-2");
  const warn = cssVar("--warn");
  const txt2 = cssVar("--txt2");
  const border = cssVar("--border");

  const donutCtx = document.getElementById("chartDonut")?.getContext("2d");
  if (donutCtx) {
    if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(donutCtx, {
      type: "doughnut",
      data: {
        labels: ["Fish Detected", "Unknown Species", "Non-Marine", "No Detection"],
        datasets: [{
          data: [s.fish_detected, s.unknown_objects, s.non_marine, s.no_detection],
          backgroundColor: [`${c2}55`, `${warn}55`, "#ff4d6a55", "#55779955"],
          borderColor:     [c2, warn, "#ff4d6a", "#557799"],
          borderWidth: 1.5, hoverOffset: 10,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: txt2, font: { family: "'Space Grotesk'", size: 11 }, padding: 14, boxWidth: 12 }
          }
        },
      },
    });
  }

  const barCtx = document.getElementById("chartBar")?.getContext("2d");
  if (barCtx) {
    if (chartBar) chartBar.destroy();
    chartBar = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: ["Fish", "Unknown", "Non-Marine", "No Detection"],
        datasets: [{
          label: "Detections",
          data: [s.fish_detected, s.unknown_objects, s.non_marine, s.no_detection],
          backgroundColor: [`${c2}55`, `${warn}55`, "#ff4d6a55", "#55779955"],
          borderColor:     [c2, warn, "#ff4d6a", "#557799"],
          borderWidth: 1.5, borderRadius: 8, borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: txt2, font: { size: 11 } }, grid: { color: border } },
          y: { beginAtZero: true, ticks: { color: txt2, font: { size: 11 }, stepSize: 1 }, grid: { color: border } },
        },
      },
    });
  }
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── History ──────────────────────────────────────────────────
async function loadHistory() {
  const wrap = document.getElementById("historyWrap");
  try {
    const data    = await fetch(`${API_BASE}/history`).then(r => r.json());
    const history = data.history;

    if (!history || Object.keys(history).length === 0) {
      wrap.innerHTML = `<div class="history-empty"><p>No scans logged yet.<br/>Run your first detection to begin.</p></div>`;
      return;
    }

    wrap.innerHTML = "";

    for (const [label, items] of Object.entries(history)) {
      const group = document.createElement("div");
      group.className = "history-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "history-date-lbl";
      groupHeader.textContent = label;

      const listWrap = document.createElement("div");
      listWrap.className = "history-list";

      items.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-item";

        row.innerHTML = `
          ${item.annotated_image_url
            ? `<img class="history-thumb" src="${API_BASE}${item.annotated_image_url}" alt="" />`
            : `<div class="history-thumb"></div>`}
          <div class="history-info">
            <div class="history-msg">${item.message}</div>
            <div class="history-meta">${item.filename} · ${fmtTime(item.timestamp)}</div>
          </div>
          <div class="history-dot ${item.status}"></div>`;

        // Make row clickable — open details modal
        row.addEventListener("click", () => openHistoryModal(item, row));

        listWrap.appendChild(row);
      });

      group.appendChild(groupHeader);
      group.appendChild(listWrap);
      wrap.appendChild(group);
    }
  } catch {
    wrap.innerHTML = `<div class="history-empty"><p>Could not load history.<br/>Ensure the API is running.</p></div>`;
  }
}

// ── History Details Modal ─────────────────────────────────────

let _activeHistoryRow = null; // tracks highlighted row

function openHistoryModal(item, rowEl) {
  // Highlight selected row, de-highlight any previous
  if (_activeHistoryRow) _activeHistoryRow.classList.remove("active");
  _activeHistoryRow = rowEl;
  rowEl.classList.add("active");

  const overlay = document.getElementById("historyModalOverlay");
  const statusMap = {
    fish_detected: { cls: "badge-fish",      label: "FISH DETECTED" },
    unknown_fish:  { cls: "badge-unknown",   label: "UNKNOWN SPECIES" },
    non_marine:    { cls: "badge-nonmarine", label: "NON-MARINE" },
    no_detection:  { cls: "badge-none",      label: "NO DETECTION" },
  };
  const si = statusMap[item.status] || statusMap.no_detection;

  // ── Image ──
  const hmImg   = document.getElementById("hmImg");
  const hmNoImg = document.getElementById("hmNoImg");
  if (item.annotated_image_url) {
    hmImg.src = `${API_BASE}${item.annotated_image_url}`;
    hmImg.style.display = "block";
    hmNoImg.style.display = "none";
  } else {
    hmImg.style.display = "none";
    hmNoImg.style.display = "flex";
  }

  // ── Status badge ──
  const badge = document.getElementById("hmBadge");
  badge.className = `result-status-badge ${si.cls}`;
  badge.textContent = si.label;

  // ── Metadata ──
  // Extract species name from message, e.g. "Fish detected: Angelfish" or just use status
  const speciesMatch = item.message.match(/:\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  const species = speciesMatch ? speciesMatch[1] : (item.status === "fish_detected" ? "Unknown Species" : "—");

  document.getElementById("hmSpecies").textContent   = species;
  document.getElementById("hmCount").textContent     = item.fish_count > 0 ? `${item.fish_count} fish` : "None";
  document.getElementById("hmFilename").textContent  = item.filename;
  document.getElementById("hmTimestamp").textContent = item.timestamp
    ? new Date(item.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "—";

  const statusEl = document.getElementById("hmStatus");
  statusEl.textContent = si.label;
  statusEl.className   = "hm-meta-val";
  if (item.status === "fish_detected") statusEl.style.color = "var(--accent-2)";
  else if (item.status === "no_detection") statusEl.style.color = "var(--txt3)";
  else if (item.status === "unknown_fish") statusEl.style.color = "var(--warn)";
  else if (item.status === "non_marine") statusEl.style.color = "var(--danger)";
  else statusEl.style.color = "var(--txt)";

  document.getElementById("hmMessage").textContent = item.message;

  // ── Fish fact — species-specific if fish was detected, random otherwise ──
  const modalSpecies = item.status === "fish_detected" ? species : null;
  document.getElementById("hmFact").textContent = getFactForSpecies(modalSpecies);

  // ── Show modal ──
  overlay.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  document.getElementById("historyModalOverlay").style.display = "none";
  document.body.style.overflow = "";
  if (_activeHistoryRow) {
    _activeHistoryRow.classList.remove("active");
    _activeHistoryRow = null;
  }
}

async function clearHistory() {
  try {
    closeHistoryModal();
    await fetch(`${API_BASE}/history`, { method: "DELETE" });
    loadHistory();
  } catch { console.warn("Could not clear history."); }
}

// ── Utilities ────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}