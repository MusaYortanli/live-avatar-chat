<?php

namespace App\Http\Controllers;

use App\Models\AvatarSession;
use App\Models\UserMinuteBalance;
use App\Services\AvatarConversationService;
use App\Services\LiveAvatarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AvatarSessionController extends Controller
{
    /**
     * Sessiepagina (Inertia/React).
     */
    public function page(Request $request): Response
    {
        $balance = UserMinuteBalance::forUser($request->user()->id);

        return Inertia::render('Avatar/Session', [
            'minutesRemaining' => $balance->minutesRemaining(),
            'mode' => config('liveavatar.mode'),
        ]);
    }

    /**
     * POORTWACHTER: start een sessie.
     * Geen minuten = geen LiveAvatar-token = geen sessie.
     */
    public function start(Request $request): JsonResponse
    {
        $request->validate([
            'disclaimer_accepted' => 'accepted',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($user, $request) {
            $balance = UserMinuteBalance::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first() ?? UserMinuteBalance::forUser($user->id);

            if ($balance->seconds_remaining < 60) {
                return response()->json([
                    'error' => 'Je hebt geen minuten meer. Koop extra minuten om verder te gaan.',
                ], 402);
            }

            // Eén actieve sessie per gebruiker
            AvatarSession::active()->where('user_id', $user->id)->update([
                'status' => 'ended',
                'ended_at' => now(),
            ]);

            $token = app(LiveAvatarService::class)->createSessionToken();

            $session = AvatarSession::create([
                'user_id' => $user->id,
                'mode' => config('liveavatar.mode'),
                'status' => 'active',
                'started_at' => now(),
                'last_heartbeat_at' => now(),
                'disclaimer_accepted' => (bool) $request->boolean('disclaimer_accepted'),
            ]);

            return response()->json([
                'session_id' => $session->id,
                'session_token' => $token,
                'seconds_remaining' => $balance->seconds_remaining,
            ]);
        });
    }

    /**
     * Heartbeat: frontend pingt elke 30 sec. We rekenen af op basis van
     * werkelijk verstreken tijd sinds de vorige heartbeat (max 120 sec
     * per ping, tegen klok-manipulatie).
     */
    public function heartbeat(Request $request, AvatarSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        if ($session->status !== 'active') {
            return response()->json(['status' => 'ended', 'seconds_remaining' => 0]);
        }

        return DB::transaction(function () use ($session) {
            $balance = UserMinuteBalance::query()
                ->where('user_id', $session->user_id)
                ->lockForUpdate()
                ->first();

            $elapsed = min(
                (int) ($session->last_heartbeat_at ?? $session->started_at)->diffInSeconds(now()),
                120
            );

            $balance->seconds_remaining = max(0, $balance->seconds_remaining - $elapsed);
            $balance->save();

            $session->update([
                'last_heartbeat_at' => now(),
                'seconds_used' => $session->seconds_used + $elapsed,
            ]);

            if ($balance->seconds_remaining <= 0) {
                $session->update(['status' => 'ended', 'ended_at' => now()]);

                return response()->json(['status' => 'ended', 'seconds_remaining' => 0]);
            }

            return response()->json([
                'status' => 'active',
                'seconds_remaining' => $balance->seconds_remaining,
            ]);
        });
    }

    /**
     * Nette afsluiting vanuit de frontend (rekent laatste stukje af).
     */
    public function stop(Request $request, AvatarSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        if ($session->status === 'active') {
            $this->heartbeat($request, $session);
            $session->refresh();
            $session->update(['status' => 'ended', 'ended_at' => now()]);
        }

        return response()->json(['status' => 'ended']);
    }

    /**
     * LITE mode: user-vraag → Claude (MDR-prompt) → tekst terug.
     * Frontend laat de avatar dit uitspreken via session.repeat(text).
     */
    public function chat(Request $request, AvatarSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);
        abort_unless($session->status === 'active', 409, 'Sessie is beëindigd.');

        $validated = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $reply = app(AvatarConversationService::class)
            ->reply($session, $validated['message']);

        return response()->json(['reply' => $reply]);
    }
}
