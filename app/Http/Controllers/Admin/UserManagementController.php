<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MinuteTransaction;
use App\Models\User;
use App\Models\UserMinuteBalance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    /**
     * Overzicht: alle gebruikers met resterende minuten en laatste sessie.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('zoek', ''));

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
                        ->orWhere('users.email', 'like', "%{$search}%");
                });
            })
            ->orderBy('users.name')
            ->select([
                'users.id',
                'users.name',
                'users.email',
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
                'is_admin' => (bool) $u->is_admin,
                'minutes_remaining' => (int) floor($u->seconds_remaining / 60),
                'last_session_at' => $u->last_session_at,
            ]);

        return Inertia::render('Admin/Users', [
            'users' => $users,
            'zoek' => $search,
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
            'password' => ['required', Password::defaults()],
            'minutes' => 'required|integer|min:0|max:10000',
        ]);

        DB::transaction(function () use ($validated, $request) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
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
