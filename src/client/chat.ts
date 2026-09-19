import { API } from "./constants.js";
import type { HttpClient } from "./http.js";

export interface ChatRoom {
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

export interface ChatRoomList {
  total: number;
  limit: number;
  supportChat: unknown | null;
  list: ChatRoom[];
}

export class ChatApi {
  constructor(private readonly http: HttpClient) {}

  rooms(page = 1) {
    return this.http
      .request<{ success: boolean; data: ChatRoomList }>(`${API}/chat/rooms`, {
        params: { page },
      })
      .then((r) => r.data);
  }

  credentials() {
    return this.http
      .request<{
        success: boolean;
        data: { username: string; password: string; phoneNumber: string; nickname: string };
      }>(`${API}/chat/credentials`)
      .then((r) => r.data);
  }

  async suggestions(listingId: number | string, prefix = ""): Promise<string[]> {
    const res = await this.http.request<{ data?: { suggestions?: string[] } }>(
      `${API}/chat/suggestion`,
      { params: { listingId, message: prefix } },
    );
    return res.data?.suggestions ?? [];
  }

  unread() {
    return this.http
      .request<{ unread: number; data: { unread: number } }>(`${API}/chat/unread-messages-count`)
      .then((r) => r.unread ?? r.data.unread ?? 0);
  }
}

export function parseRoomJid(jid: string) {
  const [local, domain = ""] = jid.split("@");
  if (!local) return { raw: jid, domain };
  const parts = local.split("-");
  if (parts.length < 3) return { raw: jid, domain };
  const [roomHash, listingId, userHash] = parts as [string, string, string];
  return {
    room_hash: roomHash,
    listing_id: Number(listingId),
    user_hash: userHash,
    domain,
  };
}
