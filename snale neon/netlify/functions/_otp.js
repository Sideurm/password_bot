const crypto = require("crypto");

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  const pepper = process.env.AUTH_JWT_SECRET || process.env.NETLIFY_AUTH_JWT_SECRET || "snake";
  return crypto.createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

module.exports = {
  generateCode,
  hashCode
};
