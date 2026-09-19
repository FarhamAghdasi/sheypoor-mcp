# Sheypoor Product Detail Page & API Documentation

> Complete reference for scraping Sheypoor listing detail pages (`/v/{slug}-{id}.html`), including the RSC stream, click-tracking endpoint, image CDN variants, and the underlying listing API.

---

## Table of Contents

1. [Overview](#1-overview)
2. [URL Patterns](#2-url-patterns)
3. [Endpoints Reference](#3-endpoints-reference)
   - 3.1 [Listing Detail API](#31-listing-detail-api)
   - 3.2 [RSC Stream (`?_rsc=`)](#32-rsc-stream-_rsc)
   - 3.3 [Click Tracking (`/api/proxy/searchia`)](#33-click-tracking-apiproxysearchia)
   - 3.4 [Related Queries (React Query keys)](#34-related-queries-react-query-keys)
4. [Page Structure (SSR + RSC)](#4-page-structure-ssr--rsc)
5. [Response Schema: `publicListingDetails`](#5-response-schema-publiclistingdetails)
6. [Image CDN Variants](#6-image-cdn-variants)
7. [Structured Data (JSON-LD)](#7-structured-data-json-ld)
8. [Scraping Strategies](#8-scraping-strategies)
9. [Reference Implementation](#9-reference-implementation)
10. [Appendix: Attributes & Image Sizes](#10-appendix-attributes--image-sizes)

---

## 1. Overview

Every Sheypoor listing has a **canonical detail page** at:

```
https://www.sheypoor.com/v/{slugified-title}-{listingId}.html
```

The page is rendered by Next.js App Router using a **dynamic route** `app/v/[slug]/page.tsx`. Data flow:

```
Browser ─► SSR HTML (has data inlined in self.__next_f.push)
        │
        ├─► RSC stream (? _rsc=hash)       ← used for client-side navigation
        │
        └─► /api/v10.0.0/listings/{id}     ← canonical JSON API (referenced in links.self)
```

| Property | Value |
|----------|-------|
| Route | `/v/[slug]/page` |
| API Base | `https://www.sheypoor.com/api/v10.0.0` |
| Canonical API | `GET /listings/{id}` |
| RSC Endpoint | `GET /v/{slug}.html?_rsc={hash}` |
| Rendering | SSR + React Query hydration |
| Auth | None for public listings |

---

## 2. URL Patterns

### 2.1 Detail Page

```
https://www.sheypoor.com/v/{slug}-{listingId}.html
```

Example:
```
https://www.sheypoor.com/v/ایفون-11-12-13-اقساطی-50-پیش-پرداخت-2-الی-12-ماهه-467065709.html
```

**Extracting `listingId`:**
```python
import re
from urllib.parse import unquote

def extract_listing_id(url: str) -> str | None:
    path = unquote(url.split("?")[0])
    m = re.search(r"-(\d+)\.html$", path)
    return m.group(1) if m else None

# → "467065709"
```

### 2.2 Canonical URL

The `<link rel="canonical">` and `og:url` meta tags point to the **clean, unencoded** version of the URL — use them as the source of truth.

### 2.3 RSC URL

Same path but with a cache-busting `_rsc` query parameter:

```
https://www.sheypoor.com/v/{slug}-{id}.html?_rsc=g2j0f
```

The `_rsc` value is a short opaque hash that varies per request; the server treats it as a stream request and returns the RSC payload instead of the HTML document.

---

## 3. Endpoints Reference

### 3.1 Listing Detail API

The canonical JSON API for a listing. It is **referenced inside the SSR state** under `links.self`:

```
GET /api/v10.0.0/listings/{listingId}
```

#### Response Shape

```json
{
  "meta": {
    "seo": {
      "title": "...",
      "description": "...",
      "h1": "...",
      "links": [],
      "meta": [{ "name": "image", "content": "https://..." }],
      "schema": [ { "@context": "http://schema.org", "@type": "Product", ... } ]
    }
  },
  "links": {
    "self": "https://www.sheypoor.com/api/v10.0.0/listings/467065709"
  },
  "data": { /* publicListingDetails object — see §5 */ }
}
```

> The same object appears embedded in the SSR RSC payload under the React Query key `LOAD_LISTING`.

---

### 3.2 RSC Stream (`?_rsc=`)

Next.js App Router streams the server component tree as escaped JavaScript chunks. Requesting the page with `?_rsc=hash` returns only the stream (no HTML document), which is smaller and easier to parse.

```
GET /v/{slug}-{id}.html?_rsc={hash}
```

#### Payload Structure

The response body is a sequence of:

```
{N}:HL[...]                 ← preloaded assets
{N}:I[moduleId,[...],"..."] ← client component references
{N}:T{hex-length},{json}    ← text chunks (RSC nodes)
{N}:["$","div",null,{...}]  ← React element tree
```

The **hydrated React Query cache** lives inside a top-level chunk (`0:` or a deferred chunk) and contains entries like:

```json
{
  "state": {
    "data": {
      "meta": { "seo": {...} },
      "links": { "self": "https://www.sheypoor.com/api/v10.0.0/listings/467065709" },
      "data": { /* publicListingDetails */ }
    },
    "queryKey": ["LOAD_LISTING", "467065709"],
    "queryHash": "[\"LOAD_LISTING\",\"467065709\"]"
  }
}
```

#### Extracting the Listing from RSC

```python
import re, json, codecs

RSC_CHUNK = re.compile(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)')

def extract_listing_from_rsc(html: str) -> dict | None:
    payload = "".join(codecs.decode(c, "unicode_escape")
                      for c in RSC_CHUNK.findall(html))

    m = re.search(
        r'"queryKey":\["LOAD_LISTING",\s*"\d+"\].*?'
        r'"data":(\{.*?"links":\{.*?"data":\{.*?\}\}\})',
        payload, re.DOTALL,
    )
    if not m:
        return None
    blob = json.loads(m.group(1))
    return blob["data"]
```

> **Note:** The regex must be tolerant of nested braces. In practice, prefer parsing the JSON with a balanced-brace scanner rather than a naive regex.

---

### 3.3 Click Tracking (`/api/proxy/searchia`)

A **fire-and-forget** analytics endpoint invoked when a user clicks a listing from the SERP. It records a click against the query ID returned by the search endpoint (`meta.query_id`) and the listing's SERP position.

```
GET /api/proxy/searchia?queryId={queryId}&id={listingId}&position={position}
```

| Param | Type | Source |
|-------|------|--------|
| `queryId` | string | `meta.query_id` from the search response |
| `id` | string | Listing ID |
| `position` | number | Zero-based index in the SERP |

#### Response

```json
{
  "statusType": "SUCCESS",
  "details": null,
  "entity": null,
  "path": "/api/clickWithQueryId/index/listings/doc/467065709"
}
```

`path` indicates the backend route (Elasticsearch-style document lookup) that was recorded.

**Scraping implication:** Do **not** call this endpoint unless you are simulating real user clicks. It exists purely for analytics and may be rate-limited or abused for tracking.

---

### 3.4 Related Queries (React Query keys)

When opening a listing page, the client fetches **several related datasets** in parallel. These appear as separate entries in the dehydrated state:

| Query Key | Purpose | Underlying API (inferred) |
|-----------|---------|---------------------------|
| `["LOAD_LISTING", "<id>"]` | Main listing detail | `/api/v10.0.0/listings/{id}` |
| `["LOAD_RELATED_SHOP", "<id>"]` | Shop the listing belongs to | `/api/v10.0.0/listings/{id}/related-shop` |
| `["LOAD_RELATED_LISTINGS", "<id>"]` | Similar ads (up to 6) | `/api/v10.0.0/listings/{id}/related-listings` |
| `["LOAD_SHOP_RELATED_LISTINGS", "<id>"]` | Other ads by the same shop | `/api/v10.0.0/listings/{id}/shop-related-listings` |
| `["LOAD_NORTH_INVESTMENT", "<id>"]` | North-region investment projects (real-estate only) | `/api/v10.0.0/listings/{id}/north-investment` |
| `["LOAD_CATEGORY_COMPACT"]` | Category tree (cached globally) | `/api/v10.0.0/categories/compact` |

These paths are **inferred** from the query key names and are not guaranteed. The safest way to capture their payloads is to parse the dehydrated state from the SSR HTML/RSC stream (see §8).

---

## 4. Page Structure (SSR + RSC)

### 4.1 SSR HTML

The HTML document includes:

1. **`<script type="application/ld+json">`** — full schema.org markup:
   - `Product` (with `offers`, `brand`, `seller`, `image`)
   - `ItemPage`
   - `BreadcrumbList`
2. **`<script>self.__next_f.push(...)</script>`** — RSC chunks (see §3.2)
3. **`<script id="listing-detail-data">`** — a small pointer:
   ```js
   window.__DEHYDRATED_STATE__ = {
     "id": "467065709",
     "type": "publicListingDetails",
     "url": "https://www.sheypoor.com/v/...-467065709.html",
     "banners": []
   };
   ```
4. **Preloaded images** — `<link rel="preload" as="image">` for above-the-fold assets.

### 4.2 RSC-Only Response

Requesting the same URL with `?_rsc=hash` returns **only** the chunk stream, no HTML shell. This is what the client fetches during soft navigation.

### 4.3 Image Slider

The slider container has `data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"` — meaning the actual `<img>` tags are hydrated on the client. To scrape the images server-side, use the `images[]` array in the `publicListingDetails` object (in RSC), not the DOM.

---

## 5. Response Schema: `publicListingDetails`

The main payload. Persist this object as the "source of truth" for a listing.

```json
{
  "type": "publicListingDetails",
  "id": "467065709",
  "title": "ایفون 11/12/13 اقساطی (50% پیش پرداخت 2 الی 12 ماهه)",
  "url": "https://www.sheypoor.com/v/...-467065709.html",
  "timePassedLabel": "ساعاتی پیش",
  "imageCount": 1,
  "videoCount": 0,
  "breadcrumbs": [
    { "title": "مازندران", "url": "/s/mazandaran", "type": "region" },
    { "title": "چالوس", "url": "/s/chalus", "type": "city" },
    { "title": "موبایل، تبلت و لوازم", "url": "...", "type": "category", "subType": 1 },
    { "title": "موبایل و تبلت", "url": "...", "type": "category", "subType": 2 },
    { "title": "اپل | Apple", "url": "...", "type": "category", "subType": 3 },
    { "title": "مرکز شهر", "url": "...", "type": "neighbourhood" }
  ],
  "seller": {
    "url": "digitalcenter2",
    "name": "دیجیتال سنتر معین فرجی2",
    "registeredAt": "عضو شیپور از شهریور ۱۴۰۵",
    "image": "https://www.sheypoor.com/image/8fca4b/500x0_S/shop_photos/74021/Image.webp?1786209484",
    "rates": { "count": 84, "commentCount": 83, "score": 3.61 },
    "hasReviews": true,
    "callbackUrl": null,
    "listingCount": null,
    "invoiceCount": null
  },
  "hideContactInfo": false,
  "consultant": null,
  "isSecurable": false,
  "labels": [],
  "resumeJobRequester": null,
  "carInspection": { "summary": null, "certify": null },
  "topCategoryId": 44096,
  "categoryId": 44006,
  "price": [{ "label": "قیمت", "amount": "توافقی" }],
  "deliveryPrices": null,
  "description": " ** دیجی سنتر معین فرجی**\n\nاگر قصد خرید **موبایل...",
  "location": "مازندران، چالوس، مرکز شهر",
  "images": [
    {
      "source": {
        "mobile": "https://cdn.sheypoor.com/imgs/.../1500x1125_Sw/....webp",
        "desktop": "https://cdn.sheypoor.com/imgs/.../1500x936_Sw/....webp"
      },
      "title": "...-عکس1",
      "alt": "...-عکس1"
    }
  ],
  "videos": [],
  "phone": "0911XXX1008",
  "isPhoneVerified": false,
  "isShopProfile": true,
  "isSecurePurchase": false,
  "showInsertRateButton": false,
  "paidTags": [],
  "actions": ["chat", "call", "sms"],
  "hideChat": false,
  "attributes": [
    {
      "a90158": "453188",
      "id": "90158",
      "key": "وضعیت کالا",
      "value": "در حد نو",
      "type": "5",
      "mobileApiVersion": "0",
      "icon": null,
      "icon_caption": "در حد نو"
    }
  ],
  "showAttributesIcon": false,
  "marketingBanner": null,
  "certificate": null,
  "position": null,
  "approximatePosition": false,
  "ministryInquiry": null,
  "addOn": false,
  "priceRange": null,
  "showPriceRangeFeedback": false,
  "securePurchaseToman": false,
  "externalActions": [],
  "securePurchaseTomanButtonText": "پرداخت",
  "noteSectionEnabled": true,
  "addedAt": "2026-09-06 18:45:02.4746",
  "specificationSummary": null,
  "idParent": "43597",
  "landings": [
    { "id": 8875, "path": "/آیفون-11", "legacyPath": null, "anchorTitle": "آیفون 11" }
  ]
}
```

### 5.1 Key Fields

| Field | Meaning |
|-------|---------|
| `id` | Listing ID (numeric string) |
| `url` | Canonical detail URL |
| `timePassedLabel` | Human-readable age (Persian) |
| `breadcrumbs[]` | Region → city → categories → neighbourhood chain |
| `seller` | Shop info; `url` is the shop slug (`/shop/{url}`) |
| `isShopProfile` | Whether the seller is a registered shop |
| `price[]` | `label` + `amount` (`"توافقی"` = negotiable, no `currency` then) |
| `description` | Markdown-ish text with inline `<span>` HTML for phone reveal |
| `images[].source.mobile` | 4:3 mobile image (1500×1125) |
| `images[].source.desktop` | 16:10 desktop image (1500×936) |
| `phone` | Masked phone (middle digits replaced by `XXX`) |
| `attributes[]` | Listing-specific attributes (same schema as search) |
| `actions[]` | Allowed CTA modes: `chat`, `call`, `sms` |
| `addedAt` | Server time (ISO-ish, local timezone) |
| `landings[]` | SEO landing pages linked to the listing |

### 5.2 Price Object

```json
{ "label": "قیمت", "amount": "توافقی" }
```
or
```json
{ "label": "", "amount": "155,000,000", "currency": "تومان" }
```

Rental listings may have up to 2 entries (`رهن` + `اجاره`).

---

## 6. Image CDN Variants

All listing images live on `cdn.sheypoor.com`. The path encodes the transformation:

```
/imgs/{YYYY}/{MM}/{DD}/{listingId}/{WxH}_{suffix}/{listingId}_{hash}.webp
```

| Size | Suffix | Typical Use |
|------|--------|-------------|
| 1500×1125 | `_Sw` | Mobile full-screen slider (4:3) |
| 1500×936 | `_Sw` | Desktop full-screen slider (16:10) |
| 666×420 | `_S` | Structured-data `Product` image |
| 220×165 | `_S` | `<meta name="image">` (OpenGraph preview) |
| 324×240 | `_Sa` | Similar-listings thumbnail |
| 225×225 | `_af` | Round thumbnail (related) |
| 225×162 | `_af` | Landscape thumbnail (related) |
| 190×190 | `_af` | Search result round |
| 180×131 | `_af` | Search result landscape |

**You can usually substitute any `WxH_suffix` combination** for a given hash — the CDN generates on the fly. For scraping, prefer the largest (`1500x1125_Sw`) for archival.

---

## 7. Structured Data (JSON-LD)

The SSR HTML contains **two** JSON-LD blocks:

### 7.1 Product / ItemPage

```json
{
  "@context": "http://schema.org",
  "@type": "Product",
  "@id": "https://www.sheypoor.com/v/...-467065709.html#Thing",
  "name": "...",
  "url": "...",
  "image": [{ "@type": "ImageObject", "contentUrl": "https://cdn.sheypoor.com/.../666x420_S/....webp" }],
  "description": "...",
  "category": "موبایل و تبلت",
  "brand": { "@type": "Brand", "name": "اپل | Apple" },
  "seller": { "@type": "Organization", "name": "دیجیتال سنتر معین فرجی2" },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "IRR",
    "Price": 0,
    "availability": "https://schema.org/InStock",
    "sku": "467065709",
    "mainEntityOfPage": "https://www.sheypoor.com/s/chalus/city-center/mobile-tablet/apple"
  }
}
```

> `Price: 0` is returned when the price is negotiable. Use the `price[]` field in `publicListingDetails` for the truth.

### 7.2 BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "مازندران", "item": "https://www.sheypoor.com/s/mazandaran" },
    ...
  ]
}
```

**Use case:** JSON-LD is **easy to parse without regex**, stable, and present in the SSR HTML. It's an excellent fallback for extracting: title, seller, brand, category, price (if not negotiable), and breadcrumbs.

---

## 8. Scraping Strategies

### Strategy A — Canonical JSON API (recommended)

If you already know the `listingId`, this is the fastest route:

```python
import requests

BASE = "https://www.sheypoor.com/api/v10.0.0"

def get_listing(listing_id: str) -> dict:
    r = requests.get(f"{BASE}/listings/{listing_id}", headers=HEADERS)
    r.raise_for_status()
    return r.json()["data"]
```

**Pros:** structured, no HTML parsing, fastest.
**Cons:** undocumented; may require the same session/cookies as the page.

### Strategy B — SSR HTML + RSC Extraction

Fetch the HTML page, then parse the `self.__next_f.push` chunks (see §3.2). Prefer this when:

- You need the SSR-embedded `publicListingDetails` exactly as the server rendered it
- You want to capture the initial slider state and preloaded assets
- The JSON API isn't reachable

```python
import re, json, codecs, requests
from urllib.parse import unquote

def scrape_listing_html(url: str) -> dict:
    html = requests.get(url, headers=HEADERS).text

    # 1. RSC chunks
    payload = "".join(
        codecs.decode(c, "unicode_escape")
        for c in re.findall(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)', html)
    )

    # 2. Locate the LOAD_LISTING entry
    m = re.search(r'"queryKey":\["LOAD_LISTING",\s*"\d+"\]', payload)
    if not m:
        raise ValueError("listing not found in RSC payload")

    # 3. Scan forward from `m.end()` to find the balanced `data` object
    start = payload.find('"data":', m.end())
    listing = _extract_balanced_json(payload, start + len('"data":'))
    return listing


def _extract_balanced_json(s: str, i: int) -> dict:
    """Extract a balanced-brace JSON object starting at s[i]."""
    depth, in_str, esc = 0, False, False
    start = i
    for j in range(i, len(s)):
        ch = s[j]
        if in_str:
            if esc:      esc = False
            elif ch == "\\": esc = True
            elif ch == '"':  in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[start:j+1])
    raise ValueError("unbalanced JSON")
```

**Pros:** matches exactly what search engines see.
**Cons:** fragile if Next.js changes its streaming format.

### Strategy C — RSC Stream Only (`?_rsc=hash`)

Fetch `GET /v/{slug}.html?_rsc=<random>` and parse the same chunks. Smaller payload than the full HTML, but you must set the correct `Accept`/`RSC` headers (Next.js expects `RSC: 1`).

```python
def get_rsc(url: str) -> str:
    r = requests.get(url, headers={
        **HEADERS,
        "RSC": "1",
        "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22...",
    })
    return r.text
```

> In practice, the full HTML page is easier to scrape than the raw RSC stream because it doesn't require the `Next-Router-State-Tree` header.

### Strategy D — JSON-LD Only

If you only need `title`, `seller`, `brand`, `category`, `breadcrumbs`, and `og:image`, skip the RSC entirely and extract the two JSON-LD blocks:

```python
import json, re, requests

def scrape_ld_only(url: str) -> dict:
    html = requests.get(url, headers=HEADERS).text
    blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        html, re.DOTALL,
    )
    for raw in blocks:
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if doc.get("@type") in ("Product", "ItemPage"):
            return doc
    return {}
```

**Pros:** trivial, stable, works even if RSC format changes.
**Cons:** loses `phone`, `actions`, `images[]` array (only 1 image), and detailed attributes.

### Strategy E — Hybrid (best for production)

1. Fetch SSR HTML once.
2. Extract `publicListingDetails` from the RSC payload (Strategy B).
3. If parsing fails, fall back to JSON-LD (Strategy D).
4. In parallel, call `/api/v10.0.0/listings/{id}` for a canonical JSON snapshot to store.

---

## 9. Reference Implementation

### 9.1 Python — Full Listing Scraper

```python
import re, json, codecs, time, random, requests
from urllib.parse import unquote

BASE    = "https://www.sheypoor.com/api/v10.0.0"
SITE    = "https://www.sheypoor.com"
UA      = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Referer": SITE + "/",
}

session = requests.Session()
session.headers.update(HEADERS)

RSC_CHUNK = re.compile(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)')


def extract_listing_id(url: str) -> str | None:
    m = re.search(r"-(\d+)\.html", unquote(url))
    return m.group(1) if m else None


def _balanced_json(s: str, i: int) -> dict:
    depth, in_str, esc, start = 0, False, False, i
    for j in range(i, len(s)):
        ch = s[j]
        if in_str:
            if esc:        esc = False
            elif ch == "\\": esc = True
            elif ch == '"':  in_str = False
            continue
        if ch == '"':       in_str = True
        elif ch == "{":     depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[start:j+1])
    raise ValueError("unbalanced JSON")


def parse_rsc_listing(html: str) -> dict | None:
    payload = "".join(
        codecs.decode(c, "unicode_escape")
        for c in RSC_CHUNK.findall(html)
    )
    m = re.search(r'"queryKey":\["LOAD_LISTING",\s*"\d+"\]', payload)
    if not m:
        return None
    start = payload.find('"data":', m.end())
    if start == -1:
        return None
    return _balanced_json(payload, start + len('"data":'))


def parse_jsonld(html: str) -> dict:
    for raw in re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        html, re.DOTALL,
    ):
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if doc.get("@type") in ("Product", "ItemPage"):
            return doc
    return {}


def scrape_listing(url: str) -> dict:
    r = session.get(url, timeout=20)
    r.raise_for_status()
    html = r.text

    listing = parse_rsc_listing(html)
    ld      = parse_jsonld(html)

    return {
        "id":         extract_listing_id(url),
        "listing":    listing,
        "jsonld":     ld,
        "images":     _collect_image_urls(listing, ld),
        "seller":     (listing or {}).get("seller"),
        "attributes": (listing or {}).get("attributes", []),
        "phone":      (listing or {}).get("phone"),
        "price":      (listing or {}).get("price"),
    }


def _collect_image_urls(listing: dict | None, ld: dict) -> list[str]:
    urls = set()
    for img in (listing or {}).get("images", []):
        src = (img.get("source") or {})
        for k in ("mobile", "desktop"):
            if src.get(k):
                urls.add(src[k])
    for img in ld.get("image", []) or []:
        if isinstance(img, dict) and img.get("contentUrl"):
            urls.add(img["contentUrl"])
    return sorted(urls)


if __name__ == "__main__":
    url = ("https://www.sheypoor.com/v/"
           "%D8%A7-%D9%81%D9%88%D9%86-11-12-13-%D8%A7%D9%82%D8%B3%D8%A7%D8%B7-50-"
           "%D8%B4-%D8%B1%D8%AF%D8%A7%D8%AE%D8%AA-2-%D8%A7%D9%84-12-%D9%85%D8%A7%D9%87%D9%87-"
           "467065709.html")
    data = scrape_listing(url)
    print(json.dumps({
        "id":      data["id"],
        "title":   (data["listing"] or {}).get("title"),
        "seller":  (data["seller"] or {}).get("name"),
        "phone":   data["phone"],
        "price":   data["price"],
        "images":  len(data["images"]),
    }, ensure_ascii=False, indent=2))
```

### 9.2 Node.js / TypeScript

```typescript
import * as cheerio from "cheerio";

const RSC_CHUNK = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g;

function unescapeRscChunk(chunk: string): string {
  return JSON.parse(`"${chunk}"`);
}

function balancedJson(s: string, i: number): unknown {
  let depth = 0, inStr = false, esc = false, start = i;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, j + 1));
    }
  }
  throw new Error("unbalanced JSON");
}

async function fetchListing(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ...",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "fa-IR,fa;q=0.9",
      "Referer": "https://www.sheypoor.com/",
    },
  });
  const html = await res.text();

  // 1. Reconstruct the RSC payload
  let payload = "";
  for (const m of html.matchAll(RSC_CHUNK)) {
    payload += unescapeRscChunk(m[1]);
  }

  // 2. Find LOAD_LISTING
  const keyMatch = payload.match(/"queryKey":\["LOAD_LISTING",\s*"\d+"\]/);
  if (!keyMatch) throw new Error("no LOAD_LISTING");
  const dataIdx = payload.indexOf('"data":', keyMatch.index);
  const listing = balancedJson(payload, dataIdx + '"data":'.length);

  // 3. JSON-LD fallback
  const $ = cheerio.load(html);
  const ld = $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => {
      try { return JSON.parse($(el).text()); } catch { return null; }
    })
    .filter((d) => d && (d["@type"] === "Product" || d["@type"] === "ItemPage"));

  return { listing, ld };
}
```

---

## 10. Appendix: Attributes & Image Sizes

### 10.1 Common `attributes[]` in Listing Detail

The listing's `attributes[]` array uses the same schema as the search `fullAttributes[]` (see the search doc). Common IDs observed:

| ID | Key | Meaning | Example |
|----|-----|---------|---------|
| `68085` | متراژ | Area (m²) | `"176"` |
| `68094` | نوع ملک | Property type | `"آپارتمان"` |
| `68101` | سال تولید | Year (vehicle) | `"1400"` |
| `68102` | کیلومتر | Mileage | `"50000"` |
| `68133` | تعداد اتاق | Rooms | `"2"` |
| `69120` | نوع کاربری | Land use | `"مسکونی"` |
| `69190` | پارکینگ | Parking | `"دارد"` |
| `69192` | انباری | Storage | `"دارد"` |
| `69194` | آسانسور | Elevator | `"ندارد"` |
| `90153` | وضعیت کالا (home) | Condition | `"نو"` |
| `90154` | وضعیت کالا (industrial) | Condition | `"در حد نو"` |
| `90158` | وضعیت کالا (electronics) | Condition | `"در حد نو"` |
| `92368` | سال ساخت بنا | Building year | `"1404"` |
| `94550` | طبقه ملک | Floor | `"4"` |
| `95000` | نمای ساختمان | Facade | `"سنگی"` |
| `95001` | آشپزخانه | Kitchen | `"اپن"` |
| `95002` | کابینت | Cabinets | `"MDF"` |
| `95003` | کفپوش | Flooring | `"سرامیک"` |
| `95004` | گرمایشی/سرمایشی | HVAC | `"پکیج"` |
| `95007` | امکانات امنیتی | Security | `"درب ضد سرقت"` |
| `95008` | سایر امکانات | Other | `"کمد دیواری"` |

### 10.2 Actions (`actions[]`)

| Value | Meaning |
|-------|---------|
| `chat` | In-app chat allowed |
| `call` | Phone call allowed |
| `sms` | SMS allowed |

### 10.3 Seller Rating

```json
"rates": {
  "count": 84,          // total ratings
  "commentCount": 83,   // written reviews
  "score": 3.61         // out of 5
}
```

### 10.4 Click-Tracking Flow

```
1. SERP response returns meta.query_id = "921090F3F2AA1FD0"
2. User clicks listing 467065709 at position 19
3. Client fires:
   GET /api/proxy/searchia?queryId=921090F3F2AA1FD0&id=467065709&position=19
4. Server responds:
   { "statusType": "SUCCESS", "path": "/api/clickWithQueryId/index/listings/doc/467065709" }
5. Client navigates to /v/{slug}-467065709.html?_rsc=<hash>
```

---

## 11. Cheat Sheet

| Task | Endpoint / Method |
|------|-------------------|
| Get listing by ID | `GET /api/v10.0.0/listings/{id}` |
| Get listing via SSR | Fetch page HTML → parse `self.__next_f.push` chunks |
| Get listing via RSC | `GET /v/{slug}.html?_rsc={hash}` + `RSC: 1` header |
| Extract JSON-LD | `<script type="application/ld+json">` in HTML |
| Listing ID from URL | Regex `-(\d+)\.html$` on path |
| Get shop info | `seller.url` → `https://www.sheypoor.com/shop/{url}` |
| Full-size image | Replace `{WxH}_{suffix}` with `1500x1125_Sw` in image URL |
| Track click (analytics) | `GET /api/proxy/searchia?queryId=&id=&position=` |
| Related listings | Parse `LOAD_RELATED_LISTINGS` from dehydrated state |
| Related shop | Parse `LOAD_RELATED_SHOP` from dehydrated state |

> ⚠️ **Disclaimer:** These endpoints are reverse-engineered from observed traffic. Sheypoor may change them without notice. Scrape responsibly: respect `robots.txt`, throttle requests, cache listings you've already fetched, and do not invoke `/api/proxy/searchia` unless you are simulating genuine user clicks (it is an analytics endpoint).