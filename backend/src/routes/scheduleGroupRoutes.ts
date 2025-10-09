import express from "express";
import {
    createScheduleGroup,
    getMyScheduleGroups,
    getAllScheduleGroups,
    updateScheduleGroup,
    deleteScheduleGroup
} from "../controllers/scheduleGroupController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/create-shift", authMiddleware, createScheduleGroup);
router.get("/show/my-schedule-group", authMiddleware, getMyScheduleGroups);
router.get("/show/all-schedule-group", authMiddleware, getAllScheduleGroups);
router.put("/update-shift/:id", authMiddleware, updateScheduleGroup);
router.delete("/delete-shift/:id", authMiddleware, deleteScheduleGroup);

export default router;