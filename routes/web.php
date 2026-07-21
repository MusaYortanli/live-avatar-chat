<?php

use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

// Geen aparte landingspagina in de MVP: direct naar inloggen of dashboard
Route::get('/', function () {
    return redirect()->route(auth()->check() ? 'dashboard' : 'login');
});

Route::get('/dashboard', DashboardController::class)
    ->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/gebruikers', [UserManagementController::class, 'index'])->name('users.index');
    Route::post('/gebruikers', [UserManagementController::class, 'store'])->name('users.store');
    Route::post('/gebruikers/{user}/minuten', [UserManagementController::class, 'addMinutes'])->name('users.minutes');
    Route::get('/gebruikers/{user}/gesprekken', [UserManagementController::class, 'sessions'])->name('users.sessions');
    Route::get('/sessies/{session}/transcript', [UserManagementController::class, 'transcript'])->name('sessions.transcript');
});

require __DIR__.'/auth.php';
require __DIR__.'/avatar.php';
