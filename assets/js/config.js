const APP_VERSION = "2026.3.5";

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
    { value: "g", label: "G", className: "color-g" },
    { value: "c", label: "C", className: "color-c" }
];

const COLOR_ORDER = ["w", "u", "b", "r", "g", "c"];
