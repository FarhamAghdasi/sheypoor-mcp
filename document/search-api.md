# Sheypoor API Documentation

## Overview

This document describes the undocumented JSON APIs used by [Sheypoor](https://www.sheypoor.com) (a major Iranian classifieds marketplace) for search, pagination, advertisement delivery, and location lookup. The data is consumed by the front-end via AJAX during infinite scroll.

- **Base URL:** `https://www.sheypoor.com/api/v10.0.0`
- **Format:** JSON (JSON:API 1.1 style for some endpoints)
- **Auth:** None observed for public search endpoints
- **Method:** `GET`

---

## 1. Search Endpoint

Fetches paginated listing results for a given location slug (e.g., `amol`).

```
GET /search/{citySlug}?f={cursor}&p={page}
```

### Query Parameters

| Param | Type   | Required | Description |
|-------|--------|----------|-------------|
| `f`   | string | Yes      | Cursor string for pagination. Format: `[1.0, {timestamp}]_{lastItemId}n_{sessionTimestamp}` |
| `p`   | number | Yes      | Page number (1-indexed) |

### Example Request

```
GET https://www.sheypoor.com/api/v10.0.0/search/amol?f=%5B1.0%2C%201789848442831%5D_467350212n_1789836221.984277&p=2
```

Decoded `f` value:
```
[1.0, 1789848442831]_467350212n_1789836221.984277
```

### Cursor (`f`) Format Breakdown

```
[1.0, <timestamp>]_<lastItemId>n_<sessionTimestamp>
```

| Segment | Meaning |
|---------|---------|
| `1.0` | Cursor version / sort mode |
| `<timestamp>` | Unix ms of the sort reference (last seen item) |
| `<lastItemId>` | ID of last item on the previous page (sentinel) |
| `n` | Marker for "normal" (non-banner) items |
| `<sessionTimestamp>` | Session/correlation timestamp |

The server returns a **new `f` value inside `meta.f`** that should be used for the next page request.

---

## 2. Response Schema

### Top-Level Envelope

```json
{
  "data": [ ... ],
  "extra_sections": [],
  "meta": { ... }
}
```

### `meta` Object

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total listings matching the query |
| `normal_count` | number | Count of `normal` type items |
| `p` | number | Current page number |
| `items_per_page` | number | Page size (typically 24) |
| `f` | string | Cursor to use for the next page |
| `query_id` | string\|null | Optional query identifier |
| `mnp` | number | Minimum price filter |
| `mxp` | number | Maximum price filter |
| `api_version` | string | API version (e.g., `v10.0.0`) |
| `toggles` | array | Feature flags |
| `add_style` | string | Ad style mode (`default`) |

### Item Types in `data[]`

| `type` | Description |
|--------|-------------|
| `normal` | Standard user listing |
| `paidEngagement` | Promoted/paid listing (bumped) |
| `banner` | Display ad banner |
| `nativeAd` | Native advertisement |

---

## 3. Item Object Schema

### Common Structure

```json
{
  "id": "467477564",
  "type": "normal",
  "attributes": { ... },
  "fullAttributes": [ ... ],
  "description": "string",
  "geo": { "lat": 36.47, "lon": 52.35 },
  "sort": [1, 1789847974116]
}
```

### `attributes` Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Listing title (Persian) |
| `url` | string | Canonical detail page URL |
| `categoryId` | number | Leaf category ID |
| `timePassedLabel` | string | Relative time (e.g., "ساعتی پیش") |
| `price` | array | `[{label, amount, currency}]`; `amount` may be `"توافقی"` (negotiable) |
| `priceTag` | string\|null | Optional price badge |
| `paidTags` | array | Promotional tags |
| `location` | string | Human-readable location |
| `images.thumbnails.round` | string | 190×190 thumbnail URL |
| `images.thumbnails.landscape` | string | 180×131 thumbnail URL |
| `imageCount` | number | Number of images |
| `videoCount` | number | Number of videos |
| `shopLogo` | string\|null | Seller shop logo |
| `isSecurePurchase` | boolean | Secure-purchase flag |
| `bump` | boolean | Bumped listing flag |
| `telephone` | string | Masked phone (e.g., `0912XXX7823`) |
| `hidePhoneNumber` | boolean | Whether phone is hidden |
| `categories` | array | Ancestor chain `[{name, id}]` |

### `price[]` Object

```json
{ "label": "", "amount": "4,200,000,000", "currency": "تومان" }
```

- For rentals, multiple entries appear with labels `رهن` (deposit) and `اجاره` (rent).
- When negotiable: `{ "label": "قیمت", "amount": "توافقی", "currency": "" }`.

### `fullAttributes[]` (Dynamic Schema)

Each entry is a key/value pair describing listing-specific attributes:

```json
{
  "a68085": "176",
  "id": "68085",
  "key": "متراژ",
  "value": "176",
  "type": "1",
  "mobileApiVersion": "0",
  "icon": "https://www.sheypoor.com/img/icons/attributes/pixel-grid-rectangle.webp",
  "icon_caption": "۱۷۶ متر"
}
```

- Keys prefixed with `a` (e.g., `a68085`) are the **attribute codes**.
- `type` indicates the value kind (`1` = number, `5` = single-select, `10` = multi-select, etc.).
- Multi-select attributes (e.g., amenities) appear as multiple entries sharing the same `id`/`key`.

### Common Attribute IDs

| ID | Key (Persian) | Meaning |
|----|---------------|---------|
| `68085` | متراژ | Area (m²) |
| `68094` | نوع ملک | Property type |
| `68095` | نوع ملک | Property type (commercial) |
| `68096` | نوع ملک | Property type (rental) |
| `68097` | نوع ملک | Property type (office) |
| `68101` | سال تولید | Year of manufacture (vehicles) |
| `68102` | کیلومتر | Mileage |
| `68133` | تعداد اتاق | Room count |
| `69120` | نوع کاربری | Land use |
| `69190` | پارکینگ | Parking |
| `69192` | انباری | Storage |
| `69194` | آسانسور | Elevator |
| `69317` | متراژ زمین | Land area |
| `92368` | سال ساخت بنا | Building year |
| `94550` | طبقه ملک | Floor |

### `sort` Field

- For `normal` items: `[1, <timestamp>]` — sort priority + creation timestamp.
- For `paidEngagement` items: `null` (they are pinned by the promotion engine).

---

## 4. Native Ad Endpoint

Fetches native advertisements injected between search results.

```
GET /banner/native-ad/{citySlug}?f={cursor}&p={page}
```

### Example

```
GET https://www.sheypoor.com/api/v10.0.0/banner/native-ad/amol?f=%5B1.0%2C%201789848577785%5D_467477926n_1789836854.566702&p=2
```

### Response

```json
{
  "jsonapi": { "version": "1.1" },
  "data": [
    {
      "type": "nativeAd",
      "id": "57835317",
      "attributes": {
        "title": "وام یک میلیاردی برای همه",
        "description": "همین حالا با احراز هویت در آبان تتر 1 میلیارد وام خرید کالا دریافت کن!",
        "link": "https://banners.sheypoor.com/banner/yektanet/link/...",
        "url": "https://banners.sheypoor.com/banner/yektanet/link/...",
        "no_follow": 0,
        "target": "_blank",
        "type": "native_ad",
        "button_text": "احراز هویت",
        "image": "https://cdn.adivery.com/media/mobile/....jpg",
        "width": 225,
        "height": 225,
        "provider": "yektanet",
        "provider_type": "external",
        "serpIndex": 23,
        "style": { ... },
        "badge": { "title": "تبلیغ", ... }
      }
    }
  ]
}
```

### Notes

- `provider` values observed: `yektanet`, `sheypoor` (in-house).
- `serpIndex` aligns the ad with the position in the main SERP stream.

---

## 5. Banner Items (inside search response)

Banners are also embedded directly in the search `data[]` array with `type: "banner"`:

```json
{
  "type": "banner",
  "id": "83a2ac510e2879b2",
  "attributes": {
    "link": "https://banners.sheypoor.com/banner/external/link/...",
    "image": "https://www.sheypoor.com/banner/external/image/...",
    "width": 1200,
    "height": 177,
    "provider": "sheypoor",
    "provider_type": "external",
    "serpIndex": 0,
    "badge": { "title": "تبلیغ" }
  }
}
```

---

## 6. Locations Endpoint

Returns the full province → city → district hierarchy for filtering.

```
GET /general/locations
```

### Response Shape

```json
{
  "success": true,
  "message": "",
  "data": {
    "version": 1789807335,
    "list": [
      {
        "provinceID": 8,
        "name": "تهران",
        "slug": "tehran-province",
        "cities": [
          {
            "cityID": 290,
            "name": "ارجمند",
            "slug": "arjmand",
            "isCapital": "0",
            "districts": [],
            "allowedToFilterByDistrict": false,
            "ownCity": [],
            "lat": "35.815046",
            "lon": "52.513575"
          },
          {
            "cityID": 291,
            "name": "اسلامشهر",
            "slug": "eslamshahr",
            "isCapital": "0",
            "districts": [
              {
                "districtID": 9145,
                "name": "اپرین",
                "slug": "aprin",
                "lat": "35.586616455720744",
                "lon": "51.19927490636081"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `data.version` | number | Snapshot timestamp (use for cache invalidation) |
| `data.list[]` | array | Provinces |
| `provinceID` | number | Province ID |
| `slug` | string | URL-safe slug used in `/search/{citySlug}` |
| `cities[].cityID` | number | City ID |
| `cities[].districts[]` | array | Optional sub-districts |
| `allowedToFilterByDistrict` | boolean | Whether district-level filter is enabled |
| `lat` / `lon` | string | Coordinates for map centering |

---

## 7. Pagination Flow

The front-end performs **infinite scroll** using a cursor-based pattern:

1. **Initial load** — call `/search/{city}?p=1&f=<initial>`; the server seeds `meta.f`.
2. **Scroll trigger** — read `meta.f` from last response.
3. **Next page** — `GET /search/{city}?p=N&f={meta.f}`.
4. **Repeat** until `data[]` is empty or `p * items_per_page >= total`.
5. **Ad injection** — periodically call `/banner/native-ad/{city}?f=...&p=...` (or rely on embedded `banner` / `nativeAd` items in the main stream).

### Observed Cursor Progression

| Request | `f` value |
|---------|-----------|
| Page 2 | `[1.0, 1789848442831]_467350212n_1789836221.984277` |
| Page 4 | `[1.0, 1789848261699]_467065606n_1789836854.566702` |

The `<lastItemId>` segment advances with each page, allowing the backend to resume from a stable sort key.

---

## 8. Error & Edge Cases

| Situation | Behavior |
|-----------|----------|
| Last page | `data` is empty or shorter than `items_per_page` |
| Negotiable price | `price[0].amount === "توافقی"` |
| No phone | `telephone` is masked; `hidePhoneNumber: true` |
| Missing geo | `geo: null` (common for non-property categories) |
| Multi-value attribute | Repeated entries in `fullAttributes[]` with same `id` |
| Paid listing | `type: "paidEngagement"`, `sort: null` |

---

## 9. Category IDs (Observed)

| Category ID | Name (Persian) | Meaning |
|-------------|----------------|---------|
| `43603` | املاک | Real Estate (root) |
| `43604` | خرید و فروش خانه و آپارتمان | Buy/Sell Homes & Apartments |
| `43605` | خرید و فروش اداری، تجاری و صنعتی | Commercial/Industrial |
| `43606` | رهن و اجاره خانه و آپارتمان | Rentals |
| `43607` | رهن و اجاره اداری، تجاری و صنعتی | Commercial Rentals |
| `43608` | لوازم خانگی | Home Appliances |
| `43610` | ظروف و لوازم آشپزخانه | Kitchenware |
| `43612` | لوازم شخصی | Personal Items |
| `43619` | ورزش فرهنگ فراغت | Sports & Leisure |
| `43626` | وسایل نقلیه | Vehicles |
| `43627` | خودرو | Cars |
| `43628` | موتور سیکلت | Motorcycles |
| `43631` | صنعتی، اداری و تجاری | Industrial/Office/Commercial |
| `43633` | خدمات و کسب و کار | Services & Business |
| `43636` | خودرو کلاسیک | Classic Cars |
| `44006` | اپل \| Apple | Apple |
| `44096` | موبایل، تبلت و لوازم | Mobile/Tablet |
| `44099` | زمین و باغ | Land & Garden |
| `44103` | نظافت و خدمات منزل | Cleaning Services |
| `44105` | اسباب کشی و حمل و نقل | Moving & Transport |
| `44110` | دوچرخه، اسکیت و اسکوتر | Bikes & Scooters |
| `44111` | سایر لوازم خانه و حیاط | Other Home Items |
| `44112` | سایر لوازم شخصی | Other Personal Items |
| `44113` | اشیای کلکسیونی و قدیمی | Collectibles |
| `44220` | لوازم سرمایش و گرمایش | HVAC |
| `44222` | وسایل برقی خانه و آشپزخانه | Home Appliances |
| `44586` | خرید و فروش ویلا | Villa Sales |
| `44802` | تجهیزات کافی‌شاپ و رستوران | Café/Restaurant Equipment |
| `44807` | سایر تجهیزات صنعتی و تجاری | Other Industrial Equipment |
| `45001` | پیش فروش و مشارکت در ساخت | Pre-sale / Partnership |
| `50001` | ماشین لباسشویی | Washing Machines |
| `50002` | ماشین ظرفشویی | Dishwashers |
| `50014` | سایر | Other (HVAC) |
| `50505` | پیکان | Paykan (classic) |
| `52577` | حیوانات مزرعه | Farm Animals |
| `52773` | دلتا (شاهین موتور) | Delta Motorcycles |

---

## 10. Summary

The Sheypoor front-end uses a **cursor-paginated search API** with three auxiliary endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/search/{city}` | Paginated listing results |
| `/banner/native-ad/{city}` | Native ad injection |
| `/general/locations` | Province/city/district hierarchy |

Key design characteristics:

- **Cursor-based pagination** via the opaque `f` parameter, allowing stable infinite scroll without offset drift.
- **Heterogeneous item stream** — `normal`, `paidEngagement`, `banner`, and `nativeAd` items are interleaved in a single array.
- **Dynamic attribute schema** — listing-specific fields are described by `fullAttributes[]` with numeric attribute IDs.
- **Masked PII** — phone numbers are partially masked server-side.
- **No authentication** required for public search/locations.

> ⚠️ **Disclaimer:** These endpoints are undocumented and reverse-engineered from observed traffic. They may change without notice, and their use should respect Sheypoor's Terms of Service and applicable laws.