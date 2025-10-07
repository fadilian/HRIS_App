import { Request, Response } from "express";
import prisma from "../utils/prisma";

// Create Schedule Group (Shift) - hanya untuk admin dan superadmin
export async function createScheduleGroup(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id; // dari JWT
        const { nameOfShift } = req.body;

        if (!nameOfShift) {
            return res.status(400).json({ message: "Nama shift wajib diisi" });
        }

        // cek user login
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // ambil companyId dari admin login
        let companyId: number | null = null;
        if (user.ownedCompanies.length > 0) {
            companyId = user.ownedCompanies[0].id;
        } else if (user.companyId) {
            companyId = user.companyId;
        }

        if (!companyId) {
            return res.status(400).json({
                message: "User tidak terhubung dengan company manapun",
            });
        }

        // cek apakah shift sudah ada di company yang sama
        const existingShift = await prisma.scheduleGroup.findFirst({
            where: { companyId, nameOfShift, deletedAt: null },
        });

        if (existingShift) {
            return res.status(409).json({
                message: `Shift "${nameOfShift}" sudah ada di perusahaan ini`,
            });
        }

        // buat shift baru
        const scheduleGroup = await prisma.scheduleGroup.create({
            data: {
                companyId,
                nameOfShift,
            },
        });

        res.status(201).json({
            message: "Shift berhasil dibuat",
            data: scheduleGroup,
        });
    } catch (err) {
        console.error("Error createScheduleGroup:", err);
        res.status(500).json({ message: "Terjadi kesalahan saat membuat shift" });
    }
}

// melihat schedule group (shift) milik sendiri - admin & superadmin
export async function getMyScheduleGroups(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;

        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // ambil companyId dari user login
        let companyId: number | null = null;
        if (user.ownedCompanies.length > 0) {
            companyId = user.ownedCompanies[0].id;
        } else if (user.companyId) {
            companyId = user.companyId;
        }

        if (!companyId) {
        return res.status(400).json({
            message: "User tidak terhubung dengan company manapun",
        });
        }

        const scheduleGroups = await prisma.scheduleGroup.findMany({
            where: { companyId, deletedAt: null },
            include: {
                company: { select: { id: true, companyName: true } },
                workSchedules: true,
            },
            orderBy: { id: "asc" },
        });

        res.status(200).json({
            message: "Data shift berhasil diambil",
            count: scheduleGroups.length,
            data: scheduleGroups,
        });
    } catch (err) {
        console.error("Error getMyScheduleGroups:", err);
        res.status(500).json({ message: "Terjadi kesalahan saat mengambil data shift" });
    }
}

// ambil semua data schedule group khusus superadmin
export async function getAllScheduleGroups(req: Request, res: Response) {
    try {
        const userRole = (req as any).user.role;

        if (userRole !== "SUPERADMIN") {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const scheduleGroups = await prisma.scheduleGroup.findMany({
        where: { deletedAt: null },
            include: {
                company: { select: { id: true, companyName: true } },
                workSchedules: true,
            },
            orderBy: [
                { companyId: "asc" },
                { id: "asc" },
            ],
        });

        res.status(200).json({
            message: "Berhasil mengambil semua data shift (semua perusahaan)",
            count: scheduleGroups.length,
            data: scheduleGroups,
        });
    } catch (err) {
        console.error("Error getAllScheduleGroups:", err);
        res.status(500).json({ message: "Terjadi kesalahan saat mengambil semua data shift" });
    }
}
