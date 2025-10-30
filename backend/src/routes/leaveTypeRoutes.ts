import express from "express";
import {
    createLeaveType,
    getLeaveTypes,
    updateLeaveType,
    deleteLeaveType
} from "../controllers/leaveTypeController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/create-leave-type", authMiddleware, createLeaveType);
router.get("/show/leave-types", authMiddleware, getLeaveTypes);
router.patch("/update-leave-type/:id", authMiddleware, updateLeaveType);
router.delete("/delete-leave-type/:id", authMiddleware, deleteLeaveType);

export default router;