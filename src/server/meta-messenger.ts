import { parseMetaPageLink, type MetaPageLink } from "@/domain/meta-page";
import { readIntegrationSecret } from "@/server/secrets";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function readMetaPageLink(): Promise<MetaPageLink | null> {
  const fromJson = parseMetaPageLink(await readIntegrationSecret("meta_page"));
  if (fromJson?.pageToken) return fromJson;
  const legacy = parseMetaPageLink(await readIntegrationSecret("meta"));
  return legacy;
}

export async function fetchMetaPageProfile(pageToken: string): Promise<{ id: string; name: string }> {
  const url = `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url);
  const json = (await res.json()) as { id?: string; name?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message || "Page token không hợp lệ — không đọc được Fanpage.");
  }
  return { id: String(json.id), name: String(json.name || "Fanpage") };
}

/** Gửi tin Messenger tới PSID của page Thiên Thiên. */
export async function sendMetaMessengerText(pageToken: string, psid: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });
  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Gửi Messenger thất bại (HTTP ${res.status}).`);
  }
}
