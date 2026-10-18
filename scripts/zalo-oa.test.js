const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createZaloClient, loadUserIdMap } = require("../zalo-oa");

const baseEnv = {
  ZALO_APP_ID: "app-id",
  ZALO_APP_SECRET: "app-secret-for-tests",
  ZALO_REFRESH_TOKEN: "refresh-token-initial",
  ZALO_TOKEN_ENCRYPTION_KEY: "test-encryption-key-with-more-than-32-characters",
  ZALO_GROUP_ID: "group-id",
  ZALO_USER_ID_MAP: JSON.stringify({ "gusa-user-1": "zalo-user-1" }),
};

test("loads only valid Gusa-to-Zalo user ID mappings", () => {
  assert.deepEqual(loadUserIdMap(baseEnv.ZALO_USER_ID_MAP), { "gusa-user-1": "zalo-user-1" });
  assert.throws(() => loadUserIdMap("[]"), /JSON/);
  assert.throws(() => loadUserIdMap(JSON.stringify({ " ": "zalo-user" })), /không hợp lệ/);
});

test("refreshes and encrypts rotated OA tokens, then sends group and direct links", async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-zalo-test-"));
  const requests = [];
  const logger = { warn() {}, error() {} };
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url === "https://oauth.zaloapp.com/v4/access_token") {
      assert.equal(options.headers.secret_key, baseEnv.ZALO_APP_SECRET);
      const form = new URLSearchParams(options.body);
      assert.equal(form.get("grant_type"), "refresh_token");
      assert.equal(form.get("refresh_token"), "refresh-token-initial");
      return Response.json({ access_token: "access-token", refresh_token: "refresh-token-rotated", expires_in: 3600 });
    }
    return Response.json({ error: 0, message: "Success" });
  };

  try {
    const client = createZaloClient({ env: baseEnv, dataDirectory, fetchImpl, logger });
    assert.equal(client.isConfigured(), true);
    assert.equal(client.getUserId("gusa-user-1"), "zalo-user-1");
    assert.equal(await client.sendGroupMessage("Duyệt tại https://quytrinh.gusa.vn"), true);
    assert.equal(await client.sendDirectMessage("zalo-user-1", "Mở Gusa để duyệt"), true);
    assert.equal(requests.length, 3);
    assert.equal(requests[1].url, "https://openapi.zalo.me/v3.0/oa/group/message");
    assert.deepEqual(JSON.parse(requests[1].options.body).recipient, { group_id: "group-id" });
    assert.equal(requests[2].url, "https://openapi.zalo.me/v3.0/oa/message/cs");
    assert.deepEqual(JSON.parse(requests[2].options.body).recipient, { user_id: "zalo-user-1" });

    const storedTokens = fs.readFileSync(path.join(dataDirectory, "zalo-oa-tokens.json"), "utf8");
    assert.equal(storedTokens.includes("refresh-token-rotated"), false);
    assert.equal(storedTokens.includes("access-token"), false);
    assert.equal(JSON.parse(storedTokens).data.length > 0, true);
  } finally {
    fs.rmSync(dataDirectory, { recursive: true });
  }
});

test("does not send when OA credentials are not configured", async () => {
  let calls = 0;
  const client = createZaloClient({
    env: {},
    dataDirectory: os.tmpdir(),
    fetchImpl: async () => { calls += 1; throw new Error("Unexpected request"); },
    logger: { warn() {}, error() {} },
  });
  assert.equal(await client.sendGroupMessage("text"), false);
  assert.equal(await client.sendDirectMessage("user-id", "text"), false);
  assert.equal(calls, 0);
});

test("surfaces API failures without exposing credentials in the error", async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-zalo-failure-test-"));
  const fetchImpl = async (url) => url === "https://oauth.zaloapp.com/v4/access_token"
    ? Response.json({ access_token: "token", refresh_token: "rotated", expires_in: 3600 })
    : Response.json({ error: -216, message: "sensitive service message" });
  try {
    const client = createZaloClient({ env: baseEnv, dataDirectory, fetchImpl, logger: { warn() {}, error() {} } });
    await assert.rejects(client.sendGroupMessage("text"), (error) => {
      assert.match(error.message, /-216/);
      assert.doesNotMatch(error.message, /sensitive|access-token|refresh-token/);
      return true;
    });
  } finally {
    fs.rmSync(dataDirectory, { recursive: true });
  }
});
