const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// QT.SX.01 — đợt 1: từ lập đề xuất sản xuất đến bàn giao vải cho xưởng (bước 1–14).
const stages = {
  "approval-1": { label: "Chờ duyệt cấp 1", role: "approval-1", step: "Bước 3" },
  "approval-2": { label: "Chờ duyệt cấp 2", role: "approval-2", step: "Bước 4" },
  reconcile: { label: "Đối chiếu sau wash", role: "reconcile", step: "Bước 3" },
  "fabric-prep": { label: "Soạn vải", role: "fabric-prep", step: "Bước 4" },
  handover: { label: "Ký phiếu & bàn giao", role: "handover", step: "Bước 11–12" },
  "workshop-receive": { label: "Xưởng nhận & báo giá", role: "workshop-receive", step: "Bước 12–14" },
  "in-production": { label: "Đang sản xuất", role: null, step: "Hoàn tất đợt 1" },
  rejected: { label: "Bị từ chối", role: "create", step: "Sửa & gửi lại" },
};
const stageOrder = ["approval-1", "approval-2", "reconcile", "fabric-prep", "handover", "workshop-receive", "in-production"];
// Phân công theo từng bước của QT.SX.01.
const roles = {
  create: { label: "Bước 1–2 · Lập & ký phiếu đề xuất sản xuất", hint: "Thống kê mã cần sản xuất, lập phiếu, ký tên; sửa & gửi lại khi bị từ chối." },
  "approval-1": { label: "Bước 3 · Duyệt cấp 1", hint: "Duyệt hoặc từ chối kế hoạch sản xuất." },
  "approval-2": { label: "Bước 4 · Duyệt cấp 2", hint: "Duyệt sau khi cấp 1 đã duyệt." },
  reconcile: { label: "Bước 3 · Đối chiếu sau wash", hint: "Nhập số mét sau wash, kiểm hao hụt và xác nhận ERPNext." },
  "fabric-prep": { label: "Bước 4 · Soạn vải", hint: "Sau khi đối chiếu, kiểm tra và xác nhận bảng số lượng theo size." },
  handover: { label: "Bước 11–12 · Ký phiếu & bàn giao cho xưởng", hint: "Ký phiếu, bàn giao bộ đề xuất và vải, chụp ảnh xác nhận." },
  "workshop-receive": { label: "Bước 12–14 · Xưởng nhận vải & báo giá", hint: "Xác nhận đã nhận, nhập đơn giá và ngày giao dự kiến." },
  "view-history": { label: "Quyền xem lại tiến độ quy trình", hint: "Xem hồ sơ, nhấn các bước 1, 2, 3… để xem người xử lý, thời gian, ghi chú và ảnh đã lưu." },
};
// Phân công cũ theo vai trò → bước tương ứng.
const legacyRoles = { create: "planner", "approval-1": "approver1", "approval-2": "approver2", "fabric-prep": "planner", reconcile: "warehouse", handover: "planner", "workshop-receive": "workshop", "view-history": "accountant" };
const maxWashLoss = 0.05;
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
    return Array.isArray(orders) ? orders.map((order) => {
      const status = ["transfer-draft", "washing"].includes(order.status) ? "reconcile" : order.status;
      let fabrics = (order.fabrics || []).map((fabric) => ({ ...fabric, cutMeters: fabric.cutMeters ?? fabric.plannedMeters }));
      if (!fabrics.length && status === "reconcile") {
        fabrics = (order.proposal?.technicalRows || []).filter((row) => row.item).map((row) => ({
          fabricCode: row.item,
          plannedMeters: amount(row.requirement),
          cutMeters: amount(row.requirement),
        })).filter((fabric) => fabric.plannedMeters);
      }
      return { ...order, status, fabrics };
    }) : [];
  };
  const saveOrders = (orders) => fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  const getAssignees = () => {
    const saved = readJson(settingsPath, {}).assignees || {};
    const mapped = Object.fromEntries(Object.keys(roles).map((role) => {
      const ids = Array.isArray(saved[role]) ? saved[role] : saved[legacyRoles[role]];
      return [role, Array.isArray(ids) ? ids : []];
    }));
    mapped["view-history"] = [...new Set([...(mapped["view-history"] || []), ...(Array.isArray(saved.accountant) ? saved.accountant : [])])];
    return mapped;
  };

  function stageRole(order) {
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
  const todayKey = () => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
  function amount(value, { integer = false } = {}) {
    const raw = String(value ?? "").trim().replace(",", ".");
    if (!(integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(raw)) return null;
    const number = Number(raw);
    return number > 0 ? number : null;
  }
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

  const sizeNumber = (value) => {
    const number = Number(String(value ?? "").trim().replace(",", "."));
    return Number.isFinite(number) && number > 0 ? String(Math.round(number)) : "";
  };

  // Bảng số lượng theo size: tên cột size do người dùng đặt, cột tổng cộng luôn được tính lại ở máy chủ.
  function cleanSizeTable(payload) {
    const labels = (Array.isArray(payload.sizeColumns) ? payload.sizeColumns : []).slice(0, 10).map((label, index) => text(label, 12) || `Size ${index + 1}`);
    const sizeColumns = labels.length ? labels : ["S"];
    const rows = (Array.isArray(payload.technicalRows) ? payload.technicalRows : []).slice(0, 10).map((row) => {
      const sizes = sizeColumns.map((_, index) => sizeNumber(row?.sizes?.[index]));
      return {
        item: text(row?.item, 100),
        requirement: text(row?.requirement, 30),
        actual: text(row?.actual, 30),
        sizes,
        note: String(sizes.reduce((sum, value) => sum + Number(value || 0), 0)),
      };
    }).filter((row) => row.item || row.requirement || row.actual || row.sizes.some(Boolean));
    return { sizeColumns, rows };
  }

  function validateProposal(payload) {
    const proposal = {
      date: text(payload.date, 10),
      productCode: text(payload.productCode, 60),
      productName: text(payload.productName, 200),
      reason: text(payload.reason, 300),
      deliveryDate: text(payload.deliveryDate, 10),
      quantity: amount(payload.quantity, { integer: true }),
      fabricNorm: amount(payload.fabricNorm),
      sampleStatus: text(payload.sampleStatus, 60),
      patternStatus: text(payload.patternStatus, 60),
      imageStatus: text(payload.imageStatus, 60),
      sampleSize: text(payload.sampleSize, 30),
      fabric: text(payload.fabric, 200),
      color: text(payload.color, 200),
      note: text(payload.note, 1000),
      changeNotes: [],
      technicalRows: [],
      productImage: typeof payload.productImage === "string" ? payload.productImage : "",
      signatureName: text(payload.signatureName, 150),
      signatureData: typeof payload.signatureData === "string" ? payload.signatureData : "",
      variants: [],
    };
    if (!isDate(proposal.date)) throw new Error("Vui lòng chọn ngày đề xuất.");
    if (!proposal.productCode || !proposal.productName) throw new Error("Vui lòng nhập mã và tên thành phẩm.");
    if (!proposal.reason) throw new Error("Vui lòng nhập lý do sản xuất.");
    if (!proposal.quantity) throw new Error("Số lượng sản xuất phải là số nguyên lớn hơn 0.");
    if (!proposal.fabricNorm) throw new Error("Định mức vải (m/sản phẩm) phải lớn hơn 0.");
    if (!proposal.sampleStatus || !proposal.patternStatus || !proposal.imageStatus) throw new Error("Vui lòng xác nhận tình trạng mẫu, rập và hình ảnh sản phẩm.");
    if (!proposal.sampleSize) throw new Error("Vui lòng nhập size mẫu.");
    if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(proposal.productImage) || proposal.productImage.length > 11 * 1024 * 1024) {
      throw new Error("Vui lòng tải hình ảnh sản phẩm hợp lệ (tối đa 8MB).");
    }
    proposal.changeNotes = (Array.isArray(payload.changeNotes) ? payload.changeNotes : [])
      .slice(0, 30)
      .map((value) => typeof value === "string"
        ? { content: "", detail: text(value, 500) }
        : { content: text(value?.content, 200), detail: text(value?.detail, 500) })
      .filter((row) => row.content || row.detail);
    const sizeTable = cleanSizeTable(payload);
    proposal.sizeColumns = sizeTable.sizeColumns;
    proposal.technicalRows = sizeTable.rows;
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
      const approvalName = text(payload.approvalName, 150);
      const approvalSignature = typeof payload.approvalSignature === "string" ? payload.approvalSignature : "";
      if (!approvalName) throw new Error("Vui lòng nhập họ và tên người duyệt.");
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(approvalSignature) || approvalSignature.length > 256 * 1024) {
        throw new Error("Vui lòng ký xác nhận trước khi duyệt.");
      }
      order.approvals = { ...order.approvals, [order.status]: { ...actor(user), name: approvalName, signatureData: approvalSignature, at: new Date().toISOString() } };
      addHistory(order, user, order.status === "approval-1" ? "Đã duyệt cấp 1" : "Đã duyệt cấp 2", text(payload.note, 500));
      return order.status === "approval-1" ? "approval-2" : "reconcile";
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
      const table = cleanSizeTable(payload);
      const previous = order.proposal.technicalRows || [];
      // Cột số m sau wash đã được nhập ở bước đối chiếu và được giữ lại khi xác nhận bảng.
      const rows = table.rows.filter((row) => row.item).map((row) => {
        const old = previous.find((item) => text(item.item, 100).toLowerCase() === text(row.item, 100).toLowerCase());
        const fabric = (order.fabrics || []).find((item) => text(item.fabricCode, 100).toLowerCase() === text(row.item, 100).toLowerCase());
        return { ...row, actual: String(fabric?.washedMeters ?? old?.actual ?? "") };
      });
      if (!rows.length) throw new Error("Vui lòng nhập ít nhất một dòng mã sản phẩm.");
      const meters = rows.map((row) => {
        const value = amount(row.requirement);
        if (!value) throw new Error(`Vui lòng nhập số m trước wash cho mã ${row.item}.`);
        return value;
      });
      order.proposal.sizeColumns = table.sizeColumns;
      order.proposal.technicalRows = rows;
      const productTotal = rows.reduce((sum, row) => sum + Number(row.note || 0), 0);
      if (productTotal > 0) order.proposal.quantity = productTotal;
      order.fabrics = rows.map((row, index) => {
        const existing = (order.fabrics || []).find((item) => text(item.fabricCode, 100).toLowerCase() === text(row.item, 100).toLowerCase());
        return {
          fabricCode: row.item,
          plannedMeters: meters[index],
          cutMeters: meters[index],
          washedMeters: existing?.washedMeters,
        };
      });
      addHistory(order, user, "Đã xác nhận bảng sau đối chiếu", text(payload.note, 500));
      return "handover";
    },
    reconcile(order, user, payload) {
      if (order.status !== "reconcile") throw new Error("Đề xuất không ở bước đối chiếu.");
      // Số m sau wash được nhập ở bước này (mặc định lấy giá trị đã lưu nếu không gửi lên).
      const entered = Array.isArray(payload.fabrics) ? payload.fabrics : [];
      const fabricKey = (value) => text(value, 100).toLowerCase();
      if (!order.fabrics?.length) {
        order.fabrics = (order.proposal?.technicalRows || []).filter((row) => row.item).map((row) => ({
          fabricCode: row.item,
          plannedMeters: amount(row.requirement),
          cutMeters: amount(row.requirement),
        })).filter((fabric) => fabric.cutMeters);
      }
      order.fabrics = order.fabrics.map((fabric) => {
        const key = fabricKey(fabric.fabricCode);
        const submitted = entered.find((row) => fabricKey(row.fabricCode) === key);
        const washedMeters = amount(submitted?.washedMeters) ?? amount(fabric.washedMeters);
        if (!washedMeters) throw new Error(`Vui lòng nhập số m sau wash của mã ${fabric.fabricCode}.`);
        if (washedMeters > fabric.cutMeters) throw new Error(`Số m sau wash của mã ${fabric.fabricCode} không được lớn hơn số m trước wash (${fabric.cutMeters}).`);
        return { ...fabric, washedMeters };
      });
      order.proposal.technicalRows = (order.proposal.technicalRows || []).map((row) => {
        const key = fabricKey(row.item);
        const fabric = order.fabrics.find((item) => fabricKey(item.fabricCode) === key);
        return fabric ? { ...row, actual: String(fabric.washedMeters) } : row;
      });
      const overLimit = order.fabrics.filter((fabric) => washLoss(fabric) > maxWashLoss);
      const lossNote = text(payload.lossNote, 500);
      if (overLimit.length && !lossNote) throw new Error(`Hao hụt vượt 5% (${overLimit.map((fabric) => fabric.fabricCode).join(", ")}). Vui lòng ghi lý do.`);
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
      if (overLimit.length) {
        const management = [...users.values()].filter((item) => item.status === "active" && isManagementUser(item));
        const detail = overLimit.map((fabric) => `${fabric.fabricCode} ${(washLoss(fabric) * 100).toFixed(1)}%`).join(", ");
        notify(management, {
          title: "Cảnh báo hao hụt vải vượt 5%",
          body: `${order.code} · ${order.proposal.productCode}: ${detail}.${lossNote ? ` Lý do: ${lossNote}` : ""}`,
          path: `/production.html?id=${order.id}`,
        }).catch((error) => console.error("Production wash-loss notification failed:", error.message));
      }
      return "fabric-prep";
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
      if (payload.expectedDate < todayKey()) throw new Error("Ngày giao hàng dự kiến không được trước ngày hôm nay.");
      order.workshop = { receivedAt: new Date().toISOString(), unitPrice, expectedDate: payload.expectedDate, ...actor(user) };
      order.proposal.deliveryDate = payload.expectedDate;
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
    const overLimitItems = (order.fabrics || []).filter((fabric) => washLoss(fabric) > maxWashLoss).map((fabric) => ({
      fabricCode: fabric.fabricCode,
      lossPercent: Number(((washLoss(fabric) || 0) * 100).toFixed(1)),
    }));
    const washLossAlert = {
      exceeded: overLimitItems.length > 0,
      items: overLimitItems,
      lossNote: order.reconcile?.lossNote || "",
    };
    return { ...order, stageLabel: stages[order.status]?.label, stageStep: stages[order.status]?.step, stageRole: role, canAct: canAct(user, order), washLossAlert };
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

  function remove(req, res, user, orderId) {
    if (!isManagementUser(user)) return send(res, 403, "Chỉ CEO/Quản trị được xóa hồ sơ sản xuất.");
    const orders = getOrders();
    const order = orders.find((item) => item.id === orderId);
    if (!order) return send(res, 404, "Không tìm thấy đề xuất sản xuất.");
    const files = [...(order.transfer?.files || []), ...(order.wash?.files || []), ...(order.wash?.returnFiles || []), ...Object.values(order.reconcile?.photos || {}).flat(), ...(order.handover?.files || [])];
    for (const file of files) {
      try {
        fs.rmSync(path.join(filesDirectory, file.id), { force: true });
      } catch (error) {
        console.error(`Production file delete failed ${file.id}:`, error);
      }
    }
    saveOrders(orders.filter((item) => item.id !== orderId));
    publish();
    sendJson(res, 200, { ok: true, id: orderId });
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
      else if (req.method === "DELETE" && /^\/api\/production\/[\w-]+$/.test(pathname)) remove(req, res, user, pathname.split("/")[3]);
      else if (req.method === "POST" && /^\/api\/production\/[\w-]+\/action$/.test(pathname)) await act(req, res, user, pathname.split("/")[3]);
      else send(res, 404, "Not found");
    } catch (error) {
      send(res, 400, error instanceof SyntaxError ? "Invalid JSON" : error.message);
    }
    return true;
  }

  // Hồ sơ đang chờ người dùng xử lý — dùng cho chuông thông báo.
  function pendingFor(user) {
    return getOrders().filter((order) => canAct(user, order)).map((order) => ({ id: order.id, code: order.code, productCode: order.proposal.productCode, updatedAt: order.updatedAt, step: roles[stageRole(order)].label }));
  }

  function washLossAlertsFor(user) {
    if (!isManagementUser(user)) return [];
    return getOrders().filter((order) => order.reconcile?.at && (order.fabrics || []).some((fabric) => washLoss(fabric) > maxWashLoss))
      .map((order) => {
        const exceeded = order.fabrics.filter((fabric) => washLoss(fabric) > maxWashLoss);
        const details = exceeded.map((fabric) => `${fabric.fabricCode} (${(washLoss(fabric) * 100).toFixed(1)}%)`).join(", ");
        return {
          id: `production-wash-loss-${order.id}-${order.reconcile.at}`,
          kind: "action",
          title: "Cảnh báo hao hụt vải vượt 5%",
          text: `${order.code} · ${order.proposal.productCode}: ${details}.${order.reconcile.lossNote ? ` Lý do: ${order.reconcile.lossNote}` : ""}`,
          url: `/production.html?id=${encodeURIComponent(order.id)}`,
          time: order.reconcile.at,
        };
      });
  }

  return { handle, pendingFor, washLossAlertsFor, dataFiles: ["production-orders.json", "production-settings.json"] };
}

module.exports = { createProductionOrders };
