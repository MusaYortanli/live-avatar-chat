# LiveAvatar POC — OBIZ Gespreksassistent (Laravel + React)

MVP-implementatie van de flow uit het Stappenplan: login → dashboard met minuten → sessie met avatar → minuten aftrekken → stop bij 0. MDR-proof by design (LITE mode + eigen LLM-laag met harde system prompt).

## Architectuur

```
Browser (React + @heygen/liveavatar-web-sdk)
   │
   ├─ POST /avatar/session ──────► Laravel: minuten-check → LiveAvatar token API
   │                               (API key blijft server-side = poortwachter)
   ├─ POST .../heartbeat (30s) ──► Laravel: seconden afrekenen, stop bij 0
   ├─ POST .../chat ─────────────► Laravel → Claude (MDR system prompt) → tekst
   │                               Frontend: session.repeat(tekst) → avatar spreekt
   └─ WebRTC video/audio ◄──────► LiveAvatar streaming (LITE mode)
```

Vangnet: `avatar:close-stale-sessions` (scheduler, elke minuut) sluit sessies af waarvan de heartbeat >120 sec is weggevallen en rekent netjes af.

## Installatie in een verse Laravel-app

```bash
# 1. Basis (Laravel 11/12 + Breeze React)
composer create-project laravel/laravel obiz-avatar
cd obiz-avatar
composer require laravel/breeze --dev
php artisan breeze:install react

# 2. Frontend dependency
npm install @heygen/liveavatar-web-sdk axios

# 3. Bestanden uit dit pakket kopiëren (zelfde mappenstructuur):
#    app/Http/Controllers/AvatarSessionController.php
#    app/Services/LiveAvatarService.php
#    app/Services/AvatarConversationService.php
#    app/Models/{AvatarSession,AvatarMessage,UserMinuteBalance}.php
#    app/Console/Commands/CloseStaleAvatarSessions.php
#    config/liveavatar.php
#    database/migrations/2026_07_05_000001_create_avatar_tables.php
#    resources/js/Pages/Avatar/Session.jsx
#    routes/avatar.php

# 4. Routes koppelen — onderaan routes/web.php:
#    require __DIR__.'/avatar.php';

# 5. Scheduler — in routes/console.php:
#    use Illuminate\Support\Facades\Schedule;
#    Schedule::command('avatar:close-stale-sessions')->everyMinute();

# 6. Migreren en draaien
php artisan migrate
npm run dev
php artisan serve
```

## .env

```env
LIVEAVATAR_API_KEY=la_...          # app.liveavatar.com → Developers
LIVEAVATAR_MODE=LITE               # LITE aanbevolen (MDR-controle)
LIVEAVATAR_AVATAR_ID=...           # public avatar of custom avatar ID
LIVEAVATAR_VOICE_ID=...            # NL-stem kiezen in dashboard
LIVEAVATAR_LANGUAGE=nl

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

AVATAR_DEFAULT_MINUTES=10          # gratis testminuten voor nieuwe users
```

## Testen

1. Registreer een gebruiker → krijgt automatisch 10 minuten (`UserMinuteBalance::forUser`)
2. Ga naar `/avatar` → accepteer disclaimer → Start gesprek
3. Typ een casus, bijv.: *"De familie vraagt of we de diagnose niet direct met de patiënt delen. Hoe ga ik hiermee om?"*
4. Avatar spreekt het MDR-veilige antwoord uit (analyse → advies → voorbeeldzin → reflectievraag)
5. Test de grens: vraag *"welke behandeling raad je aan?"* → assistent weigert en buigt terug naar communicatie
6. Zet `AVATAR_DEFAULT_MINUTES=1` en check dat de sessie na 1 minuut stopt
7. Sluit de tab zonder stop → check dat `avatar:close-stale-sessions` de sessie op `expired` zet

## MDR-borging (samenvatting)

- **Positionering**: gespreksassistent voor communicatie/reflectie — geen decision support
- **Technisch afgedwongen**: alle output loopt door `AvatarConversationService` met harde system prompt (nooit diagnose/behandeladvies); LITE mode betekent dat LiveAvatar's eigen LLM nooit aan het woord is
- **Disclaimer**: verplichte checkbox vóór elke sessie, acceptatie gelogd op `avatar_sessions.disclaimer_accepted`
- **Privacy**: prompt instrueert om herleidbare patiëntgegevens te negeren; gesprekslogging in `avatar_messages` kan uitgezet worden als AVG-afweging daarom vraagt

## Bekende aandachtspunten / fase 2

- **Voice input in LITE mode**: MVP gebruikt tekst-input. Spraak kan via browser SpeechRecognition of LiveAvatar's ASR-opties — apart onderzoeken.
- **Sandbox mode**: LiveAvatar heeft een sandbox die geen credits verbruikt — handig tijdens ontwikkeling, check de docs voor de token-parameter.
- **Max sessieduur per LiveAvatar-plan** (bijv. 20 min op Essential): `session.maxSessionDuration` uitlezen en de gebruiker waarschuwen vóór de harde cut-off.
- **Minuten bijkopen**: Mollie-integratie die `seconds_remaining` ophoogt — bewust buiten deze POC gehouden.
- **API-payload verifiëren**: het exacte `sessions/token` request-schema (LITE-variant) even naast docs.liveavatar.com leggen bij de eerste test; de FULL-variant met `avatar_persona` is bevestigd, de LITE-variant kan minder velden vereisen.
