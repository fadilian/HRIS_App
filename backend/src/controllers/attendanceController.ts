import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { calculateDistance } from "../utils/distance";
import { formatDecimal } from "../utils/formatNumber";
import { parse, isBefore, isAfter } from "date-fns";


export async function getAttendances(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const role = (req as any).user.role;

        // Pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Filter query (optional)
        const {
            search        // single search bar untuk semua field
        } = req.query as any;

        // Ambil user → untuk cek companyId jika admin
        const userData = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true }
        });

        if (!userData) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        let companyId: number | null = null;
        if (role === "ADMIN") {
            if (userData.ownedCompanies.length > 0) {
                companyId = userData.ownedCompanies[0].id;
            } else if (userData.companyId) {
                companyId = userData.companyId;
            }
        }

        // Filter
        const where: any = {
            deletedAt: null,
            employee: { deletedAt: null } // hanya employee aktif
        };

        if (role === "EMPLOYEE") {
            where.employee = { userId };
        } else if (role === "ADMIN") {
            where.employee = { companyId };
        }

        // Single search bar untuk multiple fields
        if (search) {
            const searchLower = search.toLowerCase();
            
            where.OR = [
                // Search by employee name
                { employee: { fullName: { contains: search, mode: "insensitive" } } },
                // Search by employee code
                { employee: { employeeCode: { contains: search, mode: "insensitive" } } },
                // Search by company name
                { employee: { company: { companyName: { contains: search, mode: "insensitive" } } } },
            ];

            // Search by date dalam search bar
            try {
                // Deteksi dan parse berbagai format tanggal
                let dateObj: Date | null = null;

                // Format: yyyy-mm-dd (2024-01-15)
                if (/^\d{4}-\d{2}-\d{2}$/.test(search)) {
                    dateObj = new Date(search);
                }
                // Format: dd/mm/yyyy (15/01/2024)
                else if (/^\d{2}\/\d{2}\/\d{4}$/.test(search)) {
                    const [day, month, year] = search.split('/');
                    dateObj = new Date(`${year}-${month}-${day}`);
                }
                // Format: yyyy/mm/dd (2024/01/15)
                else if (/^\d{4}\/\d{2}\/\d{2}$/.test(search)) {
                    const [year, month, day] = search.split('/');
                    dateObj = new Date(`${year}-${month}-${day}`);
                }
                // Format: dd-mm-yyyy (15-01-2024)
                else if (/^\d{2}-\d{2}-\d{4}$/.test(search)) {
                    const [day, month, year] = search.split('-');
                    dateObj = new Date(`${year}-${month}-${day}`);
                }

                // Jika berhasil parse tanggal, tambahkan ke search
                if (dateObj && !isNaN(dateObj.getTime())) {
                    where.OR.push({ date: { equals: dateObj } });
                }
            } catch (error) {
                console.log('Date parsing error:', error);
            }

            // Untuk enum fields, cek dengan equals jika cocok dengan value enum
            const workTypeValues = ['wfo', 'wfa', 'hybrid'];
            const locationStatusValues = ['inside', 'outside'];
            const attendanceStatusValues = ['ontime', 'late', 'alpha'];
            const approvalStatusValues = ['pending', 'approved', 'rejected'];

            if (workTypeValues.includes(searchLower)) {
                where.OR.push({
                    workType: searchLower.toUpperCase()
                });
            }

            if (locationStatusValues.includes(searchLower)) {
                where.OR.push({
                    locationStatus: searchLower.toUpperCase()
                });
            }

            if (attendanceStatusValues.includes(searchLower)) {
                where.OR.push({
                    attendanceStatus: searchLower.toUpperCase()
                });
            }

            if (approvalStatusValues.includes(searchLower)) {
                where.OR.push({
                    approvalStatus: searchLower.toUpperCase()
                });
            }
        }

        const [total, data] = await Promise.all([
            prisma.attendance.count({ where }),
            prisma.attendance.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            fullName: true,
                            employeeCode: true,
                            company: { select: { companyName: true } }
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit
            })
        ]);

        // Convert UTC to WIB before returning response
        const formattedData = data.map((item) => ({
            ...item,
            date: req.formatWIB(req.fromUTCToWIB(item.date), "yyyy-MM-dd"),
            checkInTime: item.checkInTime 
                ? req.formatWIB(req.fromUTCToWIB(item.checkInTime), "HH:mm:ss") 
                : null,
            checkOutTime: item.checkOutTime 
                ? req.formatWIB(req.fromUTCToWIB(item.checkOutTime), "HH:mm:ss") 
                : null,
            createdAt: req.formatWIB(req.fromUTCToWIB(item.createdAt)),
            updatedAt: item.updatedAt 
                ? req.formatWIB(req.fromUTCToWIB(item.updatedAt)) 
                : null
        }));

        res.status(200).json({
            message: "Data absensi berhasil diambil",
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            data: formattedData
        });

    } catch (err: any) {
        console.error("Error getAttendances:", err);
        res.status(500).json({
            message: err.message || "Terjadi kesalahan saat mengambil data absensi"
        });
    }
}


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
        const todayDay = req.todayWIB.toUpperCase(); // "MONDAY", dst.

        // 3. Tentukan tanggal absensi
        const dateStringWIB = req.formatWIB(nowWIB, "yyyy-MM-dd");
        
        // Buat tanggal UTC dari string tanggal WIB
        const attendanceDateUTC = new Date(`${dateStringWIB}T00:00:00.000Z`);
        
        // Untuk keperluan parsing jadwal, buat juga tanggal WIB
        const attendanceDateWIB = req.fromUTCToWIB(attendanceDateUTC);

        console.log('Debug Time Info:', {
            nowWIB: req.formatWIB(nowWIB, "yyyy-MM-dd HH:mm:ss"),
            dateStringWIB,
            attendanceDateWIB: req.formatWIB(attendanceDateWIB, "yyyy-MM-dd HH:mm:ss"),
            attendanceDateUTC: req.formatWIB(attendanceDateUTC, "yyyy-MM-dd HH:mm:ss"),
            todayDay,
            attendanceDateWIB_ISO: attendanceDateWIB.toISOString(),
            attendanceDateUTC_ISO: attendanceDateUTC.toISOString()
        });

        // 4. Cari jadwal kerja hari ini
        const schedule = employee.scheduleGroup?.workSchedules.find(
            (ws) => ws.dayOfWeek === todayDay
        );

        if (!schedule) {
            return res.status(400).json({ message: "Tidak ada jadwal kerja untuk hari ini" });
        }

        // 5. Cari record attendance hari ini (termasuk soft delete)
        const existing = await prisma.attendance.findFirst({
            where: { 
                employeeId: employee.id, 
                date: attendanceDateUTC 
            },
        });

        // 6. Parse jam kerja dari jadwal - GUNAKAN TIMEZONE WIB
        const startTimeWIB = parse(schedule.startTime, "HH:mm", attendanceDateWIB);
        const breakStartWIB = schedule.breakStart
            ? parse(schedule.breakStart, "HH:mm", attendanceDateWIB)
            : parse(schedule.endTime, "HH:mm", attendanceDateWIB);

        let actionType: "CHECK_IN" | "CHECK_OUT" = "CHECK_IN";
        let attendanceStatus: "ONTIME" | "LATE" | "ALPHA" | null = null;

        // 7. Tentukan jenis absensi (check-in / check-out)
        if (!existing || existing.deletedAt) {
            if (isBefore(nowWIB, breakStartWIB)) {
                actionType = "CHECK_IN";
            } else {
                actionType = "CHECK_OUT";
            }
        } else if (!existing.checkOutTime && isAfter(nowWIB, breakStartWIB)) {
            actionType = "CHECK_OUT";
        } else if (existing.checkOutTime) {
            return res.status(400).json({ message: "Sudah melakukan absensi penuh hari ini" });
        } else {
            return res.status(400).json({ message: "Belum waktunya check-out" });
        }

        // 8. Hitung status lokasi (khusus WFO)
        let locationStatus: "INSIDE" | "OUTSIDE" | null = null;
        if (workType === "WFO") {
            if (!formattedLatitude || !formattedLongitude) {
                return res.status(400).json({ message: "Latitude dan longitude wajib diisi untuk WFO" });
            }
            
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

        // 9. Tentukan status kehadiran
        if (actionType === "CHECK_IN") {
            attendanceStatus = isBefore(nowWIB, startTimeWIB) ? "ONTIME" : "LATE";
        }

        // 10. Konversi waktu check-in/check-out ke UTC untuk disimpan
        const checkInTimeUTC = actionType === "CHECK_IN" ? req.toUTCFromWIB(nowWIB) : null;
        const checkOutTimeUTC = actionType === "CHECK_OUT" ? req.toUTCFromWIB(nowWIB) : null;

        // 11. Simpan atau update data attendance
        let attendance;

        if (existing && existing.deletedAt !== null) {
            // Reaktivasi record yang sudah di-soft delete
            attendance = await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    deletedAt: null,
                    checkInTime: checkInTimeUTC,
                    checkOutTime: checkOutTimeUTC,
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
        } else if (!existing) {
            // Buat record baru
            attendance = await prisma.attendance.create({
                data: {
                    employeeId: employee.id,
                    workScheduleId: schedule.id,
                    date: attendanceDateUTC, // Gunakan tanggal yang sudah dikonversi
                    checkInTime: checkInTimeUTC,
                    checkOutTime: checkOutTimeUTC,
                    workType,
                    latitude: formattedLatitude,
                    longitude: formattedLongitude,
                    proof: proofFile,
                    locationStatus,
                    attendanceStatus,
                    approvalStatus: "PENDING",
                },
            });
        } else {
            // Jika sudah ada record aktif → update untuk check-out
            attendance = await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    checkOutTime: checkOutTimeUTC,
                    latitude: formattedLatitude,
                    longitude: formattedLongitude,
                    locationStatus,
                    approvalStatus: "PENDING",
                    updatedAt: new Date(),
                },
            });
        }

        // 12. Format response dalam WIB
        const responseData = {
            ...attendance,
            date: req.formatWIB(attendance.date, "yyyy-MM-dd"), // Langsung format dari UTC ke WIB
            checkInTime: attendance.checkInTime 
                ? req.formatWIB(attendance.checkInTime, "HH:mm:ss")
                : null,
            checkOutTime: attendance.checkOutTime 
                ? req.formatWIB(attendance.checkOutTime, "HH:mm:ss")
                : null,
            createdAt: req.formatWIB(attendance.createdAt),
            updatedAt: attendance.updatedAt 
                ? req.formatWIB(attendance.updatedAt)
                : null
        };

        const message = existing && existing.deletedAt !== null 
            ? `Absensi berhasil direaktivasi sebagai ${actionType === "CHECK_IN" ? "check-in" : "check-out"}`
            : !existing
            ? `Absensi ${actionType === "CHECK_IN" ? "check-in" : "check-out"} berhasil dibuat`
            : "Absensi check-out berhasil diperbarui";

        res.status(201).json({
            message,
            data: responseData,
        });
    } catch (err: any) {
        console.error("Error createAttendance:", err);
        res.status(500).json({
            message: err.message || "Terjadi kesalahan saat membuat absensi",
        });
    }
}