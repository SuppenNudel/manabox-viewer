// Version pattern is yyyy.MM.feature.patch
const APP_VERSION = "2026.3.10.1";

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
    "mythic": "M",
    "special": "S"
};

const RARITY_ICONS = {
    "common": { icon: "⚫", label: "Common" },
    "uncommon": { icon: "⚪", label: "Uncommon" },
    "rare": { icon: "🟡", label: "Rare" },
    "mythic": { icon: "🔴", label: "Mythic" },
    "special": { icon: "🟣", label: "Special" }
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

const SCRYFALL_DEFAULT_CARDS_META_URL = "https://api.scryfall.com/bulk-data/default_cards";
const META_BULK_DEFAULT_CARDS_UPDATED_AT_KEY = "bulk_default_cards_updated_at";
const LEGALITY_DISPLAY_SETTINGS_KEY = "mtg_legality_display_settings";
const MTGTOP8_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const MTGTOP8_CACHE_KEY_PREFIX = "mtg_mtgtop8_format_";
const MTGTOP8_FORMAT_MAP = {
    standard: "Standard",
    pioneer: "Pioneer",
    modern: "Modern",
    legacy: "Legacy",
    pauper: "Pauper"
};

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
    { value: "w", label: "White", className: "color-w" },
    { value: "u", label: "Blue", className: "color-u" },
    { value: "b", label: "Black", className: "color-b" },
    { value: "r", label: "Red", className: "color-r" },
    { value: "g", label: "Green", className: "color-g" },
    { value: "c", label: "Colorless", className: "color-c" }
];

const COLOR_ORDER = ["w", "u", "b", "r", "g", "c"];

const SCRYFALL_SYMBOL_CODES = new Set([
    "T", "Q", "E", "P", "PW", "CHAOS", "A", "TK", "X", "Y", "Z",
    ...Array.from({ length: 21 }, (_, index) => String(index)), "100", "1000000",
    "W/U", "W/B", "B/R", "B/G", "U/B", "U/R", "R/G", "R/W", "G/W", "G/U",
    "B/G/P", "B/R/P", "G/U/P", "G/W/P", "R/G/P", "R/W/P", "U/B/P", "U/R/P", "W/B/P", "W/U/P",
    "C/W", "C/U", "C/B", "C/R", "C/G", "2/W", "2/U", "2/B", "2/R", "2/G",
    "H", "W/P", "U/P", "B/P", "R/P", "G/P", "C/P", "HW", "HR", "W", "U", "B", "R", "G", "C", "S", "L", "D"
]);
