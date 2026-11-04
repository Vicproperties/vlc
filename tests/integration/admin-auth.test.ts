import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, cleanup, createUser, isDenied, makeAdmin, serviceClient, sql, type TestUser } from "./helpers";

/**
 * Admin authentication database layer (migration 0014): code issue/verify, lockout,
 * expiry, idle timeout, session status and password recovery markers.
 */
const service = serviceClient();
const hash = () => randomBytes(32).toString("hex");

async function pendingAdmin(label: string, role: "super_admin" | "sub_admin" = "sub_admin"): Promise<TestUser> {
  const user = await createUser(label);
  await makeAdmin(user, { role, verified: false });
  return user;
}

async function issue(sessionId: string, codeHash: string, opts: { cooldown?: number; max?: number } = {}) {
  const { data, error } = await service.rpc("admin_otp_issue", {
    p_session_id: sessionId,
    p_code_hash: codeHash,
    p_cooldown_seconds: opts.cooldown ?? 0,
    p_max_per_session: opts.max ?? 5,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function verify(sessionId: string, codeHash: string) {
  const { data, error } = await service.rpc("admin_otp_verify", { p_session_id: sessionId, p_code_hash: codeHash });
  if (error) throw new Error(error.message);
  return data;
}

async function status(user: TestUser) {
  const { data, error } = await user.client.rpc("admin_session_status");
  if (error) throw new Error(error.message);
  return data;
}

let customer: TestUser;

beforeAll(async () => {
  customer = await createUser("auth-customer");
});

afterAll(async () => {
  await cleanup([]);
});

describe("privileges", () => {
  it("customers cannot call the OTP or recovery functions", async () => {
    const id = customer.sessionId;
    const calls = [
      customer.client.rpc("admin_otp_issue", { p_session_id: id, p_code_hash: hash() }),
      customer.client.rpc("admin_otp_verify", { p_session_id: id, p_code_hash: hash() }),
      customer.client.rpc("admin_recovery_start", { p_session_id: id, p_admin_id: customer.id }),
      customer.client.rpc("admin_recovery_is_valid", { p_session_id: id, p_admin_id: customer.id }),
      customer.client.rpc("admin_recovery_complete", { p_session_id: id, p_admin_id: customer.id }),
      customer.client.rpc("admin_session_create", { p_session_id: id, p_admin_id: customer.id, p_ttl: "1 day" }),
      customer.client.rpc("admin_session_mark_verified", { p_session_id: id }),
    ];
    for (const { error } of await Promise.all(calls)) expect(isDenied(error)).toBe(true);
  });

  it("anonymous visitors cannot call admin_session_status", async () => {
    const { error } = await anonClient().rpc("admin_session_status");
    expect(isDenied(error)).toBe(true);
  });

  it("a customer's session status is 'none'", async () => {
    expect(await status(customer)).toBe("none");
  });
});

describe("one-time codes", () => {
  it("rejects malformed hashes", async () => {
    const admin = await pendingAdmin("otp-malformed");
    await expect(issue(admin.sessionId, "not-a-hash")).rejects.toThrow(/Invalid code hash/);
  });

  it("issues a code, enforces the cooldown, and verifies the session", async () => {
    const admin = await pendingAdmin("otp-happy");
    expect(await status(admin)).toBe("pending_otp");

    const code = hash();
    expect(await issue(admin.sessionId, code, { cooldown: 60 })).toBe("issued");
    expect(await issue(admin.sessionId, hash(), { cooldown: 60 })).toBe("cooldown");

    // Pending admins have no admin powers yet.
    const before = await admin.client.rpc("my_admin_permissions");
    expect(before.data).toEqual([]);

    expect(await verify(admin.sessionId, hash())).toBe("invalid");
    expect(await verify(admin.sessionId, code)).toBe("verified");
    expect(await status(admin)).toBe("verified");

    const after = await admin.client.rpc("my_admin_permissions");
    expect(after.data?.length).toBeGreaterThan(0);
  });

  it("only the newest code is valid", async () => {
    const admin = await pendingAdmin("otp-newest");
    const first = hash();
    const second = hash();
    expect(await issue(admin.sessionId, first)).toBe("issued");
    expect(await issue(admin.sessionId, second)).toBe("issued");
    expect(await verify(admin.sessionId, first)).toBe("invalid");
    expect(await verify(admin.sessionId, second)).toBe("verified");
  });

  it("locks the login after 5 wrong codes and revokes the session", async () => {
    const admin = await pendingAdmin("otp-lockout");
    const code = hash();
    await issue(admin.sessionId, code);
    for (let i = 0; i < 4; i += 1) expect(await verify(admin.sessionId, hash())).toBe("invalid");
    expect(await verify(admin.sessionId, hash())).toBe("locked");

    // Even the correct code no longer works, and no new code can be issued.
    expect(await verify(admin.sessionId, code)).toBe("no_challenge");
    expect(await issue(admin.sessionId, hash())).toBe("invalid_session");
    expect(await status(admin)).toBe("expired");
  });

  it("counts wrong attempts across resent codes", async () => {
    const admin = await pendingAdmin("otp-across");
    await issue(admin.sessionId, hash());
    for (let i = 0; i < 3; i += 1) expect(await verify(admin.sessionId, hash())).toBe("invalid");
    const fresh = hash();
    await issue(admin.sessionId, fresh);
    expect(await verify(admin.sessionId, hash())).toBe("invalid");
    expect(await verify(admin.sessionId, hash())).toBe("locked");
    expect(await verify(admin.sessionId, fresh)).toBe("no_challenge");
  });

  it("rejects expired codes", async () => {
    const admin = await pendingAdmin("otp-expired");
    const code = hash();
    await issue(admin.sessionId, code);
    await sql(
      "update private.admin_otp_challenges set expires_at = now() - interval '1 second' where session_id = $1",
      [admin.sessionId],
    );
    expect(await verify(admin.sessionId, code)).toBe("expired");
  });

  it("limits how many codes one login can request", async () => {
    const admin = await pendingAdmin("otp-limit");
    expect(await issue(admin.sessionId, hash(), { max: 2 })).toBe("issued");
    expect(await issue(admin.sessionId, hash(), { max: 2 })).toBe("issued");
    expect(await issue(admin.sessionId, hash(), { max: 2 })).toBe("limit");
  });

  it("expires logins that do not complete the code step within 30 minutes", async () => {
    const admin = await pendingAdmin("otp-pending-timeout");
    const code = hash();
    await issue(admin.sessionId, code);
    await sql("update private.admin_sessions set created_at = now() - interval '31 minutes' where session_id = $1", [
      admin.sessionId,
    ]);
    expect(await status(admin)).toBe("expired");
    expect(await verify(admin.sessionId, code)).toBe("expired");
    expect(await issue(admin.sessionId, hash())).toBe("invalid_session");
  });
});

describe("verified sessions", () => {
  it("expire after 30 minutes of inactivity and lose all admin powers", async () => {
    const admin = await createUser("idle");
    await makeAdmin(admin, { role: "super_admin", verified: true });
    expect(await status(admin)).toBe("verified");

    await sql(
      "update private.admin_sessions set last_activity_at = now() - interval '31 minutes' where session_id = $1",
      [admin.sessionId],
    );
    expect(await status(admin)).toBe("expired");
    const perms = await admin.client.rpc("my_admin_permissions");
    expect(perms.data).toEqual([]);
  });

  it("records activity (at most once a minute)", async () => {
    const admin = await createUser("touch");
    await makeAdmin(admin, { role: "sub_admin", verified: true });
    await sql(
      "update private.admin_sessions set last_activity_at = now() - interval '10 minutes' where session_id = $1",
      [admin.sessionId],
    );
    expect(await status(admin)).toBe("verified");
    const [row] = await sql<{ idle: number }>(
      "select extract(epoch from now() - last_activity_at)::int as idle from private.admin_sessions where session_id = $1",
      [admin.sessionId],
    );
    expect(row.idle).toBeLessThan(60);
  });

  it("are void once the admin account is deactivated", async () => {
    const admin = await createUser("deactivated");
    await makeAdmin(admin, { role: "sub_admin", verified: true });
    await service.from("admin_users").update({ is_active: false }).eq("id", admin.id);
    expect(await status(admin)).toBe("none");
  });
});

describe("password recovery markers", () => {
  it("are only created for active admins", async () => {
    const { data } = await service.rpc("admin_recovery_start", {
      p_session_id: customer.sessionId,
      p_admin_id: customer.id,
    });
    expect(data).toBe(false);
  });

  it("are single-use, bound to one admin, and revoke all admin sessions when completed", async () => {
    const admin = await createUser("recovery");
    await makeAdmin(admin, { role: "sub_admin", verified: true });
    const other = await createUser("recovery-other");
    await makeAdmin(other, { role: "sub_admin", verified: true });
    const recoverySession = randomUUID();

    expect(
      (await service.rpc("admin_recovery_start", { p_session_id: recoverySession, p_admin_id: admin.id })).data,
    ).toBe(true);
    expect(
      (await service.rpc("admin_recovery_is_valid", { p_session_id: recoverySession, p_admin_id: other.id })).data,
    ).toBe(false);
    expect(
      (await service.rpc("admin_recovery_is_valid", { p_session_id: recoverySession, p_admin_id: admin.id })).data,
    ).toBe(true);

    expect(
      (await service.rpc("admin_recovery_complete", { p_session_id: recoverySession, p_admin_id: admin.id })).data,
    ).toBe(true);
    expect(await status(admin)).toBe("expired");
    expect(await status(other)).toBe("verified");

    expect(
      (await service.rpc("admin_recovery_complete", { p_session_id: recoverySession, p_admin_id: admin.id })).data,
    ).toBe(false);
    expect(
      (await service.rpc("admin_recovery_is_valid", { p_session_id: recoverySession, p_admin_id: admin.id })).data,
    ).toBe(false);
  });

  it("expire after 15 minutes", async () => {
    const admin = await pendingAdmin("recovery-expiry");
    const recoverySession = randomUUID();
    await service.rpc("admin_recovery_start", { p_session_id: recoverySession, p_admin_id: admin.id });
    await sql(
      "update private.admin_recovery_sessions set expires_at = now() - interval '1 second' where session_id = $1",
      [recoverySession],
    );
    expect(
      (await service.rpc("admin_recovery_is_valid", { p_session_id: recoverySession, p_admin_id: admin.id })).data,
    ).toBe(false);
  });
});

describe("retention", () => {
  it("schedules the daily purge and the purge runs", async () => {
    const jobs = await sql<{ schedule: string; command: string }>(
      "select schedule, command from cron.job where jobname = 'purge-expired-logs'",
    );
    expect(jobs).toEqual([{ schedule: "17 3 * * *", command: "select private.purge_expired_logs()" }]);
    await expect(sql("select private.purge_expired_logs()")).resolves.toBeDefined();
  });
});
