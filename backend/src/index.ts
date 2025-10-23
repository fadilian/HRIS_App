import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { timezoneMiddleware } from "./middlewares/timezoneMiddleware";
import authRoutes from "./routes/authRoutes";
import companyRoutes from "./routes/companyRoutes";
import employeeRoutes from "./routes/employeeRoutes";
import scheduleGroupRoutes from "./routes/scheduleGroupRoutes";
import workSchedule from "./routes/workScheduleRoutes";
import leaveTypeRoutes from "./routes/leaveTypeRoutes";
import leaveRequestRoutes from "./routes/leaveRequestRoutes";

dotenv.config();
// console.log("✅ Loaded JWT_SECRET:", process.env.JWT_SECRET);
const app = express();

app.use(express.json());

// aktifkan middleware global
app.use(timezoneMiddleware);

// Izinkan request dari Next.js (port 3001)
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  credentials: true
}));

// Expose folder upload agar bisa diakses FE
app.use("/uploads", express.static("public/uploads"));

// route
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/schedule-group", scheduleGroupRoutes);
app.use("/api/work-schedule", workSchedule);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);

// route cek waktu sekarang (wib)
app.get("/time", (req, res) => {
  res.json({
    nowWIB: req.formatWIB(req.nowWIB, "dd MMM yyyy HH:mm:ss"),
    todayWIB: req.todayWIB,
  });
});

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
}); 
