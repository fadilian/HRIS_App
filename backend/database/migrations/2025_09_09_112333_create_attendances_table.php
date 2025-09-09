<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('employee_id');
            $table->unsignedBigInteger('work_schedule_id')->nullable(); 
            $table->date('date'); 
            $table->time('time')->nullable(); // bisa null untuk absent otomatis
            $table->enum('type', ['check_in', 'check_out', 'absent']); 
            $table->enum('work_type', ['wfo', 'wfa']); 
            $table->string('latitude')->nullable();
            $table->string('longitude')->nullable();
            $table->string('proof')->nullable(); // upload bukti
            $table->enum('location_status', ['inside', 'outside'])->nullable(); // validasi radius
            $table->enum('attendance_status', ['ontime', 'late', 'alpha'])->default('ontime'); // status kehadiran
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');  
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('work_schedule_id')->references('id')->on('work_schedules')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
