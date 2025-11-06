import express from "express";
import { createAttendance } from "../controllers/attendanceController";
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



// route cek waktu sekarang (wib)
router.get("/time", (req, res) => {
  res.json({
    nowWIB: req.formatWIB(req.nowWIB, "dd MMM yyyy HH:mm:ss"),
    todayWIB: req.todayWIB,
  });
});

export default router;
