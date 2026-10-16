const { isIP, BlockList } = require("node:net");

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

function getOfficeNetwork(value) {
  const ip = normalizeIp(value);
  if (isIP(ip) !== 6 || !isPublicIp(ip)) return ip;
  const [left, right] = ip.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const groups = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  return `${normalizeIp(`${groups.slice(0, 4).join(":")}::`)}/64`;
}

function validateAllowedIps(values) {
  if (!Array.isArray(values) || values.length > 100) throw new Error("Nhập tối đa 100 IP Internet, mỗi dòng một IP.");
  const ips = values.map((value) => {
    if (typeof value === "string" && value.trim().includes("/")) {
      const [address, prefix, extra] = value.trim().split("/");
      const ip = normalizeIp(address);
      if (extra !== undefined || prefix !== "64" || isIP(ip) !== 6 || !isPublicIp(ip)) {
        throw new Error("Dải mạng chỉ hỗ trợ IPv6 công cộng /64, ví dụ 2402:800:6370:b5c8::/64.");
      }
      return getOfficeNetwork(ip);
    }
    const ip = normalizeIp(value);
    if (!ip || !isPublicIp(ip)) throw new Error("Chỉ nhập IP Internet công cộng IPv4 hoặc IPv6, không nhập IP nội bộ, tên Wi-Fi hay đường dẫn.");
    return ip;
  });
  return [...new Set(ips)];
}

function isAllowedOfficeIp(value, allowedIps) {
  const ip = normalizeIp(value);
  if (!ip) return false;
  return allowedIps.some((allowed) => {
    if (!allowed.includes("/")) return allowed === ip;
    const [network] = allowed.split("/");
    if (isIP(ip) !== 6) return false;
    const subnet = new BlockList();
    subnet.addSubnet(network, 64, "ipv6");
    return subnet.check(ip, "ipv6");
  });
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

module.exports = { normalizeIp, validateAllowedIps, getRequestIp, needsOfficeNetwork, getOfficeNetwork, isAllowedOfficeIp };
