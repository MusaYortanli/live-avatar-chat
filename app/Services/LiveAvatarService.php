<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class LiveAvatarService
{
    /**
     * Vraag server-side een session token op bij LiveAvatar.
     * Dit is de poortwachter: geen token = geen sessie = geen credits.
     *
     * POST https://api.liveavatar.com/v1/sessions/token
     * Header: X-API-KEY
     */
    public function createSessionToken(): string
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

        $response = Http::withHeaders([
                'X-API-KEY' => config('liveavatar.api_key'),
            ])
            ->acceptJson()
            ->asJson()
            ->post(config('liveavatar.base_url').'/sessions/token', $payload);

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

        return $token;
    }
}
