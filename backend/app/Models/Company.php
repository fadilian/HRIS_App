<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'owner_user_id',
        'latitude',
        'longitude',
        'radius',
    ];

    // Relasi ke User (owner)
    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    // Relasi ke semua users dalam company ini
    public function users()
    {
        return $this->hasMany(User::class);
    }

    // Relasi ke employees
    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    // Relasi ke work schedules
    public function workSchedules()
    {
        return $this->hasMany(WorkSchedule::class);
    }

    // Relasi ke subscriptions (riwayat)
    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function activeSubscription()
    {
        return $this->hasOne(Subscription::class)
                    ->where('status', 'active')
                    ->latest('end_date');
    }
}
