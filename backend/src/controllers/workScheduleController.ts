import { Request, Response } from "express";
import prisma from "../utils/prisma";

// menambahkan jadwal jam kerja perhari (baik shift maupun reguler) - admin & superadmin
export async function createWorkSchedule(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const {
            scheduleGroupId,
            dayOfWeek,
            startTime,
            breakStart,
            breakEnd,
            endTime,
        } = req.body;

        // Validasi input
        if (!scheduleGroupId || !dayOfWeek || !startTime || !endTime) {
            return res.status(400).json({
                message:
                "scheduleGroupId, dayOfWeek, startTime, dan endTime wajib diisi",
            });
        }

        // Ambil user login dan company
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // Ambil companyId admin login
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

        // Pastikan scheduleGroupId valid dan milik company login
        const group = await prisma.scheduleGroup.findFirst({
            where: { id: scheduleGroupId, companyId, deletedAt: null },
        });

        if (!group) {
            return res.status(404).json({
                message:
                "Schedule group tidak ditemukan atau bukan milik company Anda",
            });
        }

        // Cek duplikat jadwal (company yang sama, hari yang sama dan schedule group yang sama)
        const existing = await prisma.workSchedule.findFirst({
            where: {
                companyId,
                scheduleGroupId,
                dayOfWeek,
                deletedAt: null,
            },
        });

        if (existing) {
            return res.status(409).json({
                message: `Jadwal untuk hari ${dayOfWeek} sudah ada di shift ini`,
            });
        }

        // Buat work schedule baru
        const workSchedule = await prisma.workSchedule.create({
            data: {
                companyId,
                scheduleGroupId,
                dayOfWeek,
                startTime,
                breakStart,
                breakEnd,
                endTime,
            },
        });

        res.status(201).json({
            message: "Work schedule berhasil dibuat",
            data: workSchedule,
        });
    } catch (err: any) {
        console.error("Error createWorkSchedule:", err);
        res.status(500).json({
            message:
                err.message || "Terjadi kesalahan saat membuat work schedule",
        });
    }
}

// ambil data work schedule hanya milik admin yang login
export async function getMyWorkSchedules(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;

        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // Ambil companyId dari user login
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

        // Ambil work schedule berdasarkan companyId
        const schedules = await prisma.workSchedule.findMany({
            where: { companyId, deletedAt: null },
            include: {
                scheduleGroup: {
                select: { id: true, nameOfShift: true },
                },
            },
            orderBy: [
                { scheduleGroupId: "asc" },
                { dayOfWeek: "asc" },
            ],
        });

        res.status(200).json({
            message: "Data work schedule berhasil diambil",
            count: schedules.length,
            data: schedules,
        });
    } catch (err) {
        console.error("Error getMyWorkSchedules:", err);
        res.status(500).json({ message: "Terjadi kesalahan saat mengambil data" });
    }
}

// ambil semua data (superadmin)
export async function getAllWorkSchedules(req: Request, res: Response) {
    try {
        const userRole = (req as any).user.role;

        if (userRole !== "SUPERADMIN") {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const schedules = await prisma.workSchedule.findMany({
            where: { deletedAt: null },
            include: {
                company: { select: { id: true, companyName: true } },
                scheduleGroup: { select: { id: true, nameOfShift: true } },
            },
            orderBy: [
                { companyId: "asc" },
                { scheduleGroupId: "asc" },
                { dayOfWeek: "asc" },
            ],
        });

        res.status(200).json({
            message: "Berhasil mengambil semua data work schedule",
            count: schedules.length,
            data: schedules,
        });
    } catch (err) {
        console.error("Error getAllWorkSchedules:", err);
        res.status(500).json({ message: "Terjadi kesalahan saat mengambil semua data" });
    }
}
