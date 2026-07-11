<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Vangnet: sessies zonder heartbeat afsluiten en afrekenen
Schedule::command('avatar:close-stale-sessions')->everyMinute();
