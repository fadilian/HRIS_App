import { Request, Response } from "express";
import prisma from "../utils/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

// =======================
// Helper: Generate Employee Code
// =======================
async function generateEmployeeCode(companyId: number, date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const datePart = `${day}${month}${year}`;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const countToday = await prisma.employee.count({
    where: {
      companyId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      deletedAt: null,
    },
  });

  const sequence = String(countToday + 1).padStart(4, "0");
  return `EMP-C${companyId}-${datePart}${sequence}`;
}

// =======================
// Create Employee
// =======================
export async function createEmployee(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
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

    const photoFile = req.file ? req.file.filename : null;

    // Validasi input required
    if (!name || !email || !password || !fullName) {
      return res.status(400).json({ 
        message: "Name, email, password, dan fullName wajib diisi" 
      });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { company: true, ownedCompanies: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    let companyId: number | null = null;
    if (user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companyId) {
      companyId = user.companyId;
    }

    if (!companyId) {
      return res.status(400).json({ 
        message: "User is not linked with any company" 
      });
    }

    // Cek email sudah ada atau belum
    const existingUser = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (existingUser) {
      return res.status(409).json({ 
        message: "Email sudah terdaftar" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "EMPLOYEE",
          companyId,
        },
      });

      const employeeCode = await generateEmployeeCode(companyId!, new Date());

      const employee = await tx.employee.create({
        data: {
          userId: newUser.id,
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
          photo: photoFile,
        },
      });

      return { newUser, employee };
    });

    res.status(201).json({ 
      message: "Employee created successfully", 
      data: result 
    });
  } catch (err) {
    console.error("Error createEmployee:", err);
    res.status(500).json({ message: "Error creating employee" });
  }
}

// =======================
// Get Employee Profile
// =======================
export async function getEmployeeProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;

    const employee = await prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      include: {
        company: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!employee) {
      return res.status(404).json({ 
        status: false, 
        message: "Employee not found" 
      });
    }

    return res.status(200).json({ status: true, employee });
  } catch (err) {
    console.error("Error getEmployeeProfile:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
}

// =======================
// Get Employees (admin / superadmin only)
// =======================
export async function getEmployees(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { company: true, ownedCompanies: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let employees;
    if (user.role === "SUPERADMIN") {
      employees = await prisma.employee.findMany({
        where: { deletedAt: null },
        include: {
          company: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (user.role === "ADMIN") {
      let companyId: number | null = null;
      if (user.ownedCompanies.length > 0) {
        companyId = user.ownedCompanies[0].id;
      } else if (user.companyId) {
        companyId = user.companyId;
      }

      if (!companyId) {
        return res.status(400).json({ 
          message: "Admin tidak terkait dengan perusahaan manapun" 
        });
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

    res.status(200).json({ message: "Success", data: employees });
  } catch (err) {
    console.error("Error getEmployees:", err);
    res.status(500).json({ message: "Error fetching employees" });
  }
}

// =======================
// Get Employee By ID
// =======================
export async function getEmployeeById(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const employeeId = Number(req.params.id);

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { company: true, ownedCompanies: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let employee;

    if (user.role === "SUPERADMIN") {
      employee = await prisma.employee.findFirst({
        where: { id: employeeId, deletedAt: null },
        include: {
          company: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    } else if (user.role === "ADMIN") {
      let companyId: number | null = null;
      if (user.ownedCompanies.length > 0) {
        companyId = user.ownedCompanies[0].id;
      } else if (user.companyId) {
        companyId = user.companyId;
      }

      if (!companyId) {
        return res.status(400).json({ 
          message: "Admin tidak terkait dengan perusahaan manapun" 
        });
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

// =======================
// Update Employee
// =======================
export async function updateEmployee(req: Request, res: Response) {
  const { id } = req.params;
  const data = req.body;
  const file = req.file;

  try {
    const currentUser = (req as any).user;

    const employee = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.deletedAt) {
      return res.status(410).json({ message: "Employee has been deleted" });
    }

    let updateUserData: any = {};
    let updateEmployeeData: any = {};

    if (currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN") {
      if (data.name || data.email) {
        updateUserData = {
          ...(data.name && { name: data.name }),
          ...(data.email && { email: data.email }),
        };
      }
      
      updateEmployeeData = {
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.nik && { nik: data.nik }),
        ...(data.gender && { gender: data.gender }),
        ...(data.mobileNumber && { mobileNumber: data.mobileNumber }),
        ...(data.address && { address: data.address }),
        ...(data.position && { position: data.position }),
        ...(data.department && { department: data.department }),
        ...(file && { photo: file.filename }),
      };
    } 
    else if (currentUser.role === "EMPLOYEE") {
      if (currentUser.id !== employee.userId) {
        return res.status(403).json({ 
          message: "Forbidden: You can only update your own profile" 
        });
      }
      
      updateEmployeeData = {
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.mobileNumber && { mobileNumber: data.mobileNumber }),
        ...(data.address && { address: data.address }),
        ...(file && { photo: file.filename }),
      };

      if (data.name || data.email || data.nik || data.gender || 
          data.position || data.department) {
        return res.status(403).json({ 
          message: "Forbidden: You cannot update these fields (name, email, nik, gender, position, department)" 
        });
      }
    } 
    else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    if (Object.keys(updateUserData).length === 0 && 
        Object.keys(updateEmployeeData).length === 0) {
      return res.status(400).json({ 
        message: "No data to update" 
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateUserData).length > 0) {
        if (updateUserData.email) {
          const existingEmail = await tx.user.findFirst({
            where: { 
              email: updateUserData.email, 
              id: { not: employee.userId },
              deletedAt: null 
            },
          });
          
          if (existingEmail) {
            throw new Error("Email already exists");
          }
        }

        await tx.user.update({
          where: { id: employee.userId },
          data: updateUserData,
        });
      }

      const updatedEmployee = await tx.employee.update({
        where: { id: employee.id },
        data: updateEmployeeData,
        include: { 
          user: { select: { id: true, name: true, email: true, role: true } },
          company: true 
        },
      });

      return updatedEmployee;
    });

    res.status(200).json({ 
      message: "Employee updated successfully", 
      employee: updated 
    });
  } catch (err: any) {
    console.error("Error updateEmployee:", err);
    
    if (err.message === "Email already exists") {
      return res.status(409).json({ message: "Email already exists" });
    }
    
    res.status(500).json({ message: "Error updating employee" });
  }
}

// =======================
// Soft Delete Employee
// =======================
export async function deleteEmployee(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const currentUser = (req as any).user;

    if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPERADMIN") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.deletedAt) {
      return res.status(410).json({ message: "Employee already deleted" });
    }

    if (currentUser.id === employee.userId) {
      return res.status(400).json({ 
        message: "You cannot delete your own account" 
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: { deletedAt: new Date() },
      });

      await tx.user.update({
        where: { id: employee.userId },
        data: { deletedAt: new Date() },
      });
    });

    res.status(200).json({ 
      message: "Employee deleted successfully (soft delete)",
      deletedAt: new Date()
    });
  } catch (err) {
    console.error("Error deleteEmployee:", err);
    res.status(500).json({ message: "Error deleting employee" });
  }
}

// =======================
// Restore Employee (Undo Soft Delete)
// =======================
export async function restoreEmployee(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const currentUser = (req as any).user;

    if (currentUser.role !== "SUPERADMIN") {
      return res.status(403).json({ 
        message: "Unauthorized. Only SUPERADMIN can restore employees" 
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (!employee.deletedAt) {
      return res.status(400).json({ message: "Employee is not deleted" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: { deletedAt: null },
      });

      await tx.user.update({
        where: { id: employee.userId },
        data: { deletedAt: null },
      });
    });

    res.status(200).json({ 
      message: "Employee restored successfully",
      restoredAt: new Date()
    });
  } catch (err) {
    console.error("Error restoreEmployee:", err);
    res.status(500).json({ message: "Error restoring employee" });
  }
}

// =======================
// Get Deleted Employees (Soft Deleted)
// =======================
export async function getDeletedEmployees(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { company: true, ownedCompanies: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let employees;
    if (user.role === "SUPERADMIN") {
      employees = await prisma.employee.findMany({
        where: { deletedAt: { not: null } },
        include: {
          company: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { deletedAt: "desc" },
      });
    } else if (user.role === "ADMIN") {
      let companyId: number | null = null;
      if (user.ownedCompanies.length > 0) {
        companyId = user.ownedCompanies[0].id;
      } else if (user.companyId) {
        companyId = user.companyId;
      }

      if (!companyId) {
        return res.status(400).json({ 
          message: "Admin tidak terkait dengan perusahaan manapun" 
        });
      }

      employees = await prisma.employee.findMany({
        where: { 
          companyId, 
          deletedAt: { not: null }
        },
        include: {
          company: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { deletedAt: "desc" },
      });
    } else {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.status(200).json({ 
      message: "Success", 
      count: employees.length,
      data: employees 
    });
  } catch (err) {
    console.error("Error getDeletedEmployees:", err);
    res.status(500).json({ message: "Error fetching deleted employees" });
  }
}