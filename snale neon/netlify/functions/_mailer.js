async function sendMail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || "Snake Neon <no-reply@snake-neon-field.net>";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend_failed_${res.status}: ${body}`);
  }
}

module.exports = { sendMail };
