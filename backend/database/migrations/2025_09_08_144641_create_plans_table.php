<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // nama paket
            $table->enum('plan_type', ['paygo', 'subscription']); // jenis plan
            $table->integer('max_employees'); // maksimal karyawan
            $table->decimal('price', 12, 2); // harga paket
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
