<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MinuteTransaction;
use App\Models\User;
use App\Models\UserMinuteBalance;
use App\Services\LiveAvatarService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    public function __construct(private LiveAvatarService $liveAvatar)
    {
    }

    /**
     * Overzicht: alle gebruikers met resterende minuten en laatste sessie.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('zoek', ''));

        // Tegoed bij LiveAvatar: FULL kost 2 credits per minuut, LITE 1.
        $creditsLeft = $this->liveAvatar->creditsLeft();
        $creditsPerMinute = config('liveavatar.mode') === 'FULL' ? 2 : 1;
        $outstandingSeconds = (int) UserMinuteBalance::sum('seconds_remaining');

        $users = User::query()
            ->leftJoin('user_minute_balances', 'users.id', '=', 'user_minute_balances.user_id')
            ->leftJoin('avatar_sessions', function ($join) {
                $join->on('avatar_sessions.id', '=', DB::raw(
                    '(select id from avatar_sessions where avatar_sessions.user_id = users.id order by started_at desc limit 1)'
                ));
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('users.name', 'like', "%{$search}%")
                        ->orWhere('users.email', 'like', "%{$search}%")
                        ->orWhere('users.organization', 'like', "%{$search}%");
                });
            })
            ->orderBy('users.name')
            ->select([
                'users.id',
                'users.name',
                'users.email',
                'users.organization',
                'users.is_admin',
                DB::raw('coalesce(user_minute_balances.seconds_remaining, 0) as seconds_remaining'),
                'avatar_sessions.started_at as last_session_at',
            ])
            ->paginate(10)
            ->withQueryString()
            ->through(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'organization' => $u->organization,
                'is_admin' => (bool) $u->is_admin,
                'minutes_remaining' => (int) floor($u->seconds_remaining / 60),
                'last_session_at' => $u->last_session_at,
            ]);

        return Inertia::render('Admin/Users', [
            'users' => $users,
            'zoek' => $search,
            'credits' => [
                'credits_left' => $creditsLeft,
                'mode' => config('liveavatar.mode'),
                'minutes_available' => $creditsLeft !== null
                    ? intdiv($creditsLeft, $creditsPerMinute)
                    : null,
                'minutes_outstanding' => intdiv($outstandingSeconds, 60),
            ],
        ]);
    }

    /**
     * Nieuwe gebruiker aanmaken (registratie is dicht: alleen de admin
     * maakt accounts). De admin kiest het wachtwoord en geeft het door;
     * de gebruiker kan het zelf wijzigen op de profielpagina.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:users,email',
            'organization' => 'nullable|string|max:255',
            'password' => ['required', Password::defaults()],
            'minutes' => 'required|integer|min:0|max:10000',
        ]);

        DB::transaction(function () use ($validated, $request) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'organization' => $validated['organization'] ?? null,
                'password' => $validated['password'],
            ]);

            // Direct geverifieerd: het adres is door de admin ingevoerd.
            $user->forceFill(['email_verified_at' => now()])->save();

            UserMinuteBalance::create([
                'user_id' => $user->id,
                'seconds_remaining' => $validated['minutes'] * 60,
            ]);

            if ($validated['minutes'] > 0) {
                MinuteTransaction::create([
                    'user_id' => $user->id,
                    'created_by' => $request->user()->id,
                    'seconds' => $validated['minutes'] * 60,
                    'reason' => 'Startminuten bij aanmaken account',
                ]);
            }
        });

        return back()->with('success', 'Account aangemaakt.');
    }

    /**
     * Gesprekgeschiedenis van één gebruiker: sessieoverzicht met per sessie
     * de mogelijkheid het transcript live bij LiveAvatar op te vragen.
     * Wij slaan zelf geen gespreksinhoud op (optie B / dataminimalisatie).
     */
    public function sessions(User $user): Response
    {
        $sessions = $user->avatarSessions()
            ->orderByDesc('started_at')
            ->paginate(10)
            ->through(fn ($s) => [
                'id' => $s->id,
                'started_at' => $s->started_at,
                'minutes_used' => (int) round($s->seconds_used / 60),
                'status' => $s->status,
                'disclaimer_accepted' => $s->disclaimer_accepted,
                'has_transcript' => (bool) $s->liveavatar_session_id,
            ]);

        return Inertia::render('Admin/UserSessions', [
            'account' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'organization' => $user->organization,
            ],
            'sessions' => $sessions,
        ]);
    }

    /**
     * Transcript van één sessie, live opgehaald bij LiveAvatar.
     */
    public function transcript(\App\Models\AvatarSession $session): \Illuminate\Http\JsonResponse
    {
        if (! $session->liveavatar_session_id) {
            return response()->json([
                'error' => 'Van deze sessie is geen transcript beschikbaar (gestart vóór deze functie bestond).',
            ], 404);
        }

        $transcript = $this->liveAvatar->getTranscript($session->liveavatar_session_id);

        if ($transcript === null) {
            return response()->json([
                'error' => 'Het transcript is niet (meer) beschikbaar bij LiveAvatar.',
            ], 404);
        }

        return response()->json(['transcript' => $transcript]);
    }

    /**
     * Minuten bijboeken (of corrigeren met een negatief aantal).
     */
    public function addMinutes(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'minutes' => 'required|integer|min:-10000|max:10000|not_in:0',
        ]);

        DB::transaction(function () use ($validated, $request, $user) {
            $balance = UserMinuteBalance::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first() ?? UserMinuteBalance::forUser($user->id);

            $balance->seconds_remaining = max(
                0,
                $balance->seconds_remaining + $validated['minutes'] * 60
            );
            $balance->save();

            MinuteTransaction::create([
                'user_id' => $user->id,
                'created_by' => $request->user()->id,
                'seconds' => $validated['minutes'] * 60,
                'reason' => $validated['minutes'] > 0
                    ? 'Bijgeboekt door admin'
                    : 'Correctie door admin',
            ]);
        });

        return back()->with('success', 'Minuten bijgewerkt.');
    }
}
