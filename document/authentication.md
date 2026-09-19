# Sheypoor Authentication & User Account API Documentation

> Complete reference for Sheypoor's login flow, session management, JWT tokens, and authenticated user endpoints (my listings, profile, chat). Covers both the API layer and the RSC-based protected pages.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Endpoints Reference](#3-endpoints-reference)
   - 3.1 [Send Verification Code](#31-send-verification-code)
   - 3.2 [Verify Code & Issue Tokens](#32-verify-code--issue-tokens)
   - 3.3 [Refresh Access Token](#33-refresh-access-token)
4. [Token Structure (JWT)](#4-token-structure-jwt)
5. [Cookies & Session State](#5-cookies--session-state)
6. [Protected Endpoints](#6-protected-endpoints)
   - 6.1 [Profile Details](#61-profile-details)
   - 6.2 [Unread Messages Count](#62-unread-messages-count)
   - 6.3 [User Listings (My Listings)](#63-user-listings-my-listings)
7. [Protected Page Routes (RSC)](#7-protected-page-routes-rsc)
8. [My Listings Response Schema](#8-my-listings-response-schema)
9. [Authenticated Scraping](#9-authenticated-scraping)
10. [Reference Implementation](#10-reference-implementation)

---

## 1. Overview

Sheypoor uses **phone-based passwordless authentication**: a user submits their phone number, receives an SMS code, and exchanges it for a pair of JWT tokens (access + refresh). Tokens are stored in **cookies** and used as `Authorization: Bearer <token>` headers on protected API calls.

| Property | Value |
|----------|-------|
| Auth Type | Phone + SMS OTP (no password) |
| Token Type | JWT (HS256) |
| Token Storage | Cookies (`access_token`, `refresh_token`) |
| Access TTL | 10 minutes (600s) |
| Refresh TTL | 90 days (7,776,000s) |
| API Base | `https://www.sheypoor.com/api/v10.0.0` |
| Protected Routes | `/session/*` (RSC pages) |

### Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. POST /auth/send         { username: "09XXXXXXXXX" }          │
│    → { verify: { token, ttl } }                                 │
│                                                                 │
│ 2. (User receives SMS with 4-digit code)                        │
│                                                                 │
│ 3. POST /auth/verify       { verification_code: "1332" }        │
│    + Authorization: Bearer <verify.token>                       │
│    → { access: {token,ttl}, refresh: {token,ttl}, userId, ... } │
│                                                                 │
│ 4. Cookies are set by the server:                               │
│    access_token  = Bearer <access.token>                        │
│    refresh_token = Bearer <refresh.token>                       │
│                                                                 │
│ 5. All subsequent authenticated requests send:                  │
│    Cookie: access_token=Bearer <token>; refresh_token=...       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Flow

### Step 1 — Initiate Login

```
POST /api/v10.0.0/auth/send
Content-Type: application/json

{ "username": "09000000000" }
```

**Response:**

```json
{
  "success": true,
  "message": "یک کد تایید به شماره موبایل شما ارسال شد",
  "data": {
    "verify": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInR5cGUiOiJWRVJJRlkifQ...",
      "ttl": 600
    }
  }
}
```

The `verify.token` is a **short-lived JWT** (10 min) that scopes the pending verification to the phone number.

### Step 2 — Verify the Code

```
POST /api/v10.0.0/auth/verify
Content-Type: application/json
Authorization: Bearer <verify.token>

{ "verification_code": "1332" }
```

**Response:**

```json
{
  "success": true,
  "message": "ورود با موفقیت انجام شد.",
  "data": {
    "userId": "16882901",
    "userName": "فرهام اقدسی",
    "userPhoto": "",
    "userPhone": "09000000000",
    "access":  { "token": "eyJ...", "ttl": 600 },
    "refresh": { "token": "eyJ...", "ttl": 7776000 }
  }
}
```

The server also sets **cookies** in the response (see §5) so subsequent browser requests are authenticated automatically.

### Step 3 — Return to the Original Page

The `session` route accepts a `returnUrl` query parameter, used after successful login:

```
GET /session?returnUrl=https%3A%2F%2Fwww.sheypoor.com%2Fsession%2FmyAccount%2FmyListings%2Fall&_rsc=1jevn
```

The `_rsc` hash indicates this is a Next.js soft-navigation request (see [RSC doc](#)).

---

## 3. Endpoints Reference

### 3.1 Send Verification Code

```
POST /api/v10.0.0/auth/send
```

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Iranian mobile number (`09XXXXXXXXX`) |

**Response fields:**

| Field | Meaning |
|-------|---------|
| `success` | `true` on success |
| `message` | Human-readable Persian message |
| `data.verify.token` | JWT scoped for verification (10 min) |
| `data.verify.ttl` | TTL in seconds (600) |

**Error cases** (inferred):
- Invalid phone format → `success: false`
- Rate limit → likely 429

---

### 3.2 Verify Code & Issue Tokens

```
POST /api/v10.0.0/auth/verify
Authorization: Bearer <verify.token>
Content-Type: application/json
```

| Field | Type | Description |
|-------|------|-------------|
| `verification_code` | string | 4-digit SMS code |

**Response fields:**

| Field | Meaning |
|-------|---------|
| `data.userId` | Numeric user ID |
| `data.userName` | Full name |
| `data.userPhone` | Verified phone number |
| `data.userPhoto` | Profile photo URL (may be empty) |
| `data.access.token` | Access JWT (10 min) |
| `data.access.ttl` | 600 seconds |
| `data.refresh.token` | Refresh JWT (90 days) |
| `data.refresh.ttl` | 7,776,000 seconds |

The server sets cookies on this response (see §5).

---

### 3.3 Refresh Access Token

*Not directly observed*, but standard JWT-refresh pattern applies. Based on the token types (`ACCESS`, `REFRESH`), the likely endpoint is:

```
POST /api/v10.0.0/auth/refresh
Authorization: Bearer <refresh.token>
```

**Response** (expected): a new `access` token pair.

The server will also accept an **expired access token** alongside a valid refresh token and reissue — but the exact behavior is unconfirmed.

---

## 4. Token Structure (JWT)

All three token types are **HS256 JWTs** signed with the same secret. They differ only in the `type` header claim and `exp`/`ttl`.

### 4.1 Verify Token

**Header:**
```json
{ "alg": "HS256", "typ": "JWT", "type": "VERIFY" }
```

**Payload:**
```json
{
  "aud": ["sheypoor"],
  "exp": 1789838961,
  "iat": 1789838361,
  "iss": "sheypoor",
  "jti": "445d020a-aa77-41eb-ab61-23424d7c81e1",
  "mobile": "09000000000",
  "nbf": 1789838361,
  "userId": "16882901"
}
```

| Claim | Meaning |
|-------|---------|
| `aud` | Audience (always `["sheypoor"]`) |
| `exp` | Expiry (Unix seconds) |
| `iat` | Issued at |
| `iss` | Issuer (`sheypoor`) |
| `jti` | Unique token ID |
| `mobile` | Phone being verified |
| `nbf` | Not before |
| `userId` | Target user ID |

### 4.2 Access Token

**Header:**
```json
{ "alg": "HS256", "typ": "JWT", "type": "ACCESS" }
```

**Payload:**
```json
{
  "aud": ["sheypoor"],
  "exp": 1789838991,
  "iat": 1789838391,
  "iss": "sheypoor",
  "jti": "ce8504e5-ca70-4288-b059-10954a687a84",
  "nbf": 1789838391,
  "userId": "16882901"
}
```

**No `mobile` claim** in the access token — the server relies on `userId` only.

### 4.3 Refresh Token

**Header:**
```json
{ "alg": "HS256", "typ": "JWT", "type": "REFRESH" }
```

**Payload:**
```json
{
  "aud": ["sheypoor"],
  "exp": 1797614391,
  "iat": 1789838391,
  "iss": "sheypoor",
  "jti": "05a8ca8c-abd7-4471-9aaf-75aa00deecdf",
  "nbf": 1789838391,
  "userId": "16882901"
}
```

### 4.4 Decoding a Token in Python

```python
import base64, json

def decode_jwt_payload(token: str) -> dict:
    payload_b64 = token.split(".")[1]
    # pad base64
    payload_b64 += "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))
```

You cannot verify the signature without the secret, but you can read the claims for logging/debugging.

---

## 5. Cookies & Session State

On successful `/auth/verify`, the server sets these cookies:

| Cookie | Value | Purpose |
|--------|-------|---------|
| `access_token` | `Bearer <access.token>` | Sent on every API call |
| `refresh_token` | `Bearer <refresh.token>` | Used to reissue access |
| `user_logged_in` | `1` | Client-side flag |
| `track_id` | UUID | Analytics |
| `provinceID` / `province` | e.g. `27` / `mazandaran` | Location context |
| `cityID` / `city` | e.g. `960` / `chalus` | Location context |
| `geo` | e.g. `city` | Geolocation mode |
| `neighbourhood` | e.g. `17-shahrivar` | Neighbourhood slug |
| `saved_items` | `[]` (JSON) | Bookmarks (client-side) |
| `analytics_campaign` | JSON | Marketing attribution |
| `analytics_token` | UUID | Analytics session |
| `_ga` / `_ga_*` | GA cookies | Google Analytics |

**Key point:** `access_token` and `refresh_token` are stored **with the `Bearer ` prefix included** in the cookie value. When scraping, replicate this exactly:

```
Cookie: access_token=Bearer eyJ...; refresh_token=Bearer eyJ...
```

Note the **space** between `Bearer` and the token — it must be URL-encoded as `%20` or sent with a space.

---

## 6. Protected Endpoints

### 6.1 Profile Details

```
GET /api/v10.0.0/user/profile-details
Cookie: access_token=Bearer <token>
```

**Response:**

```json
{
  "jsonapi": { "version": "1.1" },
  "data": {
    "type": "profileDetails",
    "id": "16882901",
    "attributes": {
      "userName": "فرهام اقدسی",
      "userPhone": "09000000000",
      "userPhoto": null
    }
  }
}
```

The `id` matches the `userId` claim in the JWT.

---

### 6.2 Unread Messages Count

```
GET /api/v10.0.0/chat/unread-messages-count
Cookie: access_token=Bearer <token>
```

**Response:**

```json
{
  "data": { "unread": 0 },
  "message": "",
  "success": true,
  "unread": 0
}
```

**Note:** This endpoint uses a **non-JSON:API** envelope (`success`/`data`/`message`), unlike the profile endpoint.

---

### 6.3 User Listings (My Listings)

The primary endpoint for the "my listings" page. Supports pagination via JSON:API-style `page[number]` / `page[size]`.

```
GET /api/v10.0.0/user/listings/{status}?isShop={bool}&page[number]={n}&page[size]={size}
Cookie: access_token=Bearer <token>
```

#### Path Parameters

| Param | Values | Description |
|-------|--------|-------------|
| `{status}` | `all`, `published`, `draft`, `expired`, `pending`, `rejected` | Filter by moderation status |

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `isShop` | boolean | `false` | Filter to shop listings only |
| `page[number]` | number | `1` | Page number (1-indexed) |
| `page[size]` | number | `24` | Items per page |

#### Example

```
GET /api/v10.0.0/user/listings/all?isShop=false&page[number]=1&page[size]=24
Cookie: access_token=Bearer eyJ...
```

#### Response Envelope

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
    "self": "https://www.sheypoor.com/api/v10.0.0/user/listings/all?page%5Bnumber%5D=1&page%5Bsize%5D=24",
    "first": "https://www.sheypoor.com/api/v10.0.0/user/listings/all?page%5Bnumber%5D=1&page%5Bsize%5D=24",
    "last":  "https://www.sheypoor.com/api/v10.0.0/user/listings/all?page%5Bnumber%5D=1&page%5Bsize%5D=24",
    "prev": null,
    "next": null
  },
  "data": [ /* userListing[] */ ]
}
```

#### Pagination Links

The envelope provides **HATEOAS-style** pagination:
- `first`, `last`, `prev`, `next` — absolute URLs
- `next: null` means this is the last page

For large crawls, follow `links.next` until `null`.

---

## 7. Protected Page Routes (RSC)

### 7.1 Route Tree

```
/session                              ← login page
/session/myAccount                    ← account root
/session/myAccount/myListings         ← listings container
/session/myAccount/myListings/all     ← "all" status
/session/myAccount/myListings/{status}
/session/bookmarks                    ← saved listings
/session/myChats                      ← in-app chat
```

### 7.2 Layout Structure

The `/session/*` routes share this Next.js nested layout:

```
app/
├── (withAuth)/                       ← route group with auth check
│   ├── layout.tsx                    ← AuthProvider (module 8001)
│   └── session/
│       ├── layout.tsx                ← LoginProvider (module 59122)
│       └── (withSidebar)/
│           ├── layout.tsx            ← Sidebar (module 2095)
│           └── myAccount/
│               └── myListings/
│                   ├── layout.tsx    ← Listings layout (module 1379)
│                   └── [status]/
│                       └── page.tsx  ← ClientPageRoot (module 52391)
```

**Key modules referenced in the RSC stream:**

| Module ID | Purpose |
|-----------|---------|
| `52391` | `ClientPageRoot` — the page component |
| `50040` | My-listings page content |
| `1379` | My-listings layout |
| `8001` | Auth provider (`AuthLoading`, `AuthProvider`) |
| `59122` | `LoginProvider` |
| `2095` | Sidebar layout |
| `98976` | `PreloadCss` |
| `82702` | `BailoutToCSR` (client-side render fallback) |

### 7.3 Auth Gating via RSC

The `(withAuth)` route group wraps all `session/*` pages. From the RSC payload:

```
["$", "$a", { fallback: <AuthLoading />, children: <AuthProvider>... }]
```

where `$a` = `React.Suspense`. If the auth check fails, the client is redirected to:

```
/session?returnUrl=<encoded-current-url>&_rsc=<hash>
```

This is why the login request URL includes:

```
/session?returnUrl=https%3A%2F%2Fwww.sheypoor.com%2Fsession%2FmyAccount%2FmyListings%2Fall&_rsc=1jevn
```

**Scraping implication:** If you hit a `/session/*` RSC endpoint without cookies, the server returns a redirect or an SSR page that renders the login form instead of the target content.

### 7.4 RSC Request Format

All `/session/*` pages are fetched as **RSC streams**:

```
GET /session/myAccount/myListings/all?_rsc=ldmeo
```

Requirements:
- Cookie: `access_token=Bearer ...`
- Header: `RSC: 1`
- Header: `Next-Router-State-Tree: <encoded>`
- The `_rsc` value is an opaque cache-busting hash

For scraping, prefer the **REST API** (`/api/v10.0.0/user/listings/all`) over the RSC endpoint — the API is stable and doesn't require the `Next-Router-State-Tree` header.

---

## 8. My Listings Response Schema

Each item in `data[]` is a `userListing` resource. It is **richer** than a public listing — it includes moderation status, action buttons, and a private edit URL.

### 8.1 `userListing` Object

```json
{
  "type": "userListing",
  "id": "467318705",
  "attributes": {
    "title": "ایفون 14 پرو مکس 256 پک اصلی بنفش",
    "url": "https://www.sheypoor.com/v/ایفون-14-پرو-مکس-256-پک-اصلی-بنفش-467318705.html",
    "categoryId": 44006,
    "timePassedLabel": "۵ روز پیش",
    "price": [
      { "label": null, "amount": 215000000, "currency": "تومان" }
    ],
    "priceTag": null,
    "paidTags": [],
    "location": "مازندران، آمل، خیابان هراز",
    "images": {
      "thumbnails": {
        "round":     "https://www.sheypoor.com/image/.../225x225_af/img/placeholders/mobile-tablet.webp",
        "landscape": "https://www.sheypoor.com/image/.../220x165_af/img/placeholders/mobile-tablet.webp"
      }
    },
    "imageCount": 0,
    "videoCount": 0,
    "shopLogo": null,
    "isSecurePurchase": false,
    "isCertified": false,
    "bump": false,
    "hidePhoneNumber": false,
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
    "securable": {
      "isSecurable": false,
      "url": null
    }
  }
}
```

### 8.2 Key Fields

| Field | Meaning |
|-------|---------|
| `id` | Listing ID (same as public listing ID) |
| `attributes.url` | Public detail URL |
| `attributes.userListingUrl` | **Owner-only** manage URL (`/session/my-listing/{id}`) |
| `attributes.moderationStatus.status` | `published`, `pending`, `rejected`, `expired`, `draft` |
| `attributes.moderationStatus.label` | Human-readable Persian status |
| `attributes.moderationStatus.class` | CSS class (`active`, `inactive`, `warning`) |
| `attributes.buttons.edit.url` | Edit page (`/listing/edit/{id}`) |
| `attributes.buttons.delete` | `true` if deletable |
| `attributes.buttons.increaseView.url` | Paid bump/boost flow |
| `attributes.bump` | `true` if currently bumped |
| `attributes.bumpStatus` | Bump state (may be `null`) |
| `attributes.isCertified` | Seller certification badge |
| `attributes.limitationStatus` | `true` if the listing is restricted |
| `attributes.securable.isSecurable` | Whether secure-purchase is enabled |

### 8.3 `meta.coupon`

When a user has never used a bump on this listing, the API offers a discount coupon:

```json
{
  "code": "sheypooroff",
  "icon": "https://www.sheypoor.com/img/icons/first_bump.png",
  "title": "۵۰٪ تخفیف اولین بروزرسانی",
  "description": "آگهی شما دوباره در بالای لیست آگهی‌ها قرار میگیرد."
}
```

The `code` can be applied during the bump flow (`/session/paid-features/...`).

### 8.4 `meta.total_items`

Total count across all pages. Use with `page[size]` to compute the last page:
```
last_page = ceil(total_items / page_size)
```

---

## 9. Authenticated Scraping

### 9.1 Login via API (Headless)

```python
import requests, json

BASE = "https://www.sheypoor.com/api/v10.0.0"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.sheypoor.com",
    "Referer": "https://www.sheypoor.com/",
}

session = requests.Session()
session.headers.update(HEADERS)


def send_code(phone: str) -> str:
    """Step 1: request SMS. Returns the short-lived verify token."""
    r = session.post(f"{BASE}/auth/send", json={"username": phone})
    r.raise_for_status()
    return r.json()["data"]["verify"]["token"]


def verify_code(verify_token: str, code: str) -> dict:
    """Step 2: exchange code for access + refresh tokens."""
    r = session.post(
        f"{BASE}/auth/verify",
        json={"verification_code": code},
        headers={"Authorization": f"Bearer {verify_token}"},
    )
    r.raise_for_status()
    data = r.json()["data"]
    # replicate the cookies the server would set
    session.cookies.set("access_token",  f"Bearer {data['access']['token']}")
    session.cookies.set("refresh_token", f"Bearer {data['refresh']['token']}")
    session.cookies.set("user_logged_in", "1")
    return data


# Usage:
# verify_token = send_code("09000000000")          # triggers SMS
# data = verify_code(verify_token, input("Code: ")) # user enters code
# print("Logged in as", data["userName"])
```

### 9.2 Scrape My Listings

```python
def iter_my_listings(status: str = "all", page_size: int = 24,
                     is_shop: bool = False):
    page = 1
    while True:
        r = session.get(
            f"{BASE}/user/listings/{status}",
            params={
                "isShop": str(is_shop).lower(),
                "page[number]": page,
                "page[size]": page_size,
            },
        )
        r.raise_for_status()
        doc = r.json()

        for item in doc.get("data", []):
            yield item

        next_url = (doc.get("links") or {}).get("next")
        if not next_url:
            break
        page += 1


for listing in iter_my_listings("all"):
    attrs = listing["attributes"]
    print(listing["id"], attrs["title"], attrs["moderationStatus"]["status"])
```

### 9.3 Useful Authenticated Endpoints

| Task | Method | URL |
|------|--------|-----|
| Current user profile | GET | `/api/v10.0.0/user/profile-details` |
| Unread chat count | GET | `/api/v10.0.0/chat/unread-messages-count` |
| My listings (all) | GET | `/api/v10.0.0/user/listings/all?isShop=false&page[number]=1&page[size]=24` |
| My listings (published) | GET | `/api/v10.0.0/user/listings/published?...` |
| My listings (drafts) | GET | `/api/v10.0.0/user/listings/draft?...` |

### 9.4 Session Persistence

Because the access token expires in 10 minutes, you'll need to **persist the refresh token** and use it to reissue access. Standard approach:

1. Store `refresh_token` in a secure location.
2. When `access_token` expires, call the refresh endpoint.
3. Overwrite cookies with the new access token.

If the refresh endpoint isn't reachable, you can also:
- Persist the whole cookie jar with `pickle` or `browser_cookie3`.
- Re-run the login flow (requires user interaction).

### 9.5 Loading the Protected RSC Page

If you must fetch the HTML/RSC for a `/session/*` page (rather than the API):

```python
def fetch_my_listings_rsc():
    url = "https://www.sheypoor.com/session/myAccount/myListings/all"
    headers = {
        **HEADERS,
        "RSC": "1",
        "Accept": "text/x-component",
    }
    r = session.get(url, headers=headers, params={"_rsc": "ldmeo"})
    r.raise_for_status()
    return r.text
```

**Note:** The `_rsc` value can be any opaque string; the server treats it as a cache key. Without valid cookies, the response is a redirect to `/session?returnUrl=...`.

---

## 10. Reference Implementation

### 10.1 Full Async Login Flow (Python + aiohttp)

```python
import asyncio, aiohttp, json

BASE = "https://www.sheypoor.com/api/v10.0.0"
UA   = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " \
       "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"


class SheypoorSession:
    def __init__(self, cookies: dict | None = None):
        self.jar = aiohttp.CookieJar()
        if cookies:
            for k, v in cookies.items():
                self.jar.update_cookies({k: v})
        self.headers = {
            "User-Agent": UA,
            "Accept": "application/json",
            "Origin": "https://www.sheypoor.com",
            "Referer": "https://www.sheypoor.com/",
        }

    async def _request(self, method, path, **kw):
        async with aiohttp.ClientSession(
            headers=self.headers, cookie_jar=self.jar
        ) as s:
            async with s.request(method, f"{BASE}{path}", **kw) as r:
                r.raise_for_status()
                return await r.json()

    async def send_code(self, phone: str) -> str:
        doc = await self._request("POST", "/auth/send",
                                  json={"username": phone})
        return doc["data"]["verify"]["token"]

    async def verify_code(self, verify_token: str, code: str) -> dict:
        doc = await self._request(
            "POST", "/auth/verify",
            json={"verification_code": code},
            headers={"Authorization": f"Bearer {verify_token}"},
        )
        data = doc["data"]
        self.jar.update_cookies({
            "access_token":  f"Bearer {data['access']['token']}",
            "refresh_token": f"Bearer {data['refresh']['token']}",
            "user_logged_in": "1",
        })
        return data

    async def profile(self) -> dict:
        return (await self._request("GET", "/user/profile-details"))["data"]["attributes"]

    async def unread_count(self) -> int:
        return (await self._request("GET", "/chat/unread-messages-count"))["data"]["unread"]

    async def my_listings(self, status="all", page=1, size=24):
        return await self._request(
            "GET", f"/user/listings/{status}",
            params={
                "isShop": "false",
                "page[number]": page,
                "page[size]": size,
            },
        )


async def main():
    s = SheypoorSession()
    vt = await s.send_code("09000000000")
    print("Enter the SMS code: ", end="", flush=True)
    code = input()
    user = await s.verify_code(vt, code)
    print(f"Logged in: {user['userName']} ({user['userId']})")

    print("Unread:", await s.unread_count())
    print("Profile:", await s.profile())

    doc = await s.my_listings("all", page=1)
    print(f"Total listings: {doc['meta']['total_items']}")
    for item in doc["data"]:
        a = item["attributes"]
        print(f"  {item['id']}: {a['title']} → {a['moderationStatus']['status']}")


if __name__ == "__main__":
    asyncio.run(main())
```

### 10.2 Decode and Inspect a JWT

```python
import base64, json, time

def inspect_jwt(token: str) -> None:
    header_b64, payload_b64, _ = token.split(".")
    header  = json.loads(base64.urlsafe_b64decode(header_b64 + "=="))
    payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))

    exp = payload.get("exp", 0)
    ttl = exp - int(time.time())

    print(f"type   : {header.get('type')}")
    print(f"userId : {payload.get('userId')}")
    print(f"mobile : {payload.get('mobile', '-')}")
    print(f"exp    : {exp} ({ttl}s from now)")
    print(f"jti    : {payload.get('jti')}")
```

Example output:

```
type   : ACCESS
userId : 16882901
mobile : -
exp    : 1789838991 (580s from now)
jti    : ce8504e5-ca70-4288-b059-10954a687a84
```

---

## 11. Cheat Sheet

| Task | Endpoint |
|------|----------|
| Send SMS code | `POST /auth/send` `{username}` |
| Verify code | `POST /auth/verify` `{verification_code}` + `Bearer <verify.token>` |
| Refresh access | `POST /auth/refresh` `Bearer <refresh.token>` (inferred) |
| Get profile | `GET /user/profile-details` |
| Unread count | `GET /chat/unread-messages-count` |
| My listings | `GET /user/listings/{status}?isShop=&page[number]=&page[size]=` |
| Session page | `GET /session/myAccount/myListings/all?_rsc=<hash>` |
| Login page | `GET /session?returnUrl=<url>&_rsc=<hash>` |

**Token TTLs:**
- `VERIFY`: 10 min (600s)
- `ACCESS`: 10 min (600s)
- `REFRESH`: 90 days (7,776,000s)

**Cookie format:**
```
access_token=Bearer%20<token>; refresh_token=Bearer%20<token>; user_logged_in=1
```

**Status values for `/user/listings/{status}`:**
`all`, `published`, `draft`, `expired`, `pending`, `rejected`

> ⚠️ **Disclaimer:** These endpoints are reverse-engineered from observed traffic. Authentication endpoints are sensitive — never automate login on someone else's phone number, and never scrape listings that don't belong to you. Respect Sheypoor's Terms of Service. Token secrets cannot be recovered from the JWT (HS256 signatures require the server's secret).