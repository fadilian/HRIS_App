import express from "express";
import { 
    createWorkSchedule,
    getMyWorkSchedules,
    getAllWorkSchedules
 } from "../controllers/workScheduleController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/create-schedule", authMiddleware, createWorkSchedule);
router.get("/show/my-work-schedule-company", authMiddleware, getMyWorkSchedules);
router.get("/show/all-work-schedule-company", authMiddleware, getAllWorkSchedules);

export default router;
