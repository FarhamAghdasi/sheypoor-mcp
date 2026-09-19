import { log } from "../util/logger.js";
import { SheypoorAuthError } from "./errors.js";
import type { HttpClient } from "./http.js";

interface AuthSendResponse {
  success: boolean;
  message?: string;
  data?: { verify?: { token: string; ttl: number } };
}

interface AuthVerifyResponse {
  success: boolean;
  message?: string;
  data?: {
    userId: string;
    userName: string;
    userPhone: string;
    userPhoto?: string;
    access: { token: string; ttl: number };
    refresh: { token: string; ttl: number };
  };
}

export interface AuthTokens {
  userId: string;
  userName: string;
  userPhone: string;
  accessToken: string;
  refreshToken: string;
  accessTtl: number;
  refreshTtl: number;
}

export interface PendingLogin {
  verifyToken: string;
  phone: string;
  expiresAt: number;
}

export class AuthManager {
  private tokens: AuthTokens | null = null;

  constructor(private readonly http: HttpClient) {
    this.restoreFromCookies();
  }

  private restoreFromCookies(): void {
    const at = this.http.cookies.get("access_token");
    const rt = this.http.cookies.get("refresh_token");
    if (!at || !rt) return;
    const access = at.startsWith("Bearer ") ? at.slice(7) : at;
    const refresh = rt.startsWith("Bearer ") ? rt.slice(7) : rt;
    const claims = safeDecodeJwt(access);
    this.tokens = {
      userId: String(claims?.userId ?? ""),
      userName: "",
      userPhone: "",
      accessToken: access,
      refreshToken: refresh,
      accessTtl: 0,
      refreshTtl: 0,
    };
    log.debug({ userId: this.tokens.userId }, "restored auth from cookies");
  }

  isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }

  async start(phone: string): Promise<PendingLogin> {
    const res = await this.http.request<AuthSendResponse>(`${API_BASE}/auth/send`, {
      method: "POST",
      body: { username: phone },
    });
    if (!res.success || !res.data?.verify) {
      throw new SheypoorAuthError(res.message ?? "auth/send failed");
    }
    return {
      verifyToken: res.data.verify.token,
      phone,
      expiresAt: Date.now() + res.data.verify.ttl * 1000,
    };
  }

  async complete(pending: PendingLogin, code: string): Promise<AuthTokens> {
    const res = await this.http.request<AuthVerifyResponse>(`${API_BASE}/auth/verify`, {
      method: "POST",
      body: { verification_code: code },
      headers: { Authorization: `Bearer ${pending.verifyToken}` },
    });
    if (!res.success || !res.data) {
      throw new SheypoorAuthError(res.message ?? "auth/verify failed");
    }
    const d = res.data;
    this.tokens = {
      userId: d.userId,
      userName: d.userName,
      userPhone: d.userPhone,
      accessToken: d.access.token,
      refreshToken: d.refresh.token,
      accessTtl: d.access.ttl,
      refreshTtl: d.refresh.ttl,
    };
    this.persistToCookies();
    return this.tokens;
  }

  async refresh(): Promise<AuthTokens> {
    if (!this.tokens) throw new SheypoorAuthError("No refresh token");
    const res = await this.http.request<{
      success?: boolean;
      data?: { access: { token: string; ttl: number } };
    }>(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.tokens.refreshToken}` },
    });
    const newAccess = res.data?.access?.token;
    if (!newAccess) throw new SheypoorAuthError("refresh failed");
    this.tokens.accessToken = newAccess;
    this.persistToCookies();
    return this.tokens;
  }

  logout(): void {
    this.tokens = null;
    this.http.clearCookies();
  }

  private persistToCookies(): void {
    if (!this.tokens) return;
    this.http.cookies.set("access_token", `Bearer ${this.tokens.accessToken}`);
    this.http.cookies.set("refresh_token", `Bearer ${this.tokens.refreshToken}`);
    this.http.cookies.set("user_logged_in", "1");
    this.http.saveCookies();
  }
}

const API_BASE = "https://www.sheypoor.com/api/v10.0.0";

export function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeDecodeJwt(token: string): Record<string, unknown> | null {
  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}
