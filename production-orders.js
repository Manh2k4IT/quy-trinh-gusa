const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// QT.SX.01 — đợt 1: từ lập đề xuất sản xuất đến bàn giao vải cho xưởng (bước 1–14).
const stages = {
  "approval-1": { label: "Chờ duyệt cấp 1", role: "approval-1", step: "Bước 3" },
  "approval-2": { label: "Chờ duyệt cấp 2", role: "approval-2", step: "Bước 4" },
  "fabric-prep": { label: "Chọn & soạn vải", role: "fabric-prep", step: "Bước 5" },
  "transfer-draft": { label: "Lập phiếu chuyển kho", role: "transfer-draft", step: "Bước 6" },
  washing: { label: "Soạn vải & wash", role: "wash-send", step: "Bước 7–8" },
  reconcile: { label: "Đối chiếu sau wash", role: "reconcile", step: "Bước 9–10" },
  handover: { label: "Ký phiếu & bàn giao", role: "handover", step: "Bước 11–12" },
  "workshop-receive": { label: "Xưởng nhận & báo giá", role: "workshop-receive", step: "Bước 12–14" },
  "in-production": { label: "Đang sản xuất", role: null, step: "Hoàn tất đợt 1" },
  rejected: { label: "Bị từ chối", role: "create", step: "Sửa & gửi lại" },
};
const stageOrder = ["approval-1", "approval-2", "fabric-prep", "transfer-draft", "washing", "reconcile", "handover", "workshop-receive", "in-production"];
// Phân công theo từng bước của QT.SX.01.
const roles = {
  create: { label: "Bước 1–2 · Lập & ký phiếu đề xuất sản xuất", hint: "Thống kê mã cần sản xuất, lập phiếu, ký tên; sửa & gửi lại khi bị từ chối." },
  "approval-1": { label: "Bước 3 · Duyệt cấp 1", hint: "Duyệt hoặc từ chối kế hoạch sản xuất." },
  "approval-2": { label: "Bước 4 · Duyệt cấp 2", hint: "Duyệt sau khi cấp 1 đã duyệt." },
  "fabric-prep": { label: "Bước 5 · Chọn & soạn vải", hint: "Soạn vải theo phiếu đã duyệt, nhập mã vải và số mét." },
  "transfer-draft": { label: "Bước 6 · Lập phiếu chuyển kho (nháp)", hint: "Tạo phiếu chuyển kho trên ERPNext, đính kèm file/ảnh phiếu." },
  "wash-send": { label: "Bước 7 · Soạn vải theo phiếu & đưa đi wash", hint: "Chụp ảnh vải đã soạn, ghi đơn vị wash." },
  "wash-return": { label: "Bước 8 · Kiểm vải sau wash", hint: "Nhập số mét thực tế khi hàng wash về, chụp ảnh hàng về." },
  reconcile: { label: "Bước 9–10 · Đối chiếu, xác nhận ERPNext & in phiếu", hint: "Kiểm hao hụt, xác nhận phiếu chuyển kho, in phiếu có chữ ký." },
  handover: { label: "Bước 11–12 · Ký phiếu & bàn giao cho xưởng", hint: "Ký phiếu, bàn giao bộ đề xuất và vải, chụp ảnh xác nhận." },
  "workshop-receive": { label: "Bước 12–14 · Xưởng nhận vải & báo giá", hint: "Xác nhận đã nhận, nhập đơn giá và ngày giao dự kiến." },
  accountant: { label: "Kế toán theo dõi", hint: "Xem toàn bộ hồ sơ (việc của kế toán ở đợt 2)." },
};
// Phân công cũ theo vai trò → bước tương ứng.
const legacyRoles = { create: "planner", "approval-1": "approver1", "approval-2": "approver2", "fabric-prep": "planner", "transfer-draft": "warehouse", "wash-send": "washer", "wash-return": "washer", reconcile: "warehouse", handover: "planner", "workshop-receive": "workshop", accountant: "accountant" };
const maxWashLoss = 0.03;
const maxFiles = 5;
const maxFileBytes = 8 * 1024 * 1024;

function createProductionOrders({ dataPath, users, getCurrentUser, isManagementUser, getUserKey, sendJson, send, notify, publish = () => {} }) {
  const ordersPath = dataPath("production-orders.json");
  const settingsPath = dataPath("production-settings.json");
  const filesDirectory = path.join(path.dirname(ordersPath), "production-files");

  function readJson(filePath, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") console.error(error);
      return fallback;
    }
  }

  const getOrders = () => {
    const orders = readJson(ordersPath, []);
    return Array.isArray(orders) ? orders : [];
  };
  const saveOrders = (orders) => fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  const getAssignees = () => {
    const saved = readJson(settingsPath, {}).assignees || {};
    return Object.fromEntries(Object.keys(roles).map((role) => {
      const ids = Array.isArray(saved[role]) ? saved[role] : saved[legacyRoles[role]];
      return [role, Array.isArray(ids) ? ids : []];
    }));
  };

  function stageRole(order) {
    if (order.status === "washing" && order.wash?.sentAt) return "wash-return";
    return stages[order.status]?.role || null;
  }

  function getUserRoles(user) {
    const key = getUserKey(user);
    return Object.entries(getAssignees()).filter(([, ids]) => ids.includes(key)).map(([role]) => role);
  }

  function canAct(user, order) {
    const role = stageRole(order);
    if (!role) return false;
    return getUserRoles(user).includes(role);
  }

  function canView(user) {
    return isManagementUser(user) || user.role === "accountant" || getUserRoles(user).length > 0;
  }

  function actor(user) {
    return { id: getUserKey(user), name: user.name || user.email };
  }

  function addHistory(order, user, action, note = "") {
    order.history.push({ at: new Date().toISOString(), stage: order.status, action, ...actor(user), ...(note ? { note } : {}) });
    order.updatedAt = new Date().toISOString();
  }

  function nextCode(orders) {
    const now = new Date();
    const prefix = `SX-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
    const used = orders.map((order) => order.code).filter((code) => code?.startsWith(prefix)).map((code) => Number(code.slice(prefix.length)) || 0);
    return `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
  }

  const text = (value, max = 200) => String(value ?? "").trim().slice(0, max);
  function amount(value, { integer = false } = {}) {
    const raw = String(value ?? "").trim().replace(",", ".");
    if (!(integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(raw)) return null;
    const number = Number(raw);
    return number > 0 ? number : null;
  }
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

  function validateProposal(payload) {
    const proposal = {
      date: text(payload.date, 10),
      productCode: text(payload.productCode, 60),
      productName: text(payload.productName, 200),
      quantity: amount(payload.quantity, { integer: true }),
      fabricNorm: amount(payload.fabricNorm),
      note: text(payload.note, 1000),
      signatureName: text(payload.signatureName, 150),
      signatureData: typeof payload.signatureData === "string" ? payload.signatureData : "",
      variants: [],
    };
    if (!isDate(proposal.date)) throw new Error("Vui lòng chọn ngày đề xuất.");
    if (!proposal.productCode || !proposal.productName) throw new Error("Vui lòng nhập mã và tên thành phẩm.");
    if (!proposal.quantity) throw new Error("Số lượng sản xuất phải là số nguyên lớn hơn 0.");
    if (!proposal.fabricNorm) throw new Error("Định mức vải (m/sản phẩm) phải lớn hơn 0.");
    for (const variant of Array.isArray(payload.variants) ? payload.variants.slice(0, 60) : []) {
      const row = { color: text(variant.color, 60), size: text(variant.size, 30), quantity: amount(variant.quantity, { integer: true }) };
      if (!row.color && !row.size && !variant.quantity) continue;
      if (!row.quantity) throw new Error("Số lượng theo màu/size phải là số nguyên lớn hơn 0.");
      proposal.variants.push(row);
    }
    if (proposal.variants.length && proposal.variants.reduce((sum, row) => sum + row.quantity, 0) !== proposal.quantity) {
      throw new Error("Tổng số lượng theo màu/size phải bằng số lượng sản xuất.");
    }
    if (!proposal.signatureName) throw new Error("Vui lòng nhập họ và tên người đề xuất.");
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(proposal.signatureData) || proposal.signatureData.length > 256 * 1024) {
      throw new Error("Vui lòng ký tên trước khi gửi đề xuất.");
    }
    return proposal;
  }

  function validateFabrics(rows, field) {
    const list = Array.isArray(rows) ? rows.slice(0, 40) : [];
    if (!list.length) throw new Error("Vui lòng nhập ít nhất một mã vải.");
    return list.map((row) => {
      const fabricCode = text(row.fabricCode, 60);
      const meters = amount(row[field]);
      if (!fabricCode) throw new Error("Vui lòng nhập mã vải cho từng dòng.");
      if (!meters) throw new Error(`Số mét của vải ${fabricCode} phải lớn hơn 0.`);
      return { fabricCode, [field]: meters };
    });
  }

  // Lưu file đính kèm (base64 data URL) ra thư mục riêng, chỉ giữ thông tin file trong hồ sơ.
  function saveFiles(files, { imagesOnly = false } = {}) {
    const list = Array.isArray(files) ? files : [];
    if (list.length > maxFiles) throw new Error(`Chỉ đính kèm tối đa ${maxFiles} file.`);
    const parsed = list.map((file) => {
      const match = /^data:([\w.+-]+\/[\w.+-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(file?.data || ""));
      const name = text(file?.name, 150) || "file";
      if (!match) throw new Error(`File ${name} không hợp lệ.`);
      const body = Buffer.from(match[2], "base64");
      if (!body.length || body.length > maxFileBytes) throw new Error(`File ${name} vượt quá 8MB.`);
      if (imagesOnly && !/^image\//.test(match[1] || "")) throw new Error(`File ${name} không phải ảnh.`);
      return { id: crypto.randomUUID(), name, type: match[1] || "application/octet-stream", size: body.length, body };
    });
    fs.mkdirSync(filesDirectory, { recursive: true });
    return parsed.map(({ body, ...meta }) => {
      fs.writeFileSync(path.join(filesDirectory, meta.id), body);
      return meta;
    });
  }

  function serveFile(res, orderId, fileId) {
    const order = getOrders().find((item) => item.id === orderId);
    const file = [...(order?.transfer?.files || []), ...(order?.wash?.files || []), ...(order?.wash?.returnFiles || []), ...Object.values(order?.reconcile?.photos || {}).flat(), ...(order?.handover?.files || [])].find((item) => item.id === fileId);
    if (!file) return send(res, 404, "Không tìm thấy file.");
    let body;
    try {
      body = fs.readFileSync(path.join(filesDirectory, file.id));
    } catch {
      return send(res, 404, "Không tìm thấy file.");
    }
    const inline = /^image\/(jpeg|png|gif|webp)$/.test(file.type) || file.type === "application/pdf";
    res.writeHead(200, {
      "Content-Type": inline ? file.type : "application/octet-stream",
      "Content-Length": body.length,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  }

  function washLoss(fabric) {
    if (!fabric.cutMeters || fabric.washedMeters == null) return null;
    return (fabric.cutMeters - fabric.washedMeters) / fabric.cutMeters;
  }

  // Mỗi hành động trả về trạng thái kế tiếp; ném Error để báo lỗi cho người dùng.
  const actions = {
    approve(order, user, payload) {
      if (!["approval-1", "approval-2"].includes(order.status)) throw new Error("Đề xuất không ở bước duyệt.");
      order.approvals = { ...order.approvals, [order.status]: { ...actor(user), at: new Date().toISOString() } };
      addHistory(order, user, "Duyệt", text(payload.note, 500));
      return order.status === "approval-1" ? "approval-2" : "fabric-prep";
    },
    reject(order, user, payload) {
      if (!["approval-1", "approval-2"].includes(order.status)) throw new Error("Đề xuất không ở bước duyệt.");
      const note = text(payload.note, 500);
      if (!note) throw new Error("Vui lòng nhập lý do từ chối.");
      addHistory(order, user, "Từ chối", note);
      order.approvals = {};
      return "rejected";
    },
    resubmit(order, user, payload) {
      if (order.status !== "rejected") throw new Error("Chỉ gửi lại được đề xuất bị từ chối.");
      order.proposal = validateProposal(payload);
      addHistory(order, user, "Sửa & gửi lại", text(payload.note, 500));
      return "approval-1";
    },
    "prepare-fabric"(order, user, payload) {
      if (order.status !== "fabric-prep") throw new Error("Đề xuất không ở bước soạn vải.");
      order.fabrics = validateFabrics(payload.fabrics, "plannedMeters");
      addHistory(order, user, "Đã soạn vải, chuyển lập phiếu chuyển kho", text(payload.note, 500));
      return "transfer-draft";
    },
    "create-transfer"(order, user, payload) {
      if (order.status !== "transfer-draft") throw new Error("Đề xuất không ở bước lập phiếu chuyển kho.");
      const erpCode = text(payload.erpCode, 80);
      if (!erpCode) throw new Error("Vui lòng nhập số phiếu chuyển kho (nháp) trên ERPNext.");
      const rows = Array.isArray(payload.fabrics) ? payload.fabrics : [];
      const fabrics = order.fabrics.map((fabric) => {
        const cutMeters = amount(rows.find((row) => row.fabricCode === fabric.fabricCode)?.cutMeters ?? fabric.plannedMeters);
        if (!cutMeters) throw new Error(`Số mét cắt của vải ${fabric.fabricCode} phải lớn hơn 0.`);
        return { ...fabric, cutMeters };
      });
      const files = [...(order.transfer?.files || []), ...saveFiles(payload.files)];
      if (files.length > maxFiles) throw new Error(`Chỉ đính kèm tối đa ${maxFiles} file.`);
      order.fabrics = fabrics;
      order.transfer = { erpCode, warehouse: "Kho Sản xuất", note: order.proposal.productCode, files };
      addHistory(order, user, `Lập phiếu chuyển kho nháp ${erpCode}`, text(payload.note, 500));
      return "washing";
    },
    "send-wash"(order, user, payload) {
      if (order.status !== "washing" || order.wash?.sentAt) throw new Error("Vải đã được đưa đi wash.");
      order.wash = { sentAt: new Date().toISOString(), vendor: text(payload.vendor, 120), files: saveFiles(payload.files, { imagesOnly: true }) };
      addHistory(order, user, "Đưa vải đi wash", text(payload.note, 500));
      return "washing";
    },
    "return-wash"(order, user, payload) {
      if (order.status !== "washing" || !order.wash?.sentAt) throw new Error("Cần xác nhận đưa vải đi wash trước.");
      const rows = Array.isArray(payload.fabrics) ? payload.fabrics : [];
      order.fabrics = order.fabrics.map((fabric) => {
        const washedMeters = amount(rows.find((row) => row.fabricCode === fabric.fabricCode)?.washedMeters);
        if (!washedMeters) throw new Error(`Vui lòng nhập số mét sau wash của vải ${fabric.fabricCode}.`);
        if (washedMeters > fabric.cutMeters) throw new Error(`Số mét sau wash của vải ${fabric.fabricCode} không được lớn hơn trước wash.`);
        return { ...fabric, washedMeters };
      });
      // Mã vải phát sinh khi hàng wash về (không có trên phiếu chuyển kho).
      for (const row of rows.filter((item) => !order.fabrics.some((fabric) => fabric.fabricCode === text(item.fabricCode, 60)))) {
        const fabricCode = text(row.fabricCode, 60);
        const washedMeters = amount(row.washedMeters);
        if (!fabricCode) throw new Error("Vui lòng nhập mã vải cho dòng mới thêm.");
        if (!washedMeters) throw new Error(`Vui lòng nhập số mét sau wash của vải ${fabricCode}.`);
        if (order.fabrics.some((fabric) => fabric.fabricCode === fabricCode)) throw new Error(`Mã vải ${fabricCode} bị trùng.`);
        order.fabrics.push({ fabricCode, washedMeters, addedAfterWash: true });
      }
      order.wash.returnFiles = saveFiles(payload.files, { imagesOnly: true });
      order.wash.returnedAt = new Date().toISOString();
      addHistory(order, user, "Nhận vải sau wash, báo số lượng thực tế", text(payload.note, 500));
      return "reconcile";
    },
    reconcile(order, user, payload) {
      if (order.status !== "reconcile") throw new Error("Đề xuất không ở bước đối chiếu.");
      const overLimit = order.fabrics.filter((fabric) => washLoss(fabric) > maxWashLoss);
      const lossNote = text(payload.lossNote, 500);
      if (overLimit.length && !lossNote) throw new Error(`Hao hụt vượt 3% (${overLimit.map((fabric) => fabric.fabricCode).join(", ")}). Vui lòng ghi lý do.`);
      if (payload.erpConfirmed !== true) throw new Error("Vui lòng xác nhận đã bấm xác nhận phiếu chuyển kho trên ERPNext.");
      if (payload.printed !== true) throw new Error("Vui lòng xác nhận đã in 2 phiếu chuyển kho có chữ ký từ Vận hành kho thời trang.");
      if (payload.proposalPrinted !== true) throw new Error("Vui lòng xác nhận đã in 2 phiếu đề xuất sản xuất có chữ ký từ Vận hành kho thời trang.");
      const photoGroups = { erp: "ảnh xác nhận phiếu chuyển kho trên ERPNext", transferPrint: "ảnh 2 phiếu chuyển kho đã in có chữ ký từ Vận hành kho thời trang", proposalPrint: "ảnh 2 phiếu đề xuất sản xuất đã in có chữ ký từ Vận hành kho thời trang" };
      for (const [key, label] of Object.entries(photoGroups)) {
        if (!Array.isArray(payload.photos?.[key]) || !payload.photos[key].length) throw new Error(`Vui lòng chụp ${label}.`);
      }
      const photos = Object.fromEntries(Object.keys(photoGroups).map((key) => [key, saveFiles(payload.photos[key], { imagesOnly: true })]));
      order.reconcile = { lossNote, overLimit: overLimit.map((fabric) => fabric.fabricCode), photos, at: new Date().toISOString(), ...actor(user) };
      addHistory(order, user, "Đối chiếu khớp, xác nhận ERPNext, in 2 phiếu chuyển kho & 2 phiếu đề xuất có chữ ký từ Vận hành kho thời trang", lossNote);
      return "handover";
    },
    handover(order, user, payload) {
      if (order.status !== "handover") throw new Error("Đề xuất không ở bước bàn giao.");
      if (payload.signed !== true) throw new Error("Vui lòng xác nhận đã ký 2 phiếu chuyển kho và kẹp vào phiếu đề xuất.");
      if (!Array.isArray(payload.files) || !payload.files.length) throw new Error("Vui lòng chụp ảnh xác nhận đã bàn giao cho phòng sản xuất.");
      order.handover = { at: new Date().toISOString(), files: saveFiles(payload.files, { imagesOnly: true }), ...actor(user) };
      addHistory(order, user, "Ký phiếu, bàn giao bộ đề xuất & vải cho xưởng", text(payload.note, 500));
      return "workshop-receive";
    },
    "workshop-receive"(order, user, payload) {
      if (order.status !== "workshop-receive") throw new Error("Đề xuất không ở bước xưởng tiếp nhận.");
      const unitPrice = amount(payload.unitPrice, { integer: true });
      if (!unitPrice) throw new Error("Vui lòng nhập đơn giá sản xuất (đồng/sản phẩm).");
      if (!isDate(payload.expectedDate)) throw new Error("Vui lòng chọn ngày giao hàng dự kiến.");
      order.workshop = { receivedAt: new Date().toISOString(), unitPrice, expectedDate: payload.expectedDate, ...actor(user) };
      addHistory(order, user, "Xưởng nhận đủ bộ đề xuất & vải; nhập đơn giá, ngày giao dự kiến", text(payload.note, 500));
      return "in-production";
    },
    "send-back"(order, user, payload) {
      const index = stageOrder.indexOf(order.status);
      if (index < 3 || order.status === "in-production") throw new Error("Không thể trả lại ở bước này.");
      const note = text(payload.note, 500);
      if (!note) throw new Error("Vui lòng nhập lý do trả lại.");
      addHistory(order, user, `Trả lại bước "${stages[stageOrder[index - 1]].label}"`, note);
      if (order.status === "reconcile" && order.wash) {
        delete order.wash.returnedAt;
        order.fabrics = order.fabrics.filter((fabric) => !fabric.addedAfterWash);
      }
      return stageOrder[index - 1];
    },
  };

  function usersWithRole(role) {
    const ids = new Set(getAssignees()[role] || []);
    return [...users.values()].filter((user) => user.status === "active" && ids.has(getUserKey(user)));
  }

  function notifyStage(order) {
    const role = stageRole(order);
    const recipients = usersWithRole(role || "create");
    const body = order.status === "in-production"
      ? `${order.code} · ${order.proposal.productCode}: xưởng đã nhận, giao dự kiến ${order.workshop.expectedDate.split("-").reverse().join("/")}.`
      : order.status === "rejected"
        ? `${order.code} · ${order.proposal.productCode} bị từ chối. Vui lòng xem lý do và gửi lại.`
        : `${order.code} · ${order.proposal.productCode} đang chờ bạn: ${roles[role].label}.`;
    notify(recipients, { title: "Quy trình sản xuất", body, path: `/production.html?id=${order.id}` })
      .catch((error) => console.error("Production notification failed:", error.message));
  }

  function publicOrder(order, user) {
    const role = stageRole(order);
    return { ...order, stageLabel: stages[order.status]?.label, stageStep: stages[order.status]?.step, stageRole: role, canAct: canAct(user, order) };
  }

  async function readBody(req) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > (maxFiles * maxFileBytes * 4) / 3 + 1024 * 1024) throw new Error("Dữ liệu gửi lên quá lớn.");
    }
    return JSON.parse(body || "{}");
  }

  function serveList(req, res, user) {
    const assignees = getAssignees();
    const names = Object.fromEntries([...users.values()].map((item) => [getUserKey(item), item.name || item.email]));
    const payload = {
      orders: getOrders().map((order) => publicOrder(order, user)),
      stages,
      stageOrder,
      roles,
      assignees: Object.fromEntries(Object.entries(assignees).map(([role, ids]) => [role, ids.map((id) => ({ id, name: names[id] || id }))])),
      me: { id: getUserKey(user), roles: getUserRoles(user), canManage: isManagementUser(user), canCreate: getUserRoles(user).includes("create") },
    };
    if (isManagementUser(user)) {
      payload.users = [...users.values()].filter((item) => item.status === "active").map((item) => ({ id: getUserKey(item), name: item.name || item.email, email: item.email }));
    }
    sendJson(res, 200, payload);
  }

  async function create(req, res, user) {
    if (!getUserRoles(user).includes("create")) return send(res, 403, "Bạn chưa được phân công lập đề xuất sản xuất.");
    const orders = getOrders();
    const order = { id: crypto.randomUUID(), code: nextCode(orders), status: "approval-1", createdAt: new Date().toISOString(), createdBy: actor(user), proposal: validateProposal(await readBody(req)), approvals: {}, fabrics: [], history: [] };
    addHistory(order, user, "Lập & ký đề xuất sản xuất");
    orders.unshift(order);
    saveOrders(orders);
    notifyStage(order);
    publish();
    sendJson(res, 201, { order: publicOrder(order, user) });
  }

  async function act(req, res, user, orderId) {
    const payload = await readBody(req);
    const handler = Object.hasOwn(actions, payload.action) ? actions[payload.action] : null;
    if (!handler) return send(res, 400, "Thao tác không hợp lệ.");
    const orders = getOrders();
    const order = orders.find((item) => item.id === orderId);
    if (!order) return send(res, 404, "Không tìm thấy đề xuất sản xuất.");
    if (!canAct(user, order)) return send(res, 403, "Bước này không thuộc phân công của bạn.");
    const previous = stageRole(order);
    order.status = handler(order, user, payload);
    saveOrders(orders);
    if (stageRole(order) !== previous || order.status === "in-production") notifyStage(order);
    publish();
    sendJson(res, 200, { order: publicOrder(order, user) });
  }

  async function updateSettings(req, res, user) {
    if (!isManagementUser(user)) return send(res, 403, "Chỉ CEO/Quản trị được phân công.");
    const payload = await readBody(req);
    const validIds = new Set([...users.values()].map(getUserKey));
    const assignees = Object.fromEntries(Object.keys(roles).map((role) => [role, [...new Set(Array.isArray(payload.assignees?.[role]) ? payload.assignees[role] : [])].filter((id) => validIds.has(id))]));
    fs.writeFileSync(settingsPath, JSON.stringify({ assignees }, null, 2));
    publish();
    sendJson(res, 200, { ok: true });
  }

  // Trả về true khi request thuộc /api/production.
  async function handle(req, res) {
    const { pathname } = new URL(req.url, "http://localhost");
    if (!pathname.startsWith("/api/production")) return false;
    const user = getCurrentUser(req);
    if (!user || user.status !== "active") return send(res, 403, "Forbidden"), true;
    // Số hồ sơ đang chờ người dùng xử lý — dùng cho chấm đỏ trên menu.
    if (req.method === "GET" && pathname === "/api/production/count") return sendJson(res, 200, { count: getOrders().filter((order) => canAct(user, order)).length }), true;
    if (!canView(user)) return send(res, 403, "Bạn chưa được phân công trong quy trình sản xuất."), true;
    try {
      if (req.method === "GET" && pathname === "/api/production") serveList(req, res, user);
      else if (req.method === "POST" && pathname === "/api/production") await create(req, res, user);
      else if (req.method === "POST" && pathname === "/api/production/settings") await updateSettings(req, res, user);
      else if (req.method === "GET" && /^\/api\/production\/[\w-]+\/files\/[\w-]+$/.test(pathname)) serveFile(res, pathname.split("/")[3], pathname.split("/")[5]);
      else if (req.method === "POST" && /^\/api\/production\/[\w-]+\/action$/.test(pathname)) await act(req, res, user, pathname.split("/")[3]);
      else send(res, 404, "Not found");
    } catch (error) {
      send(res, 400, error instanceof SyntaxError ? "Invalid JSON" : error.message);
    }
    return true;
  }

  return { handle, dataFiles: ["production-orders.json", "production-settings.json"] };
}

module.exports = { createProductionOrders };
