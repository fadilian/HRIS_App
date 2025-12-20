import cron from "node-cron";
import prisma from "../utils/prisma";
import { fromUTCToWIB, formatWIB } from "../utils/timezone";

/**
 * CRON: Auto-expire subscription
 * Jalan setiap hari jam 00:00 WIB
 */
cron.schedule(
    "0 0 * * *", // 00:00 setiap hari
    async () => {
        console.log("[AUTO EXPIRE SUBSCRIPTION] Job START (00:00 WIB)");

        try {
            // Ambil waktu WIB
            const nowUTC = new Date();
            const nowWIB = fromUTCToWIB(nowUTC);

            // Ambil tanggal hari ini WIB (awal hari)
            const todayStr = formatWIB(nowWIB, "yyyy-MM-dd");
            const todayUTC = new Date(`${todayStr}T00:00:00.000Z`);

            // Expire subscription yang lewat endDate
            const result = await prisma.subscription.updateMany({
                where: {
                    status: "ACTIVE",
                    deletedAt: null,
                    endDate: { lt: todayUTC },
                },
                data: {
                    status: "EXPIRED",
                },
            });

            console.log(
                `[AUTO EXPIRE SUBSCRIPTION] COMPLETE - Expired count: ${result.count}`
            );
        } catch (error) {
            console.error(
                "[AUTO EXPIRE SUBSCRIPTION] ERROR:",
                error
            );
        }
    },
    {
        timezone: "Asia/Jakarta", // pastikan WIB walau server UTC
    }
);
