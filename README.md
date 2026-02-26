# ManaBox Card Viewer (Client)

A browser-based viewer for your ManaBox collection CSV.

No backend is required: the app runs fully client-side with HTML, CSS, and JavaScript.

## Use the app online

- Open directly in your browser: [HTML Preview (Live App)](https://htmlpreview.github.io/?https://github.com/SuppenNudel/manabox-viewer/blob/main/index.html)

## Run locally

### Option 1: Open directly

1. Open [index.html](index.html) in your browser.
2. Load your `ManaBox_Collection.csv` using drag-and-drop or file picker.

### Option 2: Serve with a local web server (recommended)

If your browser restricts local file behavior, run a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Core workflow

1. Load your ManaBox CSV in the **Load CSV** panel.
2. Review card list and metadata.
3. Apply filters and sorting in the sidebar.
4. Save reusable filter/sort combinations as named configurations.
5. Update bulk data when a newer Scryfall `default_cards` version is available.

## Filters and sorting

### Supported filters

- Card name
- Binder name / binder type
- Rarity
- Condition
- Language
- Foil status
- Mana value (CMC) with operators (`=`, `!=`, `<`, `<=`, `>`, `>=`)
- Card type
- Color (`W`, `U`, `B`, `R`, `G`, multicolored, monocolored, colorless)
- Format legality rules with AND/OR chaining

### Sorting

You can add multiple sort criteria (for example: type, then CMC, then name).

## Scryfall data model

The app combines your CSV rows with Scryfall card data.

### Data sources

- Primary: Scryfall bulk endpoint `default_cards`
- Fallback: per-card endpoint (`/cards/{id}`) when needed

### Bulk data behavior

- The app stores bulk records in IndexedDB for reuse across sessions.
- The sidebar shows current local/remote bulk version status.
- You can trigger manual updates with **Update bulk data**.
- On CSV load, the app checks whether local bulk cache covers all loaded Scryfall IDs and only downloads if data is missing.

### Missing IDs

If some CSV Scryfall IDs are not present in `default_cards`, the app shows a detailed table dialog including:

- Card name
- Set
- Collector number
- Quantity
- Scryfall ID

## Caching and persistence

- CSV data is loaded in-memory for the active session.
- Scryfall card records and bulk lookups are stored in IndexedDB.
- Saved filter configurations are stored in `localStorage`.

## UI actions

- **Apply Filters**: applies current filter set.
- **Reset Filters**: clears all active filters and sort criteria.
- **Enrich visible**: enriches currently visible cards with Scryfall details.
- **Update bulk data**: refreshes cached bulk records for your loaded collection.
- **Details / Compact**: toggles card detail density.

## Troubleshooting

### "No cards match your filters"

- Reset filters and try again.
- Confirm CSV fields are present and correctly formatted.

### Scryfall-dependent filters seem incomplete

- Use **Update bulk data** to refresh cached bulk records.
- Use **Enrich visible** for visible cards if needed.

### App cannot access files correctly

- Start a local HTTP server instead of opening files directly.

## Privacy and data

- Your CSV is processed locally in the browser.
- Cached Scryfall data remains in browser storage (IndexedDB/localStorage) for faster future use.
