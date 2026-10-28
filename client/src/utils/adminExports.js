function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReportPdf(title, columns, rows) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    window.alert("Allow pop-ups for this site to print or save the PDF report.");
    return;
  }
  reportWindow.opener = null;

  const tableRows = rows.map((row) => `
    <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>
  `).join("");
  reportWindow.document.write(`<!doctype html>
    <html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      *{box-sizing:border-box}body{margin:32px;color:#201b17;font:12px Arial,sans-serif}
      h1{margin:0 0 8px;font-family:Georgia,serif;font-size:24px}
      p{margin:0 0 22px;color:#70685f}
      table{width:100%;border-collapse:collapse}
      th{background:#f3eee8;color:#493b2c;text-align:left}
      td,th{padding:9px 8px;border:1px solid #e4ddd4;vertical-align:top;overflow-wrap:anywhere}
      tr{break-inside:avoid}
      @page{size:landscape;margin:14mm}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <p>${rows.length} records · Generated ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
    <table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows || `<tr><td colspan="${columns.length}">No records available</td></tr>`}</tbody></table>
    <script>window.onload=()=>window.print();</script></body></html>`);
  reportWindow.document.close();
}

export function downloadReportPng(title, columns, rows) {
  const rowHeight = Math.max(18, Math.min(54, Math.floor(31000 / Math.max(1, rows.length))));
  const width = 1600;
  const height = Math.max(280, 184 + rows.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    window.alert("Your browser couldn't prepare the report image. Try downloading the PDF.");
    return;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#211b16";
  context.font = "600 34px Georgia, serif";
  context.fillText(title, 56, 64);
  context.fillStyle = "#746b61";
  context.font = "16px Arial, sans-serif";
  context.fillText(`${rows.length} records · ${new Date().toLocaleString("en-IN")}`, 56, 96);

  const left = 56;
  const tableWidth = width - 112;
  const columnWidth = tableWidth / columns.length;
  let y = 130;
  context.fillStyle = "#eee8e0";
  context.fillRect(left, y, tableWidth, 42);
  context.font = "600 15px Arial, sans-serif";
  context.fillStyle = "#493b2c";
  columns.forEach((column, index) => {
    context.fillText(String(column).slice(0, 28), left + index * columnWidth + 10, y + 26);
  });
  y += 42;

  rows.forEach((row, rowIndex) => {
    context.fillStyle = rowIndex % 2 ? "#ffffff" : "#faf8f5";
    context.fillRect(left, y, tableWidth, rowHeight);
    context.strokeStyle = "#e9e3db";
    context.strokeRect(left, y, tableWidth, rowHeight);
    const fontSize = Math.min(14, Math.max(8, Math.floor(rowHeight * 0.28)));
    const lineHeight = fontSize + 3;
    const maxLines = rowHeight >= lineHeight * 2 + 14 ? 2 : 1;
    context.font = `${fontSize}px Arial, sans-serif`;
    context.fillStyle = "#302b26";
    row.forEach((cell, columnIndex) => {
      const text = String(cell ?? "");
      const words = text.split(/\s+/);
      const lines = [];
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (context.measureText(next).width > columnWidth - 20 && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      lines.slice(0, maxLines).forEach((part, lineIndex) => {
        const textY = y + Math.max(fontSize + 4, (rowHeight - lineHeight * (maxLines - 1)) / 2) + lineIndex * lineHeight;
        context.fillText(part, left + columnIndex * columnWidth + 10, textY, columnWidth - 20);
      });
    });
    y += rowHeight;
  });

  canvas.toBlob((blob) => {
    if (!blob) {
      window.alert("Your browser couldn't create the report image. Try downloading the PDF.");
      return;
    }
    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadBlob(blob, `${filename || "report"}.png`);
  }, "image/png");
}
