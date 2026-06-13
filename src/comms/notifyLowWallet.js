const os = require("os");
const { sendMail } = require("./sendMail");

/* ── Server identity (so the admin can verify the mail is genuine, not spam) ── */

const localIPv4 = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return "unknown";
};

// Best-effort public IP (1.5s budget); falls back to the local IPv4.
const publicIPv4 = async () => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    return j.ip || localIPv4();
  } catch {
    return localIPv4();
  }
};

const serverUserAgent = () =>
  `${process.env.MAIL_FROM_NAME || "AlertMyVahan"}-Server/1.0 ` +
  `(Node ${process.version}; ${os.platform()} ${os.release()}; ${os.hostname()})`;

const istNow = () =>
  new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  });

/**
 * Emails the admin when a provider wallet runs low.
 *
 * Sends ONLY on the downward crossing — i.e. when a deduction takes the balance
 * from >= threshold to < threshold — so the admin gets one alert per depletion
 * instead of an email on every subsequent call/SMS while it stays low.
 *
 * Fire-and-forget: never throws (an email failure must not break a send).
 *
 * @param {object} p
 * @param {string} p.name          wallet label e.g. "SMS wallet"
 * @param {number} p.prevBalance   balance before the deduction
 * @param {number} p.newBalance    balance after the deduction
 * @param {number} p.threshold     ₹ level that triggers the alert
 */
const notifyLowWallet = async ({ name, prevBalance, newBalance, threshold }) => {
  try {
    const crossed = newBalance < threshold && prevBalance >= threshold;
    if (!crossed) return;

    const to = process.env.ADMINMAIL;
    if (!to) {
      console.error("notifyLowWallet: ADMINMAIL not configured");
      return;
    }

    const bal = `₹${Number(newBalance).toFixed(2)}`;
    const thr = `₹${Number(threshold).toFixed(2)}`;
    const ip = await publicIPv4();
    const ua = serverUserAgent();
    const when = istNow();

    const html = `
  <div style="margin:0;padding:24px;background:#F9FAFB;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden">
      <tr>
        <td style="background:linear-gradient(135deg,#36B76B,#2E9E5C);padding:20px 24px">
          <div style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.02em">
            ${process.env.MAIL_FROM_NAME || "AlertMyVahan"}
          </div>
          <div style="color:#EAFBF1;font-size:12px;margin-top:2px">Billing &amp; operations alert</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px">
          <div style="display:inline-block;background:#FEF3C7;color:#B45309;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px">
            ⚠ Low balance
          </div>
          <h1 style="margin:14px 0 6px;font-size:20px;color:#111827;letter-spacing:-0.02em">
            ${name} is running low
          </h1>
          <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6">
            Your <strong style="color:#111827">${name}</strong> has dropped to
            <strong style="color:#EF4444">${bal}</strong>, below the ${thr} alert threshold.
          </p>

          <div style="margin:18px 0;padding:16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#6B7280">Current balance</td>
                <td align="right" style="font-size:18px;font-weight:700;color:#EF4444">${bal}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#6B7280;padding-top:6px">Alert threshold</td>
                <td align="right" style="font-size:13px;font-weight:600;color:#111827;padding-top:6px">${thr}</td>
              </tr>
            </table>
          </div>

          <p style="margin:0 0 18px;font-size:14px;color:#111827;line-height:1.6">
            👉 <strong>Please recharge soon to avoid any inconvenience</strong> — once it hits zero,
            outgoing alerts to your customers may stop until it is topped up.
          </p>

          <div style="text-align:center;margin:8px 0 4px">
            <span style="display:inline-block;background:#36B76B;color:#FFFFFF;font-size:14px;font-weight:600;padding:11px 22px;border-radius:10px">
              Recharge → Admin console · Analytics · Cost &amp; operations
            </span>
          </div>
        </td>
      </tr>

      <!-- Verification footer: prove this came from your server, not a spammer -->
      <tr>
        <td style="padding:16px 24px;background:#0F172A">
          <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">
            Sender verification
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;color:#CBD5E1;line-height:1.7">
            <tr><td style="color:#64748B;width:110px">Server IP</td><td style="font-family:monospace;color:#E2E8F0">${ip}</td></tr>
            <tr><td style="color:#64748B">User-agent</td><td style="font-family:monospace;color:#E2E8F0">${ua}</td></tr>
            <tr><td style="color:#64748B">Sent at</td><td style="color:#E2E8F0">${when} IST</td></tr>
            <tr><td style="color:#64748B">From</td><td style="font-family:monospace;color:#E2E8F0">${process.env.NOREPLYMAIL || ""}</td></tr>
          </table>
          <div style="font-size:11px;color:#64748B;margin-top:10px">
            This is an automated message from your ${process.env.MAIL_FROM_NAME || "AlertMyVahan"} server.
            If the details above don't match your infrastructure, treat it as suspicious.
          </div>
        </td>
      </tr>
    </table>
  </div>`;

    const text =
      `${name} is running low — current balance ${bal}, below the ${thr} threshold.\n` +
      `Please recharge soon to avoid inconvenience (recharge via Admin console → Analytics → Cost & operations).\n\n` +
      `Sender verification:\n  Server IP: ${ip}\n  User-agent: ${ua}\n  Sent at: ${when} IST\n  From: ${process.env.NOREPLYMAIL || ""}`;

    await sendMail({
      to,
      subject: `⚠ Low ${name} balance: ${bal} — recharge soon`,
      text,
      html,
    });
    console.log(`Low-wallet alert emailed for ${name} (${bal}) from ${ip}`);
  } catch (err) {
    console.error("notifyLowWallet failed:", err.message);
  }
};

module.exports = notifyLowWallet;
