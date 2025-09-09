<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->unsignedBigInteger('owner_user_id');   // admin utama pembuat company
            $table->string('latitude')->nullable();        // lokasi kantor (WFO)
            $table->string('longitude')->nullable();       // lokasi kantor (WFO)
            $table->integer('radius')->default(200);       // radius absensi
            $table->timestamps();

            // FK ke users (owner)
            $table->foreign('owner_user_id')
                  ->references('id')->on('users')
                  ->onDelete('cascade');

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
