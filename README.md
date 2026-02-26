# ManaBox Card Viewer (Client)

Pure client-side version of the ManaBox card viewer. It runs entirely in the browser using HTML, CSS, and JavaScript.

## How to use

1. Open [index.html](index.html) in a browser.
2. Drag and drop your `ManaBox_Collection.csv` file into the drop area (or use the file picker).
3. Use filters, sorting, and saved configurations just like the Flask version.

## Scryfall enrichment

- Card data is fetched on demand from Scryfall as cards appear on screen.
- Results are cached in IndexedDB, so repeat visits are faster.
- Use the "Enrich visible" button to fetch data for the currently visible cards.

## Notes

- Filters that rely on Scryfall data (format legality, card types, CMC) will only work for cards that have been enriched.
- If your browser blocks local file access, serve the folder with a simple local server.
