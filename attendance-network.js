const { isIP } = require("node:net");

function normalizeIp(value) {
  if (typeof value !== "string") return "";
  const ip = value.trim();
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6 || ip.includes("%")) return "";
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isPublicIp(ip) {
  if (isIP(ip) === 6) return /^[23]/.test(ip) && !ip.startsWith("2001:db8:");
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

function validateAllowedIps(values) {
  if (!Array.isArray(values) || values.length > 100) throw new Error("Nhập tối đa 100 IP Internet, mỗi dòng một IP.");
  const ips = values.map((value) => {
    const ip = normalizeIp(value);
    if (!ip || !isPublicIp(ip)) throw new Error("Chỉ nhập IP Internet công cộng IPv4 hoặc IPv6, không nhập IP nội bộ, tên Wi-Fi hay đường dẫn.");
    return ip;
  });
  return [...new Set(ips)];
}

function getRequestIp(req, trustedProxyHops) {
  if (trustedProxyHops === 0) return normalizeIp(req.socket?.remoteAddress);
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded !== "string") return "";
  const chain = forwarded.split(",");
  if (chain.length < trustedProxyHops) return "";
  // Ignore caller-supplied addresses to the left of the trusted proxy hops.
  return normalizeIp(chain[chain.length - trustedProxyHops]);
}

function needsOfficeNetwork(action, mode, record) {
  return action === "check-in" ? mode === "office" : record.workMode !== "online";
}

module.exports = { normalizeIp, validateAllowedIps, getRequestIp, needsOfficeNetwork };
