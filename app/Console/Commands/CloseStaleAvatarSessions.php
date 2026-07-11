<?php

namespace App\Console\Commands;

use App\Models\AvatarSession;
use App\Models\UserMinuteBalance;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Vangnet: sluit sessies af waarvan de browser is weggevallen
 * (crash, tab dicht zonder stop) en reken de resterende tijd af.
 *
 * Inplannen in routes/console.php:
 *   Schedule::command('avatar:close-stale-sessions')->everyMinute();
 */
class CloseStaleAvatarSessions extends Command
{
    protected $signature = 'avatar:close-stale-sessions';

    protected $description = 'Sluit avatar-sessies zonder recente heartbeat en reken af';

    public function handle(): int
    {
        $staleAfter = config('liveavatar.stale_after_seconds', 120);

        $stale = AvatarSession::active()
            ->where('last_heartbeat_at', '<', now()->subSeconds($staleAfter))
            ->get();

        foreach ($stale as $session) {
            DB::transaction(function () use ($session, $staleAfter) {
                $balance = UserMinuteBalance::query()
                    ->where('user_id', $session->user_id)
                    ->lockForUpdate()
                    ->first();

                // Reken maximaal tot aan de stale-grens af, niet tot "nu" —
                // de gebruiker was daarna aantoonbaar niet meer verbonden.
                $elapsed = min(
                    $session->last_heartbeat_at->diffInSeconds(now()),
                    $staleAfter
                );

                if ($balance) {
                    $balance->seconds_remaining = max(0, $balance->seconds_remaining - $elapsed);
                    $balance->save();
                }

                $session->update([
                    'status' => 'expired',
                    'ended_at' => now(),
                    'seconds_used' => $session->seconds_used + $elapsed,
                ]);
            });

            $this->info("Sessie #{$session->id} (user {$session->user_id}) afgesloten als expired.");
        }

        return self::SUCCESS;
    }
}
