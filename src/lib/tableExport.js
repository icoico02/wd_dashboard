/**
 * 表格导出工具：CSV / Excel(xlsx) / PDF(系统打印)
 * 全部在浏览器端生成，不经过任何服务端。
 */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function escapeCsvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/** CSV：带 UTF-8 BOM，Excel 直接打开中文不乱码 */
export function exportCsv(head, rows, filename) {
  const csv =
    '\uFEFF' + [head, ...rows].map((r) => r.map(escapeCsvCell).join(',')).join('\r\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
}

/** Excel：真 .xlsx；xlsx 库按需动态加载，不占首屏体积 */
export async function exportExcel(head, rows, filename, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows])
  ws['!cols'] = head.map((h) => ({ wch: Math.max(10, String(h).length * 2 + 4) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/**
 * PDF：生成 A4 排版表格并调用系统打印（中文无需嵌入字体，选「另存为 PDF」即可）
 * 打印窗口放在 1px 隐藏 iframe 里，避免弹出被拦截 / 跳离当前页
 */
export function printTable({ title, subtitle, head, rows }) {
  const headHtml = head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const bodyHtml = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm 13mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: #14181f; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .meta { color: #6b7280; font-size: 12px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { border: 1px solid #d8dce2; padding: 7px 9px; text-align: left; }
  th { background: #f2f4f8; font-weight: 600; white-space: nowrap; }
  tbody tr:nth-child(even) td { background: #fafbfd; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .empty { color: #6b7280; font-size: 13px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(subtitle)}</p>
  ${
    rows.length
      ? `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
      : `<p class="empty">暂无记录</p>`
  }
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => setTimeout(() => iframe.remove(), 400)
  try {
    iframe.contentWindow.addEventListener('afterprint', cleanup)
  } catch {
    /* 某些浏览器不允许监听 iframe 的 afterprint，走兜底清理 */
  }

  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      iframe.remove()
    }
  }, 150)

  setTimeout(() => iframe.remove(), 120000)
}
