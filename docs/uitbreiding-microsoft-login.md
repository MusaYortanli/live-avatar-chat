# Uitbreiding: Inloggen met Microsoft (Entra ID)

> **Status:** niet actief. Deze uitbreiding is op 11-07-2026 volledig gebouwd, getest
> en daarna bewust teruggedraaid — voor de MVP registreren zorgverleners met hun
> privé-e-mailadres via standaard Laravel-authenticatie. Dit document bevat alles
> om de Microsoft-login later in één keer terug te zetten.

## Waarom deze opzet (advies Hakan)

Zorgverleners loggen in met hun zakelijke Microsoft 365-account. Het risico is dat
de IT-afdeling van hun organisatie **admin consent** moet geven, wat registratie
blokkeert. Dat is vermijdbaar als de app minimaal wordt opgezet:

- **Multi-tenant** app-registratie ("Accounts in any organizational directory")
- **OpenID Connect + Authorization Code Flow** (met PKCE)
- Alleen self-consent scopes: `openid`, `profile`, `User.Read` — géén
  `Directory.Read.All`, géén Application Permissions, géén organisatiebrede data
- Gebruikersinfo komt uit het token / Graph `/me`; koppeling op het stabiele
  Entra object-id (`oid`), zodat een e-mailwijziging de koppeling niet breekt

Geverifieerd tijdens de bouw: de redirect ging naar
`login.microsoftonline.com/common/oauth2/v2.0/authorize` met exact
`scope=openid profile User.Read` en `response_type=code`.

## Stap 0 — App-registratie in het Entra ID-portaal

portal.azure.com → App registrations → New registration:

1. **Supported account types:** "Accounts in any organizational directory"
   (multi-tenant — cruciaal, anders werkt alleen je eigen tenant).
2. **Redirect URI** (type *Web*): `{APP_URL}/auth/microsoft/callback`
   — lokaal `http://localhost/auth/microsoft/callback`, productie
   `https://www.obizcare.nl/auth/microsoft/callback` (beide mogen naast elkaar).
3. **Certificates & secrets:** maak een client secret aan. Noteer de *Value*
   direct — die is maar één keer zichtbaar.
4. **API permissions:** niets toevoegen. De standaard delegated `User.Read`
   is genoeg en is door de gebruiker zelf te consenten.

## Stap 1 — Package

```bash
./vendor/bin/sail composer require socialiteproviders/microsoft
```

## Stap 2 — `.env` en `.env.example`

```env
# --- Microsoft Entra ID login ---
# App-registratie in het Entra ID-portaal (multi-tenant: "Accounts in any
# organizational directory"). Redirect URI: {APP_URL}/auth/microsoft/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI="${APP_URL}/auth/microsoft/callback"
MICROSOFT_TENANT=common
```

## Stap 3 — `config/services.php`

```php
/*
| Microsoft Entra ID login (multi-tenant, OpenID Connect + PKCE).
| tenant 'common' laat gebruikers uit élke organisatie inloggen;
| alleen self-consent scopes (openid/profile/User.Read) — geen admin consent.
*/
'microsoft' => [
    'client_id' => env('MICROSOFT_CLIENT_ID'),
    'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
    'redirect' => env('MICROSOFT_REDIRECT_URI', '/auth/microsoft/callback'),
    'tenant' => env('MICROSOFT_TENANT', 'common'),
],
```

## Stap 4 — Event listener in `app/Providers/AppServiceProvider.php`

```php
use Illuminate\Support\Facades\Event;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Microsoft\MicrosoftExtendSocialite;

public function boot(): void
{
    Vite::prefetch(concurrency: 3);

    Event::listen(SocialiteWasCalled::class, MicrosoftExtendSocialite::class);
}
```

## Stap 5 — Migratie

`database/migrations/xxxx_add_microsoft_login_to_users_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Entra ID object-id (oid): stabiele koppeling, ook als het
            // e-mailadres van de medewerker wijzigt.
            $table->string('microsoft_id')->nullable()->unique()->after('email');

            // Microsoft-gebruikers hebben geen lokaal wachtwoord.
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        // SQLite: unique index apart droppen vóór de kolom, anders faalt de rollback.
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['microsoft_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('microsoft_id');
            $table->string('password')->nullable(false)->change();
        });
    }
};
```

Vergeet niet `microsoft_id` toe te voegen aan de `#[Fillable]`-attribute op
`app/Models/User.php`:

```php
#[Fillable(['name', 'email', 'password', 'microsoft_id'])]
```

## Stap 6 — Controller

`app/Http/Controllers/Auth/MicrosoftAuthController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

/**
 * "Inloggen met Microsoft" (Entra ID, multi-tenant).
 *
 * Bewust minimaal gehouden zodat géén admin consent nodig is:
 * alleen self-consent scopes (openid/profile/User.Read), geen
 * directory- of application-permissies.
 */
class MicrosoftAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('microsoft')->redirect();
    }

    public function callback(Request $request): RedirectResponse
    {
        try {
            $msUser = Socialite::driver('microsoft')->user();
        } catch (Throwable $e) {
            report($e);

            return redirect()->route('login')->withErrors([
                'email' => 'Inloggen met Microsoft is niet gelukt. Probeer het opnieuw.',
            ]);
        }

        $email = strtolower($msUser->getEmail() ?? '');

        if ($email === '') {
            return redirect()->route('login')->withErrors([
                'email' => 'Je Microsoft-account heeft geen e-mailadres doorgegeven.',
            ]);
        }

        // Koppel op Entra object-id; val terug op e-mail voor bestaande
        // wachtwoord-accounts die overstappen op Microsoft-login.
        $user = User::query()->where('microsoft_id', $msUser->getId())->first()
            ?? User::query()->where('email', $email)->first();

        if ($user) {
            $user->fill([
                'microsoft_id' => $msUser->getId(),
                'name' => $user->name ?: $msUser->getName(),
            ]);
            $user->email_verified_at ??= now();
            $user->save();
        } else {
            $user = User::create([
                'name' => $msUser->getName() ?: $email,
                'email' => $email,
                'microsoft_id' => $msUser->getId(),
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
```

## Stap 7 — Routes in `routes/auth.php` (guest-groep)

```php
use App\Http\Controllers\Auth\MicrosoftAuthController;

Route::get('auth/microsoft/redirect', [MicrosoftAuthController::class, 'redirect'])
    ->name('microsoft.redirect');

Route::get('auth/microsoft/callback', [MicrosoftAuthController::class, 'callback'])
    ->name('microsoft.callback');
```

## Stap 8 — Frontend-knop

`resources/js/Components/MicrosoftLoginButton.jsx`:

```jsx
/**
 * "Inloggen met Microsoft" (Entra ID). Gewone <a> in plaats van een
 * Inertia-link: de OAuth-redirect moet een volledige page load zijn.
 */
export default function MicrosoftLoginButton() {
    return (
        <div className="mt-4">
            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">of</span>
                </div>
            </div>

            <a
                href={route('microsoft.redirect')}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
                <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Inloggen met Microsoft
            </a>
        </div>
    );
}
```

In `Login.jsx` en `Register.jsx`:

```jsx
import MicrosoftLoginButton from '@/Components/MicrosoftLoginButton';

// ... vlak vóór </GuestLayout>, ná </form>:
<MicrosoftLoginButton />
```

## Stap 9 — Activeren en verifiëren

```bash
./vendor/bin/sail artisan migrate
./vendor/bin/sail artisan config:clear
./vendor/bin/sail npm run build
./vendor/bin/sail artisan test
```

Snelle check zonder in te loggen — de redirect-URL moet naar
`login.microsoftonline.com/common/...` wijzen met alleen de minimale scopes:

```bash
curl -s -D - -o /dev/null http://localhost/auth/microsoft/redirect | grep -i "^location"
```

## Openstaande punten bij herinvoering

- **Profielpagina:** het "wachtwoord wijzigen"-formulier is niet van toepassing
  op Microsoft-gebruikers (zij hebben `password = null`) — verbergen als de
  ingelogde gebruiker een `microsoft_id` heeft.
- **Wachtwoord-login voor MS-accounts:** `Auth::attempt` faalt netjes op een
  `null`-wachtwoord, maar overweeg een duidelijke foutmelding ("dit account
  gebruikt Microsoft-login").
- **Credits:** besluit nog hoe nieuwe (Microsoft-)gebruikers minuten krijgen;
  nu geldt het standaard starttegoed (`AVATAR_DEFAULT_MINUTES`).
