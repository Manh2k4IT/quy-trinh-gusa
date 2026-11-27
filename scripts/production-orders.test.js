const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createProductionOrders } = require("../production-orders");

const user = { id: "receiver", name: "Người tiếp nhận", status: "active", role: "employee" };
const order = (status) => ({
  id: "order-1",
  code: "SX-TEST-001",
  status,
  createdBy: { id: "creator", name: "Người lập" },
  proposal: { productCode: "SP-001", productName: "Sản phẩm", quantity: 100 },
  fabrics: [],
  history: [],
});

function setup(initialOrder, role) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "production-orders-test-"));
  const orderFile = path.join(directory, "production-orders.json");
  fs.writeFileSync(orderFile, JSON.stringify([initialOrder]));
  fs.writeFileSync(path.join(directory, "production-settings.json"), JSON.stringify({ assignees: { [role]: [user.id] } }));
  const api = createProductionOrders({
    dataPath: (name) => path.join(directory, name),
    users: new Map([[user.id, user]]),
    getCurrentUser: (req) => req.user,
    isManagementUser: (candidate) => candidate.role === "admin",
    getUserKey: (candidate) => candidate.id,
    sendJson: (res, status, body) => { res.status = status; res.body = body; },
    send: (res, status, body) => { res.status = status; res.body = body; },
    notify: async () => {},
  });
  return { api, orderFile, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

async function postAction(api, action, payload = {}) {
  const req = {
    method: "POST",
    url: "/api/production/order-1/action",
    user,
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ action, ...payload })); },
  };
  const res = {};
  await api.handle(req, res);
  return res;
}

async function postCreate(api, payload) {
  const req = {
    method: "POST",
    url: "/api/production",
    user,
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload)); },
  };
  const res = {};
  await api.handle(req, res);
  return res;
}

async function getFile(api, fileId) {
  const req = {
    method: "GET",
    url: `/api/production/order-1/files/${fileId}`,
    user,
    async *[Symbol.asyncIterator]() {},
  };
  const res = {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
  await api.handle(req, res);
  return res;
}

test("proposal color is saved separately from fabric rows", async () => {
  const fixture = setup(order("approval-1"), "create");
  try {
    const response = await postCreate(fixture.api, {
      date: "2026-11-27",
      productCode: "SP-NEW-1",
      productName: "Sản phẩm mới",
      reason: "Đề xuất sản xuất",
      quantity: "5",
      fabricNorm: "1",
      sampleStatus: "Có",
      patternStatus: "Có",
      imageStatus: "Có",
      sampleSize: "S",
      productImage: "data:image/png;base64,aGVsbG8=",
      signatureName: "Người lập",
      signatureData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      sizeColumns: ["S"],
      technicalRows: [{ color: "Đỏ", sizes: ["5"] }],
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.order.proposal.technicalRows[0].color, "Đỏ");
    assert.equal(response.body.order.proposal.technicalRows[0].item, "");
    assert.deepEqual(response.body.order.fabrics, []);
  } finally {
    fixture.cleanup();
  }
});

test("production completion moves the order to product receiving", async () => {
  const fixture = setup(order("in-production"), "production-complete");
  try {
    const response = await postAction(fixture.api, "complete-production");
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, "product-receive");
  } finally {
    fixture.cleanup();
  }
});

test("final level 2 approval uses the step 6 price as the final price", async () => {
  const missingPriceFixture = setup(order("final-approval-2"), "final-approval-2");
  try {
    const missingPrice = await postAction(missingPriceFixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    });
    assert.equal(missingPrice.status, 400);
    assert.match(missingPrice.body, /giá bán tính ở Bước 6/);
  } finally {
    missingPriceFixture.cleanup();
  }

  const initial = order("final-approval-2");
  initial.sellingPrice = { value: 250000 };
  initial.proposal.approval2SuggestedSellingPrice = 120000;
  initial.approvals = { "approval-2": { name: "Duyệt cấp 2" } };
  const fixture = setup(initial, "final-approval-2");
  try {
    const response = await postAction(fixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, "print-label");
    assert.equal(response.body.order.finalSellingPrice.value, 250000);
    assert.equal(response.body.order.finalSellingPrice.source, "step-6");
    assert.match(response.body.order.history[response.body.order.history.length - 1].action, /Duyệt giá Bước 6/);
  } finally {
    fixture.cleanup();
  }
});

test("final level 2 can reject the step 6 price and approve an alternate final price", async () => {
  const initial = order("final-approval-2");
  initial.sellingPrice = { value: 250000 };
  initial.proposal.approval2SuggestedSellingPrice = 120000;
  initial.approvals = { "approval-2": { name: "Duyệt cấp 2" } };
  const fixture = setup(initial, "final-approval-2");
  try {
    const rejectOrder = await postAction(fixture.api, "reject", { note: "Giá Bước 6 cần điều chỉnh." });
    assert.equal(rejectOrder.status, 400);

    const response = await postAction(fixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      finalSellingPrice: "300000",
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, "print-label");
    assert.equal(response.body.order.sellingPrice.value, 250000);
    assert.equal(response.body.order.finalSellingPrice.value, 300000);
    assert.equal(response.body.order.finalSellingPrice.source, "adjusted-at-final-approval");
    assert.match(response.body.order.history[response.body.order.history.length - 1].action, /Từ chối giá Bước 6, chốt giá thay thế/);
  } finally {
    fixture.cleanup();
  }
});

test("legacy final approvals use the step 6 price as the final price", async () => {
  const initial = order("in-production");
  initial.sellingPrice = { value: 250000 };
  initial.proposal.suggestedSellingPrice = 120000;
  initial.approvals = { "approval-2": { name: "Duyệt cấp 2" }, "final-approval-2": { name: "Người duyệt" } };
  initial.finalSellingPrice = { value: 120000, source: "approval-2" };
  const fixture = setup(initial, "production-complete");
  try {
    const response = {};
    await fixture.api.handle({ method: "GET", url: "/api/production", user }, response);
    assert.equal(response.body.orders[0].finalSellingPrice.value, 250000);
    assert.equal(response.body.orders[0].finalSellingPrice.source, "step-6");
  } finally {
    fixture.cleanup();
  }
});

test("label printing requires a photo and advances to production", async () => {
  const fixture = setup(order("print-label"), "print-label");
  try {
    const missingPhoto = await postAction(fixture.api, "confirm-label-print");
    assert.equal(missingPhoto.status, 400);
    assert.match(missingPhoto.body, /ảnh tem đã in/);

    const confirmed = await postAction(fixture.api, "confirm-label-print", {
      files: [{ name: "tem.png", data: "data:image/png;base64,aGVsbG8=" }],
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.order.status, "in-production");
    assert.equal(confirmed.body.order.labelPrint.files.length, 1);
  } finally {
    fixture.cleanup();
  }
});

test("approval level 1 requires and saves suggested selling price", async () => {
  const fixture = setup(order("approval-1"), "approval-1");
  try {
    const missing = await postAction(fixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    });
    assert.equal(missing.status, 400);
    assert.match(missing.body, /giá bán đề xuất/);

    const accepted = await postAction(fixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      suggestedSellingPrice: "180000",
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.order.status, "approval-2");
    assert.equal(accepted.body.order.proposal.suggestedSellingPrice, 180000);
    assert.equal(accepted.body.order.proposal.approval1SuggestedSellingPrice, 180000);
  } finally {
    fixture.cleanup();
  }
});

test("approval level 2 preserves the level 1 price and saves its own price", async () => {
  const initialOrder = order("approval-2");
  initialOrder.proposal.suggestedSellingPrice = 180000;
  const fixture = setup(initialOrder, "approval-2");
  try {
    const missing = await postAction(fixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    });
    assert.equal(missing.status, 400);
    assert.match(missing.body, /giá bán đề xuất/);

    const response = await postAction(fixture.api, "approve", {
      approvalName: "Người duyệt",
      approvalSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      suggestedSellingPrice: "999999",
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, "fabric-prep-before-wash");
    assert.equal(response.body.order.proposal.suggestedSellingPrice, 999999);
    assert.equal(response.body.order.proposal.approval1SuggestedSellingPrice, 180000);
    assert.equal(response.body.order.proposal.approval2SuggestedSellingPrice, 999999);
  } finally {
    fixture.cleanup();
  }
});

test("fabric prep is the third workflow stage and precedes post-wash reconciliation", async () => {
  const fixture = setup(order("approval-2"), "approval-2");
  try {
    const response = {};
    await fixture.api.handle({ method: "GET", url: "/api/production", user }, response);
    assert.deepEqual(response.body.stageOrder.slice(0, 4), [
      "approval-1",
      "approval-2",
      "fabric-prep-before-wash",
      "reconcile",
    ]);
    assert.deepEqual(response.body.stageOrder.slice(-3), ["print-label", "in-production", "product-receive"]);
    assert.equal(response.body.stages.handover.label, "BÀN GIAO ĐỀ XUẤT SẢN XUẤT");
  } finally {
    fixture.cleanup();
  }
});

test("pre-wash fabric prep saves editable fields, ignores after-wash input, then reconciles", async () => {
  const fixture = setup(order("fabric-prep-before-wash"), "fabric-prep");
  try {
    fs.writeFileSync(fixture.orderFile.replace("production-orders.json", "production-settings.json"), JSON.stringify({
      assignees: { "fabric-prep": [user.id], reconcile: [user.id] },
    }));

    const prepared = await postAction(fixture.api, "prepare-fabric-before-wash", {
      sizeColumns: ["S"],
      technicalRows: [{ item: "VAI-01", requirement: "10", actual: "9", color: "Đỏ", sizes: ["12"] }],
    });
    assert.equal(prepared.status, 200);
    assert.equal(prepared.body.order.status, "reconcile");
    assert.equal(prepared.body.order.proposal.technicalRows[0].item, "VAI-01");
    assert.equal(prepared.body.order.proposal.technicalRows[0].requirement, "10");
    assert.equal(prepared.body.order.proposal.technicalRows[0].actual, "");
    assert.equal(prepared.body.order.proposal.technicalRows[0].color, "Đỏ");
    assert.equal(prepared.body.order.fabrics[0].cutMeters, 10);
    assert.equal(prepared.body.order.fabrics[0].washedMeters, undefined);

    const photo = { name: "proof.png", data: "data:image/png;base64,aGVsbG8=" };
    const reconciled = await postAction(fixture.api, "reconcile", {
      fabrics: [{ fabricCode: "VAI-01", washedMeters: "9.5" }],
      erpConfirmed: true,
      proposalPrinted: true,
      photos: { erp: [photo], proposalPrint: [photo] },
    });
    assert.equal(reconciled.status, 200);
    assert.equal(reconciled.body.order.status, "fabric-prep");
    assert.equal(reconciled.body.order.proposal.technicalRows[0].actual, "9.5");
    assert.equal(reconciled.body.order.reconcile.photos.erp.length, 1);
    assert.equal(reconciled.body.order.reconcile.photos.proposalPrint.length, 1);
  } finally {
    fixture.cleanup();
  }
});

test("workshop receive moves to selling price calculation", async () => {
  const fixture = setup(order("workshop-receive"), "workshop-receive");
  try {
    const response = await postAction(fixture.api, "workshop-receive", {
      unitPrice: "90000",
      expectedDate: "2027-12-31",
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, "selling-price");
  } finally {
    fixture.cleanup();
  }
});

test("accountant selling price moves the order to final approval level 2", async () => {
  const initial = order("selling-price");
  initial.workshop = { expectedDate: "2027-12-31" };
  const fixture = setup(initial, "selling-price");
  try {
    const response = await postAction(fixture.api, "selling-price", { sellingPrice: "250000" });
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, "final-approval-2");
    assert.equal(response.body.order.sellingPrice.value, 250000);
  } finally {
    fixture.cleanup();
  }
});

test("product receiving requires quantity and both evidence photos", async () => {
  const fixture = setup(order("product-receive"), "product-receive");
  try {
    const invalidQuantity = await postAction(fixture.api, "product-receive", { receivedQuantity: "98.5", photos: { documents: [], products: [] } });
    assert.equal(invalidQuantity.status, 400);
    assert.match(invalidQuantity.body, /số nguyên/);

    const missingPhoto = await postAction(fixture.api, "product-receive", { receivedQuantity: "98", photos: { documents: [], products: [] } });
    assert.equal(missingPhoto.status, 400);
    assert.match(missingPhoto.body, /chứng từ/);

    const photo = { name: "evidence.png", data: "data:image/png;base64,aGVsbG8=" };
    const accepted = await postAction(fixture.api, "product-receive", {
      receivedQuantity: "98",
      photos: { documents: [photo], products: [photo] },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.order.status, "completed");
    assert.equal(accepted.body.order.receipt.receivedQuantity, 98);
    assert.equal(accepted.body.order.receipt.documentFiles.length, 1);
    assert.equal(accepted.body.order.receipt.productFiles.length, 1);
    assert.equal(JSON.parse(fs.readFileSync(fixture.orderFile, "utf8"))[0].receipt.receivedQuantity, 98);

    const savedPhoto = accepted.body.order.receipt.productFiles[0];
    const servedPhoto = await getFile(fixture.api, savedPhoto.id);
    assert.equal(servedPhoto.status, 200);
    assert.equal(servedPhoto.headers["Content-Type"], "image/png");
    assert.deepEqual(servedPhoto.body, Buffer.from("hello"));
  } finally {
    fixture.cleanup();
  }
});
