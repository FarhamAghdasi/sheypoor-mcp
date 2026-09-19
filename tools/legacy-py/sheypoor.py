#!/usr/bin/env python3
"""
Sheypoor API Client
===================

A comprehensive, reverse-engineered Python client for https://www.sheypoor.com

Covers:
  * Search (cursor pagination, filters, sorting)
  * Listing detail (JSON API + SSR / RSC extraction + JSON-LD fallback)
  * Metadata: categories, locations, versions, popular searches, autocomplete
  * SERP main + filter definitions
  * Native ad banners
  * Authentication (phone + OTP, token refresh)
  * User account: profile, listings, packages, buyer/seller orders, payments, wallets
  * Chat: rooms, XMPP credentials, suggestions, unread count
  * Bookmarks

Reverse-engineered from observed traffic. Respect Sheypoor's ToS and robots.txt.
"""

from __future__ import annotations

import argparse
import base64
import codecs
import html as html_lib
import json
import logging
import pathlib
import random
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple, Union
from urllib.parse import unquote, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SITE = "https://www.sheypoor.com"
API = f"{SITE}/api/v10.0.0"
XMPP_WS = "wss://www.sheypoor.com/xmpp"
XMPP_DOMAIN = "im.mielse.com"

DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS: Dict[str, str] = {
    "User-Agent": DEFAULT_UA,
    "Accept": "application/json, text/html;q=0.9",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Referer": f"{SITE}/",
    "Origin": SITE,
}

COOKIE_FILE = Path.home() / ".sheypoor" / "cookies.json"

JSONAPI_HEADERS: Dict[str, str] = {
    **DEFAULT_HEADERS,
    "Accept": "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
}

RSC_HEADERS: Dict[str, str] = {
    **DEFAULT_HEADERS,
    "RSC": "1",
    "Accept": "text/x-component",
}

log = logging.getLogger("sheypoor")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class SheypoorError(Exception):
    """Base client error."""


class SheypoorAuthError(SheypoorError):
    """Raised on authentication failure or expired token."""


class SheypoorNotFound(SheypoorError):
    """Raised when a resource is 404."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RSC_CHUNK_RE = re.compile(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)')
LISTING_ID_RE = re.compile(r"-(\d+)\.html$")


def extract_listing_id(url_or_slug: str) -> Optional[str]:
    """Extract a numeric listing ID from a Sheypoor detail URL or slug."""
    path = unquote(url_or_slug.split("?")[0])
    m = LISTING_ID_RE.search(path)
    return m.group(1) if m else None


def _balanced_json(s: str, i: int) -> Any:
    """Parse a balanced-brace JSON value starting at s[i]."""
    depth, in_str, esc, start = 0, False, False, i
    for j in range(i, len(s)):
        ch = s[j]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[start : j + 1])
    raise ValueError("Unbalanced JSON at offset %d" % i)


def parse_rsc_payload(html: str) -> str:
    """Reconstruct the concatenated RSC stream from an SSR HTML page."""
    chunks = RSC_CHUNK_RE.findall(html)
    return "".join(codecs.decode(c, "unicode_escape") for c in chunks)


def parse_jsonld(html: str) -> List[Dict[str, Any]]:
    """Return all JSON-LD blocks in an HTML document."""
    blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    out: List[Dict[str, Any]] = []
    for raw in blocks:
        try:
            out.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return out


def decode_jwt_payload(token: str) -> Dict[str, Any]:
    """Decode (without verifying) the payload section of a JWT."""
    parts = token.split(".")
    if len(parts) < 2:
        raise ValueError("not a JWT")
    b64 = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(b64))


def parse_room_jid(jid: str) -> Dict[str, Any]:
    """Split a Sheypoor MUC-Light JID into its parts."""
    local, _, domain = jid.partition("@")
    parts = local.split("-", 2)
    if len(parts) != 3:
        return {"raw": jid, "domain": domain}
    room_hash, listing_id, user_hash = parts
    return {
        "room_hash": room_hash,
        "listing_id": int(listing_id),
        "user_hash": user_hash,
        "domain": domain,
    }


# ---------------------------------------------------------------------------
# Data classes (lightweight views)
# ---------------------------------------------------------------------------

@dataclass
class ListingDetail:
    """Structured view over a `publicListingDetails` payload."""

    id: str
    title: str
    url: str
    time_passed_label: Optional[str] = None
    description: str = ""              # raw HTML
    description_text: str = ""         # HTML-stripped
    price: List[Dict[str, Any]] = field(default_factory=list)
    location: Optional[str] = None
    phone: Optional[str] = None
    images: List[str] = field(default_factory=list)          # desktop
    images_mobile: List[str] = field(default_factory=list)   # mobile
    image_count: int = 0
    video_count: int = 0
    seller: Optional[Dict[str, Any]] = None
    breadcrumbs: List[Dict[str, Any]] = field(default_factory=list)
    attributes: List[Dict[str, Any]] = field(default_factory=list)
    category_id: Optional[int] = None
    top_category_id: Optional[int] = None
    actions: List[str] = field(default_factory=list)
    is_shop_profile: bool = False
    is_phone_verified: bool = False
    is_secure_purchase: bool = False
    added_at: Optional[str] = None
    landings: List[Dict[str, Any]] = field(default_factory=list)
    videos: List[Dict[str, Any]] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def seller_name(self) -> Optional[str]:
        return (self.seller or {}).get("name")

    @property
    def seller_url(self) -> Optional[str]:
        return (self.seller or {}).get("url")

    @property
    def price_text(self) -> str:
        parts = []
        for p in self.price:
            amount = p.get("amount") or ""
            cur    = p.get("currency") or ""
            label  = p.get("label") or ""
            bit = f"{label} {amount} {cur}".strip()
            if bit:
                parts.append(bit)
        return " | ".join(parts) if parts else "—"

    @property
    def location_chain(self) -> List[str]:
        return [b.get("title", "") for b in self.breadcrumbs if b.get("title")]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "time_passed_label": self.time_passed_label,
            "description": self.description_text,
            "price": self.price,
            "price_text": self.price_text,
            "location": self.location,
            "phone": self.phone,
            "images": self.images,
            "image_count": self.image_count,
            "video_count": self.video_count,
            "seller": self.seller,
            "breadcrumbs": self.breadcrumbs,
            "attributes": self.attributes,
            "category_id": self.category_id,
            "top_category_id": self.top_category_id,
            "actions": self.actions,
            "is_shop_profile": self.is_shop_profile,
            "is_phone_verified": self.is_phone_verified,
            "is_secure_purchase": self.is_secure_purchase,
            "added_at": self.added_at,
            "landings": self.landings,
        }

    @classmethod
    def from_api(cls, doc: Dict[str, Any]) -> "ListingDetail":
        """
        Accepts either the full API envelope
        (`{"data": {"type": "publicListingDetails", ...}}`)
        or the bare details object. Handles both the flat shape described in
        the docs AND the current `attributes`-wrapped shape.
        """
        if isinstance(doc, dict) and isinstance(doc.get("data"), dict):
            details = doc["data"]
        else:
            details = doc

        if isinstance(details.get("attributes"), dict):
            a = details["attributes"]
        else:
            a = details

        images = a.get("images") or []
        desktop_urls: List[str] = []
        mobile_urls:  List[str] = []
        for img in images:
            src = img.get("source") or {}
            if src.get("desktop"):
                desktop_urls.append(src["desktop"])
            if src.get("mobile"):
                mobile_urls.append(src["mobile"])

        raw_desc = a.get("description") or ""
        text_desc = re.sub(r"<br\s*/?>", "\n", raw_desc)
        text_desc = re.sub(r"<[^>]+>", "", text_desc)
        text_desc = html_lib.unescape(text_desc).strip()

        return cls(
            id=str(details.get("id") or a.get("id") or ""),
            title=a.get("title", ""),
            url=a.get("url", ""),
            time_passed_label=a.get("timePassedLabel"),
            description=raw_desc,
            description_text=text_desc,
            price=a.get("price") or [],
            location=a.get("location"),
            phone=a.get("phone"),
            images=desktop_urls,
            images_mobile=mobile_urls,
            image_count=a.get("imageCount", 0) or 0,
            video_count=a.get("videoCount", 0) or 0,
            seller=a.get("seller"),
            breadcrumbs=a.get("breadcrumbs") or [],
            attributes=a.get("attributes") or [],
            category_id=a.get("categoryId"),
            top_category_id=a.get("topCategoryId"),
            actions=a.get("actions") or [],
            is_shop_profile=bool(a.get("isShopProfile")),
            is_phone_verified=bool(a.get("isPhoneVerified")),
            is_secure_purchase=bool(a.get("isSecurePurchase")),
            added_at=a.get("addedAt"),
            landings=a.get("landings") or [],
            videos=a.get("videos") or [],
            raw=details,
        )


@dataclass
class Listing:
    """Convenience view over a search-result listing item."""
    id: str
    type: str
    title: str
    url: str
    price: List[Dict[str, Any]] = field(default_factory=list)
    location: Optional[str] = None
    category_id: Optional[int] = None
    images: Dict[str, Any] = field(default_factory=dict)
    attributes: List[Dict[str, Any]] = field(default_factory=list)
    telephone: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_item(cls, item: Dict[str, Any]) -> "Listing":
        a = item.get("attributes") or {}
        return cls(
            id=str(item.get("id")),
            type=item.get("type", "normal"),
            title=a.get("title", ""),
            url=a.get("url", ""),
            price=a.get("price") or [],
            location=a.get("location"),
            category_id=a.get("categoryId"),
            images=a.get("images") or {},
            attributes=item.get("fullAttributes") or a.get("attributes") or [],
            telephone=a.get("telephone"),
            raw=item,
        )


# ---------------------------------------------------------------------------
# The client
# ---------------------------------------------------------------------------

class Sheypoor:
    """
    Main entry point. Handles HTTP, retries, polite throttling, and auth state.
    """

    def __init__(
        self,
        *,
        cookies: Optional[Dict[str, str]] = None,
        cookie_file: Optional[Union[str, Path]] = COOKIE_FILE,
        min_delay: float = 0.5,
        max_delay: float = 1.5,
        timeout: float = 20.0,
        user_agent: str = DEFAULT_UA,
        autoload_cookies: bool = True,
    ) -> None:
        self.timeout = timeout
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.cookie_file = Path(cookie_file) if cookie_file is not None else None

        self.session = requests.Session()
        self.session.headers.update({**DEFAULT_HEADERS, "User-Agent": user_agent})

        retry = Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT", "DELETE"],
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        self.user_id: Optional[str] = None
        self.user_name: Optional[str] = None
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None

        if cookies:
            for k, v in cookies.items():
                self.session.cookies.set(k, v)
            self._restore_tokens_from_cookies()
        elif autoload_cookies and self.cookie_file and self.cookie_file.exists():
            try:
                self.load_cookies()
            except Exception as exc:  # noqa: BLE001
                log.warning("Could not load cookie file %s: %s", self.cookie_file, exc)

    # ---------------------------------------------------------- cookies

    def _restore_tokens_from_cookies(self) -> None:
        """Rehydrate access/refresh tokens from the cookie jar."""
        jar = self.session.cookies.get_dict()
        at = jar.get("access_token")
        rt = jar.get("refresh_token")
        if at:
            self.access_token = at[len("Bearer "):] if at.startswith("Bearer ") else at
            try:
                self.user_id = str(decode_jwt_payload(self.access_token).get("userId"))
            except Exception:  # noqa: BLE001
                pass
        if rt:
            self.refresh_token = rt[len("Bearer "):] if rt.startswith("Bearer ") else rt

    def load_cookies(self, path: Optional[Path] = None) -> Dict[str, str]:
        """Load cookies from a JSON file into the session."""
        path = Path(path) if path else self.cookie_file
        if not path or not path.exists():
            return {}
        data = json.loads(path.read_text())
        for k, v in data.items():
            self.session.cookies.set(k, v)
        self._restore_tokens_from_cookies()
        log.info("Loaded %d cookies from %s", len(data), path)
        return data

    def save_cookies(self, path: Optional[Path] = None) -> Optional[Path]:
        """Persist the current cookie jar (incl. tokens) to disk."""
        path = Path(path) if path else self.cookie_file
        if not path:
            return None
        path.parent.mkdir(parents=True, exist_ok=True)

        data = self.session.cookies.get_dict()
        if self.access_token:
            data["access_token"] = f"Bearer {self.access_token}"
        if self.refresh_token:
            data["refresh_token"] = f"Bearer {self.refresh_token}"
        if self.access_token or self.refresh_token:
            data["user_logged_in"] = "1"

        path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        log.debug("Saved %d cookies to %s", len(data), path)
        return path

    def clear_cookies(self, path: Optional[Path] = None) -> None:
        """Delete the cookie file and clear the in-memory jar."""
        path = Path(path) if path else self.cookie_file
        if path and path.exists():
            path.unlink()
        self.session.cookies.clear()
        self.access_token = self.refresh_token = self.user_id = None

    def logout(self) -> None:
        self.clear_cookies()

    @property
    def is_authenticated(self) -> bool:
        return bool(self.access_token) or "access_token" in self.session.cookies.get_dict()

    # ------------------------------------------------------------------ HTTP

    def _sleep(self) -> None:
        time.sleep(random.uniform(self.min_delay, self.max_delay))

    def _request(
        self,
        method: str,
        path: str,
        *,
        api: bool = True,
        jsonapi: bool = False,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        raw_url: Optional[str] = None,
        stream: bool = False,
    ) -> requests.Response:
        url = raw_url or (f"{API}{path}" if api else f"{SITE}{path}")
        hdrs = dict(JSONAPI_HEADERS if jsonapi else DEFAULT_HEADERS)
        if headers:
            hdrs.update(headers)
        # Always include tokens if we have them
        if self.access_token:
            hdrs.setdefault("Authorization", f"Bearer {self.access_token}")

        self._sleep()
        resp = self.session.request(
            method,
            url,
            params=params,
            json=json_body,
            headers=hdrs,
            timeout=self.timeout,
            stream=stream,
        )

        if resp.status_code == 401:
            raise SheypoorAuthError(f"401 Unauthorized for {url}")
        if resp.status_code == 404:
            raise SheypoorNotFound(f"404 Not Found: {url}")
        resp.raise_for_status()
        return resp

    def _get_json(self, path: str, **kw) -> Any:
        return self._request("GET", path, **kw).json()

    def _get_text(self, path: str, **kw) -> str:
        return self._request("GET", path, **kw).text

    # -------------------------------------------------------------- RSC page

    def _fetch_rsc_page(self, path: str) -> str:
        """Fetch a protected RSC stream (e.g. /session/...)."""
        params = {"_rsc": f"{random.randint(0, 0xFFFFFF):x}"}
        return self._request(
            "GET", path, api=False, params=params, headers=RSC_HEADERS
        ).text

    # ============================================================== METADATA

    def versions(self) -> Dict[str, Any]:
        """GET /general/versions — cache-busting data versions."""
        return self._get_json("/general/versions")

    def categories(self) -> Dict[str, Any]:
        """GET /general/categories — full category tree + attribute definitions."""
        return self._get_json("/general/categories", jsonapi=True)

    def categories_compact(self) -> Dict[str, Any]:
        """GET /categories/compact — 2-level category tree (normalized)."""
        raw = self._get_json("/categories/compact")
        return self._normalize_categories(raw)

    @staticmethod
    def _normalize_categories(doc: Any) -> Dict[str, Any]:
        """
        Normalize to: {data: [{id, name, slug, children: [...]}], raw: ...}.
        Handles:
          * name at the top level OR under `attributes`
          * children inline OR under relationships.children.data
          * single or double `data` wrapping
        """
        def pick(d: Dict[str, Any], *keys: str) -> Any:
            for k in keys:
                v = d.get(k)
                if v not in (None, ""):
                    return v
            return None

        def normalize(node: Dict[str, Any]) -> Dict[str, Any]:
            attrs = node.get("attributes") or {}
            name = pick(node, "name", "title") or pick(attrs, "name", "title")
            slug = pick(node, "slug") or pick(attrs, "slug")

            children_raw = node.get("children")
            if children_raw is None:
                rel = (node.get("relationships") or {}).get("children") or {}
                children_raw = rel.get("data") or []
            if isinstance(children_raw, dict):
                children_raw = children_raw.get("data") or []
            children = [normalize(c) for c in children_raw if isinstance(c, dict)]

            return {
                "id": str(node.get("id")),
                "name": name,
                "slug": slug,
                "children": children,
            }

        data = doc
        while isinstance(data, dict) and "data" in data:
            data = data["data"]
        if not isinstance(data, list):
            return {"data": [], "raw": doc}
        return {"data": [normalize(c) for c in data], "raw": doc}

    def locations(self) -> Dict[str, Any]:
        """GET /general/locations — province / city / district hierarchy."""
        return self._get_json("/general/locations")

    def popular_searches(self) -> List[Dict[str, Any]]:
        """GET /search/popular-searches — trending terms."""
        return self._get_json("/search/popular-searches", jsonapi=True).get("data", [])

    def suggestions(self, city_slug: str, prefix: str) -> List[Dict[str, Any]]:
        """GET /search/suggestion/{city}?q= — autocomplete."""
        return self._get_json(
            f"/search/suggestion/{city_slug}",
            params={"q": prefix},
            jsonapi=True,
        ).get("data", [])

    def serp_main(self, slug_path: str = "iran", **context: Any) -> Dict[str, Any]:
        """
        GET /search/main — SEO metadata (title, h1, breadcrumbs, FAQs).
        `context` accepts c, ct, r, nh, o, q, etc.
        """
        params = self._encode_context(context)
        return self._get_json("/search/main", params=params, jsonapi=True)

    def serp_filters(self, slug_path: str, **context: Any) -> Dict[str, Any]:
        """
        GET /search/filters/{slugPath} — filter definitions for a context.
        """
        slug_path = slug_path.strip("/")
        params = self._encode_context(context)
        return self._get_json(
            f"/search/filters/{slug_path}", params=params, jsonapi=True
        )

    @staticmethod
    def _encode_context(ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Normalise neighbourhood arrays and drop None values."""
        out: Dict[str, Any] = {}
        for k, v in ctx.items():
            if v is None:
                continue
            if k == "nh" and isinstance(v, (list, tuple)):
                for i, item in enumerate(v):
                    out[f"nh[{i}]"] = item
            elif isinstance(v, bool):
                out[k] = str(v).lower()
            else:
                out[k] = v
        return out

    # ================================================================ SEARCH

    def search(
        self,
        city_slug: str = "iran",
        *,
        q: Optional[str] = None,
        page: int = 1,
        cursor: Optional[str] = None,
        c: Optional[int] = None,
        ct: Optional[int] = None,
        r: Optional[int] = None,
        nh: Optional[List[int]] = None,
        o: Optional[str] = None,
        mnp: Optional[int] = None,
        mxp: Optional[int] = None,
        brands: Optional[Union[int, str]] = None,
        wi: Optional[bool] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        GET /search/{citySlug} — one page of listing results.

        Returns the raw JSON: `{data: [...], meta: {...}, extra_sections: [...]}`.
        """
        params: Dict[str, Any] = {"p": page}
        if q is not None:
            params["q"] = q
        if cursor:
            params["f"] = cursor
        if c is not None:
            params["c"] = c
        if ct is not None:
            params["ct"] = ct
        if r is not None:
            params["r"] = r
        if nh:
            for i, item in enumerate(nh):
                params[f"nh[{i}]"] = item
        if o:
            params["o"] = o
        if mnp is not None:
            params["mnp"] = mnp
        if mxp is not None:
            params["mxp"] = mxp
        if brands is not None:
            params["brands"] = brands
        if wi is not None:
            params["wi"] = "true" if wi else "false"
        if extra:
            params.update(extra)

        return self._get_json(f"/search/{city_slug}", params=params)

    @staticmethod
    def _iter_listings_from_page(payload: Dict[str, Any]) -> Iterator[Listing]:
        for group in payload.get("data", []):
            gtype = group.get("type")
            if gtype in ("listingGroup",):
                for item in group.get("items", []):
                    yield Listing.from_item(item)
            elif gtype in ("vip",):
                for item in group.get("items", []):
                    yield Listing.from_item(item)
            elif gtype in ("normal", "paidEngagement"):
                yield Listing.from_item(group)

    def iter_search(
        self,
        city_slug: str = "iran",
        *,
        max_pages: int = 20,
        **kwargs: Any,
    ) -> Iterator[Listing]:
        """Yield every listing from a cursor-paginated search."""
        cursor: Optional[str] = None
        page = 1
        while page <= max_pages:
            payload = self.search(
                city_slug, page=page, cursor=cursor, **kwargs
            )
            yielded = False
            for listing in self._iter_listings_from_page(payload):
                yielded = True
                yield listing

            cursor = (payload.get("meta") or {}).get("f")
            if not cursor or not yielded:
                return
            page += 1

    # =============================================================== LISTING

    def listing_api(self, listing_id: Union[str, int]) -> Dict[str, Any]:
        """GET /listings/{id} — canonical JSON API (with meta.seo)."""
        return self._get_json(f"/listings/{listing_id}")

    def listing_detail(self, listing_id: Union[str, int]) -> ListingDetail:
        """Fetch a listing and parse it into a `ListingDetail` object."""
        return ListingDetail.from_api(self.listing_api(listing_id))

    def listing(self, listing_id: Union[str, int]) -> Dict[str, Any]:
        """Return the `publicListingDetails` object for a listing."""
        doc = self.listing_api(listing_id)
        return doc.get("data", doc)

    def listing_ssr(self, url: str) -> Dict[str, Any]:
        """
        Fetch the SSR HTML page and extract `publicListingDetails` from the
        Next.js RSC stream. Falls back to JSON-LD if extraction fails.
        """
        html = self._get_text(url, api=False)
        payload = parse_rsc_payload(html)

        m = re.search(r'"queryKey":\["LOAD_LISTING",\s*"\d+"\]', payload)
        if m:
            idx = payload.find('"data":', m.end())
            if idx != -1:
                try:
                    blob = _balanced_json(payload, idx + len('"data":'))
                    return {
                        "listing": blob.get("data", blob),
                        "jsonld": parse_jsonld(html),
                        "source": "rsc",
                    }
                except Exception as exc:  # noqa: BLE001
                    log.warning("RSC parse failed: %s", exc)

        # JSON-LD fallback
        for block in parse_jsonld(html):
            if isinstance(block, dict) and block.get("@type") in (
                "Product",
                "ItemPage",
            ):
                return {"listing": None, "jsonld": block, "source": "jsonld"}
        return {"listing": None, "jsonld": None, "source": "none"}

    def listing_from_url(self, url: str) -> Dict[str, Any]:
        """Resolve a detail URL into the canonical `publicListingDetails`."""
        lid = extract_listing_id(url)
        if not lid:
            raise ValueError(f"no listing ID in {url!r}")
        return self.listing(lid)

    @staticmethod
    def full_size_image(url: str) -> str:
        """Rewrite an image URL to the largest available variant."""
        return re.sub(r"/\d+x\d+_[A-Za-z]+/", "/1500x1125_Sw/", url)

    # ============================================================== BANNERS

    def native_ad(self, city_slug: str = "iran", page: int = 1) -> Dict[str, Any]:
        """GET /banner/native-ad/{city}?f=&p= — native ad."""
        return self._get_json(
            f"/banner/native-ad/{city_slug}",
            params={"p": page, "f": "[1.0]"},
            jsonapi=True,
        )

    # ================================================================ AUTH

    def auth_send(self, phone: str) -> str:
        """
        POST /auth/send { username } — request an SMS code.
        Returns the short-lived `verify.token`.
        """
        doc = self._request(
            "POST",
            "/auth/send",
            json_body={"username": phone},
            headers={"Content-Type": "application/json"},
        ).json()
        if not doc.get("success"):
            raise SheypoorAuthError(doc.get("message", "auth/send failed"))
        return doc["data"]["verify"]["token"]

    def auth_verify(self, verify_token: str, code: str) -> Dict[str, Any]:
        """
        POST /auth/verify { verification_code } — exchange code for tokens.
        Sets cookies and records in-memory tokens.
        """
        doc = self._request(
            "POST",
            "/auth/verify",
            json_body={"verification_code": str(code)},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {verify_token}",
            },
        ).json()
        if not doc.get("success"):
            raise SheypoorAuthError(doc.get("message", "auth/verify failed"))

        d = doc["data"]
        self.user_id = str(d.get("userId"))
        self.user_name = d.get("userName")
        self.access_token = d["access"]["token"]
        self.refresh_token = d["refresh"]["token"]

        # Replicate the cookies the server would set
        self.session.cookies.set("access_token", f"Bearer {self.access_token}")
        self.session.cookies.set("refresh_token", f"Bearer {self.refresh_token}")
        self.session.cookies.set("user_logged_in", "1")
        self.save_cookies()
        return d

    def login(self, phone: str, code_provider) -> Dict[str, Any]:
        """
        Convenience wrapper:
            `code_provider` is a callable that receives the SMS is requested
            and returns the code (e.g. `input`).
        """
        vt = self.auth_send(phone)
        return self.auth_verify(vt, code_provider())

    def auth_refresh(self) -> Dict[str, Any]:
        """POST /auth/refresh (inferred) — reissue access token."""
        if not self.refresh_token:
            raise SheypoorAuthError("no refresh token available")
        doc = self._request(
            "POST",
            "/auth/refresh",
            headers={"Authorization": f"Bearer {self.refresh_token}"},
        ).json()
        d = doc.get("data", doc)
        if "access" in d:
            self.access_token = d["access"]["token"]
            self.session.cookies.set(
                "access_token", f"Bearer {self.access_token}"
            )
            self.save_cookies()
        return d

    # ============================================================= ACCOUNT

    def profile(self) -> Dict[str, Any]:
        """GET /user/profile-details."""
        return self._get_json("/user/profile-details", jsonapi=True)["data"]

    def my_listings(
        self,
        status: str = "all",
        *,
        is_shop: bool = False,
        page: int = 1,
        size: int = 24,
    ) -> Dict[str, Any]:
        """GET /user/listings/{status}."""
        return self._get_json(
            f"/user/listings/{status}",
            params={
                "isShop": str(is_shop).lower(),
                "page[number]": page,
                "page[size]": size,
            },
            jsonapi=True,
        )

    def iter_my_listings(
        self, status: str = "all", *, is_shop: bool = False, size: int = 24
    ) -> Iterator[Dict[str, Any]]:
        page = 1
        while True:
            doc = self.my_listings(status, is_shop=is_shop, page=page, size=size)
            items = doc.get("data", [])
            if not items:
                return
            yield from items
            if not (doc.get("links") or {}).get("next"):
                return
            page += 1

    def my_packages(self, *, active: bool = True, is_shop: bool = False) -> Dict[str, Any]:
        """GET /user/online-packages."""
        return self._get_json(
            "/user/online-packages",
            params={
                "active": str(active).lower(),
                "isShop": str(is_shop).lower(),
            },
            jsonapi=True,
        )

    def buyer_orders(
        self, state: str = "active", page: int = 1, size: int = 20
    ) -> Dict[str, Any]:
        """GET /newSecureTrade/service/buyer/orders."""
        return self._get_json(
            "/newSecureTrade/service/buyer/orders",
            params={"p": page, "page_size": size, "state": state},
        )

    def seller_orders(
        self, state: str = "active", page: int = 1, size: int = 20
    ) -> Dict[str, Any]:
        """GET /newSecureTrade/service/seller/orders."""
        return self._get_json(
            "/newSecureTrade/service/seller/orders",
            params={"p": page, "page_size": size, "state": state},
        )

    def my_payments(self, page: int = 1, size: int = 16) -> Dict[str, Any]:
        """GET /user/payments."""
        return self._get_json(
            "/user/payments",
            params={"page[number]": page, "page[size]": size},
            jsonapi=True,
        )

    def my_wallets(self) -> Dict[str, Any]:
        """GET /user/wallets."""
        return self._get_json("/user/wallets")

    # ================================================================ CHAT

    def chat_rooms(self, page: int = 1) -> Dict[str, Any]:
        """GET /chat/rooms — chat room list."""
        return self._get_json("/chat/rooms", params={"page": page})["data"]

    def chat_credentials(self) -> Dict[str, Any]:
        """GET /chat/credentials — rotating XMPP credentials."""
        return self._get_json("/chat/credentials")["data"]

    def chat_suggestions(
        self, listing_id: Union[int, str], prefix: str = ""
    ) -> List[str]:
        """GET /chat/suggestion — quick-reply suggestions."""
        r = self._request(
            "GET",
            "/chat/suggestion",
            params={"listingId": listing_id, "message": prefix},
        )
        if r.status_code == 304:
            return []
        return r.json().get("data", {}).get("suggestions", [])

    def chat_unread(self) -> int:
        """GET /chat/unread-messages-count."""
        doc = self._get_json("/chat/unread-messages-count")
        return int(doc.get("unread", (doc.get("data") or {}).get("unread", 0)))

    # ========================================================== BOOKMARKS

    def my_bookmarks(self, page: int = 1, size: int = 24) -> Dict[str, Any]:
        """GET /user/favorites."""
        return self._get_json(
            "/user/favorites",
            params={"page[number]": page, "page[size]": size},
            jsonapi=True,
        )

    # ========================================================== PROTECTED RSC

    def my_listings_rsc(self, status: str = "all") -> str:
        """Fetch the RSC stream for /session/myAccount/myListings/{status}."""
        return self._fetch_rsc_page(f"/session/myAccount/myListings/{status}")

    def my_chats_rsc(self) -> str:
        """Fetch the RSC stream for /session/myChats."""
        return self._fetch_rsc_page("/session/myChats")

    def bookmarks_rsc(self) -> str:
        """Fetch the RSC stream for /session/bookmarks."""
        return self._fetch_rsc_page("/session/bookmarks")

    # ========================================================== CLICK TRACK

    def track_click(
        self, query_id: str, listing_id: Union[str, int], position: int
    ) -> Dict[str, Any]:
        """
        GET /api/proxy/searchia — fire-and-forget analytics.
        Do NOT call this unless you are simulating real user clicks.
        """
        return self._get_json(
            "/proxy/searchia",
            params={"queryId": query_id, "id": listing_id, "position": position},
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cmd_search(args: argparse.Namespace) -> None:
    cli = Sheypoor()
    count = 0
    for listing in cli.iter_search(
        args.city, q=args.query, max_pages=args.pages
    ):
        print(f"{listing.id}\t{listing.title}\t{listing.price}")
        count += 1
    print(f"\n{count} listings", file=sys.stderr)


def _cmd_listing(args: argparse.Namespace) -> None:
    cli = Sheypoor()
    lid = extract_listing_id(args.url) if args.url else args.id
    if not lid:
        sys.exit("provide --id or --url")

    detail = cli.listing_detail(lid)

    if args.json:
        print(json.dumps(detail.raw, ensure_ascii=False, indent=2))
        return

    print(f"ID:            {detail.id}")
    print(f"Title:         {detail.title}")
    print(f"URL:           {detail.url}")
    print(f"Price:         {detail.price_text}")
    print(f"Location:      {detail.location}")
    print(f"Phone:         {detail.phone}  (verified={detail.is_phone_verified})")
    print(f"Added at:      {detail.added_at}  ({detail.time_passed_label})")
    print(f"Category:      {detail.category_id}  (top: {detail.top_category_id})")
    print(f"Seller:        {detail.seller_name}  <{detail.seller_url}>")
    print(f"Shop profile:  {detail.is_shop_profile}")
    print(f"Actions:       {', '.join(detail.actions)}")
    print(f"Images:        {len(detail.images)}")
    for i, url in enumerate(detail.images, 1):
        print(f"  [{i}] {url}")
    if detail.breadcrumbs:
        print("Breadcrumbs:")
        for b in detail.breadcrumbs:
            print(f"  - {b.get('title')} ({b.get('type')})")
    if detail.attributes:
        print("Attributes:")
        for a in detail.attributes:
            key = a.get("key") or a.get("id")
            print(f"  - {key}: {a.get('value')}")
    if detail.landings:
        print("Landings:")
        for l in detail.landings:
            print(f"  - {l.get('anchorTitle')}  →  {l.get('path')}")
    if detail.description_text:
        print("\nDescription:")
        print(detail.description_text)


def _cmd_categories(args: argparse.Namespace) -> None:
    cli = Sheypoor()
    doc = cli.categories_compact()
    for cat in doc.get("data", []):
        name = cat.get("name") or "(unnamed)"
        slug = f"  [{cat['slug']}]" if cat.get("slug") else ""
        print(f"{cat['id']}\t{name}{slug}")
        for child in cat.get("children", []):
            cname = child.get("name") or "(unnamed)"
            cslug = f"  [{child['slug']}]" if child.get("slug") else ""
            print(f"  └─ {child['id']}\t{cname}{cslug}")
    if getattr(args, "json", False):
        print(json.dumps(doc["raw"], ensure_ascii=False, indent=2))


def _cmd_suggest(args: argparse.Namespace) -> None:
    cli = Sheypoor()
    for item in cli.suggestions(args.city, args.prefix):
        print(item.get("attributes", {}).get("title"))


def _cmd_popular(args: argparse.Namespace) -> None:
    cli = Sheypoor()
    for item in cli.popular_searches():
        print(item.get("attributes", {}).get("title"))


def _cmd_login(args: argparse.Namespace) -> None:
    cli = Sheypoor(cookie_file=args.cookies_file)
    vt = cli.auth_send(args.phone)
    code = input("Enter the SMS code: ").strip()
    data = cli.auth_verify(vt, code)
    print(f"Logged in as {data['userName']} (userId={data['userId']})")
    if cli.cookie_file:
        print(f"Cookies saved to {cli.cookie_file}")


def _cmd_logout(args: argparse.Namespace) -> None:
    cli = Sheypoor(cookie_file=args.cookies_file)
    cli.logout()
    print("Cookies cleared.")


def _cmd_me(args: argparse.Namespace) -> None:
    cli = Sheypoor(
        cookies=json.loads(args.cookies) if args.cookies else None,
        cookie_file=args.cookies_file,
    )
    if not cli.is_authenticated:
        sys.exit("Not authenticated. Run: python sheypoor.py login <phone>")
    print(json.dumps(cli.profile(), ensure_ascii=False, indent=2))
    print("Unread chats:", cli.chat_unread())
    print("Total listings:", cli.my_listings()["meta"]["total_items"])


def main() -> None:
    cookie_parent = argparse.ArgumentParser(add_help=False)
    cookie_parent.add_argument(
        "--cookies-file",
        default=str(COOKIE_FILE),
        help=f"Cookie jar path (default: {COOKIE_FILE})",
    )

    p = argparse.ArgumentParser(description="Sheypoor API client")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search")
    s.add_argument("city", nargs="?", default="iran")
    s.add_argument("-q", "--query")
    s.add_argument("-p", "--pages", type=int, default=3)
    s.set_defaults(func=_cmd_search)

    li = sub.add_parser("listing")
    li.add_argument("--id")
    li.add_argument("--url")
    li.add_argument("--json", action="store_true", help="Print raw API JSON")
    li.set_defaults(func=_cmd_listing)

    c = sub.add_parser("categories")
    c.add_argument("--json", action="store_true", help="Also print the raw JSON")
    c.set_defaults(func=_cmd_categories)

    su = sub.add_parser("suggest")
    su.add_argument("city")
    su.add_argument("prefix")
    su.set_defaults(func=_cmd_suggest)

    po = sub.add_parser("popular")
    po.set_defaults(func=_cmd_popular)

    lg = sub.add_parser("login", parents=[cookie_parent])
    lg.add_argument("phone")
    lg.set_defaults(func=_cmd_login)

    lo = sub.add_parser("logout", parents=[cookie_parent])
    lo.set_defaults(func=_cmd_logout)

    me = sub.add_parser("me", parents=[cookie_parent])
    me.add_argument("--cookies", help="JSON dict of cookies (overrides file)")
    me.set_defaults(func=_cmd_me)

    args = p.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    args.func(args)


if __name__ == "__main__":
    main()