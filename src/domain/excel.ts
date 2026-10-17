export type Sheet = { name: string; rows: (string | number | null)[][] };

function cell(value: string | number | null): string {
  if (value === null || value === "") return "<Cell/>";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  const text = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
}

/** Excel 2003 XML, mở được bằng Excel mà không cần thư viện. */
export function workbookXml(sheets: Sheet[]): string {
  const body = sheets
    .map((sheet) => {
      const rows = sheet.rows
        .map((row) => `<Row>${row.map((value) => cell(value)).join("")}</Row>`)
        .join("");
      const name = sheet.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 31) || "Sheet";
      return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${body}
</Workbook>`;
}
