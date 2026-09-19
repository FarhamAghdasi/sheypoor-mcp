# Sheypoor User Account Pages & APIs — Documentation

> Complete reference for the authenticated `/session/*` area: my listings, my packages, buyer/seller orders, payments, and wallets. Covers the RSC-based navigation, the REST APIs behind each page, and the legacy `__ENV_STATE__` bundle.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Route Map](#2-route-map)
3. [RSC Navigation Format](#3-rsc-navigation-format)
4. [My Listings](#4-my-listings)
5. [My Packages](#5-my-packages)
6. [Buyer Orders](#6-buyer-orders)
7. [Seller Orders](#7-seller-orders)
8. [Payments](#8-payments)
9. [Wallets](#9-wallets)
10. [The `__ENV_STATE__` Bundle](#10-the-__env_state__-bundle)
11. [Reference Implementation](#11-reference-implementation)

---

## 1. Overview

The `/session/*` area is a **client-side React SPA** mounted on top of the Next.js App Router. Every sub-page:

1. Is loaded as an **RSC stream** (`?_rsc=<hash>`)
2. Renders a `ClientPageRoot` (module `52391`) with a specific page module
3. Fetches its data from a `/api/v10.0.0/*` endpoint with the user's `access_token` cookie

Two different client bundles exist side-by-side:

| Bundle | Entry | Used for |
|--------|-------|----------|
| **Next.js (RSC)** | `ClientPageRoot` (52391) | All `/session/*` routes |
| **Legacy V2** | `/x/static/*.bundle.js` | Fallback shell (`__ENV_STATE__`) |

The **legacy bundle** is served when Next.js isn't used (e.g., some edge cases) and exposes `window.__ENV_STATE__` with the API keys.

---

## 2. Route Map

```
/session                                       ← login page
/session/myAccount                             ← account root
/session/myAccount/myListings/{status}         ← listings by status
/session/myPackages/{status}                   ← packages (bumps, boosts)
/session/buyerOrders/{status}                  ← buyer-side secure-trade orders
/session/sellerOrders/{status}                 ← seller-side secure-trade orders
/session/my-payments                           ← payment history
/session/bookmarks                             ← saved listings
/session/myChats                               ← in-app chat
```

### 2.1 Status Values

Each `[status]` segment resolves to a fixed tab. Observed values:

| Route | `[status]` | Meaning |
|-------|-----------|---------|
| myListings | `active` | Published / live listings |
| myListings | `inactive` | Expired / paused listings |
| myListings | `all` | Every listing regardless of state |
| myPackages | `active` | Currently active packages |
| myPackages | `inactive` | Consumed / expired packages |
| buyerOrders | `active` | Open buyer orders |
| buyerOrders | `inactive` | Closed buyer orders |
| sellerOrders | `active` | Open seller orders |
| sellerOrders | `inactive` | Closed seller orders |

The status is embedded in the RSC stream as:

```
5:["status","active","d"]
```

The `"d"` is a fixed marker (dynamic segment flag).

---

## 3. RSC Navigation Format

Every `/session/*` page is fetched as an RSC stream. Two requests are needed for a full load:

### 3.1 Initial Page Request

```http
GET /session/myAccount/myListings/active?_rsc=1jevn HTTP/1.1
Cookie: access_token=Bearer <token>; refresh_token=Bearer <token>; user_logged_in=1
RSC: 1
Accept: text/x-component
Next-Router-State-Tree: <url-encoded tree>
```

The `_rsc` value is an **opaque cache-busting hash**. The server uses it to identify the navigation branch; any random string works, but reusing one across requests is invalid.

### 3.2 RSC Response Shape

The response body is a **line-delimited stream** of numbered RSC nodes:

```
2:I[52391,[],"ClientPageRoot"]                                     ← module reference
3:I[50040,[...chunks...],"default",1]                              ← page component
4:I[49802,[],""]                                                    ← layout wrapper
5:["status","active","d"]                                           ← dynamic segment
7:[["$","meta","0",{...}], ... ]                                    ← head metadata
0:["hTYxyeCTWkN-Yv9iEw-pX", [...tree...]]                          ← root tree
```

Each line starts with `<nodeId>:` followed by either:
- `I[<moduleId>, <chunks>, <exportName>]` — a module reference
- `[<reactElement>]` — a React element tree
- `T<length>,<json>` — a text chunk
- `HL[...]` — a preloaded asset

### 3.3 Route Tree (from RSC)

The full route tree for `myListings/active`:

```json
[
  "hTYxyeCTWkN-Yv9iEw-pX",
  [
    ["children", "(withAuth)",
      ["(withAuth)", {
        "children": ["session", {
          "children": ["(withSidebar)", {
            "children": ["myAccount", {
              "children": ["myListings", {
                "children": [
                  ["status", "active", "d"],
                  { "children": ["__PAGE__", {}] }
                ]
              }]
            }]
          }]
        }]
      }]
    ]
  ]
]
```

### 3.4 Segment Flags

The `["status", "active", "d"]` array has three elements:

| Index | Value | Meaning |
|-------|-------|---------|
| 0 | `"status"` | Dynamic segment key |
| 1 | `"active"` | Actual value |
| 2 | `"d"` | `d` = dynamic (as opposed to `c` for catch-all) |

For myListings the flag is `d`. For myPackages the route uses a `catch-all` structure (no flag).

### 3.5 Page Component Modules

| Route | Page Module |
|-------|-------------|
| myListings | `50040` |
| myPackages | `78673` |
| buyerOrders | `71348` |
| sellerOrders | `14224` |

Each module ID maps to a compiled chunk under `/_next/static/chunks/`.

---

## 4. My Listings

### 4.1 Route

```
/session/myAccount/myListings/{status}
```

### 4.2 API

```
GET /api/v10.0.0/user/listings/{status}?isShop={bool}&page[number]={n}&page[size]={size}
Cookie: access_token=Bearer <token>
```

### 4.3 Response (published listing)

```json
{
  "jsonapi": { "version": "1.1" },
  "meta": {
    "total_items": 1,
    "coupon": {
      "code": "sheypooroff",
      "icon": "https://www.sheypoor.com/img/icons/first_bump.png",
      "title": "۵۰٪ تخفیف اولین بروزرسانی",
      "description": "آگهی شما دوباره در بالای لیست آگهی‌ها قرار میگیرد."
    }
  },
  "links": {
    "self":  "https://www.sheypoor.com/api/v10.0.0/user/listings/all?page%5Bnumber%5D=1&page%5Bsize%5D=24",
    "first": "https://www.sheypoor.com/api/v10.0.0/user/listings/all?page%5Bnumber%5D=1&page%5Bsize%5D=24",
    "last":  "https://www.sheypoor.com/api/v10.0.0/user/listings/all?page%5Bnumber%5D=1&page%5Bsize%5D=24",
    "prev":  null,
    "next":  null
  },
  "data": [
    {
      "type": "userListing",
      "id": "467318705",
      "attributes": {
        "title": "ایفون 14 پرو مکس 256 پک اصلی بنفش",
        "url": "https://www.sheypoor.com/v/...-467318705.html",
        "categoryId": 44006,
        "timePassedLabel": "۵ روز پیش",
        "price": [{ "label": null, "amount": 215000000, "currency": "تومان" }],
        "location": "مازندران، آمل، خیابان هراز",
        "images": {
          "thumbnails": {
            "round":     "https://www.sheypoor.com/image/.../225x225_af/img/placeholders/mobile-tablet.webp",
            "landscape": "https://www.sheypoor.com/image/.../220x165_af/img/placeholders/mobile-tablet.webp"
          }
        },
        "imageCount": 0,
        "videoCount": 0,
        "isSecurePurchase": false,
        "isCertified": false,
        "bump": false,
        "userListingUrl": "https://www.sheypoor.com/session/my-listing/467318705",
        "bumpStatus": null,
        "moderationStatus": {
          "status": "published",
          "label": "منتشر شده",
          "class": "active"
        },
        "limitationStatus": false,
        "buttons": {
          "edit": {
            "label": "ویرایش",
            "color": "blue",
            "class": "icon-pencil button link",
            "url": "https://www.sheypoor.com/listing/edit/467318705"
          },
          "reassign": null,
          "delete": true,
          "activate": null,
          "increaseView": {
            "label": "افزایش بازدید",
            "color": "blue",
            "class": "icon-graph button link",
            "url": "https://www.sheypoor.com/session/paid-features/467318705/44006/increase-view-manage-listing?direct=1"
          },
          "refresh": null,
          "payment": null
        },
        "securable": { "isSecurable": false, "url": null }
      }
    }
  ]
}
```

### 4.4 Notes

- The `status` path segment (`active`, `inactive`, `all`) maps directly to the `{status}` in the API URL.
- `moderationStatus.status` is the **true moderation state** (`published`, `pending`, `rejected`, `expired`, `draft`); the route segment is a **coarse filter** (`active` ≈ not expired).
- `buttons.delete: true` means the listing can be removed via the UI (no delete API documented here).
- The `meta.coupon` object is returned only when the listing has never been bumped. Its `code` can be applied in the paid-features flow.

---

## 5. My Packages

### 5.1 Route

```
/session/myPackages/{status}
```

### 5.2 API

```
GET /api/v10.0.0/user/online-packages?active={true|false}&isShop={true|false}
Cookie: access_token=Bearer <token>
```

### 5.3 Response (empty)

```json
{
  "jsonapi": { "version": "1.1" },
  "meta": {
    "type": "SnappPay",
    "title": "پرداخت قسطی با اسنپ پی فعال شد!",
    "description": "بسته دلخواهتو قسطی بخر و فروشت رو بالا ببر",
    "text": "خرید بسته",
    "btn_action": "https://www.sheypoor.com/session/paid-features/packages-purchase?fromBuy=true"
  },
  "data": []
}
```

### 5.4 Notes

- `active=true` → currently usable packages (bumps, boosts, etc.)
- `active=false` → consumed / expired packages
- The `meta` object always offers an entry point to the **package purchase** flow via `btn_action`.

---

## 6. Buyer Orders

### 6.1 Route

```
/session/buyerOrders/{status}
```

### 6.2 Layout

Buyer orders use a **dedicated layout** (module `23244`) loaded from:

```
/app/(withAuth)/session/(withSidebar)/buyerOrders/[status]/layout-38e22b1b846846ea.js
```

This layout passes `params: { status }` down to the page component.

### 6.3 API

```
GET /api/v10.0.0/newSecureTrade/service/buyer/orders?p={page}&page_size={size}&state={active|inactive}
Cookie: access_token=Bearer <token>
```

### 6.4 Response

```json
{
  "data": {
    "next": null,
    "previous": null,
    "count": 0,
    "results": []
  },
  "success": true,
  "message": "",
  "statusCode": 200
}
```

### 6.5 Notes

This endpoint uses a **custom envelope** (not JSON:API):

| Field | Meaning |
|-------|---------|
| `data.count` | Total orders |
| `data.next` / `data.previous` | Pagination URLs (may be `null`) |
| `data.results[]` | Order objects (schema not observed) |
| `success` | Boolean status |
| `statusCode` | HTTP-like status code (200) |

The base path `/newSecureTrade/service/` indicates this is the **secure-trade escrow** system (Sheypoor's version of "buy with confidence").

---

## 7. Seller Orders

### 7.1 Route

```
/session/sellerOrders/{status}
```

### 7.2 Layout

Seller orders use a **different layout** (module `64125`):

```
/app/(withAuth)/session/(withSidebar)/sellerOrders/[status]/layout-e17e3d1e9136e34b.js
```

### 7.3 API

The endpoint is inferred from the buyer-orders pattern:

```
GET /api/v10.0.0/newSecureTrade/service/seller/orders?p={page}&page_size={size}&state={active|inactive}
Cookie: access_token=Bearer <token>
```

**Note:** The seller endpoint was not captured in the observed traffic. It is expected to mirror the buyer endpoint with `seller` in the path.

### 7.4 Response Schema

Likely identical to the buyer orders schema:

```json
{
  "data": {
    "next": null,
    "previous": null,
    "count": 0,
    "results": []
  },
  "success": true,
  "message": "",
  "statusCode": 200
}
```

---

## 8. Payments

### 8.1 Route

```
/session/my-payments
```

### 8.2 API

```
GET /api/v10.0.0/user/payments?page[number]={n}&page[size]={size}
Cookie: access_token=Bearer <token>
```

### 8.3 Response (empty)

```json
{
  "jsonapi": { "version": "1.1" },
  "meta": {
    "total_items": 0,
    "currency": "ریال",
    "icons_urls": {
      "iv": "https://www.sheypoor.com/img/icons/my-payments/iv.svg",
      "sp": "https://www.sheypoor.com/img/icons/my-payments/sp.svg"
    }
  },
  "links": {
    "self":  null,
    "first": null,
    "last":  null,
    "prev":  null,
    "next":  null
  },
  "data": []
}
```

### 8.4 Meta Fields

| Field | Meaning |
|-------|---------|
| `total_items` | Total payment records |
| `currency` | Display currency (`ریال`, not `تومان`) |
| `icons_urls.iv` | Icon for `iv` payment method (IranVasete?) |
| `icons_urls.sp` | Icon for `sp` (SnappPay) |

### 8.5 Notes

- The **currency is Rial**, unlike listing prices which are in Toman.
- Pagination links are `null` when there are no records.
- Each payment entry (not observed) likely contains: `id`, `amount`, `method` (`iv`/`sp`), `status`, `createdAt`, `description`.

---

## 9. Wallets

### 9.1 Route

```
/session/my-payments   (nested panel)
```

or a dedicated wallet section in the sidebar.

### 9.2 API

```
GET /api/v10.0.0/user/wallets
Cookie: access_token=Bearer <token>
```

### 9.3 Response

```json
{
  "success": true,
  "message": "",
  "data": {
    "wallets": [
      {
        "logo": "https://payment.sheypoor.com/payment/images/gateways/asanpardakht.webp",
        "title": "آسان پرداخت",
        "description": "غیرفعال",
        "walletName": "asanpardakhtwallet",
        "isActive": false,
        "isDefault": false
      }
    ]
  }
}
```

### 9.4 Fields

| Field | Meaning |
|-------|---------|
| `logo` | Payment gateway logo URL |
| `title` | Gateway display name (Persian) |
| `description` | Status text (e.g., "غیرفعال" = inactive) |
| `walletName` | Internal gateway key (e.g., `asanpardakhtwallet`) |
| `isActive` | Whether this wallet is active for the user |
| `isDefault` | Whether it's the default payment method |

### 9.5 Notes

- Uses the **non-JSON:API envelope** (`success`/`data`/`message`).
- `payment.sheypoor.com` is a **separate subdomain** hosting payment gateway assets.
- Known gateway keys: `asanpardakhtwallet` (Asan Pardakht). Others are likely: `zarinpal`, `snapppay`, `mellat`, etc.

---

## 10. The `__ENV_STATE__` Bundle

### 10.1 Legacy Shell

When Next.js RSC is not used, Sheypoor falls back to a **legacy React (CRA-style) shell** at `/x/`. The HTML looks like:

```html
<!DOCTYPE html>
<html lang="fa">
<head>
  ...
  <title data-react-helmet="true"></title>
  <script defer id="state">
    window.__ENV_STATE__ = { ... };
    window.__INITIAL_DATA__ = { ... };
    window.__DEHYDRATED_STATE__ = { ... };
  </script>
  ...
</head>
<body class="V2">
  <div id="root" style="visibility: visible;"></div>
  <div id="modal"></div>
  <div id="toast-container"></div>
  <div id="app-version" style="display: none;">3.6.678</div>
</body>
</html>
```

### 10.2 `window.__ENV_STATE__`

The most important object for tooling — it exposes API endpoints and keys.

```js
window.__ENV_STATE__ = {
  "BASE_URL":        "https://www.sheypoor.com",
  "API_URL":         "https://www.sheypoor.com/api/v10.0.0/",
  "SSR_API_URL":     "http://edge-nginx-sidecar:9090/api/v10.0.0/",
  "CHAT_URL":        "wss://www.sheypoor.com/xmpp",
  "FILE_URL":        "https://www.sheypoor.com/gw/images",
  "MEDIA_URL":       "https://media.sheypoor.com/medias/video",
  "DEV_API_PROXY_PATH":    undefined,
  "DEV_SSR_API_PROXY_PATH": undefined,
  "FILE_LIMIT":      "20",
  "SENTRY_DSN":      "http://6bb7612e652c46428d88d9f15c307264@sentry.mielse.com/86",
  "ENVIROMENT":      "production",
  "SEARCHIA_API_KEY": "44B0793928414BB3A8AE62ED92CB71DD",
  "LOCAL_BUILD":     undefined,
  "TAG":             "678",
  "SSR":             false,
  "SERVER_FETCHED":  false
};
```

| Key | Purpose |
|-----|---------|
| `API_URL` | Base for all API calls |
| `SSR_API_URL` | Internal DNS (sidecar) — not reachable externally |
| `CHAT_URL` | XMPP WebSocket for in-app chat |
| `FILE_URL` | Image proxy |
| `MEDIA_URL` | Video CDN |
| `SEARCHIA_API_KEY` | **API key for the search/click tracking service** |
| `SENTRY_DSN` | Error reporting |
| `TAG` | Build tag |
| `ENVIROMENT` | `production` (note the typo — it's actually "ENVIROMENT", missing the N) |

### 10.3 `window.__DEHYDRATED_STATE__`

The **Redux/React-Query style cache** that the legacy shell uses. Includes slots for:

```js
{
  shops: { isFetching, data, meta, error, currentShopsLocation },
  locations: { ... },
  categories: { ... },
  shopDetail: {
    detail: { ... },
    about:  { ... },
    listings: { ... },
    filters:  { ... }
  },
  listingDetail: { ... },
  recommandation: {
    relatedListings: { ... },
    relatedShops: { ... },
    relatedListingSameShop: { ... },
    northInvestments: { ... }
  },
  home: {
    main: { ... },
    results: { ... }
  },
  serp: {
    info: { ... },
    filters: { ... },
    seo: { ... },
    results: {
      data, meta, list, totalPage, pendingPage,
      currentPage, error, initialListCount,
      extraSections, rowCount, isGalleryView
    },
    scrollRestoration: { enabled, lastViewedItemIndex },
    infiniteScroll: { state },
    isFetchingFilter,
    lastLoadedPage
  },
  loadTest: { ... }
}
```

This is the **legacy (V2) state** — for the modern Next.js app, use the RSC dehydrated state instead.

### 10.4 App Version

```html
<div id="app-version" style="display: none;">3.6.678</div>
```

The `TAG` field (`678`) matches the last segment of the version. Useful for detecting client updates.

### 10.5 Build Artifacts

```
/x/static/7827.7a95a275fcef2d0b1a10.bundle.js
/x/static/179.a37f378f8bab3785596e.bundle.js
/x/styles/179.ef0c489f103bd3008c81.bundle.css
```

Bundles are loaded with `defer` — the SPA boots after the DOM is parsed.

---

## 11. Reference Implementation

### 11.1 Python — Fetch All Account Data

```python
import requests

BASE = "https://www.sheypoor.com/api/v10.0.0"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Referer": "https://www.sheypoor.com/",
}

session = requests.Session()
session.headers.update(HEADERS)

# Assume login already done (see auth doc) — cookies set:
#   access_token = Bearer <token>
#   refresh_token = Bearer <token>


def my_listings(status="all", page=1, size=24, is_shop=False):
    r = session.get(
        f"{BASE}/user/listings/{status}",
        params={
            "isShop": str(is_shop).lower(),
            "page[number]": page,
            "page[size]": size,
        },
    )
    r.raise_for_status()
    return r.json()


def my_packages(active=True, is_shop=False):
    r = session.get(
        f"{BASE}/user/online-packages",
        params={"active": str(active).lower(), "isShop": str(is_shop).lower()},
    )
    r.raise_for_status()
    return r.json()


def buyer_orders(state="active", page=1, size=20):
    r = session.get(
        f"{BASE}/newSecureTrade/service/buyer/orders",
        params={"p": page, "page_size": size, "state": state},
    )
    r.raise_for_status()
    return r.json()


def seller_orders(state="active", page=1, size=20):
    r = session.get(
        f"{BASE}/newSecureTrade/service/seller/orders",
        params={"p": page, "page_size": size, "state": state},
    )
    r.raise_for_status()
    return r.json()


def my_payments(page=1, size=16):
    r = session.get(
        f"{BASE}/user/payments",
        params={"page[number]": page, "page[size]": size},
    )
    r.raise_for_status()
    return r.json()


def my_wallets():
    r = session.get(f"{BASE}/user/wallets")
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    print("Listings (all):", my_listings("all")["meta"]["total_items"])
    print("Packages:",     my_packages(active=True)["data"])
    print("Buyer orders:", buyer_orders("active")["data"]["count"])
    print("Payments:",     my_payments()["meta"]["total_items"])
    print("Wallets:",      my_wallets()["data"]["wallets"])
```

### 11.2 TypeScript — Fetch the RSC Stream

```typescript
async function fetchRscPage(path: string, rscHash = "1jevn"): Promise<string> {
  const url = new URL(path, "https://www.sheypoor.com");
  url.searchParams.set("_rsc", rscHash);

  const res = await fetch(url.toString(), {
    headers: {
      "RSC": "1",
      "Accept": "text/x-component",
      // Cookies are automatically included in browser context;
      // in Node, pass them explicitly:
      // "Cookie": `access_token=Bearer ${accessToken}`,
    },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`RSC ${res.status}`);
  return res.text();
}

// Usage:
const rsc = await fetchRscPage(
  "/session/myAccount/myListings/active",
  "1jevn"
);
// rsc is a line-delimited stream:
//   2:I[52391,[],"ClientPageRoot"]
//   3:I[50040,[...],"default",1]
//   5:["status","active","d"]
//   ...
```

### 11.3 Parsing the RSC Stream

```typescript
interface RscNode {
  id: string;
  kind: "module" | "tree" | "text" | "other";
  payload: unknown;
}

function parseRsc(stream: string): RscNode[] {
  const out: RscNode[] = [];
  for (const raw of stream.split("\n")) {
    const m = raw.match(/^([0-9a-f]+):(.+)$/);
    if (!m) continue;
    const [, id, body] = m;

    // Module reference: I[moduleId, chunks, exportName]
    if (body.startsWith("I[")) {
      out.push({ id, kind: "module", payload: JSON.parse(body.slice(1)) });
    }
    // React tree: [...]
    else if (body.startsWith("[")) {
      out.push({ id, kind: "tree", payload: JSON.parse(body) });
    }
    // Text chunk: T<length>,<json>
    else if (body.startsWith("T")) {
      const lenMatch = body.match(/^T([0-9a-f]+),/);
      if (lenMatch) {
        const hexLen = parseInt(lenMatch[1], 16);
        const jsonStart = lenMatch[0].length;
        out.push({
          id,
          kind: "text",
          payload: JSON.parse(body.slice(jsonStart, jsonStart + hexLen)),
        });
      }
    } else {
      out.push({ id, kind: "other", payload: body });
    }
  }
  return out;
}
```

### 11.4 Extracting the Status from RSC

```typescript
function extractStatus(nodes: RscNode[]): string | null {
  for (const node of nodes) {
    const t = node.payload;
    if (
      Array.isArray(t) &&
      t[0] === "status" &&
      typeof t[1] === "string"
    ) {
      return t[1];
    }
  }
  return null;
}

// → "active" / "inactive" / "all"
```

---

## 12. Cheat Sheet

| Task | Endpoint |
|------|----------|
| My listings | `GET /user/listings/{status}?isShop=&page[number]=&page[size]=` |
| My packages | `GET /user/online-packages?active={bool}&isShop={bool}` |
| Buyer orders | `GET /newSecureTrade/service/buyer/orders?p=&page_size=&state=` |
| Seller orders | `GET /newSecureTrade/service/seller/orders?p=&page_size=&state=` |
| My payments | `GET /user/payments?page[number]=&page[size]=` |
| My wallets | `GET /user/wallets` |
| RSC page | `GET /session/{path}?_rsc={hash}` + `RSC: 1` header |
| Legacy env | `window.__ENV_STATE__` in `/x/` shell |
| Legacy state | `window.__DEHYDRATED_STATE__` in `/x/` shell |

**Route → Page Module map:**

| Route | Module ID |
|-------|-----------|
| `myListings` | `50040` |
| `myPackages` | `78673` |
| `buyerOrders` | `71348` |
| `sellerOrders` | `14224` |
| `ClientPageRoot` | `52391` (shared) |

**Status tabs:**

- `myListings`: `active`, `inactive`, `all`
- `myPackages`: `active`, `inactive`
- `buyerOrders`: `active`, `inactive`
- `sellerOrders`: `active`, `inactive`

**Key API keys:**

- `SEARCHIA_API_KEY = 44B0793928414BB3A8AE62ED92CB71DD` (from legacy env state)
- Base API URL: `https://www.sheypoor.com/api/v10.0.0/`
- SSRF-only internal URL: `http://edge-nginx-sidecar:9090/api/v10.0.0/` (not reachable externally)

> ⚠️ **Disclaimer:** These endpoints are reverse-engineered from observed traffic. All are **authenticated** — they require a valid `access_token` cookie. Never use another user's credentials, and respect Sheypoor's Terms of Service. The `SEARCHIA_API_KEY` is a client-side key embedded in the bundle; do not abuse it. RSC hashes (`_rsc`) are opaque and may change between requests.