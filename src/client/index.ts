import { defaultCookieFile } from "../util/paths.js";
import { AccountApi } from "./account.js";
import { AuthManager } from "./auth.js";
import { BookmarksApi } from "./bookmarks.js";
import { ChatApi } from "./chat.js";
import { HttpClient, type HttpClientOptions } from "./http.js";
import { ListingApi } from "./listing.js";
import { MetaApi } from "./meta.js";
import { SearchApi } from "./search.js";

export interface SheypoorClientOptions extends HttpClientOptions {}

/**
 * High-level facade over every Sheypoor endpoint.
 *
 *   const cli = new SheypoorClient();
 *   const page = await cli.search.page({ q: "آیفون", city: "iran" });
 */
export class SheypoorClient {
  readonly http: HttpClient;
  readonly search: SearchApi;
  readonly listing: ListingApi;
  readonly meta: MetaApi;
  readonly auth: AuthManager;
  readonly account: AccountApi;
  readonly chat: ChatApi;
  readonly bookmarks: BookmarksApi;

  constructor(opts: SheypoorClientOptions = {}) {
    this.http = new HttpClient({
      cookieFile: opts.cookieFile ?? process.env.SHEYPOOR_COOKIE_FILE ?? defaultCookieFile(),
      ...opts,
    });
    this.search = new SearchApi(this.http);
    this.listing = new ListingApi(this.http);
    this.meta = new MetaApi(this.http);
    this.auth = new AuthManager(this.http);
    this.account = new AccountApi(this.http);
    this.chat = new ChatApi(this.http);
    this.bookmarks = new BookmarksApi(this.http);
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  saveCookies(): void {
    this.http.saveCookies();
  }

  logout(): void {
    this.auth.logout();
  }
}

export { extractListingId, normalizePrice, fullSizeImage, toAsciiDigits } from "./listing.js";
export { parseRoomJid } from "./chat.js";
export { decodeJwt } from "./auth.js";
export type { Listing, ListingDetail, NormalizedPrice } from "./models.js";
export type { SearchParams, SortMode } from "./search.js";
export type { CategoryNode, LocationProvince, LocationCity } from "./meta.js";
export type { ChatRoom, ChatRoomList } from "./chat.js";
export { SheypoorError, SheypoorAuthError, SheypoorNotFound } from "./errors.js";
