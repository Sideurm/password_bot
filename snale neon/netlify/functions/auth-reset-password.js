const { query } = require("./_db");
const { hashPassword } = require("./_auth");
const { hashCode } = require("./_otp");
const { json, badRequest, methodNotAllowed, internalError, parseBody } = require("./_http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const body = parseBody(event);
    if (!body) return badRequest("invalid_json");

    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!email || !email.includes("@")) return badRequest("invalid_email");
    if (!/^\d{6}$/.test(code)) return badRequest("invalid_code_format");
    if (newPassword.length < 6) return badRequest("password_too_short");

    const latest = await query(
      `select * from auth_codes
       where email = $1 and purpose = 'reset' and consumed_at is null
       order by created_at desc
       limit 1`,
      [email]
    );
    if (latest.rowCount === 0) return badRequest("code_not_found");

    const row = latest.rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) return badRequest("code_expired");
    if (row.attempts >= 5) return badRequest("code_attempts_exceeded");

    if (row.code_hash !== hashCode(code)) {
      await query("update auth_codes set attempts = attempts + 1 where id = $1", [row.id]);
      return badRequest("invalid_code");
    }

    const exists = await query("select id from users where email = $1 limit 1", [email]);
    if (exists.rowCount === 0) return badRequest("user_not_found");

    await query("update users set password_hash = $1 where email = $2", [hashPassword(newPassword), email]);
    await query("update auth_codes set consumed_at = now() where id = $1", [row.id]);

    return json(200, { ok: true });
  } catch (error) {
    return internalError(error);
  }
};
