const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTable =
  require("jspdf-autotable").default || require("jspdf-autotable");

/**
 * Generates the Vehicle Documents Health (VDH) report PDF and writes it to disk,
 * returning the relative path (or null on failure). Designed to be attached to
 * the WhatsApp template "amv_vdh_with_feedaackrequest_v1".
 *
 * Sections: brand header · user details · platform ("prepared by") details ·
 * vehicle details · document-health table (RC/Emission/Insurance/State permit/
 * National permit + Blacklist) · upcoming expiry alerts · report + next dates.
 *
 * @param {object} p  see field usage below (all pre-computed by the caller).
 * @returns {string|null} relative path e.g. "uploads/vdh_reports/<reg>_<date>.pdf"
 */

// AlertMyVahan palette (same as the invoice).
const BLUE = [23, 99, 245];
const GOLD = [201, 162, 39];
const CREAM = [239, 246, 255];
const DEEP = [18, 36, 86];
const GREEN = [22, 134, 70];
const AMBER = [191, 130, 20];
const RED = [200, 40, 40];

const sanitize = (s) =>
  String(s ?? "")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/₹/g, "Rs.")
    .replace(/[^\x00-\xFF]/g, "");

const toneOf = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("expired")) return RED;
  if (s.includes("due") || s.includes("soon") || s.includes("blacklist")) return AMBER;
  if (s.includes("valid") || s.includes("clear")) return GREEN;
  return DEEP;
};

const generateVdhPdf = (p) => {
  try {
    const user = p.user || {};
    const gd = p.platform || {};
    const veh = p.vehicle || {};
    const health = p.health || [];
    const upcoming = p.upcoming || [];

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;

    // ---------- Header band ----------
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 88, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 88, W, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("AlertMyVahan", M, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Vehicle Documents Health (VDH) Report", M, 58);
    doc.setFontSize(9);
    doc.text(`Report date: ${p.report_date || ""}`, W - M, 40, { align: "right" });
    doc.text(`Next report: ${p.next_report_date || ""}`, W - M, 56, {
      align: "right",
    });

    // ---------- Section helper ----------
    let y = 116;
    const heading = (txt, yy, x = M) => {
      doc.setTextColor(...DEEP);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(txt, x, yy);
      doc.setDrawColor(...GOLD);
      doc.line(x, yy + 4, x + 170, yy + 4);
    };
    const lines = (arr, x, yy, w = 250) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...DEEP);
      let cur = yy;
      for (const l of arr.filter(Boolean)) {
        doc.splitTextToSize(sanitize(l), w).forEach((wl) => {
          doc.text(wl, x, cur);
          cur += 13;
        });
      }
      return cur;
    };

    // ---------- User details (left) + Platform (right) ----------
    const colR = W / 2 + 10;
    heading("SUBSCRIBER", y);
    heading("PREPARED BY", y, colR);

    const leftEnd = lines(
      [
        user.user_name ? `Name: ${user.user_name}` : null,
        user.mobile_number ? `Mobile: +91 ${user.mobile_number}` : null,
        user.state_union_name ? `State/UT: ${user.state_union_name}` : null,
      ],
      M,
      y + 18,
      W / 2 - M - 10,
    );
    const rightEnd = lines(
      [
        gd.business_name || "AlertMyVahan",
        gd.legal_name && gd.legal_name !== gd.business_name
          ? `Legal: ${gd.legal_name}`
          : null,
        gd.gst_number ? `GSTIN: ${gd.gst_number}` : null,
        gd.registered_address || null,
        [gd.gst_state_name, gd.pincode].filter(Boolean).join(" - ") || null,
        gd.contact_number ? `Phone: ${gd.contact_number}` : null,
        gd.email ? `Email: ${gd.email}` : null,
        `Web: alertmyvahan.in · ServerPe App Solutions`,
      ],
      colR,
      y + 18,
      W / 2 - M - 10,
    );
    y = Math.max(leftEnd, rightEnd) + 10;

    // ---------- Vehicle details ----------
    heading("VEHICLE", y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLUE);
    doc.text(sanitize(veh.reg_no || "-"), M, y);
    y = lines(
      [
        [veh.manufacturer, veh.model, veh.variant].filter(Boolean).join(" · ") ||
          null,
        veh.colour ? `Colour: ${veh.colour}` : null,
        veh.owner_masked ? `Owner: ${veh.owner_masked}` : null,
      ],
      M,
      y + 14,
      W - 2 * M,
    );
    y += 6;

    // ---------- Document health table ----------
    heading("DOCUMENT HEALTH", y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["Document", "Expiry date", "Remaining days", "Status"]],
      body: health.map((h) => [
        h.label,
        h.expiry_date,
        h.remaining_days,
        h.status,
      ]),
      theme: "grid",
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: DEEP, valign: "middle" },
      alternateRowStyles: { fillColor: CREAM },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          data.cell.styles.textColor = toneOf(data.cell.raw);
        }
      },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Blacklist line (status only).
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...toneOf(p.blacklist_status));
    doc.text(`Blacklist status: ${sanitize(p.blacklist_status || "N/A")}`, M, y);
    y += 20;

    // ---------- Upcoming expiry alerts ----------
    heading("UPCOMING EXPIRY ALERTS", y);
    y += 16;
    if (upcoming.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GREEN);
      doc.text("No documents expiring soon. You're all covered!", M, y);
      y += 14;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...DEEP);
      for (const a of upcoming) {
        doc.text(
          sanitize(
            `• ${a.label} - expires ${a.expiry_date} (${a.remaining_days} day(s) left)`,
          ),
          M,
          y,
        );
        y += 14;
      }
    }

    // ---------- Footer ----------
    const footerY = H - 56;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, footerY, W - M, footerY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...DEEP);
    doc.text(
      `Generated ${p.report_date || ""} · Next VDH report on ${p.next_report_date || ""}. Data is best-effort from third-party/government sources.`,
      M,
      footerY + 16,
    );
    doc.setTextColor(...GOLD);
    doc.text(
      "Powered by: ServerPe App Solutions - Smart clicks, Smart taps",
      M,
      footerY + 30,
    );

    // ---------- Save (archive copy) ----------
    // Folder structure: uploads/vdh_reports/<REG_NO>/<YYYY-MM-DD>/VDH_<REG>_<DATE>.pdf
    // — one folder per vehicle, then per report date, keeping a permanent copy.
    const safeReg = String(veh.reg_no || "vehicle").replace(/[^A-Za-z0-9]/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    const relDir = path.posix.join("uploads", "vdh_reports", safeReg, stamp);
    const dir = path.join(__dirname, "..", relDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fileName = `VDH_${safeReg}_${stamp}.pdf`;
    fs.writeFileSync(
      path.join(dir, fileName),
      Buffer.from(doc.output("arraybuffer")),
    );
    return path.posix.join(relDir, fileName);
  } catch (err) {
    console.error("generateVdhPdf error:", err.message);
    return null;
  }
};

module.exports = generateVdhPdf;
