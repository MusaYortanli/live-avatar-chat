<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Minutensaldo per gebruiker. We slaan seconden op, niet minuten:
        // dan kun je later per-seconde afrekenen zonder migratie.
        Schema::create('user_minute_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->integer('seconds_remaining')->default(0);
            $table->timestamps();
        });

        Schema::create('avatar_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('liveavatar_session_id')->nullable()->index();
            $table->string('mode', 10)->default('LITE');
            $table->string('status', 20)->default('active'); // active | ended | expired
            $table->timestamp('started_at');
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->integer('seconds_used')->default(0);
            $table->boolean('disclaimer_accepted')->default(false);
            $table->timestamps();
        });

        // Optioneel maar handig voor MDR-dossier: welke vragen/antwoorden
        // zijn er geweest (zonder patiëntdata — dat dwingt de disclaimer af).
        Schema::create('avatar_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('avatar_session_id')->constrained()->cascadeOnDelete();
            $table->string('role', 10); // user | assistant
            $table->text('content');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('avatar_messages');
        Schema::dropIfExists('avatar_sessions');
        Schema::dropIfExists('user_minute_balances');
    }
};
