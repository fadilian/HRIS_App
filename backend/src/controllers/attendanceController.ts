import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { calculateDistance, formatDistance } from "../utils/distance";
import { formatDecimal } from "../utils/formatNumber";
import { parse, isBefore, isAfter } from "date-fns";

// Fungsi mengambil data absensi (sudah dibatasi berdasarkan role) include fitur search
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

        // Ambil user untuk cek companyId jika admin
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
                            company: { select: { companyName: true } },
                            scheduleGroup: { select: { nameOfShift: true } }
                        }
                    },
                    workSchedule: {
                        select: {
                            dayOfWeek: true
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

// Fungsi menambahkan data absensi
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

// Fungsi update data attendance hanya untuk admin/superadmin
export async function updateAttendance(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;
        const attendanceId = Number(req.params.id);

        // 1. Validasi role
        if (userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // 2. Ambil data user login
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { company: true, ownedCompanies: true },
        });

        if (!user) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        // Tentukan companyId user login
        let companyId: number | null = null;
        if (user.ownedCompanies.length > 0) {
            companyId = user.ownedCompanies[0].id;
        } else if (user.companyId) {
            companyId = user.companyId;
        }

        // 3. Ambil data attendance yang akan diupdate
        const existing = await prisma.attendance.findFirst({
            where: { id: attendanceId, deletedAt: null },
            include: {
                employee: { include: { company: true } },
            },
        });

        if (!existing) {
            return res.status(404).json({ message: "Data absensi tidak ditemukan" });
        }

        // 4. Validasi akses berdasarkan role
        if (userRole === "ADMIN" && existing.employee.companyId !== companyId) {
            return res.status(403).json({
                message: "Anda tidak memiliki akses untuk mengedit absensi dari company lain",
            });
        }

        // 5. Ambil data dari body
        const {
            checkInTime,
            checkOutTime,
            attendanceStatus,
            approvalStatus,
            workType,
            locationStatus,
            latitude,
            longitude,
        } = req.body;

        const proofFile = req.file ? req.file.filename : undefined;

        // Format latitude & longitude (maks 8 digit desimal)
        const formattedLatitude = formatDecimal(latitude);
        const formattedLongitude = formatDecimal(longitude);

        // 6. Konversi waktu check-in/out (WIB → UTC)
        let checkInTimeUTC = existing.checkInTime;
        let checkOutTimeUTC = existing.checkOutTime;

        const dateStringWIB = req.formatWIB(req.fromUTCToWIB(existing.date), "yyyy-MM-dd");

        if (checkInTime) {
            const wibToUtc = req.toUTCFromWIB(new Date(`${dateStringWIB}T${checkInTime}:00`));
            checkInTimeUTC = wibToUtc;
        }

        if (checkOutTime) {
            const wibToUtc = req.toUTCFromWIB(new Date(`${dateStringWIB}T${checkOutTime}:00`));
            checkOutTimeUTC = wibToUtc;
        }

        // 7. Update data attendance
        const updatedAttendance = await prisma.attendance.update({
            where: { id: attendanceId },
            data: {
                checkInTime: checkInTimeUTC,
                checkOutTime: checkOutTimeUTC,
                attendanceStatus: attendanceStatus?.toUpperCase(),
                approvalStatus: approvalStatus?.toUpperCase(),
                workType: workType?.toUpperCase(),
                locationStatus: locationStatus?.toUpperCase(),
                latitude: formattedLatitude ?? existing.latitude,
                longitude: formattedLongitude ?? existing.longitude,
                proof: proofFile || existing.proof,
                updatedAt: new Date(),
            },
        });

        // 8. Format output agar tetap WIB saat ditampilkan
        const responseData = {
            ...updatedAttendance,
            date: req.formatWIB(updatedAttendance.date, "yyyy-MM-dd"),
            checkInTime: updatedAttendance.checkInTime
                ? req.formatWIB(updatedAttendance.checkInTime, "HH:mm:ss")
                : null,
            checkOutTime: updatedAttendance.checkOutTime
                ? req.formatWIB(updatedAttendance.checkOutTime, "HH:mm:ss")
                : null,
            createdAt: req.formatWIB(updatedAttendance.createdAt),
            updatedAt: req.formatWIB(updatedAttendance.updatedAt),
        };

        res.status(200).json({
            message: "Data absensi berhasil diperbarui",
            data: responseData,
        });
    } catch (err: any) {
        console.error("Error updateAttendance:", err);
        res.status(500).json({
            message: err.message || "Terjadi kesalahan saat memperbarui absensi",
        });
    }
}

// Fungsi menampilkan detail attendance berdasarkan id
export async function getAttendanceById(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const role = (req as any).user.role;
        const attendanceId = Number(req.params.id);

        if (!attendanceId) {
            return res.status(400).json({ message: "Attendance ID tidak valid" });
        }

        // Ambil user
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: {
                company: true,
                ownedCompanies: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        let companyId: number | null = null;
        if (role === "ADMIN") {
            if (user.ownedCompanies.length > 0) {
                companyId = user.ownedCompanies[0].id;
            } else if (user.companyId) {
                companyId = user.companyId;
            }
        }

        // Ambil data attendance
        const attendance = await prisma.attendance.findFirst({
            where: {
                id: attendanceId,
                deletedAt: null
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        userId: true,
                        fullName: true,
                        employeeCode: true,
                        companyId: true,
                        company: {
                            select: {
                                companyName: true,
                                latitude: true,
                                longitude: true,
                                radius: true
                            }
                        },
                        scheduleGroup: { select: { nameOfShift: true } }
                    }
                },
                workSchedule: {
                    select: {
                        dayOfWeek: true,
                        startTime: true,
                        breakStart: true,
                        endTime: true
                    }
                }
            }
        });

        if (!attendance) {
            return res.status(404).json({ message: "Data absensi tidak ditemukan" });
        }

        // Validasi akses
        if (role === "EMPLOYEE" && attendance.employee.userId !== userId) {
            return res.status(403).json({ message: "Anda tidak memiliki akses ke data ini" });
        }

        if (role === "ADMIN" && attendance.employee.companyId !== companyId) {
            return res.status(403).json({
                message: "Anda tidak memiliki akses ke absensi dari perusahaan lain"
            });
        }

        // Hitung distance jika tipe kerja WFO & ada lat long pada absensi
        let distanceFromOffice: number | null = null;

        if (
            attendance.workType === "WFO" &&
            attendance.latitude &&
            attendance.longitude &&
            attendance.employee.company.latitude &&
            attendance.employee.company.longitude
        ) {
            distanceFromOffice = formatDistance (
                calculateDistance(
                    Number(attendance.latitude),
                    Number(attendance.longitude),
                    Number(attendance.employee.company.latitude),
                    Number(attendance.employee.company.longitude)
                )
            );
        }

        // Format WIB
        const result = {
            ...attendance,
            date: req.formatWIB(req.fromUTCToWIB(attendance.date), "yyyy-MM-dd"),
            checkInTime: attendance.checkInTime
                ? req.formatWIB(req.fromUTCToWIB(attendance.checkInTime), "HH:mm:ss")
                : null,
            checkOutTime: attendance.checkOutTime
                ? req.formatWIB(req.fromUTCToWIB(attendance.checkOutTime), "HH:mm:ss")
                : null,
            createdAt: req.formatWIB(req.fromUTCToWIB(attendance.createdAt)),
            updatedAt: attendance.updatedAt
                ? req.formatWIB(req.fromUTCToWIB(attendance.updatedAt))
                : null,

            hasProof: !!attendance.proof,
            isLate: attendance.attendanceStatus === "LATE",

            distanceFromOffice
        };

        res.status(200).json({
            message: "Detail absensi berhasil diambil",
            data: result
        });

    } catch (err: any) {
        console.error("Error getAttendanceById:", err);
        res.status(500).json({
            message: err.message || "Terjadi kesalahan saat mengambil detail absensi"
        });
    }
}

// Fungsi menghapus data attendance, hanya bisa dilakukan ketika status approval masih PENDING (kecuali superadmin)
export async function deleteAttendance(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const userId = user.id;
        const role = user.role;

        const attendanceId = Number(req.params.id);

        if (isNaN(attendanceId)) {
            return res.status(400).json({ message: "ID tidak valid" });
        }

        // Ambil data attendance
        const attendance = await prisma.attendance.findFirst({
            where: { id: attendanceId, deletedAt: null },
            include: {
                employee: {
                    include: {
                        company: true
                    }
                }
            }
        });

        if (!attendance) {
            return res.status(404).json({ message: "Data absensi tidak ditemukan" });
        }

        // EMPLOYEE hanya bisa hapus absensinya sendiri
        if (role === "EMPLOYEE") {
            if (attendance.employee.userId !== userId) {
                return res.status(403).json({ message: "Tidak boleh menghapus absensi milik orang lain" });
            }

            if (attendance.approvalStatus !== "PENDING") {
                return res.status(400).json({
                    message: "Absensi sudah diproses dan tidak dapat dihapus"
                });
            }
        }

        // ADMIN hanya boleh hapus untuk company miliknya
        if (role === "ADMIN") {
            // ambil companyId dengan pola yang konsisten: cek ownedCompanies dulu, lalu companyId
            const currentUser = await prisma.user.findFirst({
                where: { id: userId, deletedAt: null },
                include: { ownedCompanies: true }
            });

            let adminCompanyId: number | null = null;
            if (currentUser) {
                if (currentUser.ownedCompanies && currentUser.ownedCompanies.length > 0) {
                    adminCompanyId = currentUser.ownedCompanies[0].id;
                } else if ((currentUser as any).companyId) {
                    adminCompanyId = (currentUser as any).companyId;
                }
            }

            if (!adminCompanyId || attendance.employee.companyId !== adminCompanyId) {
                return res.status(403).json({ message: "Tidak dapat menghapus absensi employee perusahaan lain" });
            }

            if (attendance.approvalStatus !== "PENDING") {
                return res.status(400).json({
                    message: "Absensi sudah diproses dan tidak dapat dihapus"
                });
            }
        }

        // Soft delete
        await prisma.attendance.update({
            where: { id: attendanceId },
            data: {
                deletedAt: new Date()
            }
        });

        return res.status(200).json({
            message: "Absensi berhasil dihapus (soft delete)"
        });

    } catch (err: any) {
        console.error("Error deleteAttendance:", err);
        res.status(500).json({
            message: err.message || "Terjadi kesalahan saat menghapus absensi"
        });
    }
}


