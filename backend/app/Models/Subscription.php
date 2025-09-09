<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'plan_id',
        'status',
        'feature_access',
        'start_date',
        'end_date',
    ];

    protected $casts = [
        'feature_access' => 'array', // otomatis JSON → array
    ];

    // Relasi ke Company
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Relasi ke Plan
    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    // Relasi ke Transactions (riwayat pembayaran)
    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
