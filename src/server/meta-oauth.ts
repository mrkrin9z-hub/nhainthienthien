import { META_GRAPH, parseMetaAccountsPayload, type MetaOauthPageChoice } from "@/domain/meta-oauth";
import { readIntegrationSecret } from "@/server/secrets";

/** App Meta: biến môi trường Worker ưu tiên, rồi mới tới khóa đã lưu trong sổ. */
export async function resolveMetaAppCredentials(): Promise<{ appId: string; appSecret: string; source: "env" | "saved" | "missing" }> {
  const envId = (process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "").trim();
  const envSecret = (process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || "").trim();
  if (envId && envSecret) return { appId: envId, appSecret: envSecret, source: "env" };
  const savedId = (await readIntegrationSecret("meta_app_id")).trim();
  const savedSecret = (await readIntegrationSecret("meta_app_secret")).trim();
  if (savedId && savedSecret) return { appId: savedId, appSecret: savedSecret, source: "saved" };
  return { appId: savedId || envId, appSecret: savedSecret || envSecret, source: "missing" };
}

export async function exchangeMetaCode(input: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
}): Promise<string> {
  const params = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const res = await fetch(`${META_GRAPH}/oauth/access_token?${params.toString()}`);
  const json = (await res.json()) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message || "Không đổi được mã Facebook.");
  }
  return json.access_token;
}

export async function listMetaPagesForUser(userToken: string): Promise<MetaOauthPageChoice[]> {
  const url = `${META_GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`;
  const res = await fetch(url);
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const err = (json as { error?: { message?: string } }).error?.message;
    throw new Error(err || "Không lấy được danh sách Fanpage.");
  }
  return parseMetaAccountsPayload(json);
}

export type MetaPendingPages = {
  at: string;
  pages: MetaOauthPageChoice[];
};

export async function saveMetaPendingPages(pages: MetaOauthPageChoice[]): Promise<void> {
  const { saveIntegrationSecret } = await import("@/server/secrets");
  const payload: MetaPendingPages = { at: new Date().toISOString(), pages };
  await saveIntegrationSecret("meta_oauth_pending", JSON.stringify(payload));
}

export async function readMetaPendingPages(): Promise<MetaOauthPageChoice[]> {
  const raw = (await readIntegrationSecret("meta_oauth_pending")).trim();
  if (!raw) return [];
  try {
    const json = JSON.parse(raw) as MetaPendingPages;
    const at = Date.parse(json.at || "");
    if (!Number.isFinite(at) || Date.now() - at > 15 * 60 * 1000) return [];
    return Array.isArray(json.pages) ? json.pages.filter((p) => p.id && p.accessToken) : [];
  } catch {
    return [];
  }
}

export async function clearMetaPendingPages(): Promise<void> {
  const { saveIntegrationSecret } = await import("@/server/secrets");
  await saveIntegrationSecret("meta_oauth_pending", "");
}
