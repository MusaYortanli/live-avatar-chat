<?php

namespace App\Http\Controllers;

use App\Models\AvatarSession;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $sessions = AvatarSession::where('user_id', $request->user()->id);

        return Inertia::render('Dashboard', [
            'stats' => [
                'totalSessions' => (clone $sessions)->count(),
                'minutesPracticed' => (int) floor((clone $sessions)->sum('seconds_used') / 60),
                'lastSessionAt' => (clone $sessions)->latest('started_at')->value('started_at')?->toIso8601String(),
            ],
        ]);
    }
}
