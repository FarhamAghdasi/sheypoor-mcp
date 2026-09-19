# Sheypoor API & Scraping Documentation (Extended)

> Complete reference for the undocumented Sheypoor APIs, SSR hydration payloads, and practical scraping strategies. Covers search, autocomplete, popular searches, ads, banners, locations, filters, and categories.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Endpoints Reference](#2-endpoints-reference)
   - 2.1 [Search Results](#21-search-results)
   - 2.2 [Native Ads](#22-native-ads)
   - 2.3 [Locations](#23-locations)
   - 2.4 [Popular Searches](#24-popular-searches)
   - 2.5 [Search Suggestions (Autocomplete)](#25-search-suggestions-autocomplete)
   - 2.6 [Search Filters](#26-search-filters)
   - 2.7 [Compact Categories](#27-compact-categories)
3. [Search Page Structure (SSR / CSR)](#3-search-page-structure-ssr--csr)
4. [Response Schema Deep Dive](#4-response-schema-deep-dive)
5. [Scraping Strategies](#5-scraping-strategies)
6. [Pagination & Cursor Mechanics](#6-pagination--cursor-mechanics)
7. [Rate Limiting & Anti-Bot Considerations](#7-rate-limiting--anti-bot-considerations)
8. [Reference Implementation](#8-reference-implementation)
9. [Appendix: Category & Attribute Maps](#9-appendix-category--attribute-maps)

---

## 1. Overview

Sheypoor is a Next.js (App Router) SSR application that hydrates a React Query cache on the client. Every search page (`/s/{slugs}?q=...`) embeds two data sources:

1. **Server-side rendered payload** — injected into the HTML as `<script>self.__next_f.push(...)</script>` chunks and a `window.__DEHYDRATED__STATE__` global.
2. **Client-side AJAX calls** — after hydration, further pages and autocomplete results are fetched from `/api/v10.0.0/*`.

For scraping, you have **three viable strategies** (see [§5](#5-scraping-strategies)).

| Property | Value |
|----------|-------|
| Base URL | `https://www.sheypoor.com` |
| API Base | `https://www.sheypoor.com/api/v10.0.0` |
| SSR Internal API | `http://edge-nginx-sidecar:9090/api/v10.0.0` |
| Content-Type | `application/json` |
| Auth | None required for public search |
| Version | `v10.0.0` |
| Framework | Next.js (App Router) |
| State Mgmt | React Query (dehydrated on SSR) |

---

## 2. Endpoints Reference

### 2.1 Search Results

Paginated listing results for a location (or "iran" for nationwide).

```
GET /search/{citySlug}?q={query}&f={cursor}&p={page}&r={regionId}&ct={categoryId}
```

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `{citySlug}` | path | Yes | City slug (e.g., `amol`, `iran`, `tehran`) |
| `q` | string | No | Full-text query (URL-encoded, Persian supported) |
| `f` | string | Yes* | Cursor for next page |
| `p` | number | Yes* | Page number |
| `r` | number | No | Region ID filter |
| `ct` | number | No | Category ID filter |

\* On page 1, `f` may be omitted; the server generates it and returns it in `meta.f`.

#### Example

```
GET /api/v10.0.0/search/iran?q=%D8%A2%DB%8C%D9%81%D9%88%D9%86&f=%5B20.0%5D_467377962n_1789837777.412637&p=1
```

#### Response Shape

```json
{
  "data": [ ...mixed items: listingGroup | banner | vip | nativeAd... ],
  "extra_sections": [],
  "meta": {
    "total": 12250,
    "normal_count": 5591,
    "p": 1,
    "items_per_page": 24,
    "f": "[20.0]_467377962n_1789837777.412637",
    "query_id": "921090F3F2AA1FD0",
    "mnp": 0,
    "mxp": 145000000000,
    "api_version": "v10.0.0",
    "toggles": [{ "toggle_toggle.external_banner_provider_web": true }],
    "add_style": "default"
  }
}
```

> **Note:** In the SSR-rendered variant, the response is wrapped in a `pages[]` array with `data` and `list` at the top level (see §3).

#### Item Types in `data[]`

| `type` | Description |
|--------|-------------|
| `listingGroup` | Container holding 6 listings (`items[]`) |
| `banner` | Display ad (usually 1200×177) |
| `vip` | "Vitrine" — promoted national/regional listing |
| `nativeAd` | Native ad (usually from Yektanet) |

Inside a `listingGroup.items[]`, individual ads have `type`:
- `normal` — user listing
- `paidEngagement` — paid/promoted listing

---

### 2.2 Native Ads

```
GET /banner/native-ad/{citySlug}?f={cursor}&p={page}
```

Returns a `nativeAd` object with Yektanet/external provider details. Response format is JSON:API 1.1.

---

### 2.3 Locations

```
GET /general/locations
```

Returns the full province → city → district hierarchy.

```json
{
  "success": true,
  "data": {
    "version": 1789807335,
    "list": [
      {
        "provinceID": 8,
        "name": "تهران",
        "slug": "tehran-province",
        "cities": [
          {
            "cityID": 291,
            "name": "اسلامشهر",
            "slug": "eslamshahr",
            "isCapital": "0",
            "districts": [
              { "districtID": 9145, "name": "اپرین", "slug": "aprin",
                "lat": "35.586...", "lon": "51.199..." }
            ],
            "allowedToFilterByDistrict": false,
            "lat": "35.815046",
            "lon": "52.513575"
          }
        ]
      }
    ]
  }
}
```

Use `data.version` as a cache-busting key. The **city `slug`** is what feeds the `/search/{citySlug}` path.

---

### 2.4 Popular Searches

Returns a curated list of trending search terms shown on the search page.

```
GET /search/popular-searches
```

#### Response

```json
{
  "jsonapi": { "version": "1.1" },
  "data": [
    {
      "type": "popularSearch",
      "id": "1",
      "attributes": {
        "title": "کار در منزل",
        "link": "https://www.sheypoor.com/l/%DA%A9%D8%A7%D8%B1_%D8%AF%D8%B1_%D9%85%D9%86%D8%B2%D9%84"
      }
    },
    {
      "type": "popularSearch",
      "id": "2",
      "attributes": {
        "title": "اکانت کالاف",
        "link": "https://www.sheypoor.com/l/%D8%A7%DA%A9%D8%A7%D9%86%D8%AA-%DA%A9%D8%A7%D9%84%D8%A7%D9%81-%D8%AF%DB%8C%D9%88%D8%AA%DB%8C"
      }
    }
  ]
}
```

#### Fields

| Field | Description |
|-------|-------------|
| `id` | Stable identifier (rank position) |
| `title` | Display title (Persian) |
| `link` | Landing page URL (a pre-built category search) |

> The `link` value is a **landing page** URL (path `/l/{slug}`), which internally redirects to `/s/{city}?q=...`. For scraping, prefer extracting the `q` term from the landing page or using the `title` as a search query directly.

---

### 2.5 Search Suggestions (Autocomplete)

Returns query autocomplete suggestions for a given prefix, scoped to a city.

```
GET /search/suggestion/{citySlug}?q={prefix}
```

#### Example

```
GET /api/v10.0.0/search/suggestion/amol?q=%D8%B3%D8%B1%DA%86
```

(`q` decoded = `سرچ`)

#### Response

```json
{
  "jsonapi": { "version": "1.1" },
  "links": {
    "self": "https://www.sheypoor.com/api/v10.0.0/search/suggestion/amol"
  },
  "data": [
    {
      "type": "searchSuggestion",
      "id": "https://www.sheypoor.com/s/iran?r=27&ct=951&q=%D8%B3%D8%B1%DA%86%D8%B4%D9%85%D9%87",
      "attributes": {
        "title": "سرچشمه",
        "subtitle": "در «همه گروه‌ها»",
        "url": "https://www.sheypoor.com/s/iran?r=27&ct=951&q=%D8%B3%D8%B1%DA%86%D8%B4%D9%85%D9%87",
        "count": null
      }
    }
  ]
}
```

#### Fields

| Field | Description |
|-------|-------------|
| `id` | Full search URL (unique key) |
| `attributes.title` | Suggested query term |
| `attributes.subtitle` | Context label (e.g., "in all categories") |
| `attributes.url` | Ready-to-use search URL |
| `attributes.count` | Optional result count (usually `null`) |

**Notes:**
- `r=27` is a region/area code, `ct=951` is the top-level category.
- Suggestions are typically **Persian-normalized** — Google-style typo correction is applied.
- Call this endpoint on every keystroke (with debounce) to mimic the UI.

---

### 2.6 Search Filters

Returns the filter definitions available for a given search context.

```
GET /search/filters/{citySlug}?q={query}
```

#### Response (abbreviated)

```json
{
  "meta": {
    "search_variables": { "q": "آیفون" },
    "sorting_orders": [
      { "title": "جدیدترین",     "value": "n"  },
      { "title": "ارزان‌ترین",   "value": "pa" },
      { "title": "گران‌ترین",     "value": "pd" },
      { "title": "نزدیک‌ترین",    "value": "am" }
    ],
    "limits": { "top_subcategories": 8, "top_regions": 8, ... },
    "filter_bar_hidden_attributes": [68099, 69150, 69160, ...],
    "categories_without_show_more_button": [43633]
  },
  "data": [
    {
      "type": "formGroup",
      "id": "filters",
      "components": [
        {
          "type": "formComponentRangeNumber",
          "id": "1",
          "label": "قیمت",
          "unitCaption": "تومان",
          "min": { "name": "mnp", "title": "حداقل قیمت" },
          "max": { "name": "mxp", "title": "حداکثر قیمت" }
        },
        {
          "type": "formComponentBoolean",
          "id": "a78853",
          "label": "فقط خرید امن",
          "name": "a78853"
        }
      ]
    }
  ]
}
```

#### Use Cases

- Determine valid sort modes (`n`, `pa`, `pd`, `am`)
- Discover which attribute IDs are relevant for the current search
- Populate filter UI for a scraping frontend

Sort mode `n` = newest, `pa` = price ascending, `pd` = price descending, `am` = nearest.

---

### 2.7 Compact Categories

```
GET /categories/compact
```

Returns the entire category tree (2 levels) for building navigation and query filters.

#### Response (excerpt)

```json
{
  "meta": { "version": 1788996661 },
  "links": { "self": "https://www.sheypoor.com/api/v10.0.0/categories/compact" },
  "data": [
    {
      "type": "category",
      "id": "43626",
      "name": "وسایل نقلیه",
      "slug": "vehicles",
      "meta": { "excludedFromHomePage": false },
      "children": [
        { "type": "category", "id": "43627", "name": "خودرو", "slug": "car" },
        { "type": "category", "id": "43628", "name": "موتور سیکلت", "slug": "motorcycles" }
      ]
    },
    {
      "type": "category",
      "id": "44096",
      "name": "موبایل، تبلت و لوازم",
      "slug": "mobile-tablet-accessories",
      "children": [
        { "type": "category", "id": "43597", "name": "موبایل و تبلت", "slug": "mobile-tablet" },
        { "type": "category", "id": "44006", "name": "اپل | Apple", "slug": "apple" }
      ]
    }
  ]
}
```

Cache aggressively by `meta.version`.

---

## 3. Search Page Structure (SSR / CSR)

### 3.1 Page URL Format

```
https://www.sheypoor.com/s/{citySlug}?q={query}
https://www.sheypoor.com/s/iran?q=%D8%A2%DB%8C%D9%81%D9%88%D9%86
```

Additional URL parameters observed:
- `q` — search query
- `page_num` — SSR page number (`<link rel="next" href="...&page_num=2">`)
- `r`, `ct` — region & category (used in suggestion URLs)

### 3.2 Hydration Payloads

The HTML contains **two distinct data streams**:

#### A. `<script>self.__next_f.push([1, "..."])</script>` chunks

These are Next.js RSC (React Server Components) streaming payloads. They contain:
- The dehydrated React Query cache (`$L24` state object)
- The full initial search results (`LOAD_SERP_RESULTS`)
- The filter metadata (`LOAD_SERP_FILTER`)
- The SEO block (`LOAD_SERP_SEO`)
- The category tree (`LOAD_CATEGORY_COMPACT`)

The chunk payloads are **escaped JavaScript strings**, not raw JSON. To extract them:

```python
import re, json, codecs

html = requests.get(url).text

# 1. Collect all next_f chunks
chunks = re.findall(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)', html)

# 2. Concatenate & unescape
payload = "".join(codecs.decode(c, "unicode_escape") for c in chunks)
```

Within `payload`, look for these React Query keys:
- `queryKey":["LOAD_SERP_RESULTS",{"query":{"q":"آیفون"},"slugs":"iran"}]`
- `"data":{"pages":[{"data":[...listings...], "meta":{...}}]`

#### B. `window.__DEHYDRATED__STATE__`

A compact "pointer" to the listings, useful for **identifying what's on the page** without parsing everything:

```html
<script id="serp-page-data">
  window.__DEHYDRATED__STATE__ = {
    "listings":[
      {"type":"vip","id":"467464273"},
      {"type":"vip","id":"467301575"},
      ...
    ]
  };
  window.__DEHYDRATED__STATE_ENDS=1
</script>
```

Use this as a lightweight index of what SSR rendered.

#### C. `<script type="application/ld+json">` (structured data)

Contains breadcrumb JSON-LD (only breadcrumbs, not listings). Useful for confirming page context.

### 3.3 Rendering Strategy

- **Initial page (page 1):** Rendered on the server. Listings are inlined in the RSC payload.
- **Subsequent pages:** Fetched client-side via `/search/{citySlug}?f=...&p=N` (see §2.1).
- **Infinite scroll:** Driven by `react-virtuoso`'s `data-virtuoso-scroller`. Each scroll-triggered batch appends a new `listingGroup` to the DOM.
- **Ads injection:** After every N listing groups, a `<section data-index="1">` (banner) or `<section data-index="3">` (vip vitrine) is rendered.

---

## 4. Response Schema Deep Dive

### 4.1 Listing Object (inside `listingGroup.items[]`)

```json
{
  "id": "467478625",
  "type": "normal",
  "attributes": {
    "title": "آیفون 14 پرومکس",
    "url": "https://www.sheypoor.com/v/آ-فون-14-روم-س-467478625.html",
    "categoryId": 44006,
    "timePassedLabel": "لحظاتی پیش",
    "price": [
      { "label": "", "amount": "155,000,000", "currency": "تومان" }
    ],
    "location": "بوکان",
    "images": {
      "thumbnails": {
        "round":     "https://cdn.sheypoor.com/imgs/.../190x190_af/....webp",
        "landscape": "https://cdn.sheypoor.com/imgs/.../180x131_af/....webp"
      }
    },
    "imageCount": 8,
    "videoCount": 0,
    "shopLogo": null,
    "isSecurePurchase": false,
    "bump": false,
    "telephone": "0903XXX5740",
    "hidePhoneNumber": false,
    "categories": [
      { "name": "موبایل، تبلت و لوازم", "id": "44096" },
      { "name": "موبایل و تبلت",          "id": "43597" },
      { "name": "اپل | Apple",            "id": "44006" }
    ]
  },
  "fullAttributes": [
    { "a90158": "453188", "id": "90158", "key": "وضعیت کالا", "value": "در حد نو", "type": "5" }
  ],
  "description": "...",
  "geo": null,
  "sort": [0],
  "pageNumber": 1
}
```

### 4.2 Price Variants

| Variant | JSON |
|---------|------|
| Fixed price | `[{"label":"", "amount":"155,000,000", "currency":"تومان"}]` |
| Negotiable | `[{"label":"قیمت", "amount":"توافقی", "currency":""}]` |
| Rental | `[{"label":"رهن", "amount":"100,000,000", "currency":"تومان"}, {"label":"اجاره", "amount":"17,000,000", "currency":"تومان"}]` |

### 4.3 Cursor (`f`) Format

```
[{sortMode}.{?}]{lastGroupIndex}_ {lastItemId}n_{sessionTimestamp}
```

Concrete examples:

| Request | `f` value |
|---------|-----------|
| Page 1 (from SSR) | `[20.0]_467377962n_1789837777.412637` |
| Page 2 | `[1.0, 1789848442831]_467350212n_1789836221.984277` |
| Page 4 | `[1.0, 1789848261699]_467065606n_1789836854.566702` |

- `[20.0]` — sort mode + index of the last item on the page
- `467377962` — ID of the last item
- `n` — marker for normal (non-banner) items
- `1789837777.412637` — session timestamp for cache coherence

The server returns the **next** cursor inside `meta.f` of every response.

---

## 5. Scraping Strategies

### Strategy A — Pure API (recommended)

Skip the HTML entirely and use the JSON APIs.

```python
import requests

BASE = "https://www.sheypoor.com/api/v10.0.0"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.sheypoor.com/",
}

def search_all(city="iran", q=None, max_pages=10):
    results, cursor, page = [], None, 1
    while page <= max_pages:
        params = {"p": page}
        if q: params["q"] = q
        if cursor: params["f"] = cursor

        r = requests.get(f"{BASE}/search/{city}", params=params, headers=HEADERS)
        r.raise_for_status()
        j = r.json()

        for group in j.get("data", []):
            if group.get("type") == "listingGroup":
                results.extend(group["items"])
            elif group.get("type") == "vip":
                results.extend(group.get("items", []))

        cursor = j.get("meta", {}).get("f")
        if not cursor: break
        page += 1

    return results
```

**Pros:** fast, structured, no HTML parsing.
**Cons:** breaking changes are silent — no contract.

### Strategy B — SSR HTML Extraction

Useful when:
- You need to scrape as a logged-in user with cookies
- You want the exact same content the UI shows
- You want to avoid triggering a separate rate limiter

```python
import re, json, codecs, requests

def scrape_ssr(url):
    html = requests.get(url, headers={"User-Agent": "..."}).text

    # 1. Get the RSC payload
    chunks = re.findall(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)', html)
    payload = "".join(codecs.decode(c, "unicode_escape") for c in chunks)

    # 2. Find the LOAD_SERP_RESULTS block
    m = re.search(
        r'"queryKey":\["LOAD_SERP_RESULTS".*?"data":(\{.*?"pages":\[.*?\]\})',
        payload, re.DOTALL
    )
    if not m: return None
    data = json.loads(m.group(1))

    listings = []
    for page in data["pages"]:
        for group in page["data"]:
            if group.get("type") in ("listingGroup", "vip"):
                listings.extend(group.get("items", []))

    return {
        "listings": listings,
        "meta":     data["pages"][0]["meta"],
    }
```

**Pros:** no additional API calls, matches what search engines see.
**Cons:** fragile — if Next.js changes RSC format, the regex breaks.

### Strategy C — Hybrid (recommended for production)

1. **Page 1**: fetch SSR HTML → extract listings + the `meta.f` cursor.
2. **Pages 2..N**: hit `/search/{citySlug}?f=...&p=N` directly.

This halves the request count vs. pure API (page 1 comes free with the HTML) and gives you resilience if the JSON schema ever changes.

### Strategy D — Headless Browser

Use Playwright/Puppeteer only when:
- You need to interact with filters/sort UI
- You hit a JS challenge (Sheypoor currently does not appear to have one)
- You want to screenshot or render dynamic content

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://www.sheypoor.com/s/iran?q=آیفون")
    page.wait_for_selector('[data-test-id^="ad-item-"]')

    # Auto-scroll to trigger infinite loading
    for _ in range(5):
        page.mouse.wheel(0, 5000)
        page.wait_for_timeout(1500)

    items = page.query_selector_all('[data-test-id^="ad-item-"]')
    for it in items:
        print(it.get_attribute("data-test-id"), it.get_attribute("href"))
```

**Pros:** gets exactly what the user sees.
**Cons:** slow, heavy, unnecessary given the clean APIs.

---

## 6. Pagination & Cursor Mechanics

```
┌────────────────────────────────────────────────────────────────┐
│ Page 1  ──►  SSR HTML    ──►  meta.f = "[20.0]_467377962n_..." │
│ Page 2  ──►  /search/... ──►  meta.f = "[1.0, ...]_467350212n..."│
│ Page 3  ──►  /search/... ──►  meta.f = "[1.0, ...]_467..."      │
│ ...                                                            │
│ Stop when data[] is empty OR meta.f repeats (server exhausted) │
└────────────────────────────────────────────────────────────────┘
```

**Important behaviors observed:**

1. `meta.f` is **always returned** in a fresh search response.
2. `items_per_page` is **24**, but the SSR page renders fewer visible cards (listing groups compress 6 ads per group).
3. The cursor's first bracket `[20.0]` vs `[1.0, timestamp]` distinguishes sort modes:
   - `[20.0]` — default "newest" mode, item index only.
   - `[1.0, ts]` — a stable sort key + timestamp.
4. The cursor's final segment (`_{sessionTimestamp}`) matches the initial SSR request; it should be preserved for consistency across the crawl.

---

## 7. Rate Limiting & Anti-Bot Considerations

Observed behaviors:

| Aspect | Observation |
|--------|-------------|
| IP-based throttle | Not obvious at low volume (≤1 req/sec) |
| Cloudflare | Not currently in front of the API |
| Auth | Not required for search/locations/suggestions |
| Captcha | Not encountered in the flow |
| Cookies | Not required for public pages |
| Referer check | Some CDN endpoints require `Referer: https://www.sheypoor.com/` |

**Recommended crawl settings:**

```python
import time, random
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
session.mount("https://", HTTPAdapter(max_retries=Retry(
    total=3, backoff_factor=1.5,
    status_forcelist=[429, 500, 502, 503, 504],
)))

def polite_get(url, **kw):
    time.sleep(random.uniform(0.8, 2.0))
    return session.get(url, headers=HEADERS, **kw)
```

**Best practices:**
- Send a realistic desktop User-Agent.
- Include `Accept-Language: fa-IR,fa;q=0.9,en;q=0.8`.
- Cache `/categories/compact` and `/general/locations` by their `version`.
- Prefer SSR for page 1 (fewer requests).
- Respect `meta.mxp` / `meta.mnp` — you can request a narrower price band to reduce `total` and page count.

---

## 8. Reference Implementation

### 8.1 End-to-end Scraper (Python)

```python
import re, json, codecs, time, random, requests
from typing import Iterator

BASE      = "https://www.sheypoor.com/api/v10.0.0"
SITE      = "https://www.sheypoor.com"
UA        = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36")
HEADERS   = {
    "User-Agent": UA,
    "Accept": "application/json, text/html;q=0.9",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Referer": SITE + "/",
}

session = requests.Session()
session.headers.update(HEADERS)


def get_popular_searches() -> list[dict]:
    r = session.get(f"{BASE}/search/popular-searches")
    r.raise_for_status()
    return r.json()["data"]


def get_suggestions(city_slug: str, prefix: str) -> list[dict]:
    r = session.get(f"{BASE}/search/suggestion/{city_slug}",
                    params={"q": prefix})
    r.raise_for_status()
    return r.json()["data"]


def get_locations() -> dict:
    r = session.get(f"{BASE}/general/locations")
    r.raise_for_status()
    return r.json()["data"]


def get_categories() -> dict:
    r = session.get(f"{BASE}/categories/compact")
    r.raise_for_status()
    return r.json()


def search_page(city_slug: str, q: str | None = None,
                f: str | None = None, page: int = 1) -> dict:
    params = {"p": page}
    if q: params["q"] = q
    if f: params["f"] = f
    r = session.get(f"{BASE}/search/{city_slug}", params=params)
    r.raise_for_status()
    return r.json()


def iter_listings(city_slug: str, q: str | None = None,
                  max_pages: int = 20) -> Iterator[dict]:
    cursor, page = None, 1
    while page <= max_pages:
        data = search_page(city_slug, q, cursor, page)

        for group in data.get("data", []):
            if group.get("type") == "listingGroup":
                yield from group.get("items", [])
            elif group.get("type") == "vip":
                yield from group.get("items", [])

        cursor = data.get("meta", {}).get("f")
        if not cursor:
            break
        page += 1
        time.sleep(random.uniform(0.8, 2.0))


if __name__ == "__main__":
    for item in iter_listings("iran", q="آیفون", max_pages=5):
        attrs = item["attributes"]
        print(item["id"], "|", attrs.get("title"), "|", attrs.get("price"))
```

### 8.2 SSR Extraction (Python)

```python
import re, json, codecs, requests

RSC_CHUNK = re.compile(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)')

def fetch_ssr(url: str) -> dict:
    html = requests.get(url, headers=HEADERS).text

    payload = "".join(codecs.decode(c, "unicode_escape")
                      for c in RSC_CHUNK.findall(html))

    # SSR wraps the result inside the LOAD_SERP_RESULTS query
    m = re.search(
        r'"queryKey":\["LOAD_SERP_RESULTS"[^\]]*\].*?'
        r'"data":(\{.*?"meta":\{.*?\}\})',
        payload, re.DOTALL,
    )
    if not m:
        return {"listings": [], "meta": None}

    blob = json.loads(m.group(1))
    listings = []
    for page in blob.get("pages", []):
        for group in page.get("data", []):
            if group.get("type") in ("listingGroup", "vip"):
                listings.extend(group.get("items", []))

    return {"listings": listings, "meta": blob["pages"][0].get("meta")}
```

### 8.3 Node.js (TypeScript) Example

```typescript
const BASE = "https://www.sheypoor.com/api/v10.0.0";

interface Meta {
  total: number;
  p: number;
  f: string;
  items_per_page: number;
  mnp: number;
  mxp: number;
}

async function* iterateSearch(
  city: string,
  q?: string,
  maxPages = 10,
): AsyncGenerator<any> {
  let cursor: string | undefined;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${BASE}/search/${city}`);
    url.searchParams.set("p", String(page));
    if (q) url.searchParams.set("q", q);
    if (cursor) url.searchParams.set("f", cursor);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 ...",
        "Accept": "application/json",
        "Referer": "https://www.sheypoor.com/",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      data: any[];
      meta: Meta;
    };

    for (const group of json.data) {
      if (group.type === "listingGroup") yield* group.items;
      else if (group.type === "vip") yield* group.items;
    }

    cursor = json.meta?.f;
    if (!cursor) return;
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
  }
}
```

---

## 9. Appendix: Category & Attribute Maps

### 9.1 Top-Level Category IDs (from `/categories/compact`)

| ID | Name | Slug |
|----|------|------|
| `43626` | وسایل نقلیه | `vehicles` |
| `43603` | املاک | `real-estate` |
| `43618` | استخدام | `jobs` |
| `43633` | خدمات و کسب و کار | `services` |
| `43608` | لوازم خانگی | `home` |
| `43619` | ورزش فرهنگ فراغت | `sports-games-hobbies` |
| `43596` | لوازم الکترونیکی | `electronics` |
| `43631` | صنعتی، اداری و تجاری | `industrial-commercial` |
| `44096` | موبایل، تبلت و لوازم | `mobile-tablet-accessories` |
| `43612` | لوازم شخصی | `personal-stuff` |
| `53015` | اجتماعی | `social` |

### 9.2 Sub-Category Examples

| ID | Name | Parent |
|----|------|--------|
| `43597` | موبایل و تبلت | `44096` |
| `44006` | اپل \| Apple | `43597` |
| `43604` | خرید و فروش خانه و آپارتمان | `43603` |
| `44099` | زمین و باغ | `43603` |
| `43627` | خودرو | `43626` |

### 9.3 Common Listing Attribute IDs

| Attribute ID | Key (Persian) | Meaning | Type |
|--------------|---------------|---------|------|
| `68085` | متراژ | Area (m²) | number |
| `68094` | نوع ملک | Property type | single-select |
| `68101` | سال تولید | Year (vehicles) | number |
| `68102` | کیلومتر | Mileage | number |
| `68133` | تعداد اتاق | Rooms | single-select |
| `69120` | نوع کاربری | Land use | single-select |
| `69190` | پارکینگ | Parking | yes/no |
| `69192` | انباری | Storage | yes/no |
| `69194` | آسانسور | Elevator | yes/no |
| `69317` | متراژ زمین | Land area | number |
| `90154` | وضعیت کالا | Condition (used) | single-select |
| `90157` | وضعیت کالا | Condition (industrial) | single-select |
| `90158` | وضعیت کالا | Condition (electronics) | single-select |
| `92368` | سال ساخت بنا | Building year | single-select |
| `94550` | طبقه ملک | Floor | single-select |
| `95000` | نمای ساختمان | Facade | multi-select |
| `95001` | آشپزخانه | Kitchen features | multi-select |
| `95002` | کابینت | Cabinet type | multi-select |
| `95003` | کفپوش | Flooring | multi-select |
| `95004` | سیستم گرمایشی و سرمایشی | HVAC | multi-select |
| `95007` | امکانات امنیتی | Security | multi-select |
| `95008` | سایر امکانات | Other amenities | multi-select |

---

## 10. Summary Cheat-Sheet

| Task | Endpoint |
|------|----------|
| Search listings | `GET /search/{citySlug}?q=&f=&p=` |
| Next page cursor | `meta.f` from previous response |
| Autocomplete | `GET /search/suggestion/{citySlug}?q=` |
| Trending searches | `GET /search/popular-searches` |
| Available filters | `GET /search/filters/{citySlug}?q=` |
| All provinces / cities | `GET /general/locations` |
| Full category tree | `GET /categories/compact` |
| Native ad (Yektanet) | `GET /banner/native-ad/{citySlug}?f=&p=` |
| SSR payload | Extract `self.__next_f.push([1, "..."])` |
| SSR listing index | `window.__DEHYDRATED__STATE__` |
| Sort modes | `n` (newest), `pa` (asc), `pd` (desc), `am` (nearest) |

> ⚠️ **Disclaimer:** These endpoints are reverse-engineered from observed public traffic. Sheypoor may change or remove them without notice. Scrape responsibly: respect `robots.txt`, keep request rates low, cache aggressively, and comply with Sheypoor's Terms of Service and applicable laws.