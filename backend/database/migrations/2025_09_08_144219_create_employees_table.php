<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');     // FK ke users
            $table->unsignedBigInteger('company_id');  // FK ke companies
            $table->string('employee_code', 20)->unique(); // kode karyawan (generate otomatis) saat admin/HR tambah karyawan
            $table->string('full_name');
            $table->string('nik')->unique();           
            $table->enum('gender', ['male', 'female']);
            $table->string('mobile_number')->nullable();
            $table->text('address')->nullable();
            $table->string('position')->nullable();    // jabatan
            $table->string('department')->nullable();  // departemen
            $table->date('hire_date');                 // tanggal masuk kerja
            $table->timestamps();

            // Foreign keys
            $table->foreign('user_id')
                  ->references('id')->on('users')
                  ->onDelete('cascade');

            $table->foreign('company_id')
                  ->references('id')->on('companies')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
