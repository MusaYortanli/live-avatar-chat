<?php

return [

    /*
    |--------------------------------------------------------------------------
    | LiveAvatar API
    |--------------------------------------------------------------------------
    | API key blijft ALTIJD server-side. De browser krijgt alleen kortlevende
    | session tokens via AvatarSessionController@start.
    */

    'api_key' => env('LIVEAVATAR_API_KEY'),
    'base_url' => env('LIVEAVATAR_BASE_URL', 'https://api.liveavatar.com/v1'),

    // LITE = eigen LLM (MDR-controle, aanbevolen voor OBIZ)
    // FULL = LiveAvatar's eigen AI-pipeline (ASR+LLM+TTS)
    'mode' => env('LIVEAVATAR_MODE', 'LITE'),

    'avatar_id' => env('LIVEAVATAR_AVATAR_ID'),
    'voice_id' => env('LIVEAVATAR_VOICE_ID'),

    // Alleen relevant in FULL mode (knowledge base / context in LiveAvatar dashboard)
    'context_id' => env('LIVEAVATAR_CONTEXT_ID'),

    'language' => env('LIVEAVATAR_LANGUAGE', 'nl'),

    /*
    |--------------------------------------------------------------------------
    | Minuten / credits
    |--------------------------------------------------------------------------
    */

    // Aantal gratis minuten voor nieuwe gebruikers (MVP/test)
    'default_minutes' => (int) env('AVATAR_DEFAULT_MINUTES', 10),

    // Sessies zonder heartbeat langer dan X seconden worden afgesloten
    // door de scheduled cleanup (avatar:close-stale-sessions).
    'stale_after_seconds' => 120,

    /*
    |--------------------------------------------------------------------------
    | AI (LITE mode)
    |--------------------------------------------------------------------------
    */

    'anthropic_api_key' => env('ANTHROPIC_API_KEY'),
    'anthropic_model' => env('ANTHROPIC_MODEL', 'claude-sonnet-5'),
];
