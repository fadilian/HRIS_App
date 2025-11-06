import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { formatDecimal } from "../utils/formatNumber";


export async function createCompany(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id; // ambil dari JWT
        const { companyName, latitude, longitude, radius } = req.body;

        // cek role
        const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
        return res.status(403).json({ message: "Unauthorized" });
        }

        // cek apakah sudah punya company
        const existing = await prisma.company.findFirst({
        where: { ownerUserId: userId, deletedAt: null },
        });
        if (existing) {
        return res.status(400).json({ message: "User already owns a company" });
        }

        // ambil nama file logo dari multer
        const logoFile = req.file ? req.file.filename : null;

        // buat company baru
        const company = await prisma.company.create({
        data: {
            companyName,
            ownerUserId: userId,
            latitude: formatDecimal(latitude),
            longitude: formatDecimal(longitude),
            radius: radius ? Number(radius) : 200, // default 200 kalau kosong
            logo: logoFile,
        },
        });

        // update user → companyId
        await prisma.user.update({
        where: { id: userId },
        data: { companyId: company.id },
        });

        res.json({ message: "Company created successfully", company });
    } catch (err) {
        console.error("Error createCompany:", err);
        res.status(500).json({ message: "Error creating company" });
    }
}

export async function getMyCompany(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;

        const company = await prisma.company.findFirst({
        where: { ownerUserId: userId, deletedAt: null },
        include: { members: true },
        });

        if (!company) {
        return res.status(404).json({ message: "No company found" });
        }

        res.json({ company });
    } catch (err) {
        console.error("Error getMyCompany:", err);
        res.status(500).json({ message: "Error fetching company" });
    }
}

// UPDATE company
export async function updateCompany(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id; // dari JWT
        const { companyName, latitude, longitude, radius } = req.body;
        const logoFile = req.file; // file logo dari multer

        // cari company yang dimiliki user
        const company = await prisma.company.findFirst({
        where: { ownerUserId: userId, deletedAt: null },
        });

        if (!company) {
        return res.status(404).json({ message: "Company not found" });
        }

        // siapkan data update
        const updateData: any = {
        companyName,
        latitude,
        longitude,
        radius: radius ? Number(radius) : undefined,
        };

        // kalau ada file logo baru, update kolom logo
        if (logoFile) {
        updateData.logo = logoFile.filename;
        }

        const updated = await prisma.company.update({
        where: { id: company.id },
        data: updateData,
        });

        res.json({ message: "Company updated successfully", company: updated });
    } catch (err) {
        console.error("Error updateCompany:", err);
        res.status(500).json({ message: "Error updating company" });
    }
}

// admin hapus company miliknya sendiri  (jika tidak ada employee terikat)
export async function deleteCompanyOwner(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;

        // cari company milik user login
        const company = await prisma.company.findFirst({
        where: { ownerUserId: userId, deletedAt: null },
        });

        if (!company) {
        return res.status(404).json({ message: "Company not found" });
        }

        // jika nanti sudah ada tabel employees bisa aktifkan logika ini:
        const employees = await prisma.employee.findMany({
          where: { companyId: company.id, deletedAt: null },
        });
        if (employees.length > 0) {
          return res.status(400).json({ message: "Cannot delete company with active employees" });
        }

        // soft delete company
        await prisma.company.update({
        where: { id: company.id },
        data: { deletedAt: new Date() },
        });

        // putuskan relasi company di user pemilik
        await prisma.user.update({
        where: { id: userId },
        data: { companyId: null },
        });

        return res.json({ message: "Your company deleted successfully" });
    } catch (err) {
        console.error("Error deleteOwnCompany:", err);
        return res.status(500).json({ message: "Error deleting own company" });
    }
}

// superadmin bisa hapus company admin (jika tidak ada employee terikat)
export async function deleteCompanySuperadmin(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const companyId = Number(req.params.id);

        if (user.role !== "SUPERADMIN") {
        return res.status(403).json({ message: "Forbidden: Only SUPERADMIN can delete any company" });
        }

        const company = await prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        });

        if (!company) {
        return res.status(404).json({ message: "Company not found" });
        }

        // jika nanti sudah ada tabel employees bisa aktifkan logika ini:
        const employees = await prisma.employee.findMany({
          where: { companyId, deletedAt: null },
        });
        if (employees.length > 0) {
          return res.status(400).json({ message: "Cannot delete company with active employees" });
        }

        // soft delete
        await prisma.company.update({
        where: { id: company.id },
        data: { deletedAt: new Date() },
        });

        // putuskan relasi company di owner
        await prisma.user.update({
        where: { id: company.ownerUserId },
        data: { companyId: null },
        });

        return res.json({ message: `Company ID ${companyId} deleted by SUPERADMIN` });
    } catch (err) {
        console.error("Error deleteCompanyBySuperadmin:", err);
        return res.status(500).json({ message: "Error deleting company by SUPERADMIN" });
    }
}

// tampilkan semua data company (untuk superadmin)
export async function getAllCompanies(req: Request, res: Response) {
    try {
        const userRole = (req as any).user.role;
        if (userRole !== 'SUPERADMIN') {
            return res.status(403).json({ message: "Access denied. Superadmin role required." });
        }

        const { 
            page = '1', 
            limit = '10', 
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // BUILD WHERE CLAUSE
        let whereClause: any = { deletedAt: null };
        
        if (search) {
            whereClause.OR = [
                // Company fields
                { companyName: { contains: search, mode: 'insensitive' } },
                
                // Owner user fields (relational)
                { owner: { name: { contains: search, mode: 'insensitive' } } },
                { owner: { email: { contains: search, mode: 'insensitive' } } },
                
                // Optional: jika ada field lain di Company
                // { phone: { contains: search, mode: 'insensitive' } },
                // { address: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Validasi sort field
        const validSortFields = ['companyName', 'createdAt', 'updatedAt'];
        const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'createdAt';

        const [companies, totalCount] = await Promise.all([
            prisma.company.findMany({
                where: whereClause,
                include: { 
                    // members: true,
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    // Include employee count jika perlu
                    _count: {
                        select: {
                            Employee: true,
                            // members: true
                        }
                    }
                },
                orderBy: { [sortField as string]: sortOrder },
                skip: skip,
                take: limitNum
            }),
            prisma.company.count({
                where: whereClause
            })
        ]);

        res.json({ 
            companies: companies.map(company => ({
                ...company,
                employeeCount: company._count?.Employee || 0,
                // memberCount: company._count?.members || 0
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitNum),
                hasNext: pageNum < Math.ceil(totalCount / limitNum),
                hasPrev: pageNum > 1
            }
        });
    } catch (err) {
        console.error("Error getAllCompanies:", err);
        res.status(500).json({ message: "Error fetching companies" });
    }
}