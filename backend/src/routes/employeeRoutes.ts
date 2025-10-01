import { Router } from "express";
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  getEmployeeProfile,
  deleteEmployee,
  restoreEmployee,
  getDeletedEmployees,
} from "../controllers/employeeController";
import { authMiddleware } from "../middlewares/authMiddleware";
import uploadEmployeePhoto from "../middlewares/uploadEmployeePhotoMiddleware";

const router = Router();

// Create Employee (Admin/Superadmin only)
router.post(
  "/create",
  authMiddleware,
  uploadEmployeePhoto.single("photo"),
  createEmployee
);

// Get Employee Profile (Current logged in employee)
router.get("/profile", authMiddleware, getEmployeeProfile);

// Get All Active Employees (Admin/Superadmin only)
router.get("/", authMiddleware, getEmployees);

// Get All Employees (alternative route for consistency)
router.get("/show/my-employees", authMiddleware, getEmployees);

// Get Employee By ID
router.get("/show/my-employees/:id", authMiddleware, getEmployeeById);

// Get All Deleted Employees (Admin/Superadmin only)
router.get("/deleted", authMiddleware, getDeletedEmployees);

// Update Employee
router.patch(
  "/update/:id",
  authMiddleware,
  uploadEmployeePhoto.single("photo"),
  updateEmployee
);

// Soft Delete Employee (Admin/Superadmin only)
router.delete("/delete/:id", authMiddleware, deleteEmployee);

// Restore Employee (Superadmin only)
router.patch("/restore/:id", authMiddleware, restoreEmployee);

export default router;