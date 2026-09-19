# Sheypoor Filter System — API Documentation

> Complete reference for Sheypoor's search filter and SERP metadata APIs. Covers filter discovery, SERP info retrieval, query parameter semantics, and filter application workflows.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Endpoints Reference](#2-endpoints-reference)
   - 2.1 [SERP Main (`/search/main`)](#21-serp-main-searchmain)
   - 2.2 [Search Filters (`/search/filters/{slugs}`)](#22-search-filters-searchfiltersslugs)
   - 2.3 [Search Results (`/search/{citySlug}`)](#23-search-results-searchcityslug)
3. [Query Parameter Reference](#3-query-parameter-reference)
4. [Response Schema: SERP Main](#4-response-schema-serp-main)
5. [Response Schema: Filters](#5-response-schema-filters)
6. [Filter Component Types](#6-filter-component-types)
7. [Filter Application Workflow](#7-filter-application-workflow)
8. [URL Slug ↔ Query Parameter Mapping](#8-url-slug--query-parameter-mapping)
9. [Reference Implementation](#9-reference-implementation)
10. [Appendix: Filter IDs & Options](#10-appendix-filter-ids--options)

---

## 1. Overview

Sheypoor's search filtering system is split across **two read-only endpoints** that cooperate:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v10.0.0/search/main` | SERP metadata: SEO strings, breadcrumbs, FAQs |
| `GET /api/v10.0.0/search/filters/{slugs}` | Available filter definitions for the current context |

Both accept the **same set of context query parameters** (`c`, `ct`, `nh`, `o`, `r`, `a*`). They do **not** return listings — for that you use `/search/{citySlug}?f=&p=` (see the search doc).

### Conceptual Model

```
┌──────────────────────────────────────────────────────────────────┐
│  URL:  /s/chalus/17-shahrivar/mobile-tablet/apple                │
│        ?c=44006&ct=960&nh[0]=7975&o=n&r=27&a90158=453187         │
└──────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
       ┌──────────┐  ┌─────────────┐  ┌────────────┐
       │ SERP     │  │ Filter      │  │ Listing    │
       │ Main     │  │ Definitions │  │ Results    │
       │ (SEO)    │  │             │  │ (paginated)│
       └──────────┘  └─────────────┘  └────────────┘
       /search/main  /search/filters  /search/{city}
```

**Key insight:** The URL slug path (`/s/chalus/17-shahrivar/mobile-tablet/apple`) carries **human-readable** context, while the query string (`c`, `ct`, `nh`, `r`) carries the **machine IDs**. Both refer to the same context. For scraping, prefer the query parameters — they're stable and don't require Persian slug decoding.

---

## 2. Endpoints Reference

### 2.1 SERP Main (`/search/main`)

Returns **SERP-level metadata** for the current search context: SEO title/description/H1/content, breadcrumbs, and FAQ entries. Does **not** return listings.

```
GET /api/v10.0.0/search/main?{filters}
```

#### Example

```
GET /api/v10.0.0/search/main?c=44006&ct=960&nh[0]=7975&o=n&r=27
```

#### Response (abbreviated)

```json
{
  "jsonapi": { "version": "1.1" },
  "data": {
    "type": "serpMain",
    "id": "",
    "meta": { "add_style": "default" },
    "attributes": {
      "seo_friendly_url": "https://www.sheypoor.com/s/chalus/17-shahrivar/mobile-tablet/apple?o=n",
      "perfect_url":      "https://www.sheypoor.com/s/chalus/17-shahrivar/mobile-tablet/apple?c=44006&ct=960&nh%5B0%5D=7975&o=n&r=27",
      "seo_h1":           "آگهی های گوشی اپل | Apple در 17 شهریور چالوس",
      "seo_title":        "خرید و فروش موبایل و تبلت اپل | Apple ... | شیپور",
      "seo_content":      "شیپور با سال‌ها تجربه ...",
      "seo_description":  "آگهی‌های خرید و فروش انواع موبایل و تبلت ...",
      "breadcrumbs": [
        { "title": "مازندران",              "url": "/s/mazandaran",              "type": "region" },
        { "title": "چالوس",                 "url": "/s/chalus",                  "type": "city" },
        { "title": "موبایل، تبلت و لوازم",  "url": "/s/chalus/mobile-tablet-accessories", "type": "category", "subType": 1 },
        { "title": "موبایل و تبلت",         "url": "/s/chalus/mobile-tablet",    "type": "category", "subType": 2 },
        { "title": "اپل | Apple",           "url": "/s/chalus/mobile-tablet/apple","type": "category", "subType": 3 },
        { "title": "17 شهریور",             "url": "/s/chalus/17-shahrivar/mobile-tablet/apple", "type": "neighbourhood" }
      ]
    },
    "relationships": {
      "internal_links": { "data": [] },
      "faqs": {
        "data": [
          { "type": "faq", "id": "در هنگام خرید موبایل چه نکاتی را در نظر بگیریم؟" },
          { "type": "faq", "id": "برترین برندهای موبایل کدام‌اند؟" },
          { "type": "faq", "id": "خرید موبایل و گوشی دست دوم چه مزایایی دارد؟" },
          { "type": "faq", "id": "چرا باید در شیپور به دنبال خرید گوشی یا تبلت باشیم؟" }
        ]
      },
      "extra_buttons": { "data": [] }
    }
  },
  "included": [
    {
      "type": "faq",
      "id": "در هنگام خرید موبایل چه نکاتی را در نظر بگیریم؟",
      "attributes": {
        "question": "در هنگام خرید موبایل چه نکاتی را در نظر بگیریم؟",
        "answer":   "نکاتی مانند ابعاد گوشی، جنس بدنه، ..."
      }
    }
  ]
}
```

#### Key Fields

| Field | Type | Meaning |
|-------|------|---------|
| `seo_friendly_url` | string | Clean human-readable URL (without machine params) |
| `perfect_url` | string | Canonical URL with **all** context params encoded |
| `seo_h1` | string | `<h1>` shown on the SERP page |
| `seo_title` | string | `<title>` tag |
| `seo_description` | string | Meta description |
| `seo_content` | string | Long-form SEO body (injected above listings) |
| `breadcrumbs[]` | array | Region → city → categories → neighbourhood |
| `relationships.faqs.data[]` | array | FAQ references (resolved in `included[]`) |
| `included[]` | array | Full FAQ objects with `question`/`answer` |

**Note:** The `perfect_url` is the **canonical** version of the current search — persist it for re-crawling.

---

### 2.2 Search Filters (`/search/filters/{slugs}`)

Returns the **filter definitions** available for the current search context. Each filter is a `formComponent*` object with its own `id`, `label`, `name`, and a list of `formComponentOptions`.

```
GET /api/v10.0.0/search/filters/{slugPath}?{contextParams}
```

- `{slugPath}` — slash-separated path segments after `/s/` (e.g., `chalus/17-shahrivar/mobile-tablet/apple`)
- Query params — same context parameters as `/search/main` plus any active filters

#### Example

```
GET /api/v10.0.0/search/filters/chalus/17-shahrivar/mobile-tablet/apple?c=44006&ct=960&nh[0]=7975&o=n&r=27
```

#### Response (abbreviated)

```json
{
  "jsonapi": { "version": "1.1" },
  "meta": {
    "search_variables": {
      "c":  { "id": "44006", "name": "اپل | Apple",    "slug": "mobile-tablet/apple" },
      "ct": { "id": "960",   "name": "چالوس",          "slug": "chalus" },
      "nh": [{ "id": "7975", "name": "17 شهریور",     "slug": "17-shahrivar" }],
      "o":  "n",
      "r":  { "id": "27",    "name": "مازندران",       "slug": "mazandaran" },
      "brandInSlug": "44006",
      "parent_category": "43597"
    },
    "sorting_orders": [
      { "title": "جدیدترین",    "value": "n"  },
      { "title": "ارزان‌ترین",  "value": "pa" },
      { "title": "گران‌ترین",    "value": "pd" },
      { "title": "نزدیک‌ترین",   "value": "am" }
    ],
    "limits": {
      "top_subcategories": 8,
      "top_regions": 8,
      "top_cities": 8,
      "top_neighbourhoods": 8
    },
    "hide_all_iran": false,
    "chips": ["brands", 90158, "78858", 1, "wi", 78853],
    "filter_bar_hidden_attributes": [68099, 69150, 69160, 69500, 69140, 69130, 68102, 69050, 69015, 69016, 69607],
    "categories_without_show_more_button": [43633]
  },
  "links": {
    "self": "https://www.sheypoor.com/api/v10.0.0/search/filters/chalus/17-shahrivar/mobile-tablet/apple"
  },
  "data": [
    {
      "type": "formGroup",
      "id": "filters",
      "attributes": {
        "title": "filters",
        "displayTitle": false,
        "inline": true
      },
      "relationships": {
        "components": {
          "data": [
            { "type": "formComponentMultiSelect",     "id": "0" },
            { "type": "formComponentBrandAndModels",  "id": "brands" },
            { "type": "formComponentBoolean",         "id": "78858" },
            { "type": "formComponentSingleSelect",    "id": "90158" },
            { "type": "formComponentRangeNumber",     "id": "1" }
          ]
        }
      }
    }
  ],
  "included": [ /* full component definitions + options */ ]
}
```

#### Key Meta Fields

| Field | Meaning |
|-------|---------|
| `search_variables` | Resolved IDs → names for the current context |
| `sorting_orders[]` | Valid sort modes for this search |
| `chips[]` | Filter IDs/names to promote as top chips in the UI |
| `filter_bar_hidden_attributes[]` | Attribute IDs to hide from the filter bar |
| `categories_without_show_more_button[]` | Categories that never show "show more" |
| `hide_all_iran` | If `true`, suppress the "all of Iran" scope |

**`sorting_orders` values:**

| Value | Meaning |
|-------|---------|
| `n` | Newest first (default) |
| `pa` | Price ascending |
| `pd` | Price descending |
| `am` | Nearest first |

---

### 2.3 Search Results (`/search/{citySlug}`)

For the actual listings, use the paginated search endpoint (see the search doc). Filters are applied as query parameters:

```
GET /api/v10.0.0/search/{citySlug}?{contextParams}&{filterParams}&f=&p=
```

#### Example

```
GET /api/v10.0.0/search/iran?c=44006&ct=960&nh[0]=7975&o=n&r=27&a90158=453187&p=1
```

---

## 3. Query Parameter Reference

All three endpoints share a common parameter vocabulary. Context parameters define **where** you're searching; filter parameters define **what** you're filtering.

### 3.1 Context Parameters

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `r` | number | Region (province) ID | `27` (مازندران) |
| `ct` | number | City ID | `960` (چالوس) |
| `nh[n]` | number | Neighbourhood ID (array, `n` = index) | `nh[0]=7975` (17 شهریور) |
| `c` | number | Leaf category ID | `44006` (اپل) |
| `ct2` | number | Sub-category ID (rare) | — |
| `o` | string | Sort mode: `n`, `pa`, `pd`, `am` | `n` |
| `q` | string | Free-text query | `آیفون` |

### 3.2 Filter Parameters

Filter parameters are **dynamic** — each filter component exposes a `name` attribute that becomes the query key.

| Param | Type | Source | Example |
|-------|------|--------|---------|
| `a{numericId}` | string | Attribute filters | `a90158=453187` |
| `brands` | string | Brand filter | `brands=44006` |
| `mnp` | number | Min price | `mnp=1000000` |
| `mxp` | number | Max price | `mxp=50000000` |
| `wi` | string | "With image" flag | `wi=true` |
| `a78853` | boolean | Secure-purchase only | `a78853=true` |

**Rule of thumb:** If a `formComponentSingleSelect` / `formComponentMultiSelect` has `name: "aXXXXX"`, its query parameter is `aXXXXX`. If it has a friendly `name` (like `brands`, `nh`, `wi`), use that.

### 3.3 Pagination Parameters

| Param | Description |
|-------|-------------|
| `f` | Cursor (from `meta.f` of previous response) |
| `p` | Page number (1-indexed) |

### 3.4 Complete Example URL

```
/s/chalus/17-shahrivar/mobile-tablet/apple
  ?c=44006          # Apple category
  &ct=960           # Chalus city
  &nh[0]=7975       # 17 Shahrivar neighbourhood
  &o=n              # sort by newest
  &r=27             # Mazandaran province
  &a90158=453187    # condition = New
```

---

## 4. Response Schema: SERP Main

The `/search/main` endpoint returns a JSON:API document with a single `serpMain` resource and a list of `faq` resources in `included[]`.

### 4.1 `serpMain.attributes`

| Field | Type | Description |
|-------|------|-------------|
| `seo_friendly_url` | string | Canonical URL without machine params |
| `perfect_url` | string | Canonical URL with all context params |
| `seo_h1` | string | Primary heading |
| `seo_title` | string | `<title>` |
| `seo_description` | string | Meta description |
| `seo_content` | string | Long-form SEO body |
| `breadcrumbs[]` | array | Navigation trail |

### 4.2 `breadcrumbs[]` Object

```json
{
  "title": "موبایل، تبلت و لوازم",
  "url": "https://www.sheypoor.com/s/chalus/mobile-tablet-accessories",
  "type": "category",
  "subType": 1
}
```

| `type` | Meaning |
|--------|---------|
| `region` | Province |
| `city` | City |
| `neighbourhood` | Neighbourhood |
| `category` | Category (`subType` 1/2/3 = depth) |

### 4.3 FAQ Resource

```json
{
  "type": "faq",
  "id": "در هنگام خرید موبایل چه نکاتی را در نظر بگیریم؟",
  "attributes": {
    "question": "در هنگام خرید موبایل چه نکاتی را در نظر بگیریم؟",
    "answer":   "نکاتی مانند ابعاد گوشی، جنس بدنه، ..."
  }
}
```

FAQs are **deterministic** for a given category and don't change per-listing. Cache them aggressively (e.g., per `parent_category`).

---

## 5. Response Schema: Filters

The `/search/filters/{slugs}` endpoint returns a JSON:API document with a `formGroup` resource and a list of `formComponent*` resources.

### 5.1 `meta.search_variables`

Resolved context. Useful for confirming what you asked for:

```json
{
  "c":  { "id": "44006", "name": "اپل | Apple", "slug": "mobile-tablet/apple" },
  "ct": { "id": "960",   "name": "چالوس",       "slug": "chalus" },
  "nh": [{ "id": "7975", "name": "17 شهریور",  "slug": "17-shahrivar" }],
  "o":  "n",
  "r":  { "id": "27",    "name": "مازندران",    "slug": "mazandaran" },
  "brandInSlug": "44006",
  "parent_category": "43597"
}
```

### 5.2 `meta.sorting_orders[]`

```json
[
  { "title": "جدیدترین",    "value": "n"  },
  { "title": "ارزان‌ترین",  "value": "pa" },
  { "title": "گران‌ترین",    "value": "pd" },
  { "title": "نزدیک‌ترین",   "value": "am" }
]
```

The valid set is **context-dependent**. For example, `am` (nearest) is only offered when the user's location is known.

### 5.3 `meta.chips[]`

Mixed array of IDs and names that the UI promotes as top-level chips. May contain:

- `"brands"` — the brand filter key
- `90158` — attribute ID (نumeric)
- `"wi"` — "with image" flag
- `1` — price range component ID

Treat chips as hints, not as a strict schema.

### 5.4 `meta.filter_bar_hidden_attributes[]`

Numeric attribute IDs that should **not** appear in the filter bar for this category. Example: `[68099, 69150, 69160, 69500, 69140, 69130, 68102, 69050, 69015, 69016, 69607]` — these are vehicle-related attributes that don't apply to Apple phones.

### 5.5 `data[0]` — Form Group

```json
{
  "type": "formGroup",
  "id": "filters",
  "attributes": {
    "title": "filters",
    "description": null,
    "displayTitle": false,
    "inline": true,
    "sortOrder": null
  },
  "relationships": {
    "components": {
      "data": [
        { "type": "formComponentMultiSelect",     "id": "0" },
        { "type": "formComponentBrandAndModels",  "id": "brands" },
        { "type": "formComponentBoolean",         "id": "78858" },
        { "type": "formComponentSingleSelect",    "id": "90158" },
        { "type": "formComponentRangeNumber",     "id": "1" }
      ]
    }
  }
}
```

The `components` list defines the **order** and **identity** of filters. Their full definitions live in `included[]`.

### 5.6 `included[]` — Component Definitions

Each component has `attributes` (config) and `relationships.formComponentOptions.data` (option references).

---

## 6. Filter Component Types

Six component types are observed. Each maps to a specific UI control and a specific query parameter format.

### 6.1 `formComponentRangeNumber` — Price / Numeric Range

```json
{
  "type": "formComponentRangeNumber",
  "id": "1",
  "attributes": {
    "label": "قیمت",
    "name": "",
    "unitCaption": "تومان",
    "thousandSeparator": true,
    "isPrice": true,
    "min": { "name": "mnp", "title": "حداقل قیمت", "value": null },
    "max": { "name": "mxp", "title": "حداکثر قیمت", "value": null }
  }
}
```

**Query params:** `mnp` (min), `mxp` (max).

### 6.2 `formComponentSingleSelect` — Single-Select Attribute

```json
{
  "type": "formComponentSingleSelect",
  "id": "90158",
  "attributes": {
    "label": "وضعیت کالا",
    "name": "a90158",
    "analyticsKey": "newUsed"
  },
  "relationships": {
    "formComponentOptions": {
      "data": [
        { "type": "formComponentOptions", "id": "453187" },
        { "type": "formComponentOptions", "id": "453188" },
        { "type": "formComponentOptions", "id": "453189" }
      ]
    }
  }
}
```

Options are resolved in `included[]`:

```json
{ "type": "formComponentOptions", "id": "453187", "attributes": { "label": "نو" } }
{ "type": "formComponentOptions", "id": "453188", "attributes": { "label": "در حد نو" } }
{ "type": "formComponentOptions", "id": "453189", "attributes": { "label": "کارکرده" } }
```

**Query param:** `a90158=453187`.

### 6.3 `formComponentMultiSelect` — Multi-Select (e.g., Neighbourhoods)

```json
{
  "type": "formComponentMultiSelect",
  "id": "0",
  "attributes": {
    "label": "محله",
    "name": "nh",
    "dependsTo": true
  },
  "relationships": {
    "formComponentOptions": {
      "data": [
        { "type": "formComponentOptions", "id": "7975" },
        { "type": "formComponentOptions", "id": "7421" },
        ...
      ]
    }
  }
}
```

**Query param:** `nh[0]=7975&nh[1]=7421&...` (array).

### 6.4 `formComponentBoolean` — Toggle

```json
{
  "type": "formComponentBoolean",
  "id": "78858",
  "attributes": {
    "label": "فقط خرید امن",
    "name": "a78853",
    "analyticsKey": "SecurePurchase"
  }
}
```

**Query param:** `a78853=true` (or omit for false).

> **Note:** The component `id` (`78858`) differs from the attribute `name` (`a78853`). Always use `name` for the query string.

### 6.5 `formComponentBrandAndModels` — Brand (with optional model)

```json
{
  "type": "formComponentBrandAndModels",
  "id": "brands",
  "attributes": {
    "label": "اپل | Apple",
    "name": "brands",
    "value": {
      "brand": { "id": "44006", "label": "اپل | Apple" }
    },
    "isEditable": true
  }
}
```

**Query param:** `brands=44006`. If a model is also selected, it may appear as a separate `brands` value or as `brands=44006,<modelId>`.

### 6.6 `formComponentOptions` — Option Definition

Not a filter itself, but the payload that populates `formComponentOptions` references:

```json
{
  "type": "formComponentOptions",
  "id": "7975",
  "attributes": {
    "label": "17 شهریور",
    "dependencies": null
  }
}
```

---

## 7. Filter Application Workflow

### Step 1 — Resolve Context IDs

From user input (city, neighbourhood, category) or the URL slug, resolve the IDs. Sources:

- `/general/locations` → region, city, neighbourhood IDs
- `/categories/compact` → category IDs

### Step 2 — Fetch SERP Main + Filters (parallel)

```python
import asyncio, aiohttp

async def fetch_context(session, params):
    base = "https://www.sheypoor.com/api/v10.0.0"
    urls = {
        "serp":    f"{base}/search/main",
        "filters": f"{base}/search/filters/{slug_path}",
    }
    async with session.get(urls["serp"], params=params) as r:
        serp = await r.json()
    async with session.get(urls["filters"], params=params) as r:
        filters = await r.json()
    return serp, filters
```

### Step 3 — Render Available Filters

Use `data[0].relationships.components.data[]` to iterate components in order, then look up each component's full definition in `included[]`. Resolve `formComponentOptions` references the same way.

### Step 4 — Apply a Filter

When the user selects an option:

1. Take the component's `name` (e.g., `a90158`)
2. Take the option's `id` (e.g., `453187`)
3. Add `name=id` to the query string
4. Re-fetch `/search/main`, `/search/filters`, and `/search/{city}` — the returned filter set may change (cascading filters)

### Step 5 — Cascading Behavior

After applying `a90158=453187`, the server returns a **new** filter set that may:

- Remove mutually exclusive options
- Reorder options by popularity
- Update `meta.search_variables` to reflect the active filter

The `perfect_url` in `/search/main` will include the new filter:

```
/s/chalus/17-shahrivar/mobile-tablet/apple?a90158=453187&o=n
```

---

## 8. URL Slug ↔ Query Parameter Mapping

The URL path and the query string encode the same context in different forms. The mapping is:

| Path Segment | Corresponding Param | Example |
|--------------|---------------------|---------|
| `/s/{region}` | `r={regionId}` | `/s/mazandaran` → `r=27` |
| `/s/{city}` | `ct={cityId}` | `/s/chalus` → `ct=960` |
| `/s/{city}/{neighbourhood}` | `nh[0]={nhId}` | `/s/chalus/17-shahrivar` → `nh[0]=7975` |
| `/{top-cat}` | (implicit, part of `c`) | `/mobile-tablet-accessories` |
| `/{cat}` | (implicit) | `/mobile-tablet` |
| `/{leaf-cat}` | `c={catId}` | `/apple` → `c=44006` |

**Order matters:** The slug is `/{neighbourhood}/{category-path}` — neighbourhood comes **before** the category path. The query string uses `nh[0]` regardless of order.

### 8.1 Decoding Slugs to IDs

Slugs are **not** unique across regions. Always resolve them via:

- `/general/locations` for region/city/neighbourhood
- `/categories/compact` for categories

Example resolution:

```python
def resolve_slug(locations: dict, categories: dict,
                 region_slug: str, city_slug: str,
                 nh_slug: str, cat_slugs: list[str]) -> dict:
    out = {}
    for province in locations["list"]:
        if province["slug"] == region_slug:
            out["r"] = province["provinceID"]
            for city in province["cities"]:
                if city["slug"] == city_slug:
                    out["ct"] = city["cityID"]
                    for d in city.get("districts", []):
                        if d["slug"] == nh_slug:
                            out["nh"] = d["districtID"]
                    break
            break
    for cat in categories["data"]:
        if cat["slug"] == cat_slugs[-1]:
            out["c"] = int(cat["id"])
            break
    return out
```

---

## 9. Reference Implementation

### 9.1 Python — Fetch Filters for a Search Context

```python
import requests

BASE = "https://www.sheypoor.com/api/v10.0.0"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "application/vnd.api+json, application/json;q=0.9",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Referer": "https://www.sheypoor.com/",
}

def fetch_serp_main(params: dict) -> dict:
    r = requests.get(f"{BASE}/search/main", params=params, headers=HEADERS)
    r.raise_for_status()
    return r.json()

def fetch_filters(slug_path: str, params: dict) -> dict:
    url = f"{BASE}/search/filters/{slug_path}"
    r = requests.get(url, params=params, headers=HEADERS)
    r.raise_for_status()
    return r.json()

def index_included(doc: dict) -> dict:
    """Map {type: {id: resource}} for fast lookup."""
    idx = {}
    for res in doc.get("included", []):
        idx.setdefault(res["type"], {})[res["id"]] = res
    return idx

def build_filter_tree(filters_doc: dict) -> list[dict]:
    idx = index_included(filters_doc)
    group = filters_doc["data"][0]
    out = []
    for ref in group["relationships"]["components"]["data"]:
        comp = idx[ref["type"]][ref["id"]]
        comp = dict(comp)  # copy
        # resolve options
        opt_refs = (comp.get("relationships", {})
                        .get("formComponentOptions", {})
                        .get("data", []))
        comp["options"] = [
            idx.get("formComponentOptions", {}).get(o["id"])
            for o in opt_refs
        ]
        out.append(comp)
    return out


if __name__ == "__main__":
    context = {
        "c": 44006, "ct": 960, "r": 27, "o": "n",
        "nh[0]": 7975,
    }
    slug_path = "chalus/17-shahrivar/mobile-tablet/apple"

    serp   = fetch_serp_main(context)
    filters = fetch_filters(slug_path, context)

    print("H1:        ", serp["data"]["attributes"]["seo_h1"])
    print("Sort modes:", [s["value"] for s in filters["meta"]["sorting_orders"]])
    for comp in build_filter_tree(filters):
        attrs = comp["attributes"]
        print(f"- {attrs.get('label')!r:30} "
              f"name={attrs.get('name')!r:12} "
              f"type={comp['type']}")
        for opt in comp.get("options", []):
            if opt:
                print(f"    • {opt['attributes']['label']} = {opt['id']}")
```

### 9.2 Applying a Filter

```python
def apply_filter(context: dict, comp_name: str, option_id: str) -> dict:
    """Return a new context with the filter applied."""
    new_ctx = dict(context)
    new_ctx[comp_name] = option_id
    return new_ctx

# Example: filter by condition = New (a90158=453187)
new_ctx = apply_filter(context, "a90158", "453187")
# → { "c": 44006, "ct": 960, "r": 27, "o": "n",
#     "nh[0]": 7975, "a90158": 453187 }

# Then fetch the updated filter set (cascades) and listings:
filters2 = fetch_filters(slug_path, new_ctx)
```

### 9.3 JavaScript / TypeScript

```typescript
const BASE = "https://www.sheypoor.com/api/v10.0.0";

interface FilterContext {
  c?: number;      // category
  ct?: number;     // city
  r?: number;      // region
  nh?: number[];   // neighbourhoods
  o?: "n" | "pa" | "pd" | "am";
  [attr: string]: any; // dynamic: a90158, brands, mnp, mxp, ...
}

function buildQuery(ctx: FilterContext): string {
  const p = new URLSearchParams();
  if (ctx.c)  p.set("c",  String(ctx.c));
  if (ctx.ct) p.set("ct", String(ctx.ct));
  if (ctx.r)  p.set("r",  String(ctx.r));
  if (ctx.o)  p.set("o",  ctx.o);
  (ctx.nh ?? []).forEach((id, i) => p.set(`nh[${i}]`, String(id)));
  for (const [k, v] of Object.entries(ctx)) {
    if (["c","ct","r","o","nh"].includes(k)) continue;
    if (Array.isArray(v)) v.forEach((x, i) => p.set(`${k}[${i}]`, String(x)));
    else if (v != null) p.set(k, String(v));
  }
  return p.toString();
}

async function fetchSerpMain(ctx: FilterContext) {
  const res = await fetch(`${BASE}/search/main?${buildQuery(ctx)}`, {
    headers: { "Accept": "application/vnd.api+json" },
  });
  return res.json();
}

async function fetchFilters(slugPath: string, ctx: FilterContext) {
  const res = await fetch(`${BASE}/search/filters/${slugPath}?${buildQuery(ctx)}`, {
    headers: { "Accept": "application/vnd.api+json" },
  });
  return res.json();
}
```

---

## 10. Appendix: Filter IDs & Options

### 10.1 Common Filter Names (Query Keys)

| Query Key | Source | Meaning |
|-----------|--------|---------|
| `c` | Context | Leaf category ID |
| `ct` | Context | City ID |
| `r` | Context | Region (province) ID |
| `nh[n]` | Context | Neighbourhood IDs (array) |
| `o` | Context | Sort mode |
| `q` | Context | Free-text query |
| `mnp` | `formComponentRangeNumber` | Min price |
| `mxp` | `formComponentRangeNumber` | Max price |
| `brands` | `formComponentBrandAndModels` | Brand ID |
| `a{numericId}` | `formComponentSingleSelect` / `MultiSelect` / `Boolean` | Attribute filter |
| `wi` | (chip) | "With image" flag |

### 10.2 Observed Attribute IDs (Mobile Category)

| ID | Label | Options (ID → label) |
|----|-------|----------------------|
| `90158` | وضعیت کالا | `453187`=نو, `453188`=در حد نو, `453189`=کارکرده |
| `90153` | وضعیت کالا (home) | `453187`=نو, `453188`=در حد نو |
| `90154` | وضعیت کالا (home) | `453187`=نو, `453188`=در حد نو |
| `90157` | وضعیت کالا (industrial) | `461076`=نو, `461078`=کارکرده |
| `78858` | فقط خرید امن (bool) | `name=a78853` |
| `1` | قیمت (range) | `mnp`, `mxp` |

### 10.3 Filter Bar Hidden Attributes

The `meta.filter_bar_hidden_attributes[]` array lists attribute IDs that should be **suppressed** in the UI for the current category. This is useful for building a filter UI that doesn't show irrelevant fields.

Example (mobile category):

```json
[68099, 69150, 69160, 69500, 69140, 69130, 68102, 69050, 69015, 69016, 69607]
```

These are mostly **vehicle-related** attributes (mileage, gearbox, etc.) that shouldn't appear for phones.

### 10.4 `chips[]` — Promoted Filters

The `meta.chips[]` array is a **mixed-type** list of the filters the UI promotes as top-level chips. Values may be:

- `"brands"` — the brand filter key
- `90158` — a numeric attribute ID
- `"wi"` — the "with image" flag
- `1` — the price range component ID

Don't assume all chips are the same type. Filter by `typeof`.

---

## 11. Cheat Sheet

| Task | Endpoint |
|------|----------|
| Get SERP metadata (SEO, breadcrumbs, FAQs) | `GET /search/main?{ctx}` |
| Get available filters for a context | `GET /search/filters/{slugPath}?{ctx}` |
| Get listings with filters | `GET /search/{citySlug}?{ctx}&{filters}&f=&p=` |
| Resolve region/city/neighbourhood | `GET /general/locations` |
| Resolve category | `GET /categories/compact` |
| Apply a filter | Add `name=id` from the component + option |
| Cascade filters | Re-fetch `/search/main` and `/search/filters` after each change |
| Sort modes | `n` (newest), `pa` (asc), `pd` (desc), `am` (nearest) |
| Price filter | `mnp` + `mxp` |
| Neighbourhood filter | `nh[0]=...&nh[1]=...` |
| Brand filter | `brands={brandId}` |
| Attribute filter | `a{attrId}={optionId}` |
| "With image" chip | `wi=true` |
| Secure purchase | `a78853=true` |

> ⚠️ **Disclaimer:** These endpoints are reverse-engineered from observed traffic. Sheypoor may change them without notice. Cache `/search/main` and `/search/filters` responses per context (they change rarely and are keyed by the context parameters). Respect `robots.txt` and throttle requests.