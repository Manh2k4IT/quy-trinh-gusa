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
