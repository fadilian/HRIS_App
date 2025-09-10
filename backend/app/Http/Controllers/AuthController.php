<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    // Register khusus admin
    public function registerAdmin(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|unique:users',
            'password' => 'required|string|min:6|confirmed', // password_confirmation wajib
        ]);

        $user = User::create([
            'name'       => $request->name,
            'email'      => $request->email,
            'password'   => Hash::make($request->password),
            'role'       => 'admin',
            'company_id' => null, // kosong dulu
            'status'     => 'active',
        ]);

        return response()->json([
            'message' => 'Admin registered successfully',
            'user' => $user
        ], 201);
    }

    // Login
    public function loginAdmin(Request $request)
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required'
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $user = Auth::user();

        // cek role
        if ($user->role !== 'admin') {
            Auth::logout(); // logout supaya gak dapat session/token
            return response()->json(['error' => 'Access denied, only admin can login here'], 403);
        }

        $token = $user->createToken('authToken')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token
        ]);
    }

    public function loginEmployee(Request $request)
    {
        $request->validate([
            'employee_code' => 'required|string',
            'password'      => 'required|string',
        ]);

        // Cari employee berdasarkan employee_code
        $employee = Employee::where('employee_code', $request->employee_code)->first();

        if (!$employee) {
            return response()->json(['error' => 'Invalid employee code'], 404);
        }

        $user = $employee->user; // relasi employee -> user

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        if ($user->role !== 'employee') {
            return response()->json(['error' => 'Access denied, only employees can login here'], 403);
        }

        $token = $user->createToken('employeeToken')->plainTextToken;

        return response()->json([
            'message'  => 'Employee login successful',
            'employee' => $employee,
            'user'     => $user,
            'token'    => $token
        ]);
    }

    // Logout
    public function logout(Request $request)
    {
        if (!$request->user()) {
            return response()->json(['error' => 'No authenticated user'], 401);
        }

        // hapus hanya token yang sedang dipakai
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

}
