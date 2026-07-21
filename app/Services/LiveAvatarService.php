<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class LiveAvatarService
{
    /**
     * Vraag server-side een session token op bij LiveAvatar.
     * Dit is de poortwachter: geen token = geen sessie = geen credits.
     *
     * Geeft ['token' => ..., 'session_id' => ...] terug; het session_id
     * bewaren we zodat het transcript later opvraagbaar is (beheer).
     *
     * POST https://api.liveavatar.com/v1/sessions/token
     * Header: X-API-KEY
     */
    public function createSessionToken(): array
    {
        $mode = config('liveavatar.mode');

        $payload = [
            'mode' => $mode,
            'avatar_id' => config('liveavatar.avatar_id'),
        ];

        if ($mode === 'FULL') {
            $payload['avatar_persona'] = array_filter([
                'voice_id' => config('liveavatar.voice_id'),
                'context_id' => config('liveavatar.context_id'),
                'language' => config('liveavatar.language'),
            ]);
        } else {
            // LITE: alleen streaming; stem instellen indien opgegeven
            if (config('liveavatar.voice_id')) {
                $payload['avatar_persona'] = [
                    'voice_id' => config('liveavatar.voice_id'),
                ];
            }
        }

        try {
            $response = Http::withHeaders([
                'X-API-KEY' => config('liveavatar.api_key'),
            ])
                ->acceptJson()
                ->asJson()
                ->connectTimeout(5)
                ->timeout(10)
                ->post(config('liveavatar.base_url').'/sessions/token', $payload);
        } catch (ConnectionException $e) {
            report($e);

            throw new RuntimeException('Kon geen avatar-sessie starten. Probeer het later opnieuw.');
        }

        if (! $response->successful()) {
            report(new RuntimeException(
                'LiveAvatar token request failed: '.$response->status().' '.$response->body()
            ));

            throw new RuntimeException('Kon geen avatar-sessie starten. Probeer het later opnieuw.');
        }

        $token = $response->json('data.session_token');

        if (! $token) {
            throw new RuntimeException('LiveAvatar gaf geen session token terug.');
        }

        return [
            'token' => $token,
            'session_id' => $response->json('data.session_id'),
        ];
    }

    /**
     * Haal het transcript van een sessie live op bij LiveAvatar (optie B:
     * wij slaan geen gespreksinhoud op; LiveAvatar is de enige bron).
     * Geeft null terug als het transcript (niet meer) beschikbaar is.
     *
     * GET https://api.liveavatar.com/v1/sessions/{id}/transcript
     */
    public function getTranscript(string $liveAvatarSessionId): ?array
    {
        try {
            $response = Http::withHeaders([
                'X-API-KEY' => config('liveavatar.api_key'),
            ])
                ->acceptJson()
                ->connectTimeout(5)
                ->timeout(15)
                ->get(config('liveavatar.base_url')."/sessions/{$liveAvatarSessionId}/transcript");
        } catch (ConnectionException $e) {
            report($e);

            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        return collect($response->json('data.transcript_data', []))
            ->map(fn ($entry) => [
                'role' => $entry['role'] ?? 'user',
                'text' => $entry['transcript'] ?? '',
                'timestamp' => $entry['absolute_timestamp'] ?? null,
            ])
            ->values()
            ->all();
    }

    /**
     * Resterend credits-tegoed van het LiveAvatar-account.
     * Kort gecachet zodat de beheerpagina niet elke weergave de API raakt.
     * Geeft null terug als de API niet bereikbaar is.
     *
     * GET https://api.liveavatar.com/v1/users/credits
     */
    public function creditsLeft(): ?int
    {
        return Cache::remember('liveavatar.credits_left', 60, function (): ?int {
            try {
                $response = Http::withHeaders([
                    'X-API-KEY' => config('liveavatar.api_key'),
                ])
                    ->acceptJson()
                    ->connectTimeout(5)
                    ->timeout(10)
                    ->get(config('liveavatar.base_url').'/users/credits');
            } catch (ConnectionException $e) {
                report($e);

                return null;
            }

            if (! $response->successful()) {
                report(new RuntimeException(
                    'LiveAvatar credits request failed: '.$response->status().' '.$response->body()
                ));

                return null;
            }

            $credits = $response->json('data.credits_left');

            return $credits === null ? null : (int) $credits;
        });
    }
}
