<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('subscription_id');
            $table->decimal('amount', 12, 2); // nominal bayar
            $table->string('payment_method')->nullable(); // e.g. 'xendit-va', 'credit_card'
            $table->enum('status', ['pending', 'paid', 'failed', 'refunded'])->default('pending');
            $table->string('invoice_id')->nullable(); // ID dari Xendit
            $table->string('reference')->nullable();  // referensi internal
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            // FK
            $table->foreign('subscription_id')
                  ->references('id')->on('subscriptions')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
