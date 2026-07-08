import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { Project } from "@/lib/procore/types";

export type DailyReportPdfPayload = {
  project: Project;
  date: string;
  report: {
    employeeRows?: DailyReportEmployeeRow[];
    payItemRows?: DailyReportPayItemRow[];
    quantitiesTurnedIn?: string;
    inspectorName?: string;
    inspectorQuantityDetails?: string;
    workDescription?: string;
    planSheetNumbers?: string;
    workDetails?: string;
    incidentOccurred?: string;
    incidentDetails?: string;
    accidentReportFiled?: string;
    motSigns?: string;
    conesBarrels?: string;
    typeIISidewalkBarricades?: string;
    typeIIIBarricades?: string;
    lcdCount?: string;
    lcdFootage?: string;
    arrowBoards?: string;
    vmsBoards?: string;
    fdotIndex?: string;
    itsfmRows?: DailyReportItsfmRow[];
    itsfmAbovegroundEquipment?: string;
    itsfmCabinetEquipment?: string;
    createdByName?: string;
    updatedAt?: string;
  };
  dayNotes?: {
    notes?: string;
    inventory?: string;
  };
};

type DailyReportEmployeeRow = {
  employeeClassification: string;
  truckNumber: string;
  timeIn: string;
  lunchOut: string;
  lunchIn: string;
  timeOut: string;
  totalHours: string;
  driver: boolean;
  passenger: boolean;
};

type DailyReportPayItemRow = {
  payItemId: string;
  quantity: string;
};

type DailyReportItsfmRow = {
  itemKey: string;
  modelNumber: string;
  serialNumber: string;
  location: string;
};

type DailyReportItsfmItem = {
  group: "Aboveground Equipment" | "Cabinet Equipment";
  key: string;
  label: string;
};

type PdfContext = {
  cursorY: number;
  logoBuffer: Buffer | null;
  payload: DailyReportPdfPayload;
};

type TableColumn = {
  align?: "center" | "left" | "right";
  header: string;
  width: number;
};

const DAILY_REPORT_ITSFM_ITEMS: DailyReportItsfmItem[] = [
  { group: "Aboveground Equipment", key: "cctv-1", label: "CCTV #1" },
  { group: "Aboveground Equipment", key: "cctv-2", label: "CCTV #2" },
  { group: "Aboveground Equipment", key: "cctv-3", label: "CCTV #3" },
  { group: "Aboveground Equipment", key: "cctv-4", label: "CCTV #4" },
  { group: "Aboveground Equipment", key: "cctv-5", label: "CCTV #5" },
  { group: "Aboveground Equipment", key: "cctv-6", label: "CCTV #6" },
  { group: "Aboveground Equipment", key: "preemption-unit-1", label: "#1 Preemption Unit" },
  { group: "Aboveground Equipment", key: "preemption-unit-2", label: "#2 Preemption Unit" },
  { group: "Aboveground Equipment", key: "rsu", label: "RSU" },
  { group: "Aboveground Equipment", key: "antenna", label: "Antenna" },
  { group: "Cabinet Equipment", key: "cabinet", label: "Cabinet" },
  { group: "Cabinet Equipment", key: "controller", label: "Controller" },
  { group: "Cabinet Equipment", key: "mmu", label: "MMU" },
  { group: "Cabinet Equipment", key: "biu-1", label: "BIU #1" },
  { group: "Cabinet Equipment", key: "biu-2", label: "BIU #2" },
  { group: "Cabinet Equipment", key: "detection-ccu", label: "Detection CCU" },
  { group: "Cabinet Equipment", key: "rpm", label: "RPM" },
  { group: "Cabinet Equipment", key: "ups", label: "UPS" },
  { group: "Cabinet Equipment", key: "ethernet-switch", label: "Ethernet Switch" },
  { group: "Cabinet Equipment", key: "preemption-card", label: "Preemption Card" },
  { group: "Cabinet Equipment", key: "misc-1", label: "Misc" },
  { group: "Cabinet Equipment", key: "misc-2", label: "Misc" }
];

const PAGE_MARGIN = 36;
const FOOTER_HEIGHT = 26;
const CONTENT_WIDTH = 540;
const BRAND_BLUE = "#00548c";
const BRAND_MAGENTA = "#ec008c";
const TEXT = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#cbd5e1";
const SOFT_BLUE = "#eaf4fb";
const SOFT_GRAY = "#f8fafc";

export function buildDailyReportPdfFileName(projectName: string, date: string) {
  const projectNumber = projectName.trim().split(/\s+/)[0]?.slice(0, 8) || "Project";
  return `${date}_${sanitizeFileName(projectNumber)}_Daily_Report.pdf`;
}

export async function buildDailyReportPdf(payload: DailyReportPdfPayload) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: true,
      bufferPages: true,
      margins: {
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
        top: PAGE_MARGIN
      },
      size: "LETTER",
      info: {
        Author: "Chinchor Electric Inc.",
        Subject: `${payload.project.name} daily report for ${payload.date}`,
        Title: buildDailyReportPdfFileName(payload.project.name, payload.date)
      }
    });
    const chunks: Buffer[] = [];
    const context: PdfContext = {
      cursorY: 0,
      logoBuffer: readLogoBuffer(),
      payload
    };

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    context.cursorY = drawHeader(doc, context, true);
    drawDailyReportBody(doc, context);
    drawPageFooters(doc);
    doc.end();
  });
}

function drawDailyReportBody(doc: PDFKit.PDFDocument, context: PdfContext) {
  const { payload } = context;
  const { project, report } = payload;
  const payItemMap = new Map(project.payItems.map((payItem) => [payItem.id, payItem]));
  const employeeRows = (report.employeeRows ?? []).filter((row) =>
    [
      row.employeeClassification,
      row.truckNumber,
      row.timeIn,
      row.lunchOut,
      row.lunchIn,
      row.timeOut,
      row.totalHours
    ].some(Boolean)
  );
  const payItemRows = (report.payItemRows ?? []).filter((row) => row.payItemId || row.quantity);
  const inspectorQuantitiesTurnedIn = report.quantitiesTurnedIn === "yes";
  const incidentOccurred = report.incidentOccurred === "yes";

  drawMetaCards(doc, context, [
    ["Project", project.name],
    ["Date", payload.date],
    ["Created By", report.createdByName ?? ""],
    ["Last Updated", report.updatedAt ? new Date(report.updatedAt).toLocaleString() : ""]
  ]);

  drawSectionTitle(doc, context, "Employee Time on Site");
  drawTable(
    doc,
    context,
    [
      { header: "Employee - Classification", width: 146 },
      { header: "Truck", width: 48 },
      { header: "In", width: 44 },
      { header: "Lunch Out", width: 58 },
      { header: "Lunch In", width: 52 },
      { header: "Out", width: 44 },
      { align: "right", header: "Hours", width: 48 },
      { align: "center", header: "Driver", width: 50 },
      { align: "center", header: "Passenger", width: 50 }
    ],
    employeeRows.length
      ? employeeRows.map((row) => [
          row.employeeClassification,
          row.truckNumber,
          row.timeIn,
          row.lunchOut,
          row.lunchIn,
          row.timeOut,
          row.totalHours,
          row.driver ? "Yes" : "",
          row.passenger ? "Yes" : ""
        ])
      : [["No employee time entered.", "", "", "", "", "", "", "", ""]]
  );

  drawSectionTitle(doc, context, "Work Performed Pay Items");
  drawTable(
    doc,
    context,
    [
      { header: "Pay Item #", width: 95 },
      { header: "Description", width: 345 },
      { align: "right", header: "Quantity", width: 100 }
    ],
    payItemRows.length
      ? payItemRows.map((row) => {
          const payItem = payItemMap.get(row.payItemId);

          return [payItem?.code ?? "", payItem?.name ?? "", `${row.quantity} ${payItem?.unitOfMeasure ?? ""}`.trim()];
        })
      : [["No pay item quantities entered.", "", ""]]
  );

  drawSectionTitle(doc, context, "Inspector / Quantities");
  drawMetaCards(
    doc,
    context,
    [
      ["Quantities turned into inspector", formatYesNo(report.quantitiesTurnedIn)],
      ...(inspectorQuantitiesTurnedIn ? ([["Inspector Name", report.inspectorName ?? ""]] as Array<[string, string]>) : [])
    ],
    2
  );
  if (inspectorQuantitiesTurnedIn) {
    drawTextBox(doc, context, "Quantities and Items Turned Into Inspector", report.inspectorQuantityDetails ?? "");
  }

  drawTextBox(doc, context, "Description of Work Provided", report.workDescription ?? "");
  drawTextBox(doc, context, "Plan Sheet Numbers", report.planSheetNumbers ?? "");
  drawTextBox(doc, context, "Work Details", report.workDetails ?? "");
  drawTextBox(doc, context, "Notes", payload.dayNotes?.notes ?? "");
  drawTextBox(doc, context, "Inventory", payload.dayNotes?.inventory ?? "");

  drawSectionTitle(doc, context, "Incidents / Accidents");
  drawMetaCards(
    doc,
    context,
    [
      ["Incident occurred", formatYesNo(report.incidentOccurred)],
      ...(incidentOccurred ? ([["Accident report filed", formatYesNo(report.accidentReportFiled)]] as Array<[string, string]>) : [])
    ],
    2
  );
  if (incidentOccurred) {
    drawTextBox(doc, context, "Incident / Accident Details", report.incidentDetails ?? "");
  }

  drawSectionTitle(doc, context, "MOT Quantities");
  drawTable(
    doc,
    context,
    [
      { header: "Item", width: 170 },
      { align: "right", header: "Qty", width: 70 },
      { header: "Item", width: 210 },
      { align: "right", header: "Qty", width: 90 }
    ],
    [
      ["Total MOT Signs", report.motSigns ?? "", "Cones / Barrels", report.conesBarrels ?? ""],
      ["Type II Sidewalk Barricades", report.typeIISidewalkBarricades ?? "", "Type III Barricades", report.typeIIIBarricades ?? ""],
      ["LCD Count", report.lcdCount ?? "", "LCD Total Footage", report.lcdFootage ?? ""],
      ["Arrow Boards", report.arrowBoards ?? "", "VMS Boards", report.vmsBoards ?? ""],
      ["FDOT Index Used", report.fdotIndex ?? "", "", ""]
    ]
  );

  drawSectionTitle(doc, context, "ITSFM Itemized List");
  drawItsfmTable(doc, context, normalizeDailyReportItsfmRows(report.itsfmRows));

  if (report.itsfmAbovegroundEquipment?.trim() || report.itsfmCabinetEquipment?.trim()) {
    drawTextBox(doc, context, "Legacy ITSFM Aboveground Equipment Notes", report.itsfmAbovegroundEquipment ?? "");
    drawTextBox(doc, context, "Legacy ITSFM Cabinet Equipment Notes", report.itsfmCabinetEquipment ?? "");
  }
}

function drawHeader(doc: PDFKit.PDFDocument, context: PdfContext, firstPage: boolean) {
  const y = PAGE_MARGIN - 8;

  if (context.logoBuffer) {
    doc.image(context.logoBuffer, PAGE_MARGIN, y, {
      fit: firstPage ? [168, 42] : [132, 34]
    });
  } else {
    doc.fillColor(BRAND_BLUE).font("Helvetica-Bold").fontSize(16).text("CHINCHOR", PAGE_MARGIN, y + 6);
  }

  doc
    .fillColor(BRAND_BLUE)
    .font("Helvetica-Bold")
    .fontSize(firstPage ? 23 : 15)
    .text("Daily Report", PAGE_MARGIN + 195, y + 1, {
      align: "right",
      width: CONTENT_WIDTH - 195
    });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(`${context.payload.project.name} | ${context.payload.date}`, PAGE_MARGIN + 195, y + (firstPage ? 30 : 22), {
      align: "right",
      width: CONTENT_WIDTH - 195
    });

  doc
    .save()
    .moveTo(PAGE_MARGIN, y + (firstPage ? 55 : 44))
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + (firstPage ? 55 : 44))
    .lineWidth(1)
    .strokeColor(BRAND_MAGENTA)
    .stroke()
    .restore();

  return y + (firstPage ? 70 : 58);
}

function drawMetaCards(doc: PDFKit.PDFDocument, context: PdfContext, items: Array<[string, string]>, columns = 2) {
  const gap = 8;
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const rowHeight = 42;

  for (let index = 0; index < items.length; index += columns) {
    ensureSpace(doc, context, rowHeight + 8);

    items.slice(index, index + columns).forEach(([label, value], itemIndex) => {
      const x = PAGE_MARGIN + itemIndex * (cardWidth + gap);
      const y = context.cursorY;

      doc.roundedRect(x, y, cardWidth, rowHeight, 5).fillAndStroke(SOFT_GRAY, LINE);
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 9, y + 8, {
        width: cardWidth - 18
      });
      doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(10).text(value || "-", x + 9, y + 21, {
        height: 14,
        lineBreak: false,
        width: cardWidth - 18
      });
    });

    context.cursorY += rowHeight + 8;
  }
}

function drawSectionTitle(doc: PDFKit.PDFDocument, context: PdfContext, title: string) {
  ensureSpace(doc, context, 34);
  context.cursorY += 4;
  doc.roundedRect(PAGE_MARGIN, context.cursorY, CONTENT_WIDTH, 20, 3).fill(BRAND_BLUE);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(10).text(title.toUpperCase(), PAGE_MARGIN + 9, context.cursorY + 5, {
    width: CONTENT_WIDTH - 18
  });
  context.cursorY += 30;
}

function drawTextBox(doc: PDFKit.PDFDocument, context: PdfContext, title: string, value: string) {
  drawSectionTitle(doc, context, title);

  const text = value.trim() || "-";
  const textHeight = doc.heightOfString(text, {
    width: CONTENT_WIDTH - 18
  });
  const boxHeight = Math.max(44, Math.min(220, textHeight + 18));

  ensureSpace(doc, context, boxHeight + 8);
  doc.roundedRect(PAGE_MARGIN, context.cursorY, CONTENT_WIDTH, boxHeight, 5).strokeColor(LINE).stroke();
  doc.fillColor(TEXT).font("Helvetica").fontSize(9).text(text, PAGE_MARGIN + 9, context.cursorY + 9, {
    width: CONTENT_WIDTH - 18
  });
  context.cursorY = Math.max(context.cursorY + boxHeight + 10, doc.y + 10);
}

function drawItsfmTable(doc: PDFKit.PDFDocument, context: PdfContext, rows: DailyReportItsfmRow[]) {
  const rowsByKey = new Map(rows.map((row) => [row.itemKey, row]));
  const groups = Array.from(new Set(DAILY_REPORT_ITSFM_ITEMS.map((item) => item.group)));

  for (const group of groups) {
    drawTable(
      doc,
      context,
      [
        { header: group, width: 190 },
        { header: "Model #", width: 115 },
        { header: "S/N", width: 115 },
        { header: "Location", width: 120 }
      ],
      DAILY_REPORT_ITSFM_ITEMS.filter((item) => item.group === group).map((item) => {
        const row = rowsByKey.get(item.key) ?? createEmptyDailyReportItsfmRow(item.key);

        return [item.label, row.modelNumber, row.serialNumber, row.location];
      }),
      {
        headerFill: "#dbeafe"
      }
    );
  }
}

function drawTable(
  doc: PDFKit.PDFDocument,
  context: PdfContext,
  columns: TableColumn[],
  rows: string[][],
  options: { headerFill?: string } = {}
) {
  const headerHeight = 22;

  function drawHeaderRow() {
    ensureSpace(doc, context, headerHeight + 6);
    let x = PAGE_MARGIN;

    doc.rect(PAGE_MARGIN, context.cursorY, CONTENT_WIDTH, headerHeight).fillAndStroke(options.headerFill ?? SOFT_BLUE, LINE);
    columns.forEach((column) => {
      doc.fillColor(BRAND_BLUE).font("Helvetica-Bold").fontSize(7.5).text(column.header.toUpperCase(), x + 5, context.cursorY + 7, {
        align: column.align ?? "left",
        lineBreak: false,
        width: column.width - 10
      });
      x += column.width;
    });
    context.cursorY += headerHeight;
  }

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(
      22,
      ...columns.map((column, columnIndex) =>
        doc.heightOfString(row[columnIndex] ?? "", {
          width: column.width - 10
        }) + 10
      )
    );

    if (context.cursorY + rowHeight > pageBottom(doc)) {
      doc.addPage();
      context.cursorY = drawHeader(doc, context, false);
      drawHeaderRow();
    }

    let x = PAGE_MARGIN;
    const fill = rowIndex % 2 === 0 ? "#ffffff" : SOFT_GRAY;

    doc.rect(PAGE_MARGIN, context.cursorY, CONTENT_WIDTH, rowHeight).fillAndStroke(fill, LINE);
    columns.forEach((column, columnIndex) => {
      doc.fillColor(TEXT).font("Helvetica").fontSize(8.3).text(row[columnIndex] ?? "", x + 5, context.cursorY + 6, {
        align: column.align ?? "left",
        width: column.width - 10
      });
      x += column.width;
    });
    context.cursorY += rowHeight;
  });

  context.cursorY += 10;
}

function ensureSpace(doc: PDFKit.PDFDocument, context: PdfContext, height: number) {
  if (context.cursorY + height <= pageBottom(doc)) {
    return;
  }

  doc.addPage();
  context.cursorY = drawHeader(doc, context, false);
}

function drawPageFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();

  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const pageNumber = pageIndex - range.start + 1;
    const lineY = pageBottom(doc) + 8;
    const textY = lineY + 5;

    doc
      .save()
      .moveTo(PAGE_MARGIN, lineY)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, lineY)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke()
      .restore();
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(`Generated by Chinchor Daily | Page ${pageNumber} of ${range.count}`, PAGE_MARGIN, textY, {
        align: "center",
        height: 10,
        lineBreak: false,
        width: CONTENT_WIDTH
      });
  }
}

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT;
}

function readLogoBuffer() {
  const logoPath = join(process.cwd(), "public", "chinchor-logo.png");

  return existsSync(logoPath) ? readFileSync(logoPath) : null;
}

function normalizeDailyReportItsfmRows(rows: DailyReportItsfmRow[] | undefined) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.itemKey, row]));

  return DAILY_REPORT_ITSFM_ITEMS.map((item) => ({
    ...createEmptyDailyReportItsfmRow(item.key),
    ...(rowsByKey.get(item.key) ?? {})
  }));
}

function createEmptyDailyReportItsfmRow(itemKey: string): DailyReportItsfmRow {
  return {
    itemKey,
    location: "",
    modelNumber: "",
    serialNumber: ""
  };
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function formatYesNo(value: string | undefined) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "";
}
