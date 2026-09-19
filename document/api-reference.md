# Sheypoor API Documentation

> Source: `api.har.json`  
> Base URL: `https://www.sheypoor.com`  
> API version observed: `v10.0.0`  
> Capture environment: Chrome on Linux, `2026-09-19`

## Endpoint Index

| Method | Endpoint | Purpose | Auth observed |
|---|---|---|---|
| `GET` | `/manifest.json` | PWA web app manifest | None |
| `POST` | `https://sentry.mielse.com/api/112/envelope/` | Third-party Sentry session/error reporting | None |
| `GET` | `/api/v10.0.0/banner/native-ad/iran` | Fetch native ad banner | None |
| `GET` | `/api/v10.0.0/general/versions` | Fetch data version timestamps | None |
| `GET` | `/api/v10.0.0/general/categories` | Fetch full category tree and attributes | None |

No `Authorization`, `X-Access-Token`, `X-Refresh-Token`, `X-Verify-Token`, or `x-ticket` headers were used in the captured requests.

---

## Common Request Headers

These headers appeared across most Sheypoor requests:

```http
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: en-US,en;q=0.9,fa;q=0.8
Referer: https://www.sheypoor.com/s/iran
sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
```

For JSON:API endpoints, Sheypoor uses:

```http
Accept: application/vnd.api+json
Content-Type: application/vnd.api+json
```

---

## Common Cookies Observed

```text
analytics_campaign
analytics_token
yektanet_session_last_activity
_ga
provinceID
province
cityID
city
geo
_ga_67M81PLT2N
neighbourhood
provinces
cities
```

These are mostly analytics, localization, and ad-personalization cookies. They are not required for basic public API access, but may affect response personalization.

---

# 1. PWA Manifest

## `GET /manifest.json`

Returns the Progressive Web App manifest for Sheypoor.

### Request

```http
GET https://www.sheypoor.com/manifest.json
Accept: */*
Referer: https://www.sheypoor.com/s/iran
sec-fetch-dest: manifest
```

Optional conditional headers observed:

```http
If-None-Match: W/"3f1-1a03d2761b8"
If-Modified-Since: Wed, 26 Aug 2026 08:19:46 GMT
```

### Response

```http
HTTP/2 200
Content-Type: application/json; charset=UTF-8
Content-Length: 427
Content-Encoding: gzip
Cache-Control: public, max-age=0
X-Cache: HIT
```

### Response Body Sample

```json
{
  "name": "Sheypoor",
  "description": "Sheypoor",
  "short_name": "Sheypoor",
  "start_url": "/?utm_source=pwa",
  "display": "standalone",
  "background_color": "#fff",
  "theme_color": "#3e7bfa",
  "gcm_sender_id": "103953800507",
  "orientation": "portrait",
  "prefer_related_applications": true,
  "related_applications": [
    {
      "platform": "play",
      "url": "https://play.google.com/store/apps/details?id=com.sheypoor.mobile",
      "id": "com.sheypoor.mobile"
    },
    {
      "platform": "itunes",
      "url": "https://itunes.apple.com/us/app/shypwr-sheypoor/id877169218?mt=8"
    }
  ],
  "permissions": ["gcm"],
  "version": "1.0",
  "icons": [
    {
      "src": "/resources/favicon/48.png?v=1",
      "sizes": "48x48",
      "type": "image/png"
    },
    {
      "src": "/resources/favicon/128.png?v=1",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/resources/favicon/192.png?v=1",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### cURL

```bash
curl -X GET 'https://www.sheypoor.com/manifest.json' \
  -H 'Accept: */*' \
  -H 'Referer: https://www.sheypoor.com/s/iran'
```

---

# 2. Sentry Envelope Reporting

## `POST https://sentry.mielse.com/api/112/envelope/`

This is a third-party Sentry endpoint used by the Sheypoor frontend for session/error reporting. It is not a Sheypoor API endpoint.

### Request

```http
POST https://sentry.mielse.com/api/112/envelope/?sentry_key=b8fb35046ea4441f96cd931320cf57c7&sentry_version=7&sentry_client=sentry.javascript.nextjs%2F8.38.0
Content-Type: text/plain;charset=UTF-8
Origin: https://www.sheypoor.com
Referer: https://www.sheypoor.com/
```

### Query Parameters

| Name | Example | Notes |
|---|---|---|
| `sentry_key` | `b8fb35046ea4441f96cd931320cf57c7` | Sentry project key |
| `sentry_version` | `7` | Sentry envelope protocol version |
| `sentry_client` | `sentry.javascript.nextjs%2F8.38.0` | Sentry client SDK |

### Request Body

Newline-delimited Sentry envelope:

```text
{"sent_at":"2026-09-19T16:40:17.897Z","sdk":{"name":"sentry.javascript.nextjs","version":"8.38.0"}}
{"type":"session"}
{"sid":"adfa705f11044f5da8874e313a1ba350","init":true,"started":"2026-09-19T16:40:17.897Z","timestamp":"2026-09-19T16:40:17.897Z","status":"ok","errors":0,"attrs":{"release":"hTYxyeCTWkN-Yv9iEw-pX","environment":"production","user_agent":"Mozilla/5.0 ..."}}
```

### Response

```http
HTTP/2 200
Content-Type: application/json
Content-Length: 2
Access-Control-Allow-Origin: *
```

```json
{}
```

### cURL

```bash
curl -X POST 'https://sentry.mielse.com/api/112/envelope/?sentry_key=b8fb35046ea4441f96cd931320cf57c7&sentry_version=7&sentry_client=sentry.javascript.nextjs%2F8.38.0' \
  -H 'Content-Type: text/plain;charset=UTF-8' \
  -H 'Origin: https://www.sheypoor.com' \
  -H 'Referer: https://www.sheypoor.com/' \
  --data-raw $'{"sent_at":"2026-09-19T16:40:17.897Z","sdk":{"name":"sentry.javascript.nextjs","version":"8.38.0"}}\n{"type":"session"}\n{"sid":"adfa705f11044f5da8874e313a1ba350","init":true,"started":"2026-09-19T16:40:17.897Z","timestamp":"2026-09-19T16:40:17.897Z","status":"ok","errors":0,"attrs":{"release":"hTYxyeCTWkN-Yv9iEw-pX","environment":"production","user_agent":"Mozilla/5.0 ..."}}'
```

---

# 3. Native Ad Banner

## `GET /api/v10.0.0/banner/native-ad/iran`

Returns a native ad banner for the Iran listing page.

### Request

```http
GET https://www.sheypoor.com/api/v10.0.0/banner/native-ad/iran?f=%5B1.0%2C%201789848195816%5D_467477691n_1789835630.512526&p=1
Accept: application/vnd.api+json
Content-Type: application/vnd.api+json
Referer: https://www.sheypoor.com/s/iran
```

### Query Parameters

| Name | Required | Example | Notes |
|---|---|---|---|
| `f` | Observed | `%5B1.0%2C%201789848195816%5D_467477691n_1789835630.512526` | URL-encoded fingerprint/tracking token. Decoded: `[1.0, 1789848195816]_467477691n_1789835630.512526` |
| `p` | Observed | `1` | Page number |

### Response

```http
HTTP/2 200
Content-Type: application/vnd.api+json
Pragma: no-cache
Cache-Control: no-cache, no-store
Expires: 0
Content-Encoding: gzip
X-Cache: MISS
```

### Response Body Structure

```json
{
  "jsonapi": {
    "version": "1.1"
  },
  "data": [
    {
      "type": "nativeAd",
      "id": "51369383",
      "attributes": {
        "name": "",
        "description": "همین حالا با احراز هویت در آبان تتر 1 میلیارد وام خرید کالا دریافت کن!",
        "link": "https://banners.sheypoor.com/banner/yektanet/link/51369383?...",
        "url": "https://banners.sheypoor.com/banner/yektanet/link/51369383?...",
        "no_follow": 0,
        "target": "_blank",
        "type": "native_ad",
        "title": "وام یک میلیاردی برای همه",
        "button_text": "احراز هویت",
        "image": "https://cdn.adivery.com/media/mobile/5d6c951f-4852-462d-96d7-08562e39785a.jpg",
        "width": 225,
        "height": 225,
        "provider": "yektanet",
        "provider_type": "external",
        "serpIndex": 23,
        "style": {
          "titleColor": "#030A17",
          "descriptionColor": "#81858B",
          "backgroundColor": "#FFFFFF"
        },
        "badge": {
          "title": "تبلیغ",
          "titleColor": "#0084FF",
          "backgroundColor": "#FFFFFF"
        }
      }
    }
  ]
}
```

### cURL

```bash
curl -X GET 'https://www.sheypoor.com/api/v10.0.0/banner/native-ad/iran?f=%5B1.0%2C%201789848195816%5D_467477691n_1789835630.512526&p=1' \
  -H 'Accept: application/vnd.api+json' \
  -H 'Content-Type: application/vnd.api+json' \
  -H 'Referer: https://www.sheypoor.com/s/iran'
```

---

# 4. General Versions

## `GET /api/v10.0.0/general/versions`

Returns version timestamps for cached data such as locations and categories.

### Request

```http
GET https://www.sheypoor.com/api/v10.0.0/general/versions
Accept: */*
Referer: https://www.sheypoor.com/s/iran
If-Modified-Since: Sat, 19 Sep 2026 08:44:09 GMT
```

### Response

```http
HTTP/2 200
Content-Type: application/json; charset=UTF-8
Content-Length: 112
Content-Encoding: gzip
Cache-Control: public, max-age=600
Last-Modified: Sat, 19 Sep 2026 16:34:49 GMT
Expires: Sat, 19 Sep 2026 16:44:49 GMT
Age: 329
X-Cache: HIT
```

### Response Body

```json
{
  "success": true,
  "message": "",
  "data": {
    "locationsData": 1789808821,
    "categoriesData": 1788950213,
    "categoriesCompactData": 1788996661
  }
}
```

### cURL

```bash
curl -X GET 'https://www.sheypoor.com/api/v10.0.0/general/versions' \
  -H 'Accept: */*' \
  -H 'Referer: https://www.sheypoor.com/s/iran'
```

---

# 5. General Categories

## `GET /api/v10.0.0/general/categories`

Returns the full Sheypoor category tree, category relationships, and included attribute definitions.

### Request

```http
GET https://www.sheypoor.com/api/v10.0.0/general/categories
Accept: */*
Referer: https://www.sheypoor.com/s/iran
```

No query parameters were observed.

### Response

```http
HTTP/2 200
Content-Type: application/vnd.api+json
Content-Length: 96056
Content-Encoding: gzip
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Last-Modified: Sat, 19 Sep 2026 08:43:31 GMT
Age: 28606
X-Cache: HIT
```

Uncompressed response size was approximately `1,825,380` bytes.

### Response Body Structure

```json
{
  "jsonapi": {
    "version": "1.1"
  },
  "meta": {
    "version": 1788950213
  },
  "links": {
    "self": "https://www.sheypoor.com/api/v10.0.0/general/categories"
  },
  "data": [
    {
      "type": "category",
      "id": "43626",
      "attributes": {
        "name": "وسایل نقلیه",
        "isTop": false,
        "excludedAttributes": [],
        "sortOptions": [
          { "optionID": 1, "title": "جدیدترین" },
          { "optionID": 2, "title": "ارزان‌ترین" },
          { "optionID": 3, "title": "گران‌ترین" },
          { "optionID": 4, "title": "نزدیک‌ترین" }
        ],
        "defaultSortOptionID": 1,
        "iconURL": "https://www.sheypoor.com/img/category-icons/appv7/VEHICLES.svg",
        "defaultImageURL": "https://www.sheypoor.com/img/placeholders/car.jpg",
        "defaultThumbnailURL": "https://www.sheypoor.com/img/placeholders/car.jpg",
        "optionalDistrictSelection": false,
        "hasImageFilter": true,
        "placeholders": {
          "title": "عنوان آگهی را بنویسید",
          "description": "توضیحات لازم را اینجا بنویسید",
          "image": "با افزودن عکس، بازدید آگهی خود را تا ۵ برابر افزایش دهید"
        },
        "viewPlace": "11111",
        "slug": "vehicles",
        "isSecurePurchase": false
      },
      "relationships": {
        "attributes": {
          "data": [
            { "type": "attribute", "id": "1" },
            { "type": "attribute", "id": "2" },
            { "type": "attribute", "id": "3" },
            { "type": "attribute", "id": "200" }
          ]
        },
        "children": {
          "data": [
            { "type": "category", "id": "43627" },
            { "type": "category", "id": "52471" }
          ]
        },
        "brands": {
          "data": []
        }
      }
    }
  ],
  "included": [
    {
      "type": "attribute",
      "id": "1",
      "attributes": {
        "title": "قیمت (تومان)",
        "order": 0,
        "index": 20,
        "isRequired": false,
        "type": 1,
        "badge": null,
        "analyticsKey": "price",
        "options": [],
        "virtualAttributes": [],
        "groupName": null,
        "dependency": [],
        "isSeparated": false,
        "isLast": false,
        "viewComponent": 1,
        "viewPlace": "01100",
        "queryKey": "p"
      }
    }
  ]
}
```

### Notes

- This is a JSON:API response.
- `data` contains category resources.
- `included` contains attribute resources referenced by categories.
- `relationships.children` contains child category IDs.
- `relationships.brands` may contain brand category IDs for vehicle-like categories.
- The response is large and contains the full category and attribute metadata for Sheypoor.

### cURL

```bash
curl -X GET 'https://www.sheypoor.com/api/v10.0.0/general/categories' \
  -H 'Accept: */*' \
  -H 'Referer: https://www.sheypoor.com/s/iran'
```

---

# JSON:API Notes

The following endpoints use JSON:API conventions:

- `GET /api/v10.0.0/banner/native-ad/iran`
- `GET /api/v10.0.0/general/categories`

Typical JSON:API response shape:

```json
{
  "jsonapi": { "version": "1.1" },
  "meta": {},
  "links": {},
  "data": [],
  "included": []
}
```

- `data`: primary resource or array of resources.
- `included`: related resources referenced by `relationships`.
- Each resource has `type`, `id`, `attributes`, and optionally `relationships`.

---

# Authentication and Access Notes

- No authentication token was observed in the HAR.
- All captured Sheypoor API endpoints appear publicly accessible.
- Cookies are sent automatically by the browser and include analytics and location preferences.
- Some endpoints may rely on `Referer`, `User-Agent`, and `Accept` headers for normal browser behavior.
- `Accept: application/vnd.api+json` is required or recommended for JSON:API endpoints.
- `GET /api/v10.0.0/general/versions` uses plain JSON, not JSON:API.
- `GET /manifest.json` is a PWA manifest, not an API.

---

# Replicating Requests

Example with a cookie jar:

```bash
curl -X GET 'https://www.sheypoor.com/api/v10.0.0/general/categories' \
  -H 'Accept: */*' \
  -H 'Referer: https://www.sheypoor.com/s/iran' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' \
  -b cookies.txt \
  -c cookies.txt
```

To reproduce the exact HAR behavior, include the observed cookies:

```text
analytics_campaign
analytics_token
yektanet_session_last_activity
_ga
provinceID
province
cityID
city
geo
_ga_67M81PLT2N
neighbourhood
provinces
cities
```

---

# Summary

The HAR file contains five network entries:

1. `GET /manifest.json` — PWA manifest.
2. `POST https://sentry.mielse.com/api/112/envelope/` — third-party Sentry reporting.
3. `GET /api/v10.0.0/banner/native-ad/iran` — native ad banner.
4. `GET /api/v10.0.0/general/versions` — data version timestamps.
5. `GET /api/v10.0.0/general/categories` — full category and attribute metadata.

The main Sheypoor API prefix observed is:

```text
https://www.sheypoor.com/api/v10.0.0/
```