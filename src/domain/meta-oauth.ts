/** OAuth Meta để chọn Fanpage Thiên Thiên — không lấy inbox StudioBase. */

import { signDriveState, readDriveState } from "./drive-oauth.ts";

export const META_GRAPH = "https://graph.facebook.com/v21.0";
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
].join(",");

export type MetaOauthPageChoice = {
  id: string;
  name: string;
  accessToken: string;
};

/** State OAuth Meta — dùng cùng cơ chế ký với Drive. */
export const signMetaState = signDriveState;
export const readMetaState = readDriveState;

export function metaAuthUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
    scope: META_OAUTH_SCOPES,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export function parseMetaAccountsPayload(json: unknown): MetaOauthPageChoice[] {
  if (!json || typeof json !== "object") return [];
  const data = (json as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: MetaOauthPageChoice[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: string; name?: string; access_token?: string };
    const id = String(item.id || "").trim();
    const accessToken = String(item.access_token || "").trim();
    if (!id || accessToken.length < 20) continue;
    out.push({
      id,
      name: String(item.name || "Fanpage").trim() || "Fanpage",
      accessToken,
    });
  }
  return out;
}
