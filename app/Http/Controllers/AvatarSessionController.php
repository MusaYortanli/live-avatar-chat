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
    public function start(Request $request, LiveAvatarService $liveAvatar): JsonResponse
    {
        $request->validate([
            'disclaimer_accepted' => 'accepted',
        ]);

        $user = $request->user();

        // Snelle voorcontrole zonder lock: bespaart een API-call bij leeg tegoed.
        if (UserMinuteBalance::forUser($user->id)->seconds_remaining < 60) {
            return $this->noMinutesResponse();
        }

        // Externe call BUITEN de transactie/lock: een token minten kost geen
        // credits (LiveAvatar rekent pas af per minuut streaming), dus we
        // houden de balance-rij niet gelockt tijdens de netwerklatentie.
        $liveAvatarSession = $liveAvatar->createSessionToken();

        return DB::transaction(function () use ($user, $request, $liveAvatarSession) {
            $balance = UserMinuteBalance::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first() ?? UserMinuteBalance::forUser($user->id);

            // Autoritatieve hercontrole binnen de lock (race tussen voorcontrole
            // en nu, bijv. een parallelle sessie die tegoed verbruikte).
            if ($balance->seconds_remaining < 60) {
                return $this->noMinutesResponse();
            }

            // Eén actieve sessie per gebruiker
            AvatarSession::active()->where('user_id', $user->id)->update([
                'status' => 'ended',
                'ended_at' => now(),
            ]);

            $session = AvatarSession::create([
                'user_id' => $user->id,
                'mode' => config('liveavatar.mode'),
                'liveavatar_session_id' => $liveAvatarSession['session_id'],
                'status' => 'active',
                'started_at' => now(),
                'last_heartbeat_at' => now(),
                'disclaimer_accepted' => (bool) $request->boolean('disclaimer_accepted'),
            ]);

            return response()->json([
                'session_id' => $session->id,
                'session_token' => $liveAvatarSession['token'],
                'seconds_remaining' => $balance->seconds_remaining,
            ]);
        });
    }

    private function noMinutesResponse(): JsonResponse
    {
        return response()->json([
            'error' => 'Je hebt geen minuten meer. Koop extra minuten om verder te gaan.',
        ], 402);
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
    public function chat(Request $request, AvatarSession $session, AvatarConversationService $conversation): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);
        abort_unless($session->status === 'active', 409, 'Sessie is beëindigd.');

        $validated = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $reply = $conversation->reply($session, $validated['message']);

        return response()->json(['reply' => $reply]);
    }
}
