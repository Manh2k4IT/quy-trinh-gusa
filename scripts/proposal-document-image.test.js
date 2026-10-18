const assert = require("node:assert/strict");
const test = require("node:test");
const { createProposalPdf } = require("../proposal-document-pdf");
const { renderPdfPages } = require("../proposal-document-image");

test("renders a proposal PDF into JPEG images within the Zalo size limit", async () => {
  const pdf = await createProposalPdf({ id: "p1", userName: "Nguyễn Văn A", type: "leave", date: "2026-10-20", reason: "Việc gia đình", status: "pending" });
  const pages = await renderPdfPages(pdf);
  assert.ok(pages.length >= 1);
  for (const page of pages) {
    assert.equal(page.subarray(0, 2).toString("hex"), "ffd8");
    assert.ok(page.length <= 1024 * 1024);
  }
});
