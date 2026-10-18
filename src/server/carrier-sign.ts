import { createHash } from "node:crypto";

const JT_PASSWORD_SALT = "jadada369t3";

/** Mật khẩu nghiệp vụ J&T: MD5 hex hoa của mật khẩu thường + jadada369t3. */
export function jtBusinessPassword(plain: string): string {
  return createHash("md5").update(`${plain}${JT_PASSWORD_SALT}`, "utf8").digest("hex").toUpperCase();
}

/** Header digest: base64 của MD5 trên đúng byte JSON + private key, không phải hex. */
export function jtHeaderDigest(biz: string, privateKey: string): string {
  return createHash("md5")
    .update(Buffer.concat([Buffer.from(biz, "utf8"), Buffer.from(privateKey, "utf8")]))
    .digest("base64");
}
