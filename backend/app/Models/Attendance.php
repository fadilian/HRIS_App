<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'work_schedule_id',
        'date',
        'time',
        'type',
        'work_type',
        'latitude',
        'longitude',
        'proof',
        'location_status',
        'attendance_status',
        'status',
        
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function workSchedule()
    {
        return $this->belongsTo(WorkSchedule::class);
    }
}
