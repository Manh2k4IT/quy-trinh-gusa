const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPrinting({ canceled = false, openError = '', printError = false } = {}) {
  const calls = [];
  class BrowserWindow {
    constructor(options) {
      assert.equal(options.webPreferences.javascript, false);
      assert.equal(options.webPreferences.nodeIntegration, false);
      this.webContents = {
        setWindowOpenHandler: () => {},
        printToPDF: async (options) => {
          calls.push('pdf');
          assert.equal(options.preferCSSPageSize, true);
          assert.equal(options.pageSize, 'A4');
          if (printError) throw new Error('PDF failed');
          return Buffer.from('%PDF-test');
        },
      };
    }
    async loadURL(url) {
      const html = decodeURIComponent(url.split(',').slice(1).join(','));
      assert.ok(html.includes('Content-Security-Policy'));
      assert.ok(html.includes('Đơn thử'));
    }
    destroy() { calls.push('destroy'); }
  }
  const context = {
    require: (name) => name === 'electron' ? {
      BrowserWindow,
      dialog: { showSaveDialog: async () => ({ canceled, filePath: 'C:\\test.pdf' }) },
      shell: { openPath: async () => { calls.push('open'); return openError; } },
    } : { promises: { writeFile: async (file, data) => {
      assert.equal(file, 'C:\\test.pdf');
      assert.ok(data.toString().startsWith('%PDF'));
      calls.push('write');
    } } },
    Buffer,
    module: { exports: {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'printing.js'), 'utf8'), context);
  return { previewDocument: context.module.exports.previewDocument, calls };
}

test('desktop creates A4 PDF, saves it, opens the reader and destroys its hidden window', async () => {
  const client = loadPrinting();
  const result = await client.previewDocument(null, '<h1>Đơn thử</h1>');
  assert.equal(result.canceled, false);
  assert.deepEqual(client.calls, ['pdf', 'write', 'open', 'destroy']);
});

test('canceling the save dialog creates no PDF', async () => {
  const client = loadPrinting({ canceled: true });
  assert.equal((await client.previewDocument(null, '<h1>Đơn thử</h1>')).canceled, true);
  assert.deepEqual(client.calls, []);
});

test('printing and reader failures are surfaced and hidden windows are always destroyed', async () => {
  for (const options of [{ printError: true }, { openError: 'No reader' }]) {
    const client = loadPrinting(options);
    await assert.rejects(client.previewDocument(null, '<h1>Đơn thử</h1>'));
    assert.equal(client.calls.at(-1), 'destroy');
  }
});

test('invalid and oversized documents are rejected before opening a dialog', async () => {
  const client = loadPrinting();
  for (const html of [null, '', ' '.repeat(5), 'x'.repeat(10 * 1024 * 1024 + 1)]) {
    await assert.rejects(client.previewDocument(null, html));
  }
  assert.deepEqual(client.calls, []);
});

test('both composers use desktop PDF preview but retain browser printing', async () => {
  for (const file of ['proposal-composer.js', 'payment-composer.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const proposal = file === 'proposal-composer.js';
    const start = source.indexOf(`${proposal ? 'printButton' : 'print'}.addEventListener('click'`);
    const end = source.indexOf(proposal ? 'async function loadDocumentEmployee' : "fetch('/api/me'", start);
    for (const desktop of [true, false]) {
      const calls = [];
      let click;
      const button = { disabled: false, addEventListener: (event, handler) => { click = handler; } };
      const frame = { contentWindow: { focus: () => {}, print: () => calls.push('browser') } };
      const context = {
        window: {
          desktopSettings: desktop ? { previewDocument: async (html) => {
            assert.equal(html, '<h1>Test</h1>');
            calls.push('desktop');
            return { canceled: false };
          } } : undefined,
          validatePaymentTemplate: () => true,
          validateProposalSignature: () => true,
        },
        form: { checkValidity: () => true },
        printButton: button, print: button,
        documentFrame: frame, frame,
        documentReady: true,
        documentEmployee: { name: 'A' }, employee: 'A',
        renderedDocument: '<h1>Test</h1>', html: '<h1>Test</h1>',
        documentStatus: { textContent: '' }, message: { textContent: '' },
        console,
      };
      vm.runInNewContext(source.slice(start, end), context);
      await click();
      assert.deepEqual(calls, [desktop ? 'desktop' : 'browser']);
      assert.equal(button.disabled, false);
    }
  }
});
