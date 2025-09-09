<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id'); // FK ke companies
            $table->string('name')->nullable(); // nama shift (opsional)
            $table->enum('day_of_week', [
                'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
            ]); // hari kerja
            $table->time('start_time'); // jam masuk
            $table->time('break_start')->nullable(); // mulai istirahat
            $table->time('break_end')->nullable();   // akhir istirahat
            $table->time('end_time');   // jam pulang
            $table->timestamps();

            // Foreign key
            $table->foreign('company_id')
                  ->references('id')->on('companies')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_schedules');
    }
};
