import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "..", "assets", "envista_logomark.png");

interface DashboardPdfInput {
  tenantName: string;
  generatedFor: string;
  generatedAt: Date;
  kpis: {
    totalPipeline: number;
    weightedPipeline: number;
    openOpportunities: number;
    closedWonRevenue: number;
    winRate: number;
    avgOpportunitySize: number;
    totalGrossMargin?: number;
    totalExpectedMargin?: number;
    totalBottomLineCost?: number;
  };
  charts: {
    pipelineByStage: { stageName: string; count: number; amount: number }[];
    revenueByMonth: { month: string; revenue: number }[];
  };
}

function money(n: number) {
  try {
    const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    return formatted.replace("₹", "Rs. ");
  } catch {
    return `Rs. ${n.toFixed(0)}`;
  }
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, startY: number) {
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f1a17").text(title, 40, startY);
  doc.moveTo(40, startY + 16).lineTo(555, startY + 16).strokeColor("#0f6b4e").lineWidth(1.5).stroke();
  doc.y = startY + 22;
}

function drawStyledTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  alignments: ("left" | "right" | "center")[],
  startX = 40
) {
  let y = doc.y;

  // Table Header Row Background
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  doc.roundedRect(startX, y, tableWidth, 22, 3).fill("#1e293b");

  // Header Labels
  let x = startX;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
  headers.forEach((h, i) => {
    doc.text(h, x + 6, y + 6, { width: colWidths[i] - 12, align: alignments[i] });
    x += colWidths[i];
  });
  y += 24;

  // Table Rows
  rows.forEach((row, rowIndex) => {
    const isAlt = rowIndex % 2 === 1;
    if (isAlt) {
      doc.rect(startX, y, tableWidth, 20).fill("#f8fafc");
    }

    doc.moveTo(startX, y + 20).lineTo(startX + tableWidth, y + 20).strokeColor("#f1f5f9").lineWidth(0.5).stroke();

    x = startX;
    doc.fontSize(9).font("Helvetica").fillColor("#334155");
    row.forEach((cell, i) => {
      doc.text(cell, x + 6, y + 5, { width: colWidths[i] - 12, align: alignments[i] });
      x += colWidths[i];
    });
    y += 20;
  });

  doc.y = y + 10;
}

export function generateDashboardPdf(input: DashboardPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header Banner Box
    doc.roundedRect(40, 40, 515, 76, 6).fill("#14171a");
    
    // Brand Accent Line
    doc.rect(40, 40, 6, 76).fill("#0f6b4e");

    // Logo mark + Title & Subtitle inside Header Banner
    try {
      doc.image(LOGO_PATH, 58, 50, { height: 36 });
    } catch {
      // Falls back to text-only header if the asset is unavailable at runtime.
    }
    const titleX = 104;
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#ffffff").text("Envista Cyber Defence CRM", titleX, 52);
    doc.fontSize(10).font("Helvetica").fillColor("#94a3b8").text("Executive Dashboard & Financial Summary Report", titleX, 72);

    // Meta Metadata on right side of Banner
    doc.fontSize(8).font("Helvetica").fillColor("#cbd5e1")
      .text(`Tenant: ${input.tenantName}`, 340, 52, { width: 200, align: "right" })
      .text(`Viewer: ${input.generatedFor}`, 340, 65, { width: 200, align: "right" })
      .text(`Exported: ${input.generatedAt.toLocaleString()}`, 340, 78, { width: 200, align: "right" });

    let currentY = 130;

    // --- SECTION 1: KEY PERFORMANCE METRICS (2-column Cards Grid) ---
    drawSectionHeader(doc, "Key Performance Indicators", currentY);
    currentY = doc.y;

    const marginVal = (input.kpis.totalGrossMargin || 0) + (input.kpis.totalExpectedMargin || 0);
    const costVal = input.kpis.totalBottomLineCost || 0;

    const kpiCards = [
      { label: "Total Pipeline", val: money(input.kpis.totalPipeline) },
      { label: "Weighted Pipeline", val: money(input.kpis.weightedPipeline) },
      { label: "Open Opportunities", val: String(input.kpis.openOpportunities) },
      { label: "Closed Won Revenue", val: money(input.kpis.closedWonRevenue) },
      { label: "Win Rate", val: `${Math.round(input.kpis.winRate * 100)}%` },
      { label: "Avg Opportunity Size", val: money(input.kpis.avgOpportunitySize) },
      { label: "Margin Value", val: money(marginVal) },
      { label: "Cost Incurred to Company", val: money(costVal) },
    ];

    const cardW = 250;
    const cardH = 40;
    const gapX = 15;
    const gapY = 10;

    kpiCards.forEach((kpi, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = 40 + col * (cardW + gapX);
      const cy = currentY + row * (cardH + gapY);

      // Card Container
      doc.roundedRect(cx, cy, cardW, cardH, 4).fillAndStroke("#f8fafc", "#e2e8f0");
      
      // Left Accent Pill
      doc.roundedRect(cx + 6, cy + 8, 3, 24, 1.5).fill("#0f6b4e");

      // Label & Value
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#64748b").text(kpi.label.toUpperCase(), cx + 16, cy + 8, { width: cardW - 24 });
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f1a17").text(kpi.val, cx + 16, cy + 20, { width: cardW - 24 });
    });

    currentY += 4 * (cardH + gapY) + 15;

    // --- SECTION 2: PIPELINE BY STAGE ---
    drawSectionHeader(doc, "Pipeline Stage Breakdown", currentY);

    if (input.charts.pipelineByStage.length === 0) {
      doc.fontSize(9).font("Helvetica-Oblique").fillColor("#94a3b8").text("No open opportunities found in pipeline.", 40, doc.y);
    } else {
      drawStyledTable(
        doc,
        ["Stage Name", "Deal Count", "Pipeline Amount"],
        input.charts.pipelineByStage.map((s) => [s.stageName, String(s.count), money(s.amount)]),
        [250, 100, 165],
        ["left", "center", "right"]
      );
    }

    currentY = doc.y + 10;

    // --- SECTION 3: REVENUE TREND (LAST 6 MONTHS) ---
    drawSectionHeader(doc, "Monthly Revenue Trend", currentY);

    drawStyledTable(
      doc,
      ["Month / Cycle", "Realized Closed Won Revenue"],
      input.charts.revenueByMonth.map((m) => [m.month, money(m.revenue)]),
      [250, 265],
      ["left", "right"]
    );

    // Document Footer
    doc.moveTo(40, 770).lineTo(555, 770).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    doc.fontSize(8).font("Helvetica").fillColor("#94a3b8").text(
      "CONFIDENTIAL — Envista Cyber Defence CRM Executive Summary. Figures reflect role visibility permissions at time of generation.",
      40,
      778,
      { width: 515, align: "center" }
    );

    doc.end();
  });
}
