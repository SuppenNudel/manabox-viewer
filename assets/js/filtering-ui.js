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
