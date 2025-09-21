import { Router } from "express";
import multer from "multer";
import { register, loginAdmin, profile, updateProfile, deleteAccount, requestPasswordReset, resetPassword, logout } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";

const upload = multer();
const router = Router();

router.post("/register", upload.none(), register);
router.post("/login/admin", loginAdmin);
router.get("/profile", authMiddleware, profile);
router.patch("/profile/update", authMiddleware, updateProfile);
router.delete("/profile/delete", authMiddleware, deleteAccount);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/logout", authMiddleware, logout);

export default router;
