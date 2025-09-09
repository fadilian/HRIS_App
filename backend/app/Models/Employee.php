<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'company_id',
        'employee_code',
        'full_name',
        'nik',
        'gender',
        'mobile_number',
        'address',
        'position',
        'department',
        'hire_date',
    ];

    // Relasi ke User
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Relasi ke Company
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Relasi ke Attendances
    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    // Relasi ke Leaves
    public function leaves()
    {
        return $this->hasMany(Leave::class);
    }
}
