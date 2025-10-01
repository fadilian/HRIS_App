import { Router } from "express";
import { createEmployee, getEmployees, getEmployeeById } from "../controllers/employeeController";
import { authMiddleware } from "../middlewares/authMiddleware";
import uploadLogo from "../middlewares/uploadLogoMiddleware";

const router = Router();


router.post("/create", authMiddleware, createEmployee);
router.get("/show/my-employees", authMiddleware, getEmployees);
router.get("/show/my-employees/:id", authMiddleware, getEmployeeById);

export default router;
