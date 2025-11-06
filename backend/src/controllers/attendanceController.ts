import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { calculateDistance } from "../utils/distance";
import { formatDecimal } from "../utils/formatNumber";
import { parse, isBefore, isAfter } from "date-fns";


export async function createAttendance(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const { workType, latitude, longitude } = req.body;
        const proofFile = req.file ? req.file.filename : null;

        // Format latitude dan longitude
        const formattedLatitude = formatDecimal(latitude);
        const formattedLongitude = formatDecimal(longitude);

        // 1. Validasi role dan ambil data employee
        const employee = await prisma.employee.findFirst({
            where: { userId, deletedAt: null },
            include: {
                company: true,
                scheduleGroup: { include: { workSchedules: true } },
            },
        });

        if (!employee) {
            return res.status(404).json({ message: "Employee tidak ditemukan" });
        }

        // 2. Ambil waktu dari middleware
        const nowWIB = req.nowWIB;
        const todayDay = req.todayWIB.toUpperCase(); // "MONDAY", "TUESDAY", dst.
        const todayDateStr = req.formatWIB(nowWIB, "yyyy-MM-dd");
        const todayDate = new Date(todayDateStr + "T00:00:00+07:00");

        // 3. Cari jadwal kerja hari ini
        const schedule = employee.scheduleGroup?.workSchedules.find(
            (ws) => ws.dayOfWeek === todayDay
        );

        if (!schedule) {
            return res.status(400).json({ message: "Tidak ada jadwal kerja untuk hari ini" });
        }

        // 4. Cari record attendance hari ini (termasuk soft delete)
        const existing = await prisma.attendance.findFirst({
            where: { employeeId: employee.id, date: todayDate },
        });

        // 5. Parse jam kerja dari jadwal
        const startTime = parse(schedule.startTime, "HH:mm", todayDate);
        const breakStart = schedule.breakStart
        ? parse(schedule.breakStart, "HH:mm", todayDate)
        : parse(schedule.endTime, "HH:mm", todayDate);

        let actionType: "CHECK_IN" | "CHECK_OUT" = "CHECK_IN";
        let attendanceStatus: "ONTIME" | "LATE" | "ALPHA" | null = null;

        // 6. Tentukan jenis absensi (check-in / check-out)
        if (!existing || existing.deletedAt) {
            if (isBefore(nowWIB, breakStart)) {
                actionType = "CHECK_IN";
            } else {
                actionType = "CHECK_OUT";
            }
        } else if (!existing.checkOutTime && isAfter(nowWIB, breakStart)) {
            actionType = "CHECK_OUT";
        } else if (existing.checkOutTime) {
            return res.status(400).json({ message: "Sudah melakukan absensi penuh hari ini" });
        } else {
            return res.status(400).json({ message: "Belum waktunya check-out" });
        }

        // 7. Hitung status lokasi (khusus WFO)
        let locationStatus: "INSIDE" | "OUTSIDE" | null = null;
        if (workType === "WFO") {
            if (!formattedLatitude || !formattedLongitude) {
                return res.status(400).json({ message: "Latitude dan longitude wajib diisi untuk WFO" });
            }
            
            // Format juga latitude dan longitude company untuk konsistensi
            const companyLatitude = formatDecimal(employee.company.latitude);
            const companyLongitude = formatDecimal(employee.company.longitude);
            
            if (!companyLatitude || !companyLongitude) {
                return res.status(400).json({ message: "Koordinat perusahaan tidak valid" });
            }

            const distance = calculateDistance(
                formattedLatitude,
                formattedLongitude,
                companyLatitude,
                companyLongitude
            );
            locationStatus = distance <= employee.company.radius ? "INSIDE" : "OUTSIDE";
        }

        // 8. Tentukan status kehadiran
        if (actionType === "CHECK_IN") {
            attendanceStatus = isBefore(nowWIB, startTime) ? "ONTIME" : "LATE";
        }

        // 9. Simpan atau update data attendance
        let attendance;

        if (existing && existing.deletedAt !== null) {
            // Reaktivasi record yang sudah di-soft delete
            attendance = await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                deletedAt: null,
                checkInTime: actionType === "CHECK_IN" ? req.toUTCFromWIB(nowWIB) : null,
                checkOutTime: actionType === "CHECK_OUT" ? req.toUTCFromWIB(nowWIB) : null,
                workType,
                latitude: formattedLatitude,
                longitude: formattedLongitude,
                proof: proofFile,
                locationStatus,
                attendanceStatus,
                approvalStatus: "PENDING",
                updatedAt: new Date(),
                },
            });

            return res.status(201).json({
                message: `Absensi berhasil direaktivasi sebagai ${actionType === "CHECK_IN" ? "check-in" : "check-out"}`,
                data: attendance,
            });
        }

        if (!existing) {
            // Buat record baru
            attendance = await prisma.attendance.create({
                data: {
                employeeId: employee.id,
                workScheduleId: schedule.id,
                date: todayDate,
                checkInTime: actionType === "CHECK_IN" ? req.toUTCFromWIB(nowWIB) : null,
                checkOutTime: actionType === "CHECK_OUT" ? req.toUTCFromWIB(nowWIB) : null,
                workType,
                latitude: formattedLatitude,
                longitude: formattedLongitude,
                proof: proofFile,
                locationStatus,
                attendanceStatus,
                approvalStatus: "PENDING",
                },
            });

            return res.status(201).json({
                message: `Absensi ${actionType === "CHECK_IN" ? "check-in" : "check-out"} berhasil dibuat`,
                data: attendance,
            });
        }

        // Jika sudah ada record aktif → update untuk check-out
        attendance = await prisma.attendance.update({
            where: { id: existing.id },
            data: {
                checkOutTime: req.toUTCFromWIB(nowWIB),
                latitude: formattedLatitude, // Tetap update koordinat untuk check-out
                longitude: formattedLongitude,
                locationStatus,
                approvalStatus: "PENDING",
                updatedAt: new Date(),
            },
        });

        res.status(200).json({
            message: "Absensi check-out berhasil diperbarui",
            data: attendance,
        });
    } catch (err: any) {
        console.error("Error createAttendance:", err);
        res.status(500).json({
            message: err.message || "Terjadi kesalahan saat membuat absensi",
        });
    }
}