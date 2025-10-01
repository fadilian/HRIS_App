import { Request, Response } from "express";
import prisma from "../utils/prisma";
import bcrypt from "bcrypt";

// Helper untuk generate employee code
async function generateEmployeeCode(companyId: number, date: Date) {
    // Format tanggal -> ddMMyy
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const datePart = `${day}${month}${year}`;

    // Hitung jumlah employee untuk companyId tsb pada tanggal tersebut
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const countToday = await prisma.employee.count({
        where: {
            companyId,
            createdAt: {
                gte: startOfDay,
                lte: endOfDay,
            },
            deletedAt: null,
        },
    });

    const sequence = String(countToday + 1).padStart(4, "0");

    // format baru: EMP-C{companyId}-{date}{sequence}
    return `EMP-C${companyId}-${datePart}${sequence}`;
}


export async function createEmployee(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id; // ambil dari JWT
        const {
            name,
            email,
            password,
            fullName,
            nik,
            gender,
            mobileNumber,
            address,
            position,
            department,
            hireDate,
        } = req.body;

        // cek role & ambil company
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // cari companyId user
        let companyId: number | null = null;
        if (user.ownedCompanies.length > 0) {
            // kalau user adalah owner
            companyId = user.ownedCompanies[0].id;
        } else if (user.companyId) {
            // kalau user adalah member
            companyId = user.companyId;
        }

        if (!companyId) {
            return res.status(400).json({ message: "User is not linked with any company" });
        }

        // hash password employee
        const hashedPassword = await bcrypt.hash(password, 10);

        // transaksi insert ke 2 tabel
        const result = await prisma.$transaction(async (tx) => {
            // buat user employee
            const newUsers = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: "EMPLOYEE",
                    companyId,
                },
            });

            // generate employee code
            const employeeCode = await generateEmployeeCode(companyId, new Date());

            // buat data employee
            const employee = await tx.employee.create({
                data: {
                    userId: newUsers.id,
                    companyId,
                    employeeCode,
                    fullName,
                    nik,
                    gender,
                    mobileNumber,
                    address,
                    position,
                    department,
                    hireDate: new Date(hireDate),
                },
            });

            return { newUsers, employee };
        });

        res.json({ message: "Employee created successfully", data: result });
    } catch (err) {
        console.error("Error createEmployee:", err);
        res.status(500).json({ message: "Error creating employee" });
    }
}

// menampilkan data employees dengan memfilter role yang login (admin atau superadmin)
export async function getEmployees(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id; // ambil dari JWT

        // cek role user
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let employees;

        if (user.role === "SUPERADMIN") {
            // superadmin bisa lihat semua employees
            employees = await prisma.employee.findMany({
                where: { deletedAt: null },
                include: {
                    company: true,
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
                orderBy: { createdAt: "desc" },
            });
        } else if (user.role === "ADMIN") {
            // cari companyId admin
            let companyId: number | null = null;
            if (user.ownedCompanies.length > 0) {
                companyId = user.ownedCompanies[0].id;
            } else if (user.companyId) {
                companyId = user.companyId;
            }

            if (!companyId) {
                return res.status(400).json({ message: "Admin tidak terkait dengan perusahaan manapun" });
            }

            employees = await prisma.employee.findMany({
                where: { companyId, deletedAt: null },
                include: {
                    company: true,
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
                orderBy: { createdAt: "desc" },
            });
        } else {
            return res.status(403).json({ message: "Unauthorized" });
        }

        res.json({ message: "Success", data: employees });
    } catch (err) {
        console.error("Error getEmployees:", err);
        res.status(500).json({ message: "Error fetching employees" });
    }
}

export async function getEmployeeById(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id; // ambil dari JWT
        const employeeId = Number(req.params.id);

        // cek role user
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let employee;

        if (user.role === "SUPERADMIN") {
            // superadmin bisa lihat semua
            employee = await prisma.employee.findFirst({
                where: { id: employeeId, deletedAt: null },
                include: {
                    company: true,
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
            });
        } else if (user.role === "ADMIN") {
            // cari companyId admin
            let companyId: number | null = null;
            if (user.ownedCompanies.length > 0) {
                companyId = user.ownedCompanies[0].id;
            } else if (user.companyId) {
                companyId = user.companyId;
            }

            if (!companyId) {
                return res.status(400).json({ message: "Admin tidak terkait dengan perusahaan manapun" });
            }

            employee = await prisma.employee.findFirst({
                where: { id: employeeId, companyId, deletedAt: null },
                include: {
                    company: true,
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
            });
        } else {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        res.json({ message: "Success", data: employee });
    } catch (err) {
        console.error("Error getEmployeeById:", err);
        res.status(500).json({ message: "Error fetching employee" });
    }
}