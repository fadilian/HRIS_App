import { Router } from "express";
import { createCompany, getMyCompany, updateCompany, deleteCompanyOwner, deleteCompanySuperadmin, getAllCompanies } from "../controllers/companyController";
import { authMiddleware } from "../middlewares/authMiddleware";
import uploadLogo from "../middlewares/uploadLogoMiddleware";

const router = Router();

// hanya admin login yang bisa create + lihat company-nya sendiri
router.post("/create", authMiddleware, uploadLogo.single("logo"), createCompany);
router.get("/show/mycompany", authMiddleware, getMyCompany);
router.get("/all-companies", authMiddleware, getAllCompanies);
router.patch("/update", authMiddleware, uploadLogo.single("logo"), updateCompany);
router.delete("/delete", authMiddleware, deleteCompanyOwner );
router.delete("/delete/:id", authMiddleware, deleteCompanySuperadmin );

export default router;
