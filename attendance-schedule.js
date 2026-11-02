// Shift rules per office, shared by server.js and attendance.js. Times are minutes after midnight (Asia/Ho_Chi_Minh).
(function (root) {
  const ATTENDANCE_SITES = {
    q4: {
      label: "Quận 4",
      shifts: {
        "full-day": { checkInFrom: 6 * 60, checkInTo: 12 * 60, lateAfter: 8 * 60 + 30, checkOutFrom: 17 * 60 + 30 },
        "half-day-morning": { checkInFrom: 6 * 60, checkInTo: 12 * 60, lateAfter: 8 * 60 + 30, checkOutFrom: 17 * 60 + 30 },
        "half-day-afternoon": { checkInFrom: 11 * 60, checkInTo: 15 * 60, lateAfter: 13 * 60, checkOutFrom: 17 * 60 + 30 },
      },
    },
    "ben-thanh": {
      label: "Bến Thành",
      shifts: {
        "full-day": { checkInFrom: 6 * 60, checkInTo: 12 * 60, lateAfter: 9 * 60, checkOutFrom: 17 * 60 },
        "half-day-morning": { checkInFrom: 6 * 60, checkInTo: 12 * 60, lateAfter: 9 * 60, checkOutFrom: 13 * 60 },
        "half-day-afternoon": { checkInFrom: 11 * 60, checkInTo: 15 * 60, lateAfter: 13 * 60, checkOutFrom: 17 * 60 },
      },
    },
  };

  function normalizeAttendanceSite(site) {
    return Object.hasOwn(ATTENDANCE_SITES, site) ? site : "q4";
  }

  function getAttendanceShift(site, attendanceType) {
    const shifts = ATTENDANCE_SITES[normalizeAttendanceSite(site)].shifts;
    return shifts[attendanceType] || shifts["full-day"];
  }

  function formatShiftTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  const api = { ATTENDANCE_SITES, normalizeAttendanceSite, getAttendanceShift, formatShiftTime };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GusaAttendanceSchedule = api;
})(this);
