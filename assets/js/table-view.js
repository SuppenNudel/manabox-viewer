const TABLE_SETTINGS_KEY = "manabox_table_view";
const MANABOX_TABLE_FIELDS = [
    "Name", "Quantity", "Set code", "Set name", "Collector number", "Foil", "Rarity",
    "Condition", "Language", "Purchase price", "Purchase price currency", "Binder Name",
    "Binder Type", "Scryfall ID", "ManaBox ID", "Misprint", "Altered"
];
const SCRYFALL_TABLE_FIELDS = [
    "name", "id", "oracle_id", "lang", "released_at", "uri", "scryfall_uri", "layout",
    "mana_cost", "cmc", "type_line", "oracle_text", "power", "toughness", "loyalty",
    "defense", "colors", "color_identity", "color_indicator", "produced_mana", "keywords",
    "set", "set_name", "set_type", "collector_number", "rarity", "artist", "flavor_text",
    "printed_name", "printed_type_line", "printed_text", "watermark", "frame", "frame_effects",
    "border_color", "finishes", "foil", "nonfoil", "promo", "promo_types", "reprint",
    "reserved", "digital", "games", "edhrec_rank", "penny_rank", "card_faces", "all_parts",
    "prices.usd", "prices.usd_foil", "prices.usd_etched", "prices.eur", "prices.eur_foil",
    "prices.tix"
];
let tableColumnSignature = "";

function getTableColumnDefinitions() {
    const manabox = new Set(MANABOX_TABLE_FIELDS);
    const scryfall = new Set([...SCRYFALL_TABLE_FIELDS, ...state.availableFormats.map(format => `legalities.${format}`)]);
    const collectFields = (value, prefix = "") => {
        Object.entries(value || {}).forEach(([key, field]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (field && typeof field === "object" && !Array.isArray(field)) {
                collectFields(field, path);
            } else {
                scryfall.add(path);
            }
        });
    };
    state.allCards.forEach(card => {
        Object.keys(card).filter(key => !key.startsWith("_")).forEach(key => manabox.add(key));
        collectFields(card._scryfall);
    });
    state.tableColumns.forEach(column => {
        if (column.startsWith("manabox:")) manabox.add(column.slice(8));
        if (column.startsWith("scryfall:")) scryfall.add(column.slice(9));
    });
    return [
        ...Array.from(manabox, field => ({ id: `manabox:${field}`, source: "ManaBox", field, label: field })),
        ...Array.from(scryfall, field => ({ id: `scryfall:${field}`, source: "Scryfall", field, label: field.replace(/[_.]/g, " ") }))
    ];
}

function refreshTableColumnPicker() {
    const definitions = getTableColumnDefinitions();
    const signature = JSON.stringify([definitions.map(column => column.id), state.tableColumns]);
    if (signature === tableColumnSignature) return;
    tableColumnSignature = signature;
    elements.tableColumnList.innerHTML = ["ManaBox", "Scryfall"].map(source => `
        <fieldset><legend>${source}</legend>${definitions.filter(column => column.source === source).map(column => `
            <label><input type="checkbox" value="${escapeHtml(column.id)}"
                ${state.tableColumns.includes(column.id) ? "checked" : ""}
                ${column.id === "manabox:Name" ? "disabled" : ""}>${escapeHtml(column.label)}</label>
        `).join("")}</fieldset>
    `).join("");
}

function saveTableSettings() {
    try {
        localStorage.setItem(TABLE_SETTINGS_KEY, JSON.stringify({ view: state.collectionView, columns: state.tableColumns }));
    } catch (error) {
        console.warn("Unable to save table settings", error);
    }
}

function updateCollectionViewControls() {
    elements.collectionView.querySelectorAll("[data-view]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.view === state.collectionView));
    });
    elements.tableColumns.classList.toggle("hidden", state.collectionView !== "table");
    elements.toggleDetailsBtn.classList.toggle("hidden", state.collectionView === "table");
    elements.cardsContainer.classList.toggle("table-view", state.collectionView === "table");
}

function formatTableValue(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.map(formatTableValue).join(" / ") || "-";
    if (typeof value === "object") return Object.entries(value).map(([key, field]) => `${key}: ${formatTableValue(field)}`).join("; ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
}

function createTableRow(card) {
    const cells = state.tableColumns.map(column => {
        const isManaBox = column.startsWith("manabox:");
        const field = column.slice(isManaBox ? 8 : 9);
        let value = isManaBox ? card[field] : field.split(".").reduce((record, key) => record?.[key], card._scryfall);
        if (!isManaBox && value === undefined && card._scryfall?.card_faces) {
            const faceValues = card._scryfall.card_faces.map(face => field.split(".").reduce((record, key) => record?.[key], face)).filter(fieldValue => fieldValue !== undefined);
            if (faceValues.length) value = faceValues;
        }
        if (column === "manabox:Name") {
            return `<th scope="row"><button type="button" class="table-card-name" data-preview-card="${card._id}">${escapeHtml(card._displayName || card.Name || "Unknown card")}</button></th>`;
        }
        return `<td>${escapeHtml(formatTableValue(value))}</td>`;
    });
    return `<tr class="collection-row" data-card-id="${card._id}">${cells.join("")}</tr>`;
}

function createCardsTable(cards) {
    const definitions = new Map(getTableColumnDefinitions().map(column => [column.id, column]));
    return `<div class="collection-table-scroll" tabindex="0" role="region" aria-label="Collection table"><table class="collection-table">
        <caption class="sr-only">Filtered card collection</caption>
        <thead><tr>${state.tableColumns.map(id => {
            const column = definitions.get(id);
            return `<th scope="col">${escapeHtml(column.label)}<small>${column.source}</small></th>`;
        }).join("")}</tr></thead>
        <tbody>${cards.map(createTableRow).join("")}</tbody>
    </table></div>`;
}

function hideTablePreview() {
    document.getElementById("table-card-preview")?.classList.add("hidden");
}

function showTablePreview(target) {
    const card = state.displayedCards.find(entry => String(entry._id) === target.dataset.previewCard);
    const images = card?._scryfall?.image_uris || card?._scryfall?.card_faces?.find(face => face.image_uris)?.image_uris;
    let preview = document.getElementById("table-card-preview");
    if (!preview) {
        preview = document.createElement("div");
        preview.id = "table-card-preview";
        preview.className = "table-card-preview hidden";
        preview.setAttribute("role", "tooltip");
        document.body.appendChild(preview);
    }
    preview.replaceChildren();
    const imageUrl = images?.normal || images?.large;
    if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = card._displayName || card.Name || "Card preview";
        preview.appendChild(image);
    } else {
        preview.textContent = "Image unavailable";
    }
    preview.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    const left = rect.right + width + 12 <= window.innerWidth ? rect.right + 12 : rect.left - width - 12;
    preview.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
    preview.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - height - 8))}px`;
}

function initializeTableView() {
    try {
        const saved = JSON.parse(localStorage.getItem(TABLE_SETTINGS_KEY) || "null");
        if (saved?.view === "table") state.collectionView = "table";
        if (Array.isArray(saved?.columns)) {
            state.tableColumns = ["manabox:Name", ...new Set(saved.columns.filter(column => typeof column === "string" && /^(manabox|scryfall):.+/.test(column) && column !== "manabox:Name"))];
        }
    } catch (error) {
        console.warn("Unable to load table settings", error);
    }
    updateCollectionViewControls();
    refreshTableColumnPicker();
    elements.collectionView.addEventListener("click", event => {
        const button = event.target.closest("[data-view]");
        if (!button) return;
        state.collectionView = button.dataset.view;
        hideTablePreview();
        updateCollectionViewControls();
        saveTableSettings();
        if (state.allCards.length) renderPage();
    });
    elements.tableColumnList.addEventListener("change", event => {
        const input = event.target;
        if (!input.matches('input[type="checkbox"]')) return;
        if (input.checked) state.tableColumns.push(input.value);
        else state.tableColumns = state.tableColumns.filter(column => column !== input.value);
        saveTableSettings();
        renderPage();
    });
    const showPreview = event => {
        const target = event.target.closest("[data-preview-card]");
        if (target) showTablePreview(target);
    };
    const hidePreview = event => {
        const target = event.target.closest("[data-preview-card]");
        if (target && !target.contains(event.relatedTarget)) hideTablePreview();
    };
    elements.cardsContainer.addEventListener("mouseover", showPreview);
    elements.cardsContainer.addEventListener("focusin", showPreview);
    elements.cardsContainer.addEventListener("mouseout", hidePreview);
    elements.cardsContainer.addEventListener("focusout", hidePreview);
    document.addEventListener("scroll", hideTablePreview, true);
    window.addEventListener("resize", hideTablePreview);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            hideTablePreview();
            elements.tableColumns.open = false;
        }
    });
    document.addEventListener("click", event => {
        if (!elements.tableColumns.contains(event.target)) elements.tableColumns.open = false;
    });
}