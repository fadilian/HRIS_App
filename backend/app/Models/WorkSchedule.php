<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'day_of_week',
        'start_time',
        'end_time',
        'break_start',
        'break_end',
    ];

    // Relasi ke Company
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Relasi ke Attendance
    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }
}
