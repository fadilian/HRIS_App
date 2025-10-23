import express from "express";
import {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    updateLeaveRequestStatus,
    cancelLeaveRequest,
    deleteLeaveRequest
} from "../controllers/leaveRequestController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { upload } from "../middlewares/uploadLeaveRequest"; // Jika ada upload attachment

const router = express.Router();

// Employee endpoints
router.post("/create-leave-request", authMiddleware, upload.single('attachment'), createLeaveRequest);
router.get("/show/my-leave-requests", authMiddleware, getLeaveRequests);
router.get("/show/leave-request/:id", authMiddleware, getLeaveRequestById);
router.patch("/cancel-leave-request/:id", authMiddleware, cancelLeaveRequest);

// Admin endpoints
router.patch("/update-leave-status/:id", authMiddleware, updateLeaveRequestStatus);
router.delete("/delete-leave-request/:id", authMiddleware, deleteLeaveRequest);

export default router;