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
    availableFormats: [
        "standard", "future", "historic", "gladiator", "pioneer", "modern",
        "legacy", "pauper", "vintage", "penny", "commander", "oathbreaker",
        "brawl", "historicbrawl", "alchemy", "paupercommander", "duel",
        "oldschool", "premodern"
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
    searchNameInput: document.getElementById("search-name"),
    filterBinderNameSelect: document.getElementById("filter-binder-name"),
    filterBinderTypeSelect: document.getElementById("filter-binder-type"),
    filterRaritySelect: document.getElementById("filter-rarity"),
    filterConditionSelect: document.getElementById("filter-condition"),
    filterLanguageSelect: document.getElementById("filter-language"),
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

function setStatus(text) {
    elements.enrichStatus.textContent = text;
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
        const request = indexedDB.open("mkm_linker_cache", 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("scryfall")) {
                db.createObjectStore("scryfall", { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
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

async function fetchScryfallCard(id) {
    if (state.scryfallInFlight.has(id)) return state.scryfallInFlight.get(id);

    const cached = await getCachedScryfall(id);
    if (cached) return cached;

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

function buildSelectOptions(selectEl, values) {
    const existing = selectEl.querySelectorAll("option");
    const keep = existing.length > 0 ? existing[0].outerHTML : "";
    selectEl.innerHTML = keep;

    values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
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
    buildSelectOptions(elements.filterBinderTypeSelect, Array.from(binderTypes).sort());
    buildSelectOptions(elements.filterRaritySelect, Array.from(rarities).sort());
    buildSelectOptions(elements.filterConditionSelect, Array.from(conditions).sort());
    buildSelectOptions(elements.filterLanguageSelect, Array.from(languages).sort());
}

async function loadCardTypesCatalog() {
    try {
        const response = await fetch("https://api.scryfall.com/catalog/card-types");
        if (!response.ok) return;
        const data = await response.json();
        const types = (data.data || []).map(t => t.toLowerCase()).sort();
        buildSelectOptions(elements.filterCardTypeSelect, types);
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
            ${state.availableFormats.map(fmt => `<option value="${fmt}">${fmt}</option>`).join("")}
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
    });

    row.querySelector(".filter-legality-type").addEventListener("change", e => {
        const filter = state.formatFilters.find(f => f.id === filterId);
        if (filter) filter.legalityType = e.target.value;
    });

    row.querySelector(".filter-format-select").addEventListener("change", e => {
        const filter = state.formatFilters.find(f => f.id === filterId);
        if (filter) filter.format = e.target.value;
    });

    row.querySelector(".remove-format-filter").addEventListener("click", () => removeFormatFilter(filterId));
}

function removeFormatFilter(filterId) {
    state.formatFilters = state.formatFilters.filter(f => f.id !== filterId);
    const row = elements.formatFiltersContainer.querySelector(`[data-filter-id="${filterId}"]`);
    if (row) row.remove();
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
    });

    row.querySelector(".sort-direction-select").addEventListener("change", e => {
        const sort = state.sortCriteria.find(s => s.id === sortId);
        if (sort) sort.direction = e.target.value;
    });

    row.querySelector(".remove-sort-criteria").addEventListener("click", () => removeSortCriteria(sortId));
}

function removeSortCriteria(sortId) {
    state.sortCriteria = state.sortCriteria.filter(s => s.id !== sortId);
    const row = elements.sortCriteriaContainer.querySelector(`[data-sort-id="${sortId}"]`);
    if (row) row.remove();
}

function applyFilters() {
    const filters = {
        name: elements.searchNameInput.value.toLowerCase(),
        binderName: elements.filterBinderNameSelect.value.toLowerCase(),
        binderType: elements.filterBinderTypeSelect.value.toLowerCase(),
        rarity: elements.filterRaritySelect.value.toLowerCase(),
        condition: elements.filterConditionSelect.value.toLowerCase(),
        language: elements.filterLanguageSelect.value.toLowerCase(),
        foil: elements.filterFoilSelect.value.toLowerCase(),
        cmcOperator: elements.filterCMCOperator.value,
        cmcValue: elements.filterCMCValue.value,
        cardType: elements.filterCardTypeSelect.value.toLowerCase()
    };

    state.filteredCards = state.allCards.filter(card => {
        if (filters.name && !(card["Name"] || "").toLowerCase().includes(filters.name)) return false;
        if (filters.binderName && (card["Binder Name"] || "").toLowerCase() !== filters.binderName) return false;
        if (filters.binderType && (card["Binder Type"] || "").toLowerCase() !== filters.binderType) return false;
        if (filters.rarity && (card["Rarity"] || "").toLowerCase() !== filters.rarity) return false;
        if (filters.condition && (card["Condition"] || "").toLowerCase() !== filters.condition) return false;
        if (filters.language && (card["Language"] || "").toLowerCase() !== filters.language) return false;
        if (filters.foil && (card["Foil"] || "").toLowerCase() !== filters.foil) return false;

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
                        <div class="detail-value">${escapeHtml(card["Binder Type"] || "")}</div>
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
    const entries = Object.entries(card._scryfall.legalities)
        .filter(([, status]) => ["legal", "banned", "restricted"].includes(status));

    if (entries.length === 0) return "";

    return entries.map(([format, status]) => {
        const statusClass = status === "legal" ? "legal" : status;
        return `<span class="legality-item ${statusClass}">${format}: ${status}</span>`;
    }).join("");
}

async function enrichCard(card, cardElement) {
    if (!card["Scryfall ID"]) return;
    if (card._scryfall) return;

    const scryfallData = await fetchScryfallCard(card["Scryfall ID"]);
    if (!scryfallData) return;

    card._scryfall = scryfallData;
    card._cardTypes = extractCardTypes(scryfallData.type_line || "");

    const printedName = scryfallData.printed_name;
    card._displayName = printedName && printedName !== scryfallData.name
        ? `${card["Name"]} (${printedName})`
        : (card["Name"] || "");

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
    for (const cardElement of cardElements) {
        const cardId = parseInt(cardElement.dataset.cardId, 10);
        const card = state.displayedCards.find(c => c._id === cardId);
        if (card) await enrichCard(card, cardElement);
    }
    setStatus("Scryfall: idle");
}

function resetFilters() {
    elements.searchNameInput.value = "";
    elements.filterBinderNameSelect.value = "";
    elements.filterBinderTypeSelect.value = "";
    elements.filterRaritySelect.value = "";
    elements.filterConditionSelect.value = "";
    elements.filterLanguageSelect.value = "";
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
            foil: elements.filterFoilSelect.value,
            cmcOperator: elements.filterCMCOperator.value,
            cmcValue: elements.filterCMCValue.value,
            cardType: elements.filterCardTypeSelect.value
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

function saveCurrentConfig() {
    const name = prompt("Enter a name for this configuration:");
    if (!name || name.trim() === "") return;

    const configs = JSON.parse(localStorage.getItem("mtg_filter_configs") || "{}");
    configs[name.trim()] = getCurrentFilterState();
    localStorage.setItem("mtg_filter_configs", JSON.stringify(configs));
    loadSavedConfigs();
    elements.savedConfigsSelect.value = name.trim();
    alert(`Configuration "${name.trim()}" saved.`);
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
    elements.filterFoilSelect.value = config.filters.foil || "";
    elements.filterCMCOperator.value = config.filters.cmcOperator || "";
    elements.filterCMCValue.value = config.filters.cmcValue || "";
    elements.filterCardTypeSelect.value = config.filters.cardType || "";

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
        });

        legalitySelect.addEventListener("change", e => {
            const target = state.formatFilters.find(f => f.id === filterId);
            if (target) target.legalityType = e.target.value;
        });

        formatSelect.addEventListener("change", e => {
            const target = state.formatFilters.find(f => f.id === filterId);
            if (target) target.format = e.target.value;
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
        });

        directionSelect.addEventListener("change", e => {
            const target = state.sortCriteria.find(s => s.id === sortId);
            if (target) target.direction = e.target.value;
        });

        removeBtn.addEventListener("click", () => removeSortCriteria(sortId));
    });

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

    elements.applyFiltersBtn.addEventListener("click", applyFilters);
    elements.searchNameInput.addEventListener("keypress", event => {
        if (event.key === "Enter") applyFilters();
    });
    elements.addFormatFilterBtn.addEventListener("click", addFormatFilter);
    elements.addSortCriteriaBtn.addEventListener("click", addSortCriteria);
    elements.saveConfigBtn.addEventListener("click", saveCurrentConfig);
    elements.savedConfigsSelect.addEventListener("change", loadSelectedConfig);
    elements.deleteConfigBtn.addEventListener("click", deleteSelectedConfig);
    elements.resetFiltersBtn.addEventListener("click", resetFilters);
    elements.toggleDetailsBtn.addEventListener("click", toggleDetails);
    elements.enrichVisibleBtn.addEventListener("click", enrichVisibleCards);
}

async function handleFile(file) {
    if (!file) return;
    const text = await file.text();
    state.allCards = parseCSV(text);
    state.filteredCards = [...state.allCards];
    state.displayedCards = [...state.allCards];
    elements.fileStatus.textContent = `Loaded: ${file.name} (${state.allCards.length} cards)`;

    loadFilterOptions(state.allCards);
    renderCards(state.allCards);
    setStatus("Scryfall: idle");
}

async function init() {
    state.scryfallCache = await openScryfallCache();
    loadSavedConfigs();
    loadCardTypesCatalog();
    attachEventListeners();
}

document.addEventListener("DOMContentLoaded", init);
