<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

// Authentication
Route::post('/register/admin', [AuthController::class, 'registerAdmin']);
Route::post('/login/admin', [AuthController::class, 'loginAdmin']);
Route::post('/login/employee', [AuthController::class, 'loginEmployee']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
});



Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
