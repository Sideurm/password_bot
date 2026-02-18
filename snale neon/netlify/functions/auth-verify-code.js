const { query } = require("./_db");
const { hashPassword, issueUserToken } = require("./_auth");
const { hashCode } = require("./_otp");
const { json, badRequest, methodNotAllowed, internalError, parseBody } = require("./_http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const body = parseBody(event);
    if (!body) return badRequest("invalid_json");

    const email = String(body.email || "").trim().toLowerCase();
    const purpose = String(body.purpose || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const password = String(body.password || "");

    if (!email || !email.includes("@")) return badRequest("invalid_email");
    if (!["register", "login"].includes(purpose)) return badRequest("invalid_purpose");
    if (!/^\d{6}$/.test(code)) return badRequest("invalid_code_format");

    const latest = await query(
      `select * from auth_codes
       where email = $1 and purpose = $2 and consumed_at is null
       order by created_at desc
       limit 1`,
      [email, purpose]
    );
    if (latest.rowCount === 0) return badRequest("code_not_found");

    const row = latest.rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) return badRequest("code_expired");
    if (row.attempts >= 5) return badRequest("code_attempts_exceeded");

    if (row.code_hash !== hashCode(code)) {
      await query("update auth_codes set attempts = attempts + 1 where id = $1", [row.id]);
      return badRequest("invalid_code");
    }

    let user = null;

    if (purpose === "register") {
      const exists = await query("select id from users where email = $1 limit 1", [email]);
      if (exists.rowCount > 0) return json(409, { error: "email_already_exists" });

      const passwordHash = row.password_hash || (password.length >= 6 ? hashPassword(password) : null);
      if (!passwordHash) return badRequest("password_required_for_register");

      const inserted = await query(
        "insert into users(email, password_hash) values($1, $2) returning id, email",
        [email, passwordHash]
      );
      user = inserted.rows[0];
      await query(
        "insert into user_progress(user_id, progress_json) values($1, $2::jsonb) on conflict (user_id) do nothing",
        [user.id, "{}"]
      );
    } else {
      const result = await query("select id, email from users where email = $1 limit 1", [email]);
      if (result.rowCount === 0) return badRequest("user_not_found");
      user = result.rows[0];
    }

    await query("update auth_codes set consumed_at = now() where id = $1", [row.id]);
    const token = issueUserToken(user);
    return json(200, { ok: true, token, user: { id: user.id, email: user.email } });
  } catch (error) {
    return internalError(error);
  }
};
