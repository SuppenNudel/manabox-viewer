let applyFiltersDebounceTimer = null;
const PRELOAD_MESSAGE_TYPE = "cardmarket-helper:preload-csv";
let appInitialized = false;
let pendingPreloadPayload = null;
let lastPreloadSignature = "";

function scheduleApplyFilters(delay = 120) {
    if (applyFiltersDebounceTimer) {
        clearTimeout(applyFiltersDebounceTimer);
    }

    applyFiltersDebounceTimer = setTimeout(() => {
        applyFiltersDebounceTimer = null;
        applyFilters();
    }, delay);
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

function parseDelimitedCSV(text, delimiter = ",") {
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

        if (char === delimiter && !inQuotes) {
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

function detectCsvDelimiter(text) {
    const firstLine = String(text || "").split(/\r?\n/)[0] || "";
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return semicolons > commas ? ";" : ",";
}

function parseCSV(text) {
    return parseDelimitedCSV(text, detectCsvDelimiter(text));
}

function getFirstNonEmptyValue(record, candidates) {
    for (const candidate of candidates) {
        const value = record[candidate];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }
    return "";
}

function getLanguageFromCardmarketId(idValue) {
    const id = String(idValue || "").trim();
    if (!id) return "";
    const languageKey = Object.keys(CARDMARKET_LANGUAGE_MAP).find(key => String(CARDMARKET_LANGUAGE_MAP[key]) === id);
    if (!languageKey) return "";
    return languageKey;
}

function getConditionFromCardmarketValue(conditionValue) {
    const normalized = String(conditionValue || "").trim().toLowerCase().replace(/\s+/g, "_");
    const conditionById = {
        "1": "Mint",
        "2": "Near Mint",
        "3": "Excellent",
        "4": "Good",
        "5": "Light Played",
        "6": "Played",
        "7": "Poor"
    };

    if (conditionById[normalized]) {
        return conditionById[normalized];
    }

    if (CONDITION_CODE_MAP[normalized]) {
        return CONDITION_CODE_MAP[normalized].label;
    }

    return normalized ? toDisplayLabel(normalized) : "";
}

function toFoilLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return "Foil";
    return "Normal";
}

function isCardmarketShipmentExport(cards) {
    if (!Array.isArray(cards) || cards.length === 0) return false;
    const first = cards[0];
    return first.idProduct !== undefined && first.groupCount !== undefined;
}

function mapCardmarketShipmentToViewerCards(cards) {
    return cards.map((card, index) => {
        const quantityRaw = getFirstNonEmptyValue(card, ["groupCount", "amount", "Quantity", "quantity"]);
        const quantity = parseInt(quantityRaw, 10);
        const idProduct = getFirstNonEmptyValue(card, ["idProduct", "mkmid"]);
        const name = getFirstNonEmptyValue(card, ["name", "Name", "productName", "articleName"]) || (idProduct ? `Cardmarket #${idProduct}` : `Card ${index + 1}`);

        return {
            "Name": name,
            "Set code": getFirstNonEmptyValue(card, ["setCode", "set", "expansionCode"]),
            "Set name": getFirstNonEmptyValue(card, ["setName", "expansion", "edition"]),
            "Collector number": getFirstNonEmptyValue(card, ["collectorNumber", "collector", "number"]),
            "Foil": toFoilLabel(getFirstNonEmptyValue(card, ["isFoil", "foil"])),
            "Rarity": getFirstNonEmptyValue(card, ["rarity", "Rarity"]),
            "Language": getFirstNonEmptyValue(card, ["language", "Language"]) || getLanguageFromCardmarketId(getFirstNonEmptyValue(card, ["idLanguage", "languageId"])),
            "Condition": getConditionFromCardmarketValue(getFirstNonEmptyValue(card, ["condition", "Condition"])),
            "Quantity": Number.isNaN(quantity) ? "1" : String(quantity),
            "Scryfall ID": getFirstNonEmptyValue(card, ["scryfallId", "scryfall_id", "Scryfall ID"]),
            "Purchase price": getFirstNonEmptyValue(card, ["price", "Purchase price"]),
            "Purchase price currency": getFirstNonEmptyValue(card, ["currency", "Purchase price currency"]) || "EUR",
            "Misprint": "false",
            "Altered": "false",
            "Binder Name": getFirstNonEmptyValue(card, ["binderName", "Binder Name"]),
            "Binder Type": getFirstNonEmptyValue(card, ["binderType", "Binder Type"])
        };
    });
}

function normalizeImportedCards(cards) {
    if (isCardmarketShipmentExport(cards)) {
        return mapCardmarketShipmentToViewerCards(cards);
    }
    return cards;
}

function normalizeIncomingPreloadedCards(cards) {
    return cards.map(card => {
        const normalizedCard = { ...card };

        const explicitScryfallId = getFirstNonEmptyValue(normalizedCard, ["Scryfall ID", "scryfallId", "scryfall_id"]);
        if (explicitScryfallId) {
            normalizedCard["Scryfall ID"] = String(explicitScryfallId).trim();
        }

        if (normalizedCard._scryfall && normalizedCard._scryfall.id) {
            if (!normalizedCard["Scryfall ID"]) {
                normalizedCard["Scryfall ID"] = String(normalizedCard._scryfall.id).trim();
            }
            applyScryfallDataToCard(normalizedCard, normalizedCard._scryfall);
        }

        return normalizedCard;
    });
}

function getPreloadPayloadSignature(payload) {
    const shipmentId = payload && payload.shipmentId ? String(payload.shipmentId) : "";
    const csvLength = payload && payload.csvContent ? String(payload.csvContent.length) : "0";
    const cardCount = payload && Array.isArray(payload.cards) ? String(payload.cards.length) : "0";
    return `${shipmentId}:${csvLength}:${cardCount}`;
}

async function applyPreloadPayload(payload) {
    if (!payload) {
        return;
    }

    const sellerName = payload.sellerName ? String(payload.sellerName) : "unknown";
    const shipmentId = payload.shipmentId ? String(payload.shipmentId) : "unknown";
    const sourceLabel = `Cardmarket shipment ${shipmentId} (${sellerName})`;

    if (Array.isArray(payload.cards) && payload.cards.length > 0) {
        await handleCardsData(payload.cards, sourceLabel);
        return;
    }

    if (!payload.csvContent) {
        return;
    }

    await handleCsvText(payload.csvContent, sourceLabel);
}

function handlePreloadMessage(event) {
    const data = event.data;
    const hasCardsPayload = Array.isArray(data && data.cards) && data.cards.length > 0;
    const hasCsvPayload = Boolean(data && data.csvContent);

    if (!data || data.type !== PRELOAD_MESSAGE_TYPE || (!hasCardsPayload && !hasCsvPayload)) {
        return;
    }

    const signature = getPreloadPayloadSignature(data);
    if (signature === lastPreloadSignature) {
        return;
    }
    lastPreloadSignature = signature;

    pendingPreloadPayload = data;
    if (appInitialized) {
        applyPreloadPayload(pendingPreloadPayload);
        pendingPreloadPayload = null;
    }
}

window.addEventListener("message", handlePreloadMessage);

function getExportCards() {
    if (Array.isArray(state.displayedCards) && state.displayedCards.length > 0) {
        return state.displayedCards;
    }
    if (Array.isArray(state.filteredCards) && state.filteredCards.length > 0) {
        return state.filteredCards;
    }
    return Array.isArray(state.allCards) ? state.allCards : [];
}

function getExportHeaders(cards) {
    if (!cards || cards.length === 0) return [];
    const excludedHeaders = new Set(["Binder Name", "Binder Type"]);
    return Object.keys(cards[0]).filter(key => !key.startsWith("_") && !excludedHeaders.has(key));
}

function escapeCsvValue(value) {
    const text = value === undefined || value === null ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function buildManaboxCsv(cards) {
    const headers = getExportHeaders(cards);
    if (headers.length === 0) return "";

    const lines = [headers.map(escapeCsvValue).join(",")];
    cards.forEach(card => {
        const row = headers.map(header => escapeCsvValue(card[header]));
        lines.push(row.join(","));
    });

    return lines.join("\r\n");
}

function buildDecklistTxt(cards) {
    return cards
        .map(card => {
            const quantity = parseInt(card["Quantity"], 10) || 0;
            const name = card["Name"] || "Unknown Card";
            return `${quantity} ${name}`;
        })
        .join("\r\n");
}

function triggerFileDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
}

function getTimestampForFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function downloadCurrentList() {
    const cards = getExportCards();
    if (cards.length === 0) {
        showInfoDialog({
            title: "Download List",
            message: "No cards available to export. Load a CSV first."
        });
        return;
    }

    const format = elements.downloadFormatSelect ? elements.downloadFormatSelect.value : "csv";
    const timestamp = getTimestampForFilename();

    if (format === "txt") {
        const txtContent = buildDecklistTxt(cards);
        triggerFileDownload(`decklist_${timestamp}.txt`, txtContent, "text/plain;charset=utf-8");
        return;
    }

    const csvContent = buildManaboxCsv(cards);
    triggerFileDownload(`manabox_export_${timestamp}.csv`, `\uFEFF${csvContent}`, "text/csv;charset=utf-8");
}

function normalizeLanguage(value) {
    const normalized = String(value || "").toLowerCase().trim().replace("-", "_");
    if (LANGUAGE_LABELS[normalized]) {
        return normalized;
    }

    const labelToCode = {
        "english": "en",
        "french": "fr",
        "german": "de",
        "spanish": "es",
        "italian": "it",
        "chinese (simplified)": "zh_cn",
        "japanese": "ja",
        "portuguese": "pt",
        "russian": "ru",
        "korean": "ko",
        "chinese (traditional)": "zh_tw"
    };

    return labelToCode[normalized] || normalized;
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
    buildSelectOptions(elements.filterRaritySelect, Array.from(rarities).sort(), getRarityLabelWithIcon);

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

    buildSelectOptions(elements.filterConditionSelect, sortedConditions, getConditionLabelWithIcon);
    buildSelectOptions(elements.filterLanguageSelect, Array.from(languages).sort(), getLanguageLabelWithIcon);
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

    const sortedFormats = [...state.availableFormats].sort((a, b) => {
        const labelA = getFormatLabel(a).toLowerCase();
        const labelB = getFormatLabel(b).toLowerCase();
        return labelA.localeCompare(labelB);
    });

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
            ${sortedFormats.map(fmt => `<option value="${fmt}">${getFormatLabel(fmt)}</option>`).join("")}
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
        case "color": {
            const colors = getCardColors(card) || [];
            const uniqueSorted = [...new Set(colors)].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b));
            const colorKey = uniqueSorted.join("");
            const count = uniqueSorted.length;

            let comboRank = 999;
            if (count === 0) comboRank = 0;
            else if (count === 1) comboRank = COLOR_ORDER.indexOf(colorKey) + 1;
            else if (count === 2) comboRank = TWO_COLOR_RANK.get(colorKey) || 999;
            else if (count === 3) comboRank = THREE_COLOR_RANK.get(colorKey) || 999;
            else if (count === 4) comboRank = FOUR_COLOR_RANK.get(colorKey) || 999;
            else if (count === 5) comboRank = 1;

            return `${String(count).padStart(2, "0")}-${String(comboRank).padStart(3, "0")}-${colorKey || "z"}`;
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
            <option value="color">Color</option>
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

function getCardColors(card, source = "colors") {
    if (!card._scryfall) return null;

    const allowedColors = new Set(["w", "u", "b", "r", "g", "c"]);
    let sourceColors = [];
    if (source === "identity") {
        sourceColors = Array.isArray(card._scryfall.color_identity) ? card._scryfall.color_identity : [];
    } else if (source === "produces") {
        sourceColors = Array.isArray(card._scryfall.produced_mana) ? card._scryfall.produced_mana : [];
    } else {
        sourceColors = Array.isArray(card._scryfall.colors) ? card._scryfall.colors : [];
    }
    const producesMana = Array.isArray(card._scryfall.produced_mana) ? card._scryfall.produced_mana : [];
    const colors = new Set();

    sourceColors.forEach(color => {
        const normalized = String(color).toLowerCase();
        if (allowedColors.has(normalized)) colors.add(normalized);
    });

    if (source !== "produces") {
        producesMana.forEach(color => {
            const normalized = String(color).toLowerCase();
            if (allowedColors.has(normalized)) colors.add(normalized);
        });
    }

    if (colors.size === 0) {
        colors.add("c");
    }

    return Array.from(colors);
}

function matchesColorCountFilter(card, colorCountOperator, colorCountFilter, colorSource) {
    if (!colorCountOperator || colorCountFilter === "") return true;
    const colors = getCardColors(card, colorSource);
    if (colors === null) return false;
    const target = parseInt(colorCountFilter, 10);
    if (Number.isNaN(target)) return true;

    const actual = colors.filter(color => color !== "c").length;
    switch (colorCountOperator) {
        case "=": return actual === target;
        case "!=": return actual !== target;
        case "<": return actual < target;
        case "<=": return actual <= target;
        case ">": return actual > target;
        case ">=": return actual >= target;
        default: return true;
    }
}

function matchesColorFilter(card, colorFilters, colorMode, colorSource) {
    if (!colorFilters || colorFilters.length === 0) return true;

    const colors = getCardColors(card, colorSource);
    if (colors === null) return false;

    const normalizedFilters = colorFilters.map(color => String(color).toLowerCase());
    const wantsColorless = normalizedFilters.includes("c");
    const selectedColors = normalizedFilters.filter(color => color !== "c");
    const filteredColors = colors.filter(color => color !== "c");

    if (wantsColorless) {
        if (selectedColors.length > 0) return false;
        return filteredColors.length === 0;
    }

    const selectedSet = new Set(selectedColors);
    const cardSet = new Set(filteredColors);

    if (colorMode === "exact") {
        if (cardSet.size !== selectedSet.size) return false;
        return selectedColors.every(color => cardSet.has(color));
    }

    if (colorMode === "at-most") {
        return filteredColors.every(color => selectedSet.has(color));
    }

    return selectedColors.every(color => filteredColors.includes(color));
}

function hasScryfallDependentFilters(filters) {
    const hasCmcFilter = Boolean(filters.cmcOperator && filters.cmcValue);
    const hasCardTypeFilter = Boolean(filters.cardType);
    const hasColorFilter = Array.isArray(filters.color) && filters.color.length > 0;
    const hasColorCountFilter = Boolean(filters.colorCountOperator && filters.colorCount !== "");
    const hasScryfallQueryFilter = Boolean(filters.scryfallQuery && filters.scryfallQuery.trim());
    const hasFormatFilter = state.formatFilters.some(filter => filter.format);
    return hasCmcFilter || hasCardTypeFilter || hasColorFilter || hasColorCountFilter || hasScryfallQueryFilter || hasFormatFilter;
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
        colorSource: getSelectedColorSource(),
        colorMode: getSelectedColorMode(),
        colorCountOperator: getSelectedColorCountOperator(),
        colorCount: getSelectedColorCount(),
        foil: elements.filterFoilSelect.value.toLowerCase(),
        cmcOperator: elements.filterCMCOperator.value,
        cmcValue: elements.filterCMCValue.value,
        cardType: elements.filterCardTypeSelect.value.toLowerCase(),
        scryfallQuery: elements.scryfallQueryInput.value
    };

    let scryfallMatchingIds = new Set();
    if (filters.scryfallQuery && filters.scryfallQuery.trim()) {
        setStatus("Scryfall: searching...");
        scryfallMatchingIds = await searchScryfallByQuery(filters.scryfallQuery);
        setStatus("Scryfall: idle");
    }

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
        if (!matchesColorFilter(card, filters.color, filters.colorMode, filters.colorSource)) return false;
        if (!matchesColorCountFilter(card, filters.colorCountOperator, filters.colorCount, filters.colorSource)) return false;
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

        if (scryfallMatchingIds.size > 0) {
            const cardScryfallId = card["Scryfall ID"];
            if (!cardScryfallId || !scryfallMatchingIds.has(cardScryfallId)) return false;
        }

        if (!evaluateFormatFilters(card)) return false;

        return true;
    });

    renderCards(state.filteredCards);
}

function renderCards(cards) {
    if (elements.entryCountSpan) {
        elements.entryCountSpan.textContent = cards.length;
    }
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
    const setCodeSlug = String(setCode).toLowerCase().replace(/[^a-z0-9]/g, "");
    const rarityKey = (card["Rarity"] || "").toLowerCase();
    const rarityIcon = RARITY_ICONS[rarityKey] || { icon: "?", label: card["Rarity"] || "Unknown" };
    const keyruneRarityClassMap = {
        common: "ss-common",
        uncommon: "ss-uncommon",
        rare: "ss-rare",
        mythic: "ss-mythic"
    };
    const keyruneRarityClass = keyruneRarityClassMap[rarityKey] || "ss-common";
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
                    <div class="card-subtitle">${escapeHtml(setCode)}${setCodeSlug ? ` <i class="ss ss-${setCodeSlug} ${keyruneRarityClass} set-icon" title="${escapeHtml(setCode)}"></i>` : ""} ${escapeHtml(setName)}</div>
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
        color: getSelectedColorFilters(),
        colorCount: getSelectedColorCount(),
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
    elements.scryfallQueryInput.value = "";
    elements.filterBinderNameSelect.value = "";
    elements.filterBinderTypeSelect.value = "";
    elements.filterRaritySelect.value = "";
    elements.filterConditionSelect.value = "";
    elements.filterLanguageSelect.value = "";
    setSelectedColorFilters([]);
    if (elements.filterColorSourceSelect) {
        elements.filterColorSourceSelect.value = "colors";
    }
    if (elements.filterColorModeSelect) {
        elements.filterColorModeSelect.value = "includes";
    }
    if (elements.filterColorCountOperatorSelect) {
        elements.filterColorCountOperatorSelect.value = "";
    }
    if (elements.filterColorCountSelect) {
        elements.filterColorCountSelect.value = "";
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
            scryfallQuery: elements.scryfallQueryInput.value,
            binderName: elements.filterBinderNameSelect.value,
            binderType: elements.filterBinderTypeSelect.value,
            rarity: elements.filterRaritySelect.value,
            condition: elements.filterConditionSelect.value,
            language: elements.filterLanguageSelect.value,
            color: getSelectedColorFilters(),
            colorSource: getSelectedColorSource(),
            colorMode: getSelectedColorMode(),
            colorCountOperator: getSelectedColorCountOperator(),
            colorCount: getSelectedColorCount(),
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
    elements.scryfallQueryInput.value = config.filters.scryfallQuery || "";
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
    if (elements.filterColorSourceSelect) {
        elements.filterColorSourceSelect.value = config.filters.colorSource || "colors";
    }
    if (elements.filterColorCountOperatorSelect) {
        elements.filterColorCountOperatorSelect.value = config.filters.colorCountOperator || (config.filters.colorCount ? "=" : "");
    }
    if (elements.filterColorCountSelect) {
        elements.filterColorCountSelect.value = config.filters.colorCount || "";
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
    elements.applyScryfallQueryBtn.addEventListener("click", () => applyFilters());
    elements.scryfallQueryInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            applyFilters();
        }
    });

    [
        elements.filterBinderNameSelect,
        elements.filterBinderTypeSelect,
        elements.filterRaritySelect,
        elements.filterConditionSelect,
        elements.filterLanguageSelect,
        elements.filterColorSourceSelect,
        elements.filterColorModeSelect,
        elements.filterColorCountOperatorSelect,
        elements.filterColorCountSelect,
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
    if (elements.downloadListBtn) {
        elements.downloadListBtn.addEventListener("click", downloadCurrentList);
    }
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
    await handleCsvText(text, file.name);
}

async function handleCsvText(text, sourceName = "CSV") {
    const parsedCards = parseCSV(text);
    await handleCardsData(parsedCards, sourceName);
}

async function handleCardsData(cards, sourceName = "CSV") {
    const importedCards = normalizeImportedCards(cards);
    state.allCards = normalizeIncomingPreloadedCards(importedCards);
    prepareCardsForFiltering(state.allCards);
    state.filteredCards = [...state.allCards];
    state.displayedCards = [...state.allCards];
    const totalQuantity = state.allCards.reduce((sum, card) => sum + (parseInt(card["Quantity"], 10) || 0), 0);
    elements.fileStatus.textContent = `Loaded: ${sourceName} (${state.allCards.length} entries, ${totalQuantity} cards)`;

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

    appInitialized = true;
    if (pendingPreloadPayload) {
        await applyPreloadPayload(pendingPreloadPayload);
        pendingPreloadPayload = null;
    }
}

document.addEventListener("DOMContentLoaded", init);
