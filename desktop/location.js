const { execFile } = require("node:child_process");
const path = require("node:path");

function getWindowsPosition() {
  return new Promise((resolve, reject) => {
    const executable = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    // PowerShell cannot read scripts inside Electron's virtual ASAR filesystem.
    const script = path.join(__dirname, "location.ps1").replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
    execFile(executable, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script], {
      windowsHide: true,
      timeout: 40000,
      maxBuffer: 64 * 1024,
      encoding: "utf8",
    }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.ok === false && [1, 2, 3].includes(result.error?.code) && typeof result.error.message === "string") {
          resolve(result);
          return;
        }
        const coords = result.position?.coords;
        if (result.ok !== true || !coords ||
          !Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90 ||
          !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180 ||
          !Number.isFinite(coords.accuracy) || coords.accuracy < 0 ||
          !Number.isFinite(result.position.timestamp)) {
          throw new Error("Windows trả về dữ liệu vị trí không hợp lệ.");
        }
        resolve(result);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

module.exports = { getWindowsPosition };
