<?php

use App\Http\Controllers\AvatarSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Avatar routes
|--------------------------------------------------------------------------
| Include in routes/web.php:  require __DIR__.'/avatar.php';
| Alle routes achter auth — géén publieke avatar-toegang.
*/

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/avatar', [AvatarSessionController::class, 'page'])
        ->name('avatar.page');

    Route::post('/avatar/session', [AvatarSessionController::class, 'start'])
        ->name('avatar.session.start');

    Route::post('/avatar/session/{session}/heartbeat', [AvatarSessionController::class, 'heartbeat'])
        ->name('avatar.session.heartbeat');

    Route::post('/avatar/session/{session}/stop', [AvatarSessionController::class, 'stop'])
        ->name('avatar.session.stop');

    Route::post('/avatar/session/{session}/chat', [AvatarSessionController::class, 'chat'])
        ->middleware('throttle:20,1')
        ->name('avatar.session.chat');
});
