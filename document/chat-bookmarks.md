# Sheypoor Chat & Bookmarks API — Documentation

> Complete reference for the in-app chat system (XMPP over WebSocket) and the saved-listings (bookmarks) feature. Covers the RSC-based chat pages, the XMPP credentials/rooms APIs, the message-suggestion endpoint, and the favorites API.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Chat System Architecture](#2-chat-system-architecture)
3. [Chat REST APIs](#3-chat-rest-apis)
   - 3.1 [Chat Rooms List](#31-chat-rooms-list)
   - 3.2 [Chat Credentials (XMPP)](#32-chat-credentials-xmpp)
   - 3.3 [Message Suggestions](#33-message-suggestions)
   - 3.4 [Unread Messages Count](#34-unread-messages-count)
4. [XMPP over WebSocket](#4-xmpp-over-websocket)
5. [Chat Page Routes (RSC)](#5-chat-page-routes-rsc)
6. [Chat Room JID Format](#6-chat-room-jid-format)
7. [Bookmarks](#7-bookmarks)
8. [Bookmarks RSC Routes](#8-bookmarks-rsc-routes)
9. [Reference Implementation](#9-reference-implementation)
10. [Cheat Sheet](#10-cheat-sheet)

---

## 1. Overview

Sheypoor's in-app chat is built on **XMPP** (Extensible Messaging and Presence Protocol) over **WebSocket**, hosted at `wss://www.sheypoor.com/xmpp`. The XMPP server runs at `im.mielse.com` and uses **MUC-Light** (XEP-xxxx, "Multi-User Chat Light") for per-listing conversation rooms.

| Component | Value |
|-----------|-------|
| XMPP WebSocket | `wss://www.sheypoor.com/xmpp` |
| XMPP Domain | `im.mielse.com` |
| Chat URL (env) | `wss://www.sheypoor.com/xmpp` |
| Chat Domain (env) | `im.mielse.com` |
| Protocol | XMPP (RFC 6120/6121) |
| Stream Mgmt | XEP-0198 (`urn:xmpp:sm:3`) |
| Message Archive | XEP-0313 (`urn:xmpp:mam:2`) |
| Room Type | MUC-Light |
| Auth | SASL PLAIN (username/password from `/chat/credentials`) |

The chat system uses a **state-machine of React Contexts** in the frontend:

| Provider | Module | Responsibility |
|----------|--------|----------------|
| `ChatProvider` | `50825` | Top-level XMPP connection |
| `ChatRoomsProvider` | `21099` | Chat room list state |
| `ChatHistoryProvider` | `12374` | Per-room message history |
| `CurrentRoomProvider` | `29763` | Active room selection |

---

## 2. Chat System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                          Browser                                      │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ChatProvider  ──►  XMPP connection (wss://www.sheypoor.com/xmpp)│  │
│  │      │                                                          │  │
│  │      ├── ChatRoomsProvider   (GET /chat/rooms)                  │  │
│  │      ├── ChatHistoryProvider (XMPP MAM)                         │  │
│  │      └── CurrentRoomProvider (room selection)                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
           │                                       │
           ▼                                       ▼
  ┌────────────────────┐              ┌────────────────────────┐
  │  REST API          │              │  XMPP Server           │
  │  /api/v10.0.0/chat │              │  im.mielse.com         │
  │  - /rooms          │              │  (MUC-Light + MAM)     │
  │  - /credentials    │              │                        │
  │  - /suggestion     │              │                        │
  │  - /unread-...     │              │                        │
  └────────────────────┘              └────────────────────────┘
```

**Flow:**
1. Client fetches credentials → `/chat/credentials`
2. Client connects to `wss://www.sheypoor.com/xmpp` with SASL PLAIN
3. Client fetches room list → `/chat/rooms`
4. On room selection, client joins the MUC and requests history via MAM
5. New messages arrive over the XMPP stream
6. On message send, client sends XMPP `<message>` stanza

---

## 3. Chat REST APIs

### 3.1 Chat Rooms List

```
GET /api/v10.0.0/chat/rooms?page={n}
Cookie: access_token=Bearer <token>
```

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number (1-indexed) |

#### Response

```json
{
  "success": true,
  "message": "",
  "data": {
    "total": 1,
    "limit": 24,
    "supportChat": null,
    "list": [
      {
        "timestamp": 1789395955401,
        "room_jid": "effbd0ae2bc2567a83c38d768f3b1fc2-467318705-dd7fb953a88bb782af08e21db20db8a4@muclight.im.mielse.com",
        "unread": 0,
        "msg": "سلام وقتتون بخیر بله",
        "msg_id": "sendMessage-a-5891ef3f-faea-4825-b575-d6e885fee0ab",
        "id": 467318705,
        "title": "ایفون 14 پرو مکس 256 پک اصلی بنفش",
        "price": "215,000,000 تومان",
        "image": "https://www.sheypoor.com/image/5d3db8/133x133_af/img/placeholders/electronics.jpg",
        "nickname": "ali",
        "secure_purchase": "",
        "is_owner": true,
        "is_expired": false,
        "status": 0,
        "attributes": {
          "rate": "{\"showInterval\":0,\"showMsgCount\":0}",
          "sp": -1
        },
        "listing_url": "https://www.sheypoor.com/v/...-467318705.html",
        "active": true
      }
    ]
  }
}
```

#### Fields

| Field | Type | Meaning |
|-------|------|---------|
| `data.total` | number | Total number of rooms |
| `data.limit` | number | Page size (24) |
| `data.supportChat` | object\|null | Support conversation (if any) |
| `data.list[]` | array | Room summaries |
| `list[].timestamp` | number | Last message timestamp (ms) |
| `list[].room_jid` | string | XMPP MUC room JID |
| `list[].unread` | number | Unread message count |
| `list[].msg` | string | Last message preview |
| `list[].msg_id` | string | Last message stanza ID |
| `list[].id` | number | **Listing ID** the room is about |
| `list[].title` | string | Listing title |
| `list[].price` | string | Formatted price with currency |
| `list[].image` | string | Listing thumbnail |
| `list[].nickname` | string | Other party's nickname |
| `list[].is_owner` | boolean | `true` if the current user owns the listing |
| `list[].is_expired` | boolean | Listing expired flag |
| `list[].status` | number | Room status code (0 = active) |
| `list[].active` | boolean | Whether the room is still active |
| `list[].attributes.rate` | string (JSON) | Rating config for the other party |
| `list[].attributes.sp` | number | Secure-purchase flag (-1 = off) |
| `list[].listing_url` | string | Public listing URL |

#### Pagination

The endpoint uses **`total` + `limit`** rather than JSON:API pagination links. Compute pages as:

```
last_page = ceil(total / limit)
```

---

### 3.2 Chat Credentials (XMPP)

```
GET /api/v10.0.0/chat/credentials
Cookie: access_token=Bearer <token>
```

#### Response

```json
{
  "success": true,
  "message": "",
  "data": {
    "username": "dd7fb953a88bb782af08e21db20db8a4@im.mielse.com",
    "password": "43578c76eb7269bf2e90a3741ce5be45",
    "phoneNumber": "0939XXX3094",
    "nickname": "فرهام اقدسی"
  }
}
```

#### Fields

| Field | Meaning |
|-------|---------|
| `username` | Full XMPP JID (`<userHash>@im.mielse.com`) |
| `password` | SASL PLAIN password (rotating) |
| `phoneNumber` | Masked phone (middle digits replaced with `XXX`) |
| `nickname` | Display name |

**Notes:**
- The password is a **rotating credential**, not the user's account password.
- It's used for **SASL PLAIN** authentication when connecting to XMPP.
- Cache with a short TTL; the server may rotate it.

---

### 3.3 Message Suggestions

Returns quick-reply suggestions for a given listing and (optional) message prefix.

```
GET /api/v10.0.0/chat/suggestion?listingId={id}&message={prefix}
Cookie: access_token=Bearer <token>
```

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `listingId` | number | Yes | Listing ID the conversation is about |
| `message` | string | No | Current draft (for context-aware suggestions) |

#### Response

```json
{
  "success": true,
  "message": "",
  "data": {
    "suggestions": [
      "سلام.",
      "لطفا تماس بگیرید."
    ]
  }
}
```

#### Notes

- Returns `304 Not Modified` when the suggestion set hasn't changed (based on `message` prefix).
- Send `If-None-Match` or `If-Modified-Since` headers to leverage this.
- Suggestions are context-sensitive to the category.

---

### 3.4 Unread Messages Count

```
GET /api/v10.0.0/chat/unread-messages-count
Cookie: access_token=Bearer <token>
```

#### Response

```json
{
  "data": { "unread": 0 },
  "message": "",
  "success": true,
  "unread": 0
}
```

**Note:** The `unread` field appears **both** inside `data` and at the top level (legacy compatibility).

---

## 4. XMPP over WebSocket

### 4.1 Connection

```
wss://www.sheypoor.com/xmpp
```

The server responds with **HTTP 101 Switching Protocols**, upgrading to a WebSocket carrying an XMPP stream.

### 4.2 Authentication

1. Open the WebSocket.
2. Send the XMPP stream opening:
   ```xml
   <open xmlns="urn:ietf:params:xml:ns:xmpp-framing"
         to="im.mielse.com"
         version="1.0"/>
   ```
3. Receive `<stream:features>` with SASL mechanisms.
4. Authenticate using SASL PLAIN with the credentials from `/chat/credentials`:
   ```xml
   <auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">
     <base64>BASE64(\0username\0password)</base64>
   </auth>
   ```
   Where `username` is the bare JID (`<userHash>@im.mielse.com`) and `password` is the credential value.
5. Server responds with `<success xmlns="urn:ietf:params:xml:ns:xmpp-sasl"/>`.
6. Restart the stream.
7. Bind the resource:
   ```xml
   <iq type="set" id="bind1">
     <bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">
       <resource>web</resource>
     </bind>
   </iq>
   ```
8. Receive the full JID (e.g., `dd7fb953...@im.mielse.com/web`).

### 4.3 Stream Management (XEP-0198)

After auth, the server enables stream management (`urn:xmpp:sm:3`):

```xml
<r xmlns="urn:xmpp:sm:3"/>          <!-- client → server: request ack -->
<a xmlns="urn:xmpp:sm:3" h="10"/>   <!-- server → client: ack to h=10 -->
```

The `h` attribute is the count of **handled** stanzas. Use it to resume sessions after network drops.

### 4.4 Room History (MAM, XEP-0313)

To fetch history for a room, the client sends an IQ query:

```xml
<iq type="set" id="getRoomHistory">
  <query xmlns="urn:xmpp:mam:2" queryid="getRoomHistory">
    <x xmlns="jabber:x:data" type="submit">
      <field var="FORM_TYPE">
        <value>urn:xmpp:mam:2</value>
      </field>
    </x>
    <set xmlns="http://jabber.org/protocol/rsm">
      <max>50</max>
      <before/>
    </set>
  </query>
</iq>
```

The server responds with the archive:

```xml
<iq type="result" id="getRoomHistory">
  <fin xmlns="urn:xmpp:mam:2" complete="true">
    <set xmlns="http://jabber.org/protocol/rsm">
      <first index="0">CMRI2HF2M4O1</first>
      <last>CMRIB7S6PT81</last>
      <count>9</count>
    </set>
  </fin>
</iq>
```

| Field | Meaning |
|-------|---------|
| `fin.complete` | `true` if the archive is fully returned |
| `set.first` | Oldest message ID in the batch |
| `set.last` | Newest message ID in the batch |
| `set.count` | Total messages in the archive |

### 4.5 Keepalive (Ping)

The client sends an XMPP ping every 30 seconds:

```xml
<iq type="get" to="im.mielse.com">
  <ping xmlns="urn:xmpp:ping"/>
</iq>
```

The server replies with an empty `<iq type="result"/>`, then a stream-management `<r/>` / `<a/>` pair confirms the roundtrip.

### 4.6 Room JID Format

Each room JID has the structure:

```
{roomHash}-{listingId}-{userHash}@muclight.im.mielse.com
```

Example:
```
effbd0ae2bc2567a83c38d768f3b1fc2-467318705-dd7fb953a88bb782af08e21db20db8a4@muclight.im.mielse.com
```

| Segment | Meaning |
|---------|---------|
| `effbd0ae2bc2567a83c38d768f3b1fc2` | Room hash (per listing) |
| `467318705` | Listing ID |
| `dd7fb953a88bb782af08e21db20db8a4` | User hash (current user's XMPP hash) |
| `muclight.im.mielse.com` | MUC-Light subdomain |

To open a specific chat, navigate to:

```
/session/myChats?jid=<url-encoded-room_jid>
```

---

## 5. Chat Page Routes (RSC)

### 5.1 Routes

| Route | Purpose | Page Module |
|-------|---------|-------------|
| `/session/myChats` | Chat list / empty state | `93236` |
| `/session/myChats?jid={room_jid}` | Active conversation | `93236` |

### 5.2 Layout Providers

The chat layout (`33243`) wraps the page with **four** nested providers:

```
ChatProvider (50825)
  └── ChatRoomsProvider (21099)
        └── ChatHistoryProvider (12374)
              └── CurrentRoomProvider (29763)
                    └── <main> children </main>
```

Each provider manages one slice of the chat state:

| Provider | State |
|----------|-------|
| `ChatProvider` | XMPP connection lifecycle |
| `ChatRoomsProvider` | Room list from `/chat/rooms` |
| `ChatHistoryProvider` | Message archive per room (MAM) |
| `CurrentRoomProvider` | Selected `room_jid` (from `?jid=`) |

### 5.3 Selecting a Room

When the user clicks a room, the URL becomes:

```
/session/myChats?jid=effbd0ae...%40muclight.im.mielse.com&_rsc=1y0zd
```

The `jid` query param is URL-encoded (note `%40` for `@`). The `CurrentRoomProvider` reads this and:
1. Joins the MUC if not already joined
2. Requests MAM history (if not cached)
3. Renders messages

### 5.4 RSC Payload Structure

The RSC page stream for the chat list is:

```
2:I[52391,[],"ClientPageRoot"]                            ← page root
3:I[93236,[...],"default",1]                              ← chat page module
4:I[37195,[...],"default"]                                ← layout
5:I[44669,[...],""]                                       ← another layout
6:"$Sreact.suspense"                                      ← suspense marker
7:I[98976,[...],"PreloadCss"]
9:I[82702,[...],"BailoutToCSR"]
a:I[4727,[...],"default"]
c:I[72830,[...],"default"]
d:I[93561,[...],"default"]
f:I[50825,[...],"ChatProvider"]                           ← chat providers
10:I[21099,[...],"ChatRoomsProvider"]
11:I[12374,[...],"ChatHistoryProvider"]
12:I[29763,[...],"CurrentRoomProvider"]
0:["hTYxyeCTWkN-Yv9iEw-pX",[...route tree...]]
```

The `f`, `10`, `11`, `12` lines are the **provider chain** applied at the layout level.

---

## 6. Chat Room JID Format

### 6.1 Structure

```
{roomHash}-{listingId}-{userHash}@muclight.{xmppDomain}
```

Example breakdown:
```
effbd0ae2bc2567a83c38d768f3b1fc2   ← room hash
-                                    ← separator
467318705                            ← listing ID
-                                    ← separator
dd7fb953a88bb782af08e21db20db8a4   ← current user's XMPP hash
@muclight.im.mielse.com              ← MUC-Light subdomain
```

### 6.2 Decoding in Python

```python
from urllib.parse import unquote

def parse_room_jid(jid: str) -> dict:
    """Split a Sheypoor MUC-Light JID into its parts."""
    local, _, domain = jid.partition("@")
    room_hash, listing_id, user_hash = local.split("-", 2)
    return {
        "room_hash":  room_hash,
        "listing_id": int(listing_id),
        "user_hash":  user_hash,
        "domain":     domain,
    }

# Example:
parse_room_jid(
    "effbd0ae2bc2567a83c38d768f3b1fc2-467318705-dd7fb953a88bb782af08e21db20db8a4@muclight.im.mielse.com"
)
# → {
#     "room_hash":  "effbd0ae2bc2567a83c38d768f3b1fc2",
#     "listing_id": 467318705,
#     "user_hash":  "dd7fb953a88bb782af08e21db20db8a4",
#     "domain":     "muclight.im.mielse.com",
#   }
```

### 6.3 Notes

- The `room_hash` is **per-listing**, so all conversations about listing `467318705` share the same room prefix.
- The `user_hash` identifies the **current** user (the one whose credentials are loaded). The other party's JID has a different `user_hash`.
- The domain is `muclight.<xmpp-domain>` to distinguish MUC-Light from the main XMPP service.

---

## 7. Bookmarks

### 7.1 Overview

The **bookmarks** feature (Persian: "ذخیره‌ها") saves listings for later. It's distinct from the chat system and has its own API + RSC page.

| Component | Value |
|-----------|-------|
| Page route | `/session/bookmarks` |
| Page module | `70413` |
| Layout module | `78341` |
| API | `GET /api/v10.0.0/user/favorites` |

### 7.2 API

```
GET /api/v10.0.0/user/favorites?page[number]={n}&page[size]={size}
Cookie: access_token=Bearer <token>
```

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page[number]` | number | `1` | Page number |
| `page[size]` | number | `24` | Items per page |

#### Response (empty)

```json
{
  "jsonapi": { "version": "1.1" },
  "meta": { "total_items": 0 },
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

#### Response (with items, inferred)

Based on the standard Sheypoor listing schema, each item in `data[]` is likely a `publicListing` (or `userListing`) resource with `attributes` mirroring the search results schema. See the search API doc for field reference.

### 7.3 Bookmarks RSC Page

The `/session/bookmarks` page is fetched as an RSC stream:

```
GET /session/bookmarks?_rsc={hash}
```

Layout: `78341` (from `/session/bookmarks/layout-*.js`).

### 7.4 Adding/Removing Bookmarks

The API endpoints for add/remove are **not captured**. Based on standard REST patterns, expect:

```
POST   /api/v10.0.0/user/favorites/{listingId}    ← add
DELETE /api/v10.0.0/user/favorites/{listingId}    ← remove
```

Or a body-based variant:

```
POST /api/v10.0.0/user/favorites
{ "listingId": "467318705" }
```

The exact contract is unconfirmed — capture the XHR when clicking the bookmark icon in the UI.

### 7.5 Client-Side Bookmark State

The bookmark icon on each listing uses the `saved_items` **cookie** (client-side only):

```
Cookie: saved_items=%5B%5D   ← JSON array of listing IDs
```

This is **cosmetic** — the server persists favorites via `/user/favorites`. The cookie is used for instant UI feedback before the API responds.

---

## 8. Bookmarks RSC Routes

### 8.1 Route

```
/session/bookmarks
```

### 8.2 Page Module

`70413` — loaded from:

```
/app/(withAuth)/session/bookmarks/page-0c7a1d0f6f9aa381.js
```

### 8.3 Layout

`78341` — loaded from:

```
/app/(withAuth)/session/bookmarks/layout-296ca50d8437350a.js
```

### 8.4 RSC Stream Structure

```
2:I[52391,[],"ClientPageRoot"]
3:I[70413,[...],"default",1]           ← bookmarks page
4:I[37195,[...],"default"]             ← layout
5:I[44669,[...],""]
6:"$Sreact.suspense"
7:I[98976,[...],"PreloadCss"]
9:I[82702,[...],"BailoutToCSR"]
a:I[4727,[...],"default"]
c:I[72830,[...],"default"]
d:I[93561,[...],"default"]
0:["hTYxyeCTWkN-Yv9iEw-pX",[...tree...]]
```

### 8.5 Header Variant

The bookmarks layout uses a **different header** than other session pages — it has a mobile-friendly title bar:

```jsx
<header className="... bg-light-4 shadow-sm shadow-dark-4 desktop:shadow-none mobile:h-16">
  <span className="text-heading-4-normal text-dark-0 desktop:hidden">ذخیره‌ها</span>
  ...
</header>
```

The mobile header renders the title "ذخیره‌ها" (Bookmarks) while the desktop header uses the full nav.

---

## 9. Reference Implementation

### 9.1 Python — Fetch Chat Rooms & Credentials

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


def chat_credentials() -> dict:
    r = session.get(f"{BASE}/chat/credentials")
    r.raise_for_status()
    return r.json()["data"]


def chat_rooms(page: int = 1) -> dict:
    r = session.get(f"{BASE}/chat/rooms", params={"page": page})
    r.raise_for_status()
    return r.json()["data"]


def chat_suggestions(listing_id: int, prefix: str = "") -> list[str]:
    r = session.get(
        f"{BASE}/chat/suggestion",
        params={"listingId": listing_id, "message": prefix},
    )
    if r.status_code == 304:
        return []  # not modified; use cached
    r.raise_for_status()
    return r.json()["data"]["suggestions"]


def unread_messages() -> int:
    r = session.get(f"{BASE}/chat/unread-messages-count")
    r.raise_for_status()
    return r.json()["unread"]


if __name__ == "__main__":
    creds = chat_credentials()
    print("XMPP username:", creds["username"])
    print("XMPP password:", creds["password"][:8] + "...")
    print("Nickname:     ", creds["nickname"])

    rooms = chat_rooms(page=1)
    print(f"\nTotal rooms: {rooms['total']} (limit {rooms['limit']})")
    for room in rooms["list"]:
        print(f"  [{room['unread']}] {room['title']} — {room['msg'][:40]}")
        print(f"      JID: {room['room_jid']}")
        print(f"      Listing: {room['id']}  is_owner={room['is_owner']}")

    print("\nUnread total:", unread_messages())

    if rooms["list"]:
        first = rooms["list"][0]
        print(f"\nSuggestions for {first['id']}:")
        for s in chat_suggestions(first["id"]):
            print("  •", s)
```

### 9.2 Python — Raw XMPP Connection (websockets)

```python
import asyncio, base64, json, ssl
import websockets
import requests

BASE = "https://www.sheypoor.com/api/v10.0.0"
XMPP_WS = "wss://www.sheypoor.com/xmpp"
XMPP_DOMAIN = "im.mielse.com"


def fetch_credentials(cookies: dict) -> dict:
    r = requests.get(
        f"{BASE}/chat/credentials",
        cookies=cookies,
        headers={"User-Agent": "Mozilla/5.0 ..."},
    )
    r.raise_for_status()
    return r.json()["data"]


async def xmpp_session(creds: dict) -> None:
    username = creds["username"]   # e.g., "dd7fb...@im.mielse.com"
    password = creds["password"]

    # SASL PLAIN payload: \0 <authcid> \0 <password>
    authcid = username.split("@")[0]
    sasl = base64.b64encode(
        f"\0{authcid}\0{password}".encode()
    ).decode()

    ssl_ctx = ssl.create_default_context()

    async with websockets.connect(XMPP_WS, ssl=ssl_ctx) as ws:
        # 1. Open stream
        await ws.send(
            f'<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" '
            f'to="{XMPP_DOMAIN}" version="1.0"/>'
        )
        print("S:", await ws.recv())   # <open .../> + <stream:features>

        # 2. SASL PLAIN
        await ws.send(
            f'<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" '
            f'mechanism="PLAIN">{sasl}</auth>'
        )
        print("S:", await ws.recv())   # <success/>

        # 3. Reopen stream
        await ws.send(
            f'<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" '
            f'to="{XMPP_DOMAIN}" version="1.0"/>'
        )
        print("S:", await ws.recv())

        # 4. Bind resource
        await ws.send(
            '<iq type="set" id="bind1">'
            '<bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">'
            '<resource>web</resource>'
            '</bind></iq>'
        )
        print("S:", await ws.recv())

        # 5. Keep-alive loop (ping every 30s)
        while True:
            await asyncio.sleep(30)
            await ws.send(
                f'<iq type="get" to="{XMPP_DOMAIN}" id="ping1">'
                f'<ping xmlns="urn:xmpp:ping"/></iq>'
            )
            resp = await ws.recv()
            print("S:", resp)


# Usage:
# creds = fetch_credentials({"access_token": "Bearer eyJ..."})
# asyncio.run(xmpp_session(creds))
```

### 9.3 TypeScript — Chat State Hook (conceptual)

```typescript
import { createContext, useContext, useEffect, useState } from "react";

interface ChatRoom {
  timestamp: number;
  room_jid: string;
  unread: number;
  msg: string;
  msg_id: string;
  id: number;
  title: string;
  price: string;
  image: string;
  nickname: string;
  is_owner: boolean;
  is_expired: boolean;
  active: boolean;
  listing_url: string;
}

interface ChatContextValue {
  rooms: ChatRoom[];
  currentJid: string | null;
  setCurrentJid: (jid: string | null) => void;
  unread: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentJid, setCurrentJid] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Fetch rooms
    fetch("/api/v10.0.0/chat/rooms?page=1", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRooms(d.data.list));

    // Fetch unread count
    fetch("/api/v10.0.0/chat/unread-messages-count", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUnread(d.unread));
  }, []);

  return (
    <ChatContext.Provider value={{ rooms, currentJid, setCurrentJid, unread }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}
```

### 9.4 Python — Fetch Bookmarks

```python
def my_bookmarks(page: int = 1, size: int = 24) -> dict:
    r = session.get(
        f"{BASE}/user/favorites",
        params={"page[number]": page, "page[size]": size},
    )
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    doc = my_bookmarks(page=1)
    print(f"Total bookmarks: {doc['meta']['total_items']}")
    for item in doc.get("data", []):
        attrs = item["attributes"]
        print(f"  {item['id']}: {attrs.get('title')}")
```

---

## 10. Cheat Sheet

### 10.1 Chat

| Task | Endpoint |
|------|----------|
| List chat rooms | `GET /chat/rooms?page={n}` |
| Get XMPP credentials | `GET /chat/credentials` |
| Message suggestions | `GET /chat/suggestion?listingId={id}&message={prefix}` |
| Unread count | `GET /chat/unread-messages-count` |
| Open a specific chat | `/session/myChats?jid={url-encoded-room_jid}` |
| XMPP WebSocket | `wss://www.sheypoor.com/xmpp` |
| XMPP domain | `im.mielse.com` |
| MUC-Light domain | `muclight.im.mielse.com` |

### 10.2 Bookmarks

| Task | Endpoint |
|------|----------|
| List bookmarks | `GET /user/favorites?page[number]=&page[size]=` |
| Bookmarks page | `/session/bookmarks?_rsc={hash}` |
| Client-side cache | Cookie `saved_items` (JSON array of IDs) |

### 10.3 Room JID Format

```
{roomHash}-{listingId}-{userHash}@muclight.im.mielse.com
```

### 10.4 XMPP Stanzas Reference

| Direction | Stanza | Purpose |
|-----------|--------|---------|
| C → S | `<open xmlns="urn:ietf:params:xml:ns:xmpp-framing">` | Open stream |
| C → S | `<auth mechanism="PLAIN">` | SASL auth |
| C → S | `<iq type="set"><bind>...</bind></iq>` | Bind resource |
| C → S | `<iq type="set" id="getRoomHistory"><query xmlns="urn:xmpp:mam:2">` | Fetch history |
| C → S | `<iq type="get"><ping xmlns="urn:xmpp:ping"/></iq>` | Keepalive |
| C → S | `<r xmlns="urn:xmpp:sm:3"/>` | Request ack |
| S → C | `<a xmlns="urn:xmpp:sm:3" h="10"/>` | Ack reply |
| S → C | `<fin xmlns="urn:xmpp:mam:2" complete="true">` | MAM complete |

### 10.5 Chat Page Modules

| Route | Page Module | Layout Module |
|-------|-------------|---------------|
| `/session/myChats` | `93236` | `33243` |
| `/session/bookmarks` | `70413` | `78341` |
| `ClientPageRoot` | `52391` (shared) | — |

### 10.6 Chat Providers

| Provider | Module | State |
|----------|--------|-------|
| `ChatProvider` | `50825` | XMPP connection |
| `ChatRoomsProvider` | `21099` | Room list |
| `ChatHistoryProvider` | `12374` | Message archive |
| `CurrentRoomProvider` | `29763` | Active room |

### 10.7 Notable Design Points

- **Chat uses XMPP**, not REST, for message delivery. The REST API only provides room metadata, credentials, and suggestions.
- **Credentials rotate** — refetch `/chat/credentials` on reconnect or 401.
- **MAM history** is fetched via IQ queries over the same WebSocket, not via HTTP.
- **Room JIDs are deterministic** — `{roomHash}-{listingId}-{userHash}@muclight.im.mielse.com` — so you can pre-compute the room for a listing.
- **Bookmarks use JSON:API** with `page[number]` / `page[size]` pagination.
- **`saved_items` cookie** is a client-side cache; the source of truth is `/user/favorites`.

> ⚠️ **Disclaimer:** These endpoints are reverse-engineered from observed traffic. Chat credentials are sensitive — never share or log them. The XMPP server may enforce rate limits and may reject non-browser clients. Respect Sheypoor's Terms of Service and only access chats you're authorized to view.