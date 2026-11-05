import "server-only";
import { serverEnv } from "@/lib/env/server";
import { generateOtp, hashIdentifier, hashOtp } from "./otp-core";

export { generateOtp };

export function otpHash(sessionId: string, code: string): string {
  return hashOtp(serverEnv("ADMIN_OTP_HMAC_SECRET"), sessionId, code);
}

export function emailHash(email: string): string {
  return hashIdentifier(serverEnv("ADMIN_OTP_HMAC_SECRET"), "email", email);
}

export function ipHash(ip: string): string {
  return hashIdentifier(serverEnv("ADMIN_OTP_HMAC_SECRET"), "ip", ip);
}

export function phoneHash(phone: string): string {
  return hashIdentifier(serverEnv("ADMIN_OTP_HMAC_SECRET"), "phone", phone);
}
