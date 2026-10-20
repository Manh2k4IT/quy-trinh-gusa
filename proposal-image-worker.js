const { createProposalPdf } = require("./proposal-document-pdf");
const { renderPdfPages } = require("./proposal-document-image");

process.once("message", async (proposal) => {
  try {
    const pages = await renderPdfPages(await createProposalPdf(proposal));
    process.send({ pages: pages.map((page) => page.toString("base64")) }, () => process.exit(0));
  } catch (error) {
    process.send({ error: error.message }, () => process.exit(1));
  }
});
