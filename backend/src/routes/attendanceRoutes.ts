import express from "express";
import { 
    createAttendance,
    getAttendances,
    updateAttendance,
    getAttendanceById,
    deleteAttendance,
    getAdminDashboard,
    getEmployeeDashboard
 } from "../controllers/attendanceController";
import { authMiddleware } from "../middlewares/authMiddleware";
import uploadProofAttendance from "../middlewares/uploadProofAttendance";
import { timezoneMiddleware } from "../middlewares/timezoneMiddleware";

const router = express.Router();

// tambah absensi
router.post(
    "/create-attendance", 
    authMiddleware, 
    timezoneMiddleware, 
    uploadProofAttendance.single("proof"), 
    createAttendance
);

// tampilkan data absensi (include search)
router.get(
    "/show-attendance",
    authMiddleware,
    timezoneMiddleware,
    getAttendances
);

// tampilan detail data absensi (berdasarkan id attendance)
router.get(
    "/show-detail/:id",
    authMiddleware,
    timezoneMiddleware,
    getAttendanceById
)

// update data absensi (admin/superadmin only)
router.patch(
    "/update-attendance/:id", 
    authMiddleware, 
    timezoneMiddleware,
    uploadProofAttendance.single("proof"), 
    updateAttendance
);

// soft delete attendance
router.delete(
    "/delete-attendance/:id",
    authMiddleware,
    deleteAttendance
);

// dashboard admin (perhari)
router.get(
    "/admin-dashboard",
    authMiddleware,
    timezoneMiddleware,
    getAdminDashboard
);

// dashboard employee (perbulan)
router.get(
    "/employee-dashboard",
    authMiddleware,
    timezoneMiddleware,
    getEmployeeDashboard
);

// route cek waktu sekarang (wib)
router.get("/time", (req, res) => {
  res.json({
    nowWIB: req.formatWIB(req.nowWIB, "dd MMM yyyy HH:mm:ss"),
    todayWIB: req.todayWIB,
  });
});

export default router;
