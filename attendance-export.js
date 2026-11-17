const ExcelJS = require('exceljs/dist/exceljs.min.js');

function tableRows(table) {
	const header = table.querySelector('thead tr') || table.querySelector('tr');
	const rows = [...table.querySelectorAll('tr')].filter((row) => row.querySelector('.attendance-day'));
	if (!header || !rows.length) throw new Error('Không có dữ liệu chấm công để xuất.');
	const headers = [...header.children].map((cell) => {
		const day = cell.querySelector('span');
		const weekday = cell.querySelector('small');
		return day && weekday ? `${day.textContent.trim()} ${weekday.textContent.trim()}` : cell.textContent.trim();
	});
	return [headers, ...rows.map((row) => [...row.children].map((cell) => {
		if (cell.classList.contains('attendance-day')) {
			return cell.querySelector('.attendance-status-dot')?.getAttribute('title') || cell.textContent.trim();
		}
		const text = cell.textContent.trim();
		if (cell.classList.contains('attendance-index') || cell.classList.contains('attendance-count-cell') || cell.classList.contains('attendance-total')) {
			const number = Number(text.replace(',', '.'));
			if (text && Number.isFinite(number)) return number;
		}
		return text;
	}))];
}

async function createWorkbook(table) {
	const rows = tableRows(table);
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Chấm công');
	sheet.addRows(rows);
	sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
	sheet.getRow(1).font = { bold: true };
	sheet.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
	sheet.columns.forEach((column, index) => { column.width = index === 0 ? 8 : index === 1 ? 28 : 20; });
	return workbook.xlsx.writeBuffer();
}

async function download(table, month) {
	const bytes = await createWorkbook(table);
	const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
	try {
		const link = document.createElement('a');
		link.href = url;
		link.download = `cham-cong-${month}.xlsx`;
		document.body.append(link);
		link.click();
		link.remove();
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}

if (typeof window !== 'undefined') window.GusaAttendanceExport = { download };
module.exports = { createWorkbook };
