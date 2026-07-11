<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('email');
        });

        // Logboek van minutentoekenningen: wie kreeg wanneer hoeveel en waarom.
        // Verbruik zelf staat al per sessie in avatar_sessions.seconds_used.
        Schema::create('minute_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('seconds'); // positief = toekenning, negatief = correctie
            $table->string('reason');   // bv. "Startminuten", "Bijgeboekt door admin"
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('minute_transactions');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
        });
    }
};
