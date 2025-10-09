import express from "express";
import { 
    createWorkSchedule,
    getMyWorkSchedules,
    getAllWorkSchedules,
    updateWorkSchedule,
    deleteWorkSchedule
 } from "../controllers/workScheduleController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/create-schedule", authMiddleware, createWorkSchedule);
router.get("/show/my-work-schedule-company", authMiddleware, getMyWorkSchedules);
router.get("/show/all-work-schedule-company", authMiddleware, getAllWorkSchedules);
router.put("/update-schedule/:id", authMiddleware, updateWorkSchedule);
router.delete("/delete-schedule/:id", authMiddleware, deleteWorkSchedule);

export default router;