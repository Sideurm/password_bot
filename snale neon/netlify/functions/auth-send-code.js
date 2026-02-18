const { query } = require("./_db");
const { hashPassword } = require("./_auth");
const { sendMail } = require("./_mailer");
const { generateCode, hashCode } = require("./_otp");
const { json, badRequest, methodNotAllowed, internalError, parseBody } = require("./_http");

function purposeTitle(purpose) {
  if (purpose === "register") return "регистрации";
  if (purpose === "login") return "входа";
  return "сброса пароля";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const body = parseBody(event);
    if (!body) return badRequest("invalid_json");

    const email = String(body.email || "").trim().toLowerCase();
    const purpose = String(body.purpose || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !email.includes("@")) return badRequest("invalid_email");
    if (!["register", "login", "reset"].includes(purpose)) return badRequest("invalid_purpose");

    if (purpose === "register") {
      if (password.length < 6) return badRequest("password_too_short");
      const exists = await query("select id from users where email = $1 limit 1", [email]);
      if (exists.rowCount > 0) return json(409, { error: "email_already_exists" });
    } else {
      const exists = await query("select id from users where email = $1 limit 1", [email]);
      if (exists.rowCount === 0) return badRequest("user_not_found");
    }

    const cooldown = await query(
      `select created_at from auth_codes
       where email = $1 and purpose = $2
       order by created_at desc
       limit 1`,
      [email, purpose]
    );
    if (cooldown.rowCount) {
      const created = new Date(cooldown.rows[0].created_at).getTime();
      if (Date.now() - created < 30000) return badRequest("code_cooldown_30s");
    }

    const code = generateCode();
    const codeHash = hashCode(code);
    const passwordHash = purpose === "register" ? hashPassword(password) : null;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(
      `insert into auth_codes(email, purpose, code_hash, password_hash, expires_at)
       values($1, $2, $3, $4, $5)`,
      [email, purpose, codeHash, passwordHash, expiresAt]
    );

    await sendMail({
      to: email,
      subject: `Код для ${purposeTitle(purpose)} в Neon Snake`,
      text: `Ваш код: ${code}\nКод действует 10 минут.`
    });

    return json(200, { ok: true });
  } catch (error) {
    return internalError(error);
  }
};
