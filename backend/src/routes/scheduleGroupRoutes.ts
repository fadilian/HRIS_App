import express from "express";
import { 
    createScheduleGroup, 
    getMyScheduleGroups, 
    getAllScheduleGroups } from "../controllers/scheduleGroupController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/create-shift", authMiddleware, createScheduleGroup);
router.get("/show/my-schedule-group", authMiddleware, getMyScheduleGroups);
router.get("/show/all-schedule-group", authMiddleware, getAllScheduleGroups);

export default router;
