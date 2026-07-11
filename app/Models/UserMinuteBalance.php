<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserMinuteBalance extends Model
{
    protected $guarded = [];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function forUser(int $userId): self
    {
        return static::firstOrCreate(
            ['user_id' => $userId],
            ['seconds_remaining' => config('liveavatar.default_minutes') * 60],
        );
    }

    public function minutesRemaining(): int
    {
        return (int) floor($this->seconds_remaining / 60);
    }
}
