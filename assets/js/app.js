const state = {
    allCards: [],
    filteredCards: [],
    displayedCards: [],
    currentPage: 0,
    cardsPerPage: 80,
    formatFilters: [],
    sortCriteria: [],
    nextFormatId: 0,
    nextSortId: 0,
    scryfallObserver: null,
    scryfallCache: null,
    scryfallInFlight: new Map(),
    bulkRemoteMeta: null,
    bulkLocalUpdatedAt: null,
    bulkLoadingPromise: null,
    availableFormats: [
        "standard", "future", "historic", "gladiator", "pioneer", "modern",
        "legacy", "pauper", "vintage", "penny", "commander", "oathbreaker",
        "brawl", "standardbrawl", "historicbrawl", "alchemy", "timeless",
        "paupercommander", "duel", "predh", "oldschool", "premodern"
    ]
};

const CONDITION_CODE_MAP = {
    "mint": { code: "mt", label: "Mint" },
    "near_mint": { code: "nm", label: "Near Mint" },
    "excellent": { code: "ex", label: "Excellent" },
    "good": { code: "gd", label: "Good" },
    "light_played": { code: "lp", label: "Light Played" },
    "played": { code: "pl", label: "Played" },
    "poor": { code: "po", label: "Poor" }
};

const LANGUAGE_LABELS = {
    "en": "English",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    "zh_cn": "Chinese (Simplified)",
    "ja": "Japanese",
    "pt": "Portuguese",
    "ru": "Russian",
    "ko": "Korean",
    "zh_tw": "Chinese (Traditional)"
};

const RARITY_LABELS = {
    "common": "C",
    "uncommon": "U",
    "rare": "R",
    "mythic": "M"
};

const RARITY_ICONS = {
    "common": { icon: "⚫", label: "Common" },
    "uncommon": { icon: "⚪", label: "Uncommon" },
    "rare": { icon: "🟡", label: "Rare" },
    "mythic": { icon: "🔴", label: "Mythic" }
};

const LANGUAGE_ICONS = {
    "en": { icon: "🇬🇧", label: "English" },
    "fr": { icon: "🇫🇷", label: "French" },
    "de": { icon: "🇩🇪", label: "German" },
    "es": { icon: "🇪🇸", label: "Spanish" },
    "it": { icon: "🇮🇹", label: "Italian" },
    "zh_cn": { icon: "🇨🇳", label: "Chinese (Simplified)" },
    "ja": { icon: "🇯🇵", label: "Japanese" },
    "pt": { icon: "🇵🇹", label: "Portuguese" },
    "ru": { icon: "🇷🇺", label: "Russian" },
    "ko": { icon: "🇰🇷", label: "Korean" },
    "zh_tw": { icon: "🇹🇼", label: "Chinese (Traditional)" }
};

const CARDMARKET_CONDITION_MAP = {
    "mint": 1,
    "near_mint": 2,
    "excellent": 3,
    "good": 4,
    "light_played": 5,
    "played": 6,
    "poor": 7
};

const CARDMARKET_LANGUAGE_MAP = {
    "en": 1,
    "fr": 2,
    "de": 3,
    "es": 4,
    "it": 5,
    "zh_cn": 6,
    "ja": 7,
    "pt": 8,
    "ru": 9,
    "ko": 10,
    "zh_tw": 11
};

const elements = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("csv-file"),
    fileStatus: document.getElementById("file-status"),
    bulkStatus: document.getElementById("bulk-status"),
    updateBulkDataBtn: document.getElementById("update-bulk-data"),
    bulkProgress: document.getElementById("bulk-progress"),
    bulkProgressBar: document.getElementById("bulk-progress-bar"),
    bulkProgressText: document.getElementById("bulk-progress-text"),
    legalityMenuToggle: document.getElementById("legality-menu-toggle"),
    legalityMenu: document.getElementById("legality-menu"),
    legalityDisplayList: document.getElementById("legality-display-list"),
    infoDialog: document.getElementById("info-dialog"),
    infoDialogTitle: document.getElementById("info-dialog-title"),
    infoDialogBody: document.getElementById("info-dialog-body"),
    infoDialogCancel: document.getElementById("info-dialog-cancel"),
    infoDialogClose: document.getElementById("info-dialog-close"),
    searchNameInput: document.getElementById("search-name"),
    filterBinderNameSelect: document.getElementById("filter-binder-name"),
    filterBinderTypeSelect: document.getElementById("filter-binder-type"),
    filterRaritySelect: document.getElementById("filter-rarity"),
    filterConditionSelect: document.getElementById("filter-condition"),
    filterLanguageSelect: document.getElementById("filter-language"),
    filterColorButtons: document.getElementById("filter-color-buttons"),
    filterColorModeSelect: document.getElementById("filter-color-mode"),
    filterFoilSelect: document.getElementById("filter-foil"),
    filterCMCOperator: document.getElementById("filter-cmc-operator"),
    filterCMCValue: document.getElementById("filter-cmc-value"),
    filterCardTypeSelect: document.getElementById("filter-card-type"),
    formatFiltersContainer: document.getElementById("format-filters-container"),
    addFormatFilterBtn: document.getElementById("add-format-filter"),
    sortCriteriaContainer: document.getElementById("sort-criteria-container"),
    addSortCriteriaBtn: document.getElementById("add-sort-criteria"),
    savedConfigsSelect: document.getElementById("saved-configs"),
    saveConfigBtn: document.getElementById("save-config"),
    deleteConfigBtn: document.getElementById("delete-config"),
    applyFiltersBtn: document.getElementById("apply-filters"),
    resetFiltersBtn: document.getElementById("reset-filters"),
    cardsContainer: document.getElementById("cards-container"),
    cardCountSpan: document.getElementById("card-count"),
    toggleDetailsBtn: document.getElementById("toggle-details"),
    enrichVisibleBtn: document.getElementById("enrich-visible"),
    enrichStatus: document.getElementById("enrich-status")
};

const SCRYFALL_DEFAULT_CARDS_META_URL = "https://api.scryfall.com/bulk-data/default_cards";
const META_BULK_DEFAULT_CARDS_UPDATED_AT_KEY = "bulk_default_cards_updated_at";
const LEGALITY_DISPLAY_SETTINGS_KEY = "mtg_legality_display_settings";

const dialogState = {
    resolver: null,
    mode: "info"
};

let applyFiltersDebounceTimer = null;

function scheduleApplyFilters(delay = 120) {
    if (applyFiltersDebounceTimer) {
        clearTimeout(applyFiltersDebounceTimer);
    }

    applyFiltersDebounceTimer = setTimeout(() => {
        applyFiltersDebounceTimer = null;
        applyFilters();
    }, delay);
}

const FORMAT_LABELS = {
    standard: "Standard",
    future: "Future",
    historic: "Historic",
    gladiator: "Gladiator",
    pioneer: "Pioneer",
    modern: "Modern",
    legacy: "Legacy",
    pauper: "Pauper",
    vintage: "Vintage",
    penny: "Penny",
    commander: "Commander",
    oathbreaker: "Oathbreaker",
    brawl: "Brawl",
    standardbrawl: "Standard Brawl",
    historicbrawl: "Historic Brawl",
    alchemy: "Alchemy",
    timeless: "Timeless",
    paupercommander: "Pauper Commander",
    duel: "Duel Commander",
    predh: "preDH",
    oldschool: "Old School",
    premodern: "Premodern"
};

const COLOR_FILTER_OPTIONS = [
    { value: "w", label: "W", className: "color-w" },
    { value: "u", label: "U", className: "color-u" },
    { value: "b", label: "B", className: "color-b" },
    { value: "r", label: "R", className: "color-r" },
    { value: "g", label: "G", className: "color-g" }
];

function setStatus(text) {
    elements.enrichStatus.textContent = text;
}

function getFormatLabel(formatKey) {
    if (!formatKey) return "";
    return FORMAT_LABELS[formatKey] || formatKey;
}

function toDisplayLabel(value) {
    if (!value) return "";
    return String(value)
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function getRarityLabel(value) {
    const key = String(value || "").toLowerCase();
    const labels = {
        common: "Common",
        uncommon: "Uncommon",
        rare: "Rare",
        mythic: "Mythic"
    };
    return labels[key] || toDisplayLabel(value);
}

function getConditionLabel(value) {
    const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
    return CONDITION_CODE_MAP[key] ? CONDITION_CODE_MAP[key].label : toDisplayLabel(value);
}

function getLanguageLabel(value) {
    const key = normalizeLanguage(String(value || ""));
    return LANGUAGE_LABELS[key] || toDisplayLabel(value);
}

function getCardTypeLabel(value) {
    return toDisplayLabel(value);
}

function initializeColorFilterButtons() {
    if (!elements.filterColorButtons) return;

    elements.filterColorButtons.innerHTML = COLOR_FILTER_OPTIONS
        .map(color => `<button type="button" class="color-filter-btn ${color.className}" data-color="${color.value}">${color.label}</button>`)
        .join("");
}

function getSelectedColorFilters() {
    if (!elements.filterColorButtons) return [];
    return Array.from(elements.filterColorButtons.querySelectorAll(".color-filter-btn.active"))
        .map(button => button.dataset.color)
        .filter(Boolean);
}

function getSelectedColorMode() {
    return elements.filterColorModeSelect ? elements.filterColorModeSelect.value : "includes";
}

function setSelectedColorFilters(selectedColors) {
    if (!elements.filterColorButtons) return;
    const selected = new Set((selectedColors || []).map(color => String(color).toLowerCase()));
    Array.from(elements.filterColorButtons.querySelectorAll(".color-filter-btn")).forEach(button => {
        button.classList.toggle("active", selected.has(String(button.dataset.color).toLowerCase()));
    });
}

function getSelectedLegalityDisplayFormats() {
    if (!elements.legalityDisplayList) return [];
    return Array.from(elements.legalityDisplayList.querySelectorAll('input[type="checkbox"]:checked'))
        .map(input => String(input.value).toLowerCase());
}

function loadLegalityDisplayFormatsOptions() {
    if (!elements.legalityDisplayList) return;

    const sortedFormats = [...state.availableFormats].sort((a, b) => {
        const labelA = getFormatLabel(a).toLowerCase();
        const labelB = getFormatLabel(b).toLowerCase();
        return labelA.localeCompare(labelB);
    });

    elements.legalityDisplayList.innerHTML = sortedFormats
        .map(format => `
            <label class="legality-checkbox">
                <input type="checkbox" value="${format}" />
                <span>${escapeHtml(getFormatLabel(format))}</span>
            </label>
        `)
        .join("");
}

function saveLegalityDisplaySettings() {
    const selectedFormats = getSelectedLegalityDisplayFormats();
    localStorage.setItem(LEGALITY_DISPLAY_SETTINGS_KEY, JSON.stringify({ legalityFormats: selectedFormats }));
}

function loadLegalityDisplaySettings() {
    if (!elements.legalityDisplayList) return;

    try {
        const raw = localStorage.getItem(LEGALITY_DISPLAY_SETTINGS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const selected = new Set(Array.isArray(parsed.legalityFormats) ? parsed.legalityFormats : []);

        Array.from(elements.legalityDisplayList.querySelectorAll('input[type="checkbox"]')).forEach(input => {
            input.checked = selected.has(input.value);
        });
    } catch (error) {
        // Ignore invalid localStorage content.
    }
}

function toggleLegalityMenu(forceOpen) {
    if (!elements.legalityMenu) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : elements.legalityMenu.classList.contains("hidden");
    elements.legalityMenu.classList.toggle("hidden", !shouldOpen);
}

function closeInfoDialog() {
    if (!elements.infoDialog) return;

    if (dialogState.resolver) {
        const resolve = dialogState.resolver;
        dialogState.resolver = null;
        dialogState.mode = "info";
        resolve(null);
    }

    elements.infoDialog.classList.add("hidden");
}

function showInfoDialog({ title = "Information", message = "", html = "", buttonLabel = "OK" }) {
    if (!elements.infoDialog || !elements.infoDialogTitle || !elements.infoDialogBody || !elements.infoDialogClose || !elements.infoDialogCancel) {
        return;
    }

    dialogState.mode = "info";
    dialogState.resolver = null;

    elements.infoDialogTitle.textContent = title;
    if (html) {
        elements.infoDialogBody.innerHTML = html;
    } else {
        elements.infoDialogBody.innerHTML = `<p>${escapeHtml(message)}</p>`;
    }

    elements.infoDialogCancel.classList.add("hidden");
    elements.infoDialogClose.textContent = buttonLabel;
    elements.infoDialog.classList.remove("hidden");
}

function showInputDialog({ title = "Input", message = "", confirmLabel = "Save", cancelLabel = "Cancel", value = "", placeholder = "" }) {
    if (!elements.infoDialog || !elements.infoDialogTitle || !elements.infoDialogBody || !elements.infoDialogClose || !elements.infoDialogCancel) {
        return Promise.resolve(null);
    }

    if (dialogState.resolver) {
        const resolve = dialogState.resolver;
        dialogState.resolver = null;
        resolve(null);
    }

    dialogState.mode = "input";
    elements.infoDialogTitle.textContent = title;
    elements.infoDialogBody.innerHTML = `
        <p>${escapeHtml(message)}</p>
        <input id="dialog-input" class="dialog-input" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    `;

    elements.infoDialogCancel.classList.remove("hidden");
    elements.infoDialogCancel.textContent = cancelLabel;
    elements.infoDialogClose.textContent = confirmLabel;
    elements.infoDialog.classList.remove("hidden");

    const inputEl = elements.infoDialogBody.querySelector("#dialog-input");
    if (inputEl) {
        inputEl.focus();
        inputEl.select();
        inputEl.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                if (elements.infoDialogClose) elements.infoDialogClose.click();
            }
        });
    }

    return new Promise(resolve => {
        dialogState.resolver = resolve;
    });
}

function handleInfoDialogPrimaryAction() {
    if (!elements.infoDialog) return;

    if (dialogState.mode === "input" && dialogState.resolver) {
        const inputEl = elements.infoDialogBody ? elements.infoDialogBody.querySelector("#dialog-input") : null;
        const value = inputEl ? inputEl.value.trim() : "";
        const resolve = dialogState.resolver;
        dialogState.resolver = null;
        dialogState.mode = "info";
        elements.infoDialog.classList.add("hidden");
        resolve(value);
        return;
    }

    elements.infoDialog.classList.add("hidden");
}

function handleInfoDialogCancelAction() {
    if (!elements.infoDialog) return;

    if (dialogState.resolver) {
        const resolve = dialogState.resolver;
        dialogState.resolver = null;
        dialogState.mode = "info";
        elements.infoDialog.classList.add("hidden");
        resolve(null);
        return;
    }

    elements.infoDialog.classList.add("hidden");
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 1) return "<1s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

function getBulkSizeLabel(meta) {
    const sizeBytes = meta && Number(meta.size) > 0 ? Number(meta.size) : 0;
    return sizeBytes > 0 ? ` (~${formatBytes(sizeBytes)})` : "";
}

function setBulkProgress({ visible, progressPercent = 0, text = "", indeterminate = false }) {
    if (!elements.bulkProgress || !elements.bulkProgressBar || !elements.bulkProgressText) return;

    elements.bulkProgress.classList.toggle("hidden", !visible);
    if (!visible) return;

    const clamped = Math.max(0, Math.min(100, progressPercent));
    elements.bulkProgressBar.style.width = indeterminate ? "100%" : `${clamped}%`;
    elements.bulkProgressBar.style.opacity = indeterminate ? "0.5" : "1";
    elements.bulkProgressText.textContent = text;

    const progressTrack = elements.bulkProgress.querySelector(".bulk-progress-track");
    if (progressTrack) {
        progressTrack.setAttribute("aria-valuenow", String(Math.round(clamped)));
    }
}

async function downloadJsonWithProgress(url, progressLabel, expectedTotalBytes = 0) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to download default cards bulk data");

    const headerTotalBytes = Number(response.headers.get("content-length")) || 0;
    const totalBytes = headerTotalBytes > 0 ? headerTotalBytes : (Number(expectedTotalBytes) || 0);
    const hasKnownSize = totalBytes > 0;
    const usesEstimatedSize = headerTotalBytes <= 0 && hasKnownSize;

    if (!response.body || !response.body.getReader) {
        setBulkProgress({
            visible: true,
            progressPercent: 0,
            text: hasKnownSize
                ? `${progressLabel}: downloading 0% • 0 B / ${formatBytes(totalBytes)}${usesEstimatedSize ? " (estimated)" : ""}`
                : `${progressLabel}: downloading...`,
            indeterminate: true
        });
        const jsonData = await response.json();
        setBulkProgress({
            visible: true,
            progressPercent: 100,
            text: `${progressLabel}: complete`,
            indeterminate: false
        });
        return jsonData;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let receivedBytes = 0;
    const startTime = performance.now();

    setBulkProgress({
        visible: true,
        progressPercent: 0,
        text: `${progressLabel}: starting...`,
        indeterminate: !hasKnownSize
    });

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        receivedBytes += value.byteLength;
        chunks.push(decoder.decode(value, { stream: true }));

        const elapsedSeconds = Math.max((performance.now() - startTime) / 1000, 0.001);
        const bytesPerSecond = receivedBytes / elapsedSeconds;

        if (hasKnownSize) {
            const progressPercent = (receivedBytes / totalBytes) * 100;
            const remainingBytes = Math.max(totalBytes - receivedBytes, 0);
            const remainingSeconds = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : Infinity;
            setBulkProgress({
                visible: true,
                progressPercent,
                text: `${progressLabel}: ${Math.round(progressPercent)}% • ${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)}${usesEstimatedSize ? " (estimated)" : ""} • ~${formatDuration(remainingSeconds)} left`,
                indeterminate: false
            });
        } else {
            setBulkProgress({
                visible: true,
                progressPercent: 100,
                text: `${progressLabel}: ${formatBytes(receivedBytes)} downloaded`,
                indeterminate: true
            });
        }
    }

    chunks.push(decoder.decode());
    const jsonText = chunks.join("");
    const jsonData = JSON.parse(jsonText);

    setBulkProgress({
        visible: true,
        progressPercent: 100,
        text: `${progressLabel}: complete`,
        indeterminate: false
    });

    return jsonData;
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            row.push(current);
            current = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") {
                i += 1;
            }
            row.push(current);
            if (row.length > 1 || row[0] !== "") {
                rows.push(row);
            }
            row = [];
            current = "";
            continue;
        }

        current += char;
    }

    if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
    }

    if (rows.length === 0) return [];

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);

    return dataRows
        .filter(r => r.some(cell => cell && cell.trim() !== ""))
        .map((cells, index) => {
            const record = {};
            headers.forEach((header, idx) => {
                record[header] = cells[idx] ? cells[idx].trim() : "";
            });
            record._id = index + 1;
            return record;
        });
}

function normalizeLanguage(value) {
    return value.toLowerCase().replace("-", "_");
}

function prepareCardsForFiltering(cards) {
    cards.forEach(card => {
        card._filterName = (card["Name"] || "").toLowerCase();
        card._filterBinderName = (card["Binder Name"] || "").toLowerCase();
        card._filterBinderType = (card["Binder Type"] || "").toLowerCase();
        card._filterRarity = (card["Rarity"] || "").toLowerCase();
        card._filterCondition = (card["Condition"] || "").toLowerCase();
        card._filterLanguage = (card["Language"] || "").toLowerCase();
        card._filterFoil = (card["Foil"] || "").toLowerCase();
    });
}

function applyScryfallDataToCard(card, scryfallData) {
    card._scryfall = scryfallData;
    card._cardTypes = extractCardTypes(scryfallData.type_line || "");

    const printedName = scryfallData.printed_name;
    card._displayName = printedName && printedName !== scryfallData.name
        ? `${card["Name"]} (${printedName})`
        : (card["Name"] || "");
}

function scheduleBackgroundCardWarmup(cards) {
    const queue = cards.filter(card => !card._scryfall && card["Scryfall ID"]);
    if (queue.length === 0) return;

    const runBatch = async () => {
        const batch = queue.splice(0, 24);
        if (batch.length === 0) return;

        await Promise.all(batch.map(card => enrichCard(card, null, { cacheOnly: true })));

        if (queue.length === 0) return;
        if (typeof requestIdleCallback === "function") {
            requestIdleCallback(() => { runBatch(); }, { timeout: 350 });
        } else {
            setTimeout(() => { runBatch(); }, 60);
        }
    };

    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => { runBatch(); }, { timeout: 350 });
    } else {
        setTimeout(() => { runBatch(); }, 60);
    }
}

function escapeHtml(value) {
    const text = value === undefined || value === null ? "" : String(value);
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function buildCardmarketUrl(card) {
    const scryfall = card._scryfall;
    const baseUrl = scryfall && scryfall.purchase_uris ? scryfall.purchase_uris.cardmarket : "";
    if (!baseUrl) return "#";

    const params = new URLSearchParams();
    params.set("sellerCountry", "7");

    const language = normalizeLanguage(card["Language"] || "");
    if (CARDMARKET_LANGUAGE_MAP[language]) {
        params.set("language", String(CARDMARKET_LANGUAGE_MAP[language]));
    }

    const condition = (card["Condition"] || "").toLowerCase().replace(/\s+/g, "_");
    if (CARDMARKET_CONDITION_MAP[condition]) {
        params.set("minCondition", String(CARDMARKET_CONDITION_MAP[condition]));
    }

    const foil = (card["Foil"] || "").toLowerCase();
    if (foil === "foil") params.set("isFoil", "Y");
    if (foil === "normal") params.set("isFoil", "N");

    const quantity = parseInt(card["Quantity"], 10);
    if (!Number.isNaN(quantity)) params.set("quantity", String(quantity));

    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${params.toString()}`;
}

function extractCardTypes(typeLine) {
    if (!typeLine) return [];
    const mainTypes = typeLine.split("-")[0].trim();
    return mainTypes ? mainTypes.split(/\s+/).map(t => t.toLowerCase()) : [];
}

async function openScryfallCache() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("manabox-viewer", 3);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("scryfall")) {
                db.createObjectStore("scryfall", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("bulk_lookup")) {
                db.createObjectStore("bulk_lookup", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("bulk_missing")) {
                db.createObjectStore("bulk_missing", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function formatIsoDate(value) {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function updateBulkStatus() {
    if (!elements.bulkStatus) return;

    if (elements.updateBulkDataBtn) {
        elements.updateBulkDataBtn.textContent = "Update bulk data";
        elements.updateBulkDataBtn.disabled = false;
    }

    if (!state.bulkRemoteMeta) {
        elements.bulkStatus.textContent = state.bulkLocalUpdatedAt
            ? `Bulk data: local ${formatIsoDate(state.bulkLocalUpdatedAt)}`
            : "Bulk data: unknown";
        if (elements.updateBulkDataBtn) {
            elements.updateBulkDataBtn.disabled = true;
        }
        return;
    }

    const remoteDate = state.bulkRemoteMeta.updated_at;
    const remoteSizeLabel = getBulkSizeLabel(state.bulkRemoteMeta);
    const localDate = state.bulkLocalUpdatedAt;
    if (!localDate) {
        elements.bulkStatus.textContent = `Bulk data: remote ${formatIsoDate(remoteDate)}${remoteSizeLabel} (not downloaded)`;
        if (elements.updateBulkDataBtn) {
            elements.updateBulkDataBtn.textContent = "Download bulk data";
        }
        return;
    }

    const isOutdated = new Date(remoteDate).getTime() > new Date(localDate).getTime();
    elements.bulkStatus.textContent = isOutdated
        ? `Bulk data: local ${formatIsoDate(localDate)} (newer available: ${formatIsoDate(remoteDate)}${remoteSizeLabel})`
        : `Bulk data: up to date (${formatIsoDate(localDate)}${remoteSizeLabel})`;
    if (isOutdated && elements.updateBulkDataBtn) {
        elements.updateBulkDataBtn.textContent = "Update bulk data (newer available)";
    }
}

async function getMetaValue(key) {
    if (!state.scryfallCache) return null;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("meta", "readonly");
        const request = tx.objectStore("meta").get(key);
        request.onsuccess = () => {
            const row = request.result;
            resolve(row ? row.value : null);
        };
        request.onerror = () => resolve(null);
    });
}

async function setMetaValue(key, value) {
    if (!state.scryfallCache) return;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("meta", "readwrite");
        tx.objectStore("meta").put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function getCachedBulkCard(id) {
    if (!state.scryfallCache) return null;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("bulk_lookup", "readonly");
        const request = tx.objectStore("bulk_lookup").get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

async function clearBulkLookup() {
    if (!state.scryfallCache) return;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("bulk_lookup", "readwrite");
        tx.objectStore("bulk_lookup").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function getBulkMissingEntry(id) {
    if (!state.scryfallCache) return null;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("bulk_missing", "readonly");
        const request = tx.objectStore("bulk_missing").get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

async function clearBulkMissing() {
    if (!state.scryfallCache) return;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("bulk_missing", "readwrite");
        tx.objectStore("bulk_missing").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function storeBulkMissing(ids, updatedAt) {
    if (!state.scryfallCache || ids.length === 0) return;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("bulk_missing", "readwrite");
        const store = tx.objectStore("bulk_missing");
        ids.forEach(id => store.put({ id, updatedAt }));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function getBulkMissingIdsForVersion(ids, updatedAt) {
    if (!updatedAt) return [];

    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    const missingIds = [];

    for (const id of uniqueIds) {
        const entry = await getBulkMissingEntry(id);
        if (entry && entry.updatedAt === updatedAt) {
            missingIds.push(id);
        }
    }

    return missingIds;
}

function buildMissingCardsTableHtml(unresolvedIds) {
    const unresolvedSet = new Set(unresolvedIds);
    const unresolvedCards = state.allCards.filter(card => unresolvedSet.has(card["Scryfall ID"]));

    const rows = unresolvedCards
        .slice(0, 100)
        .map(card => {
            const cardName = card["Name"] || "Unknown card";
            const setName = card["Set name"] || "";
            const setCode = card["Set code"] || "";
            const collectorNumber = card["Collector number"] || "";
            const quantity = card["Quantity"] || "0";
            const scryfallId = card["Scryfall ID"] || "";

            return `<tr>
                <td>${escapeHtml(cardName)}</td>
                <td>${escapeHtml(setName)} ${setCode ? `(${escapeHtml(setCode)})` : ""}</td>
                <td>${escapeHtml(collectorNumber)}</td>
                <td>${escapeHtml(quantity)}</td>
                <td>${escapeHtml(scryfallId)}</td>
            </tr>`;
        })
        .join("");

    const omittedCount = unresolvedCards.length - Math.min(unresolvedCards.length, 100);
    return `
        <p><strong>${unresolvedIds.length}</strong> Scryfall IDs were not found in <em>default_cards</em>.</p>
        <table class="dialog-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Set</th>
                    <th>Collector #</th>
                    <th>Qty</th>
                    <th>Scryfall ID</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        ${omittedCount > 0 ? `<p>Showing first 100 rows. ${omittedCount} more not shown.</p>` : ""}
    `;
}

function showMissingCardsDialog(unresolvedIds) {
    if (!unresolvedIds || unresolvedIds.length === 0) return;
    showInfoDialog({
        title: "Missing Scryfall IDs",
        html: buildMissingCardsTableHtml(unresolvedIds),
        buttonLabel: "Close"
    });
}

async function storeBulkCards(cards) {
    if (!state.scryfallCache || cards.length === 0) return;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("bulk_lookup", "readwrite");
        const store = tx.objectStore("bulk_lookup");
        cards.forEach(card => store.put(card));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function fetchDefaultCardsMeta() {
    const response = await fetch(SCRYFALL_DEFAULT_CARDS_META_URL);
    if (!response.ok) return null;
    return response.json();
}

async function getCachedScryfall(id) {
    if (!state.scryfallCache) return null;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("scryfall", "readonly");
        const store = tx.objectStore("scryfall");
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

async function setCachedScryfall(cardData) {
    if (!state.scryfallCache || !cardData) return;
    return new Promise(resolve => {
        const tx = state.scryfallCache.transaction("scryfall", "readwrite");
        tx.objectStore("scryfall").put(cardData);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function fetchScryfallCard(id, options = {}) {
    const { cacheOnly = false } = options;

    if (state.scryfallInFlight.has(id)) return state.scryfallInFlight.get(id);

    const cached = await getCachedScryfall(id);
    if (cached) return cached;

    const bulkCached = await getCachedBulkCard(id);
    if (bulkCached) {
        setCachedScryfall(bulkCached);
        return bulkCached;
    }

    if (cacheOnly) return null;

    const request = fetch(`https://api.scryfall.com/cards/${id}`)
        .then(response => response.ok ? response.json() : null)
        .then(data => {
            if (data) setCachedScryfall(data);
            state.scryfallInFlight.delete(id);
            return data;
        })
        .catch(() => {
            state.scryfallInFlight.delete(id);
            return null;
        });

    state.scryfallInFlight.set(id, request);
    return request;
}

async function refreshBulkMetaStatus() {
    state.bulkLocalUpdatedAt = await getMetaValue(META_BULK_DEFAULT_CARDS_UPDATED_AT_KEY);
    try {
        state.bulkRemoteMeta = await fetchDefaultCardsMeta();
    } catch (error) {
        state.bulkRemoteMeta = null;
    }
    updateBulkStatus();
}

async function loadBulkLookupForIds(ids, options = {}) {
    const { forceUpdate = false, allowDownload = true, onlyIfMissing = false } = options;
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    if (!state.bulkRemoteMeta) {
        await refreshBulkMetaStatus();
    }

    const remoteMeta = state.bulkRemoteMeta;
    if (!remoteMeta || !remoteMeta.download_uri) return;

    const remoteUpdatedAt = remoteMeta.updated_at;
    const localUpdatedAt = state.bulkLocalUpdatedAt;
    const hasLocalVersion = Boolean(localUpdatedAt);
    const hasNewerRemote = !localUpdatedAt || (new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime());

    const missingIds = [];
    for (const id of uniqueIds) {
        const cached = await getCachedBulkCard(id);
        if (cached) continue;

        if (localUpdatedAt) {
            const missingEntry = await getBulkMissingEntry(id);
            if (missingEntry && missingEntry.updatedAt === localUpdatedAt) {
                continue;
            }
        }

        missingIds.push(id);
    }

    const shouldDownload = forceUpdate
        || (onlyIfMissing ? (missingIds.length > 0) : (!hasLocalVersion || hasNewerRemote || missingIds.length > 0));
    if (!shouldDownload) return;
    if (!allowDownload) return;

    if (state.bulkLoadingPromise) {
        await state.bulkLoadingPromise;
        return;
    }

    const shouldRefreshAll = forceUpdate || (hasNewerRemote && !onlyIfMissing);

    const targetIds = shouldRefreshAll
        ? uniqueIds
        : (missingIds.length > 0 ? missingIds : uniqueIds);

    state.bulkLoadingPromise = (async () => {
        const label = forceUpdate ? "updating" : "loading";
        setStatus(`Scryfall: ${label} default cards bulk data`);
        const allCards = await downloadJsonWithProgress(remoteMeta.download_uri, "Bulk data", Number(remoteMeta.size) || 0);
        const idSet = new Set(targetIds);
        const matchedCards = [];

        for (const card of allCards) {
            if (idSet.has(card.id)) {
                matchedCards.push(card);
                idSet.delete(card.id);
                if (idSet.size === 0) break;
            }
        }

        if (shouldRefreshAll) {
            await clearBulkLookup();
            await clearBulkMissing();
        }

        await storeBulkCards(matchedCards);
        const unresolvedIds = Array.from(idSet);
        await storeBulkMissing(unresolvedIds, remoteUpdatedAt);
        await setMetaValue(META_BULK_DEFAULT_CARDS_UPDATED_AT_KEY, remoteUpdatedAt);
        state.bulkLocalUpdatedAt = remoteUpdatedAt;
        updateBulkStatus();

        return {
            unresolvedIds
        };
    })();

    try {
        const bulkResult = await state.bulkLoadingPromise;
        const unresolvedIds = bulkResult && Array.isArray(bulkResult.unresolvedIds)
            ? bulkResult.unresolvedIds
            : [];

        if (unresolvedIds.length > 0) {
            showMissingCardsDialog(unresolvedIds);
        }

        setStatus("Scryfall: idle");
    } catch (error) {
        setStatus("Scryfall: bulk data load failed");
        setBulkProgress({
            visible: true,
            progressPercent: 0,
            text: "Bulk data: download failed",
            indeterminate: false
        });
    } finally {
        state.bulkLoadingPromise = null;
        if (elements.bulkProgress && !elements.bulkProgressText.textContent.includes("failed")) {
            setTimeout(() => {
                if (!state.bulkLoadingPromise) {
                    setBulkProgress({ visible: false });
                }
            }, 1200);
        }
    }
}

function buildSelectOptions(selectEl, values, getLabel = value => value) {
    const existing = selectEl.querySelectorAll("option");
    const keep = existing.length > 0 ? existing[0].outerHTML : "";
    selectEl.innerHTML = keep;

    values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = getLabel(value);
        selectEl.appendChild(option);
    });
}

function loadFilterOptions(cards) {
    const binderNames = new Set();
    const binderTypes = new Set();
    const rarities = new Set();
    const conditions = new Set();
    const languages = new Set();

    cards.forEach(card => {
        if (card["Binder Name"]) binderNames.add(card["Binder Name"]);
        if (card["Binder Type"]) binderTypes.add(card["Binder Type"]);
        if (card["Rarity"]) rarities.add(card["Rarity"]);
        if (card["Condition"]) conditions.add(card["Condition"]);
        if (card["Language"]) languages.add(card["Language"]);
    });

    buildSelectOptions(elements.filterBinderNameSelect, Array.from(binderNames).sort());
    buildSelectOptions(elements.filterBinderTypeSelect, Array.from(binderTypes).sort(), toDisplayLabel);
    buildSelectOptions(elements.filterRaritySelect, Array.from(rarities).sort(), getRarityLabel);

    const conditionOrder = {
        mint: 1,
        near_mint: 2,
        excellent: 3,
        good: 4,
        light_played: 5,
        played: 6,
        poor: 7
    };

    const sortedConditions = Array.from(conditions).sort((a, b) => {
        const keyA = String(a || "").toLowerCase().replace(/\s+/g, "_");
        const keyB = String(b || "").toLowerCase().replace(/\s+/g, "_");
        const orderA = conditionOrder[keyA] ?? Number.MAX_SAFE_INTEGER;
        const orderB = conditionOrder[keyB] ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return getConditionLabel(a).localeCompare(getConditionLabel(b));
    });

    buildSelectOptions(elements.filterConditionSelect, sortedConditions, getConditionLabel);
    buildSelectOptions(elements.filterLanguageSelect, Array.from(languages).sort(), getLanguageLabel);
}

async function loadCardTypesCatalog() {
    try {
        const response = await fetch("https://api.scryfall.com/catalog/card-types");
        if (!response.ok) return;
        const data = await response.json();
        const types = (data.data || []).map(t => t.toLowerCase()).sort();
        buildSelectOptions(elements.filterCardTypeSelect, types, getCardTypeLabel);
    } catch (error) {
        // Keep default empty if fetch fails.
    }
}

function createFormatFilterRow(filterId) {
    const row = document.createElement("div");
    row.className = "format-filter-row";
    row.dataset.filterId = filterId;

    row.innerHTML = `
        <select class="filter-connector" data-filter-id="${filterId}">
            <option value="and">AND</option>
            <option value="or">OR</option>
        </select>
        <select class="filter-legality-type" data-filter-id="${filterId}">
            <option value="legal">Legal in</option>
            <option value="not-legal">Not legal in</option>
            <option value="banned">Banned in</option>
        </select>
        <select class="filter-format-select" data-filter-id="${filterId}">
            <option value="">Select format</option>
            ${state.availableFormats.map(fmt => `<option value="${fmt}">${getFormatLabel(fmt)}</option>`).join("")}
        </select>
        <button class="remove-format-filter" data-filter-id="${filterId}" type="button">x</button>
    `;

    return row;
}

function addFormatFilter() {
    const filterId = state.nextFormatId++;
    state.formatFilters.push({ id: filterId, connector: "and", legalityType: "legal", format: "" });

    const row = createFormatFilterRow(filterId);
    elements.formatFiltersContainer.appendChild(row);

    row.querySelector(".filter-connector").addEventListener("change", e => {
        const filter = state.formatFilters.find(f => f.id === filterId);
        if (filter) filter.connector = e.target.value;
        scheduleApplyFilters();
    });

    row.querySelector(".filter-legality-type").addEventListener("change", e => {
        const filter = state.formatFilters.find(f => f.id === filterId);
        if (filter) filter.legalityType = e.target.value;
        scheduleApplyFilters();
    });

    row.querySelector(".filter-format-select").addEventListener("change", e => {
        const filter = state.formatFilters.find(f => f.id === filterId);
        if (filter) filter.format = e.target.value;
        scheduleApplyFilters();
    });

    row.querySelector(".remove-format-filter").addEventListener("click", () => removeFormatFilter(filterId));
}

function removeFormatFilter(filterId) {
    state.formatFilters = state.formatFilters.filter(f => f.id !== filterId);
    const row = elements.formatFiltersContainer.querySelector(`[data-filter-id="${filterId}"]`);
    if (row) row.remove();
    scheduleApplyFilters();
}

function evaluateFormatFilters(card) {
    if (state.formatFilters.length === 0) return true;
    if (!card._scryfall || !card._scryfall.legalities) return false;

    let result = null;
    state.formatFilters.forEach(filter => {
        if (!filter.format) return;
        const status = card._scryfall.legalities[filter.format];
        let conditionResult = false;
        if (filter.legalityType === "legal") {
            conditionResult = status === "legal" || status === "restricted";
        } else if (filter.legalityType === "banned") {
            conditionResult = status === "banned";
        } else {
            conditionResult = status === "not_legal";
        }

        if (result === null) {
            result = conditionResult;
        } else if (filter.connector === "and") {
            result = result && conditionResult;
        } else {
            result = result || conditionResult;
        }
    });

    return result !== null ? result : true;
}

function getSortValue(card, sortField) {
    switch (sortField) {
        case "name":
            return (card._displayName || card["Name"] || "").toLowerCase();
        case "rarity":
            return { common: 1, uncommon: 2, rare: 3, mythic: 4 }[(card["Rarity"] || "").toLowerCase()] || 0;
        case "set":
            return (card["Set name"] || "").toLowerCase();
        case "quantity":
            return parseInt(card["Quantity"], 10) || 0;
        case "condition":
            return { mint: 1, near_mint: 2, excellent: 3, good: 4, light_played: 5, played: 6, poor: 7 }[(card["Condition"] || "").toLowerCase().replace(/\s+/g, "_")] || 0;
        case "binder":
            return (card["Binder Name"] || "").toLowerCase();
        case "cmc":
            return card._scryfall && card._scryfall.cmc !== undefined ? card._scryfall.cmc : 0;
        case "type": {
            const order = { planeswalker: 1, creature: 2, artifact: 3, instant: 4, sorcery: 5, enchantment: 6, land: 7, battle: 8 };
            const types = card._cardTypes || [];
            for (const type of types) {
                if (order[type] !== undefined) return order[type];
            }
            return 999;
        }
        default:
            return "";
    }
}

function sortCards(cards) {
    const validCriteria = state.sortCriteria.filter(c => c.field);
    if (validCriteria.length === 0) return cards;

    return cards.sort((a, b) => {
        for (const criterion of validCriteria) {
            const aVal = getSortValue(a, criterion.field);
            const bVal = getSortValue(b, criterion.field);
            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            else if (aVal > bVal) comparison = 1;
            if (criterion.direction === "desc") comparison *= -1;
            if (comparison !== 0) return comparison;
        }
        return 0;
    });
}

function createSortCriteriaRow(sortId, isFirst) {
    const row = document.createElement("div");
    row.className = "sort-criteria-row";
    row.dataset.sortId = sortId;

    const label = isFirst ? "Sort by" : "Then by";
    row.innerHTML = `
        <select class="sort-field-select" data-sort-id="${sortId}">
            <option value="">${label}</option>
            <option value="name">Name</option>
            <option value="rarity">Rarity</option>
            <option value="set">Set</option>
            <option value="quantity">Quantity</option>
            <option value="condition">Condition</option>
            <option value="binder">Binder Name</option>
            <option value="cmc">Mana Value (CMC)</option>
            <option value="type">Card Type</option>
        </select>
        <select class="sort-direction-select" data-sort-id="${sortId}">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
        </select>
        <button class="remove-sort-criteria" data-sort-id="${sortId}" type="button">x</button>
    `;

    return row;
}

function addSortCriteria() {
    const sortId = state.nextSortId++;
    state.sortCriteria.push({ id: sortId, field: "", direction: "asc" });

    const row = createSortCriteriaRow(sortId, state.sortCriteria.length === 1);
    elements.sortCriteriaContainer.appendChild(row);

    row.querySelector(".sort-field-select").addEventListener("change", e => {
        const sort = state.sortCriteria.find(s => s.id === sortId);
        if (sort) sort.field = e.target.value;
        scheduleApplyFilters();
    });

    row.querySelector(".sort-direction-select").addEventListener("change", e => {
        const sort = state.sortCriteria.find(s => s.id === sortId);
        if (sort) sort.direction = e.target.value;
        scheduleApplyFilters();
    });

    row.querySelector(".remove-sort-criteria").addEventListener("click", () => removeSortCriteria(sortId));
}

function removeSortCriteria(sortId) {
    state.sortCriteria = state.sortCriteria.filter(s => s.id !== sortId);
    const row = elements.sortCriteriaContainer.querySelector(`[data-sort-id="${sortId}"]`);
    if (row) row.remove();
    scheduleApplyFilters();
}

function getCardColors(card) {
    if (!card._scryfall) return null;

    const sourceColors = Array.isArray(card._scryfall.colors) ? card._scryfall.colors : [];
    return sourceColors.map(color => String(color).toLowerCase());
}

function matchesColorFilter(card, colorFilters, colorMode) {
    if (!colorFilters || colorFilters.length === 0) return true;

    const colors = getCardColors(card);
    if (colors === null) return false;

    const selectedSet = new Set(colorFilters);
    const cardSet = new Set(colors);

    if (colorMode === "exact") {
        if (cardSet.size !== selectedSet.size) return false;
        return colorFilters.every(color => cardSet.has(color));
    }

    if (colorMode === "at-most") {
        return colors.every(color => selectedSet.has(color));
    }

    return colorFilters.every(color => colors.includes(color));
}

function hasScryfallDependentFilters(filters) {
    const hasCmcFilter = Boolean(filters.cmcOperator && filters.cmcValue);
    const hasCardTypeFilter = Boolean(filters.cardType);
    const hasColorFilter = Array.isArray(filters.color) && filters.color.length > 0;
    const hasFormatFilter = state.formatFilters.some(filter => filter.format);
    return hasCmcFilter || hasCardTypeFilter || hasColorFilter || hasFormatFilter;
}

async function enrichCardsForScryfallFilters(cards) {
    const cardsToEnrich = cards.filter(card => !card._scryfall && card["Scryfall ID"]);
    if (cardsToEnrich.length === 0) return;

    await loadBulkLookupForIds(cardsToEnrich.map(card => card["Scryfall ID"]), { allowDownload: false });

    const total = cardsToEnrich.length;
    const batchSize = 20;

    setStatus(`Scryfall: enriching ${total} cards for filters`);

    for (let index = 0; index < total; index += batchSize) {
        const batch = cardsToEnrich.slice(index, index + batchSize);
        await Promise.all(batch.map(card => enrichCard(card, null)));
        const done = Math.min(index + batch.length, total);
        setStatus(`Scryfall: enriching ${done}/${total} for filters`);
    }

    setStatus("Scryfall: idle");
}

async function applyFilters() {
    const filters = {
        name: elements.searchNameInput.value.toLowerCase(),
        binderName: elements.filterBinderNameSelect.value.toLowerCase(),
        binderType: elements.filterBinderTypeSelect.value.toLowerCase(),
        rarity: elements.filterRaritySelect.value.toLowerCase(),
        condition: elements.filterConditionSelect.value.toLowerCase(),
        language: elements.filterLanguageSelect.value.toLowerCase(),
        color: getSelectedColorFilters(),
        colorMode: getSelectedColorMode(),
        foil: elements.filterFoilSelect.value.toLowerCase(),
        cmcOperator: elements.filterCMCOperator.value,
        cmcValue: elements.filterCMCValue.value,
        cardType: elements.filterCardTypeSelect.value.toLowerCase()
    };

    if (hasScryfallDependentFilters(filters)) {
        await enrichCardsForScryfallFilters(state.allCards);
    }

    state.filteredCards = state.allCards.filter(card => {
        if (filters.name && !card._filterName.includes(filters.name)) return false;
        if (filters.binderName && card._filterBinderName !== filters.binderName) return false;
        if (filters.binderType && card._filterBinderType !== filters.binderType) return false;
        if (filters.rarity && card._filterRarity !== filters.rarity) return false;
        if (filters.condition && card._filterCondition !== filters.condition) return false;
        if (filters.language && card._filterLanguage !== filters.language) return false;
        if (!matchesColorFilter(card, filters.color, filters.colorMode)) return false;
        if (filters.foil && card._filterFoil !== filters.foil) return false;

        if (filters.cmcOperator && filters.cmcValue) {
            if (!card._scryfall || card._scryfall.cmc === undefined) return false;
            const cardCmc = parseInt(card._scryfall.cmc, 10);
            const filterCmc = parseInt(filters.cmcValue, 10);
            switch (filters.cmcOperator) {
                case "=": if (cardCmc !== filterCmc) return false; break;
                case "!=": if (cardCmc === filterCmc) return false; break;
                case "<": if (cardCmc >= filterCmc) return false; break;
                case "<=": if (cardCmc > filterCmc) return false; break;
                case ">": if (cardCmc <= filterCmc) return false; break;
                case ">=": if (cardCmc < filterCmc) return false; break;
                default: break;
            }
        }

        if (filters.cardType) {
            const types = card._cardTypes || [];
            if (!types.includes(filters.cardType)) return false;
        }

        if (!evaluateFormatFilters(card)) return false;

        return true;
    });

    renderCards(state.filteredCards);
}

function renderCards(cards) {
    const totalQuantity = cards.reduce((sum, card) => sum + (parseInt(card["Quantity"], 10) || 0), 0);
    elements.cardCountSpan.textContent = totalQuantity;

    if (cards.length === 0) {
        elements.cardsContainer.innerHTML = '<div class="no-results">No cards match your filters.</div>';
        return;
    }

    const sorted = sortCards([...cards]);
    state.currentPage = 0;
    state.displayedCards = sorted;
    renderPage();
}

function renderPage() {
    const end = (state.currentPage + 1) * state.cardsPerPage;
    const cardsToShow = state.displayedCards.slice(0, end);

    elements.cardsContainer.innerHTML = cardsToShow.map(createCardElement).join("");

    if (end < state.displayedCards.length) {
        const button = document.createElement("button");
        button.className = "ghost-btn";
        button.textContent = `Load More (${state.displayedCards.length - end} remaining)`;
        button.addEventListener("click", () => {
            state.currentPage += 1;
            renderPage();
        });
        elements.cardsContainer.appendChild(button);
    }

    setupScryfallObserver(cardsToShow);
}

function createCardElement(card) {
    const displayName = card._displayName || card["Name"] || "";
    const setName = card["Set name"] || "";
    const setCode = card["Set code"] || "";
    const rarityKey = (card["Rarity"] || "").toLowerCase();
    const rarityIcon = RARITY_ICONS[rarityKey] || { icon: "?", label: card["Rarity"] || "Unknown" };
    const conditionKey = (card["Condition"] || "").toLowerCase().replace(/\s+/g, "_");
    const conditionData = CONDITION_CODE_MAP[conditionKey] || { code: "un", label: card["Condition"] || "Unknown" };
    const languageKey = normalizeLanguage(card["Language"] || "");
    const languageIcon = LANGUAGE_ICONS[languageKey] || { icon: "🌐", label: card["Language"] || "Unknown" };

    const isFoil = (card["Foil"] || "").toLowerCase() === "foil";
    
    // Handle double-sided cards (card_faces) vs regular cards
    let imageUrl = "";
    if (card._scryfall) {
        if (card._scryfall.card_faces && card._scryfall.card_faces.length > 0 && card._scryfall.card_faces[0].image_uris) {
            imageUrl = card._scryfall.card_faces[0].image_uris.normal;
        } else if (card._scryfall.image_uris) {
            imageUrl = card._scryfall.image_uris.normal;
        }
    }
    
    const scryfallUrl = card._scryfall ? card._scryfall.scryfall_uri : "#";
    const cardmarketUrl = buildCardmarketUrl(card);

    const legalities = buildLegalities(card);

    const imageHtml = imageUrl
        ? `<div class="card-image${isFoil ? " is-foil" : ""}"><img src="${imageUrl}" alt="${escapeHtml(displayName)}"></div>`
        : `<div class="card-image${isFoil ? " is-foil" : ""}">No image</div>`;

    return `
        <div class="card-item" data-card-id="${card._id}">
            ${imageHtml}
            <div class="card-content">
                <div>
                    <div class="card-title"><span class="card-quantity">${escapeHtml(card["Quantity"] || "0")}x</span> ${escapeHtml(displayName)}</div>
                    <div class="card-subtitle">${escapeHtml(setName)} (${escapeHtml(setCode)})</div>
                </div>

                <div class="card-metadata">
                    <span class="badge-icon" title="${escapeHtml(rarityIcon.label)}">${rarityIcon.icon}</span>
                    <a href="https://help.cardmarket.com/en/CardCondition" target="_blank" rel="noopener noreferrer" class="article-condition condition-${conditionData.code}" title="${escapeHtml(conditionData.label)}"><span class="badge">${escapeHtml(conditionData.code.toUpperCase())}</span></a>
                    <span class="badge-icon" title="${escapeHtml(languageIcon.label)}">${languageIcon.icon}</span>
                    ${isFoil ? '<span class="badge-icon" title="Foil">⭐</span>' : ''}
                </div>

                <div class="card-details">
                    <div>
                        <div class="detail-label">Collector</div>
                        <div class="detail-value">${escapeHtml(card["Collector number"] || "")}</div>
                    </div>
                    <div>
                        <div class="detail-label">Binder</div>
                        <div class="detail-value">${escapeHtml(card["Binder Name"] || "")}</div>
                    </div>
                    <div>
                        <div class="detail-label">Type</div>
                        <div class="detail-value">${escapeHtml(toDisplayLabel(card["Binder Type"] || ""))}</div>
                    </div>
                    <div>
                        <div class="detail-label">Purchase</div>
                        <div class="detail-value">${escapeHtml(card["Purchase price"] || "")} ${escapeHtml(card["Purchase price currency"] || "")}</div>
                    </div>
                    <div>
                        <div class="detail-label">Misprint</div>
                        <div class="detail-value">${(card["Misprint"] || "").toLowerCase() === "true" ? "Yes" : "No"}</div>
                    </div>
                    <div>
                        <div class="detail-label">Altered</div>
                        <div class="detail-value">${(card["Altered"] || "").toLowerCase() === "true" ? "Yes" : "No"}</div>
                    </div>
                </div>

                ${legalities ? `<div class="legalities">${legalities}</div>` : ''}

                <div class="card-actions">
                    ${cardmarketUrl !== "#" ? `<a class="card-link" href="${cardmarketUrl}" target="_blank" rel="noopener noreferrer">Cardmarket</a>` : '<span class="card-link">Cardmarket N/A</span>'}
                    <a class="card-link secondary" href="${scryfallUrl}" target="_blank" rel="noopener noreferrer">Scryfall</a>
                </div>
            </div>
        </div>
    `;
}

function buildLegalities(card) {
    if (!card._scryfall || !card._scryfall.legalities) return "";
    const selectedDisplayFormats = new Set(getSelectedLegalityDisplayFormats());

    const entries = Object.entries(card._scryfall.legalities)
        .filter(([format, status]) => {
            if (!["legal", "banned", "restricted"].includes(status)) return false;
            if (selectedDisplayFormats.size === 0) return true;
            return selectedDisplayFormats.has(format);
        });

    if (entries.length === 0) return "";

    return entries.map(([format, status]) => {
        const statusClass = status === "legal" ? "legal" : status;
        return `<span class="legality-item ${statusClass}">${escapeHtml(getFormatLabel(format))}</span>`;
    }).join("");
}

async function enrichCard(card, cardElement, options = {}) {
    const { cacheOnly = false } = options;

    if (!card["Scryfall ID"]) return;
    if (card._scryfall) return;

    const scryfallData = await fetchScryfallCard(card["Scryfall ID"], { cacheOnly });
    if (!scryfallData) return;

    applyScryfallDataToCard(card, scryfallData);

    if (cardElement) {
        const newHtml = createCardElement(card);
        cardElement.outerHTML = newHtml;
    }
}

function setupScryfallObserver(cards) {
    if (state.scryfallObserver) state.scryfallObserver.disconnect();

    const cardMap = {};
    cards.forEach(card => { cardMap[card._id] = card; });

    state.scryfallObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const cardElement = entry.target;
            const cardId = parseInt(cardElement.dataset.cardId, 10);
            const card = cardMap[cardId];
            if (!card) return;
            enrichCard(card, cardElement);
            state.scryfallObserver.unobserve(cardElement);
        });
    }, { root: null, rootMargin: "400px", threshold: 0 });

    document.querySelectorAll(".card-item").forEach(el => state.scryfallObserver.observe(el));
}

async function enrichVisibleCards() {
    setStatus("Scryfall: enriching visible");
    const cardElements = Array.from(document.querySelectorAll(".card-item"));
    const ids = cardElements
        .map(cardElement => {
            const cardId = parseInt(cardElement.dataset.cardId, 10);
            const card = state.displayedCards.find(c => c._id === cardId);
            return card ? card["Scryfall ID"] : "";
        })
        .filter(Boolean);

    await loadBulkLookupForIds(ids, { allowDownload: false });

    for (const cardElement of cardElements) {
        const cardId = parseInt(cardElement.dataset.cardId, 10);
        const card = state.displayedCards.find(c => c._id === cardId);
        if (card) await enrichCard(card, cardElement);
    }
    setStatus("Scryfall: idle");
}

async function updateBulkDataForCurrentCards() {
    if (!state.allCards || state.allCards.length === 0) {
        showInfoDialog({
            title: "Bulk Data Update",
            message: "Load a CSV first so cards can be indexed from default cards bulk data."
        });
        return;
    }

    const ids = state.allCards.map(card => card["Scryfall ID"]).filter(Boolean);
    if (ids.length === 0) {
        showInfoDialog({
            title: "Bulk Data Update",
            message: "No Scryfall IDs found in the loaded CSV."
        });
        return;
    }

    await refreshBulkMetaStatus();
    await loadBulkLookupForIds(ids, { forceUpdate: true });

    const missingIds = await getBulkMissingIdsForVersion(ids, state.bulkLocalUpdatedAt);

    if (hasScryfallDependentFilters({
        cmcOperator: elements.filterCMCOperator.value,
        cmcValue: elements.filterCMCValue.value,
        cardType: elements.filterCardTypeSelect.value,
        color: getSelectedColorFilters()
    })) {
        await applyFilters();
    }

    if (missingIds.length > 0) {
        showMissingCardsDialog(missingIds);
    } else {
        showInfoDialog({
            title: "Bulk Data Update",
            message: "Bulk data updated for the currently loaded cards."
        });
    }
}

function resetFilters() {
    elements.searchNameInput.value = "";
    elements.filterBinderNameSelect.value = "";
    elements.filterBinderTypeSelect.value = "";
    elements.filterRaritySelect.value = "";
    elements.filterConditionSelect.value = "";
    elements.filterLanguageSelect.value = "";
    setSelectedColorFilters([]);
    if (elements.filterColorModeSelect) {
        elements.filterColorModeSelect.value = "includes";
    }
    elements.filterFoilSelect.value = "";
    elements.filterCMCOperator.value = "";
    elements.filterCMCValue.value = "";
    elements.filterCardTypeSelect.value = "";

    state.formatFilters = [];
    state.sortCriteria = [];
    state.nextFormatId = 0;
    state.nextSortId = 0;
    elements.formatFiltersContainer.innerHTML = "";
    elements.sortCriteriaContainer.innerHTML = "";

    applyFilters();
}

function toggleDetails() {
    elements.cardsContainer.classList.toggle("compact-view");
    elements.toggleDetailsBtn.classList.toggle("active");
    elements.toggleDetailsBtn.textContent = elements.toggleDetailsBtn.classList.contains("active") ? "Details" : "Compact";
}

function getCurrentFilterState() {
    return {
        filters: {
            name: elements.searchNameInput.value,
            binderName: elements.filterBinderNameSelect.value,
            binderType: elements.filterBinderTypeSelect.value,
            rarity: elements.filterRaritySelect.value,
            condition: elements.filterConditionSelect.value,
            language: elements.filterLanguageSelect.value,
            color: getSelectedColorFilters(),
            colorMode: getSelectedColorMode(),
            foil: elements.filterFoilSelect.value,
            cmcOperator: elements.filterCMCOperator.value,
            cmcValue: elements.filterCMCValue.value,
            cardType: elements.filterCardTypeSelect.value
        },
        display: {
            legalityFormats: getSelectedLegalityDisplayFormats()
        },
        formatFilters: state.formatFilters.map(f => ({
            connector: f.connector,
            legalityType: f.legalityType,
            format: f.format
        })),
        sortCriteria: state.sortCriteria.map(s => ({
            field: s.field,
            direction: s.direction
        }))
    };
}

function loadSavedConfigs() {
    const configs = JSON.parse(localStorage.getItem("mtg_filter_configs") || "{}");
    elements.savedConfigsSelect.innerHTML = '<option value="">Load a saved config</option>';
    Object.keys(configs).sort().forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        elements.savedConfigsSelect.appendChild(option);
    });
}

async function saveCurrentConfig() {
    const prefilledName = elements.savedConfigsSelect.value || "";
    const name = await showInputDialog({
        title: "Save Configuration",
        message: "Enter a name for this configuration:",
        confirmLabel: "Save",
        cancelLabel: "Cancel",
        value: prefilledName,
        placeholder: "Configuration name"
    });
    if (!name || name.trim() === "") return;

    const configs = JSON.parse(localStorage.getItem("mtg_filter_configs") || "{}");
    configs[name.trim()] = getCurrentFilterState();
    localStorage.setItem("mtg_filter_configs", JSON.stringify(configs));
    loadSavedConfigs();
    elements.savedConfigsSelect.value = name.trim();
    showInfoDialog({
        title: "Saved Configuration",
        message: `Configuration "${name.trim()}" saved.`
    });
}

function loadSelectedConfig() {
    const name = elements.savedConfigsSelect.value;
    if (!name) return;

    const configs = JSON.parse(localStorage.getItem("mtg_filter_configs") || "{}");
    const config = configs[name];
    if (!config) return;

    elements.searchNameInput.value = config.filters.name || "";
    elements.filterBinderNameSelect.value = config.filters.binderName || "";
    elements.filterBinderTypeSelect.value = config.filters.binderType || "";
    elements.filterRaritySelect.value = config.filters.rarity || "";
    elements.filterConditionSelect.value = config.filters.condition || "";
    elements.filterLanguageSelect.value = config.filters.language || "";
    if (Array.isArray(config.filters.color)) {
        setSelectedColorFilters(config.filters.color);
    } else if (config.filters.color) {
        setSelectedColorFilters([config.filters.color]);
    } else {
        setSelectedColorFilters([]);
    }
    if (elements.filterColorModeSelect) {
        elements.filterColorModeSelect.value = config.filters.colorMode || "includes";
    }
    elements.filterFoilSelect.value = config.filters.foil || "";
    elements.filterCMCOperator.value = config.filters.cmcOperator || "";
    elements.filterCMCValue.value = config.filters.cmcValue || "";
    elements.filterCardTypeSelect.value = config.filters.cardType || "";

    if (elements.legalityDisplayList) {
        const selectedLegalityFormats = new Set((config.display && config.display.legalityFormats) || []);
        Array.from(elements.legalityDisplayList.querySelectorAll('input[type="checkbox"]')).forEach(input => {
            input.checked = selectedLegalityFormats.has(input.value);
        });
    }

    state.formatFilters = [];
    state.nextFormatId = 0;
    elements.formatFiltersContainer.innerHTML = "";

    (config.formatFilters || []).forEach(filter => {
        const filterId = state.nextFormatId++;
        state.formatFilters.push({ id: filterId, connector: filter.connector, legalityType: filter.legalityType, format: filter.format });
        const row = createFormatFilterRow(filterId);
        elements.formatFiltersContainer.appendChild(row);
        const connectorSelect = row.querySelector(".filter-connector");
        const legalitySelect = row.querySelector(".filter-legality-type");
        const formatSelect = row.querySelector(".filter-format-select");
        const removeBtn = row.querySelector(".remove-format-filter");

        connectorSelect.value = filter.connector;
        legalitySelect.value = filter.legalityType;
        formatSelect.value = filter.format;

        connectorSelect.addEventListener("change", e => {
            const target = state.formatFilters.find(f => f.id === filterId);
            if (target) target.connector = e.target.value;
            scheduleApplyFilters();
        });

        legalitySelect.addEventListener("change", e => {
            const target = state.formatFilters.find(f => f.id === filterId);
            if (target) target.legalityType = e.target.value;
            scheduleApplyFilters();
        });

        formatSelect.addEventListener("change", e => {
            const target = state.formatFilters.find(f => f.id === filterId);
            if (target) target.format = e.target.value;
            scheduleApplyFilters();
        });

        removeBtn.addEventListener("click", () => removeFormatFilter(filterId));
    });

    state.sortCriteria = [];
    state.nextSortId = 0;
    elements.sortCriteriaContainer.innerHTML = "";

    (config.sortCriteria || []).forEach((sort, index) => {
        const sortId = state.nextSortId++;
        state.sortCriteria.push({ id: sortId, field: sort.field, direction: sort.direction });
        const row = createSortCriteriaRow(sortId, index === 0);
        elements.sortCriteriaContainer.appendChild(row);
        const fieldSelect = row.querySelector(".sort-field-select");
        const directionSelect = row.querySelector(".sort-direction-select");
        const removeBtn = row.querySelector(".remove-sort-criteria");

        fieldSelect.value = sort.field;
        directionSelect.value = sort.direction;

        fieldSelect.addEventListener("change", e => {
            const target = state.sortCriteria.find(s => s.id === sortId);
            if (target) target.field = e.target.value;
            scheduleApplyFilters();
        });

        directionSelect.addEventListener("change", e => {
            const target = state.sortCriteria.find(s => s.id === sortId);
            if (target) target.direction = e.target.value;
            scheduleApplyFilters();
        });

        removeBtn.addEventListener("click", () => removeSortCriteria(sortId));
    });

    if (state.displayedCards.length > 0) {
        renderPage();
    }

    applyFilters();
}

function deleteSelectedConfig() {
    const name = elements.savedConfigsSelect.value;
    if (!name) return;

    if (!confirm(`Delete configuration "${name}"?`)) return;

    const configs = JSON.parse(localStorage.getItem("mtg_filter_configs") || "{}");
    delete configs[name];
    localStorage.setItem("mtg_filter_configs", JSON.stringify(configs));
    loadSavedConfigs();
}

function attachEventListeners() {
    elements.fileInput.addEventListener("change", event => handleFile(event.target.files[0]));
    elements.dropzone.addEventListener("dragover", event => {
        event.preventDefault();
        elements.dropzone.classList.add("dragover");
    });
    elements.dropzone.addEventListener("dragleave", () => elements.dropzone.classList.remove("dragover"));
    elements.dropzone.addEventListener("drop", event => {
        event.preventDefault();
        elements.dropzone.classList.remove("dragover");
        const file = event.dataTransfer.files[0];
        handleFile(file);
    });

    if (elements.applyFiltersBtn) {
        elements.applyFiltersBtn.addEventListener("click", applyFilters);
    }

    elements.searchNameInput.addEventListener("input", () => scheduleApplyFilters());

    [
        elements.filterBinderNameSelect,
        elements.filterBinderTypeSelect,
        elements.filterRaritySelect,
        elements.filterConditionSelect,
        elements.filterLanguageSelect,
        elements.filterColorModeSelect,
        elements.filterFoilSelect,
        elements.filterCMCOperator,
        elements.filterCardTypeSelect,
        elements.savedConfigsSelect
    ].forEach(control => {
        if (!control || control === elements.savedConfigsSelect) return;
        control.addEventListener("change", () => scheduleApplyFilters());
    });

    if (elements.filterCMCValue) {
        elements.filterCMCValue.addEventListener("input", () => scheduleApplyFilters());
    }
    elements.addFormatFilterBtn.addEventListener("click", addFormatFilter);
    elements.addSortCriteriaBtn.addEventListener("click", addSortCriteria);
    elements.saveConfigBtn.addEventListener("click", saveCurrentConfig);
    elements.savedConfigsSelect.addEventListener("change", loadSelectedConfig);
    elements.deleteConfigBtn.addEventListener("click", deleteSelectedConfig);
    elements.resetFiltersBtn.addEventListener("click", resetFilters);
    elements.toggleDetailsBtn.addEventListener("click", toggleDetails);
    elements.enrichVisibleBtn.addEventListener("click", enrichVisibleCards);
    elements.updateBulkDataBtn.addEventListener("click", updateBulkDataForCurrentCards);
    if (elements.filterColorButtons) {
        elements.filterColorButtons.addEventListener("click", event => {
            const button = event.target.closest(".color-filter-btn");
            if (!button) return;
            button.classList.toggle("active");
            scheduleApplyFilters();
        });
    }
    if (elements.legalityDisplayList) {
        elements.legalityDisplayList.addEventListener("change", () => {
            saveLegalityDisplaySettings();
            if (state.displayedCards.length > 0) {
                renderPage();
            }
        });
    }

    if (elements.legalityMenuToggle) {
        elements.legalityMenuToggle.addEventListener("click", event => {
            event.stopPropagation();
            toggleLegalityMenu();
        });
    }

    document.addEventListener("click", event => {
        if (!elements.legalityMenu || !elements.legalityMenuToggle) return;
        const clickedInsideMenu = elements.legalityMenu.contains(event.target);
        const clickedToggle = elements.legalityMenuToggle.contains(event.target);
        if (!clickedInsideMenu && !clickedToggle) {
            toggleLegalityMenu(false);
        }
    });

    if (elements.infoDialogClose) {
        elements.infoDialogClose.addEventListener("click", handleInfoDialogPrimaryAction);
    }

    if (elements.infoDialogCancel) {
        elements.infoDialogCancel.addEventListener("click", handleInfoDialogCancelAction);
    }

    if (elements.infoDialog) {
        elements.infoDialog.addEventListener("click", event => {
            if (event.target === elements.infoDialog) {
                closeInfoDialog();
            }
        });
    }
}

async function handleFile(file) {
    if (!file) return;
    const text = await file.text();
    state.allCards = parseCSV(text);
    prepareCardsForFiltering(state.allCards);
    state.filteredCards = [...state.allCards];
    state.displayedCards = [...state.allCards];
    const totalQuantity = state.allCards.reduce((sum, card) => sum + (parseInt(card["Quantity"], 10) || 0), 0);
    elements.fileStatus.textContent = `Loaded: ${file.name} (${state.allCards.length} entries, ${totalQuantity} cards)`;

    const csvScryfallIds = state.allCards.map(card => card["Scryfall ID"]).filter(Boolean);
    if (state.bulkLocalUpdatedAt && csvScryfallIds.length > 0) {
        await loadBulkLookupForIds(csvScryfallIds, { allowDownload: true, onlyIfMissing: true });
    }

    loadFilterOptions(state.allCards);
    renderCards(state.allCards);
    setStatus("Scryfall: idle");

    scheduleBackgroundCardWarmup(state.allCards);
}

async function init() {
    elements.infoDialog = document.getElementById("info-dialog");
    elements.infoDialogTitle = document.getElementById("info-dialog-title");
    elements.infoDialogBody = document.getElementById("info-dialog-body");
    elements.infoDialogCancel = document.getElementById("info-dialog-cancel");
    elements.infoDialogClose = document.getElementById("info-dialog-close");
    closeInfoDialog();

    state.scryfallCache = await openScryfallCache();
    await refreshBulkMetaStatus();
    loadSavedConfigs();
    loadCardTypesCatalog();
    initializeColorFilterButtons();
    loadLegalityDisplayFormatsOptions();
    loadLegalityDisplaySettings();
    attachEventListeners();
}

document.addEventListener("DOMContentLoaded", init);
