import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import companyRoutes from "./routes/companyRoutes";
import employeeRoutes from "./routes/employeeRoutes";

dotenv.config();
// console.log("✅ Loaded JWT_SECRET:", process.env.JWT_SECRET);
const app = express();

app.use(express.json());

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

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
}); 
