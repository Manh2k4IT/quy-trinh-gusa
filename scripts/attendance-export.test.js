const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { createWorkbook } = require('../attendance-export');

function cell(text, classes = [], title) {
	return {
		textContent: text,
		classList: { contains: (name) => classes.includes(name) },
		querySelector: (selector) => selector === '.attendance-status-dot' && title ? { getAttribute: () => title } : null,
	};
}

function table(rows) {
	const header = { children: [cell('STT'), cell('Nhân viên'), cell('1'), cell('2'), cell('Đã công'), cell('Tổng ngày')], querySelector: () => null };
	return {
		querySelector: (selector) => selector === 'tr' ? header : null,
		querySelectorAll: () => [header, ...rows],
	};
}

test('exports status labels and numeric totals as safe Excel cells', async () => {
	const cells = [
		cell('1', ['attendance-index']),
		cell('=1+1', ['attendance-person']),
		cell('', ['attendance-day'], 'Đề xuất khác: Công tác'),
		cell('', ['attendance-day'], 'Làm 1/2 ngày'),
		cell('1', ['attendance-count-cell']),
		cell('1,5', ['attendance-total']),
	];
	const bytes = await createWorkbook(table([{ children: cells, querySelector: () => true }]));
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(Buffer.from(bytes));
	const sheet = workbook.getWorksheet('Chấm công');
	assert.deepEqual(sheet.getRow(2).values.slice(1), [1, '=1+1', 'Đề xuất khác: Công tác', 'Làm 1/2 ngày', 1, 1.5]);
	assert.equal(sheet.getCell('B2').type, ExcelJS.ValueType.String);
});

test('rejects an empty or filtered-out table', async () => {
	await assert.rejects(createWorkbook(table([])), /Không có dữ liệu chấm công/);
});
