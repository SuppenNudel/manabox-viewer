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

async function searchScryfallByQuery(query) {
    if (!query || !query.trim()) return new Set();

    const trimmedQuery = query.trim();
    if (state.scryfallQueryCache.has(trimmedQuery)) {
        return state.scryfallQueryCache.get(trimmedQuery);
    }

    const matchingIds = new Set();
    let hasMore = true;
    let cursor = null;

    try {
        while (hasMore) {
            let url = `https://api.scryfall.com/cards/search?${new URLSearchParams({ q: trimmedQuery })}`;
            if (cursor) {
                url += `&page=${cursor}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Scryfall search failed: ${response.status}`);
                state.scryfallQueryCache.set(trimmedQuery, new Set());
                return new Set();
            }

            const data = await response.json();
            if (data.data) {
                data.data.forEach(card => {
                    matchingIds.add(card.id);
                });
            }

            hasMore = data.has_more ?? false;
            cursor = (cursor || 0) + 1;
        }
    } catch (error) {
        console.error("Scryfall search error:", error);
        state.scryfallQueryCache.set(trimmedQuery, new Set());
        return new Set();
    }

    state.scryfallQueryCache.set(trimmedQuery, matchingIds);
    return matchingIds;
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
