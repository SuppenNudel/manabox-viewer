function canonicalColorKey(code) {
    return String(code || "")
        .toLowerCase()
        .split("")
        .filter(color => COLOR_ORDER.includes(color))
        .sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b))
        .join("");
}

function buildColorRankMap(sequence) {
    const map = new Map();
    sequence.forEach((code, index) => {
        map.set(canonicalColorKey(code), index + 1);
    });
    return map;
}

const TWO_COLOR_RANK = buildColorRankMap(["wu", "ub", "br", "rg", "gw", "wb", "ur", "bg", "rw", "gu"]);
const THREE_COLOR_RANK = buildColorRankMap(["gwu", "wub", "ubr", "brg", "rgw", "wbg", "urw", "bgu", "rwb", "gur"]);
const FOUR_COLOR_RANK = buildColorRankMap(["wubr", "ubrg", "brgw", "rgwu", "gwub"]);

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
        mythic: "Mythic",
        special: "Special"
    };
    return labels[key] || toDisplayLabel(value);
}

function getRarityLabelWithIcon(value) {
    const key = String(value || "").toLowerCase();
    const rarityData = RARITY_ICONS[key];
    if (rarityData) {
        return `${rarityData.icon} ${rarityData.label}`;
    }
    return getRarityLabel(value);
}

function getConditionLabel(value) {
    const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
    return CONDITION_CODE_MAP[key] ? CONDITION_CODE_MAP[key].label : toDisplayLabel(value);
}

function getConditionLabelWithIcon(value) {
    const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
    const condition = CONDITION_CODE_MAP[key];
    if (condition) {
        return `${condition.code.toUpperCase()} ${condition.label}`;
    }
    return getConditionLabel(value);
}

function getLanguageLabel(value) {
    const key = normalizeLanguage(String(value || ""));
    return LANGUAGE_LABELS[key] || toDisplayLabel(value);
}

function getLanguageLabelWithIcon(value) {
    const key = normalizeLanguage(String(value || ""));
    const iconData = LANGUAGE_ICONS[key];
    const icon = iconData ? iconData.icon : "🌐";
    return `${icon} ${getLanguageLabel(value)}`;
}

function getCardTypeLabel(value) {
    return toDisplayLabel(value);
}

function getCardTypeLabelWithIcon(value) {
    const key = String(value || "").toLowerCase();
    const iconMap = {
        creature: "🐾",
        planeswalker: "✶",
        artifact: "🏆",
        instant: "⚡",
        sorcery: "🔥",
        enchantment: "🌅",
        land: "⛰️",
        battle: "🛡️"
    };
    const icon = iconMap[key] || "🃏";
    return `${icon} ${getCardTypeLabel(value)}`;
}

function renderScryfallSymbol(symbol) {
    const code = String(symbol).replace(/^\{|\}$/g, "");
    const specialCodes = { "\u00bd": "HALF", "\u221e": "INFINITY" };
    if (!SCRYFALL_SYMBOL_CODES.has(code) && !specialCodes[code]) return escapeHtml(symbol);
    const filename = specialCodes[code] || code.replaceAll("/", "");
    const color = COLOR_FILTER_OPTIONS.find(option => option.value === code.toLowerCase());
    const label = color ? `${color.label} mana {${code}}` : `{${code}}`;
    return `<img class="mana-symbol" src="https://svgs.scryfall.io/card-symbols/${filename}.svg" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" width="18" height="18">`;
}

function renderScryfallText(value) {
    return String(value).split(/(\{[^{}]+\})/g).map(part => {
        return /^\{[^{}]+\}$/.test(part) ? renderScryfallSymbol(part) : escapeHtml(part);
    }).join("");
}

function renderScryfallValue(value, field = "") {
    if (value === null || value === undefined) return "-";
    if (Array.isArray(value)) {
        if (["colors", "color_identity", "color_indicator", "produced_mana"].includes(field)) {
            const colors = [...new Set(value.flat())];
            if (!colors.length) return field === "produced_mana" ? "-" : renderScryfallSymbol("{C}");
            return colors.map(color => renderScryfallSymbol(`{${color}}`)).join(" ");
        }
        return value.map(entry => renderScryfallValue(entry, field)).join(" / ") || "-";
    }
    if (typeof value === "object") {
        return Object.entries(value).map(([key, entry]) => `${escapeHtml(key)}: ${renderScryfallValue(entry, key)}`).join("; ");
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value === "" ? "-" : renderScryfallText(value);
}

function getScryfallDisplayValue(card, field) {
    const data = card._scryfall;
    if (!data) return undefined;
    if (field !== "color_identity" && state.multiFaceMode === "front" && data.card_faces?.[0]?.[field] !== undefined) {
        return data.card_faces[0][field];
    }
    if (data[field] !== undefined && data[field] !== null) return data[field];
    const values = (data.card_faces || []).map(face => face[field]).filter(value => value !== undefined && value !== null);
    if (!values.length) return undefined;
    return field === "colors" ? [...new Set(values.flat())] : values;
}

function initializeColorFilterButtons() {
    if (!elements.filterColorButtons) return;

    elements.filterColorButtons.innerHTML = COLOR_FILTER_OPTIONS
        .map(color => `<button type="button" class="color-filter-btn ${color.className}" data-color="${color.value}" title="${color.label}" aria-label="${color.label}" aria-pressed="false">${renderScryfallSymbol(`{${color.value.toUpperCase()}}`)}</button>`)
        .join("");
}

function getCollectionSet(card) {
    const code = String(card["Set code"] || "").trim().toLowerCase();
    const name = String(card["Set name"] || "").trim();
    return { key: code ? `code:${code}` : (name ? `name:${name.toLowerCase()}` : ""), code, name };
}

function loadSetFilterOptions(cards) {
    const sets = new Map();
    cards.forEach(card => {
        const set = getCollectionSet(card);
        if (!set.key) return;
        const existing = sets.get(set.key);
        if (!existing || (!existing.name && set.name)) sets.set(set.key, set);
    });
    state.availableSets = Array.from(sets.values()).sort((first, second) => {
        return (first.name || first.code).localeCompare(second.name || second.code);
    });
    renderSetFilterOptions();
}

function getMatchingSetOptions(query) {
    const search = String(query || "").trim().toLowerCase();
    return state.availableSets.filter(set => !state.selectedSets.includes(set.key)
        && (set.name.toLowerCase().includes(search) || set.code.includes(search)));
}

function renderSetFilterOptions() {
    const createOption = (set, checked) => {
        const label = set.name && set.code ? `${set.name} (${set.code.toUpperCase()})` : (set.name || set.code.toUpperCase());
        const iconCode = set.code.toLowerCase().replace(/[^a-z0-9]/g, "");
        const icon = iconCode ? `<i class="ss ss-${iconCode} set-filter-icon" aria-hidden="true"></i>` : "";
        return `<label class="set-filter-option"><input type="checkbox" value="${escapeHtml(set.key)}" ${checked ? "checked" : ""}>${icon}<span>${escapeHtml(label)}</span></label>`;
    };
    elements.setFilterSummary.textContent = state.selectedSets.length ? `Choose sets (${state.selectedSets.length} selected)` : "Choose sets";
    const setsByKey = new Map(state.availableSets.map(set => [set.key, set]));
    elements.selectedSets.innerHTML = state.selectedSets.map(key => {
        const set = setsByKey.get(key) || { key, code: key.startsWith("code:") ? key.slice(5) : "", name: key.startsWith("name:") ? key.slice(5) : "" };
        return createOption(set, true);
    }).join("");
    const matching = getMatchingSetOptions(elements.searchSetsInput.value);
    elements.setFilterOptions.innerHTML = matching.length
        ? matching.map(set => createOption(set, false)).join("")
        : `<p class="set-filter-empty">${state.availableSets.length ? "No matching sets." : "No sets loaded."}</p>`;
}

function setSelectedSets(keys) {
    state.selectedSets = [...new Set((Array.isArray(keys) ? keys : []).filter(key => typeof key === "string" && /^(code|name):.+/.test(key)))];
    elements.searchSetsInput.value = "";
    elements.setFilterDropdown.open = false;
    renderSetFilterOptions();
}

function handleSetFilterChange(event) {
    const input = event.target;
    if (!input.matches('input[type="checkbox"]')) return;
    if (input.checked) state.selectedSets = [...new Set([...state.selectedSets, input.value])];
    else state.selectedSets = state.selectedSets.filter(key => key !== input.value);
    renderSetFilterOptions();
    if (elements.setFilterDropdown.open) elements.searchSetsInput.focus();
    scheduleApplyFilters();
}

function initializeSetFilterDropdown() {
    elements.setFilterDropdown.addEventListener("toggle", () => {
        if (elements.setFilterDropdown.open) elements.searchSetsInput.focus();
    });
    elements.setFilterDropdown.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            elements.setFilterDropdown.open = false;
            elements.setFilterSummary.focus();
        }
    });
    document.addEventListener("click", event => {
        if (!elements.setFilterDropdown.contains(event.target)) elements.setFilterDropdown.open = false;
    });
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

function getSelectedColorSource() {
    return elements.filterColorSourceSelect ? elements.filterColorSourceSelect.value : "colors";
}

function getSelectedColorCount() {
    if (!elements.filterColorCountSelect) return "";
    return elements.filterColorCountSelect.value;
}

function getSelectedColorCountOperator() {
    if (!elements.filterColorCountOperatorSelect) return "";
    return elements.filterColorCountOperatorSelect.value;
}

function setSelectedColorFilters(selectedColors) {
    if (!elements.filterColorButtons) return;
    const selected = new Set((selectedColors || []).map(color => String(color).toLowerCase()));
    Array.from(elements.filterColorButtons.querySelectorAll(".color-filter-btn")).forEach(button => {
        button.classList.toggle("active", selected.has(String(button.dataset.color).toLowerCase()));
        button.setAttribute("aria-pressed", String(button.classList.contains("active")));
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
