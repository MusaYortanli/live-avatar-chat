import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

function StatCard({ label, value, detail }) {
    return (
        <div className="rounded-[14px] border border-[#E2E8E6] bg-surface px-6 py-5">
            <div className="text-sm font-medium text-gray-600">{label}</div>
            <div className="mt-1.5 text-[26px] font-bold text-gray-900">
                {value}
            </div>
            {detail && (
                <div className="mt-0.5 text-[13px] text-gray-500">{detail}</div>
            )}
        </div>
    );
}

export default function Dashboard({ stats }) {
    const { auth, minutesRemaining } = usePage().props;
    const firstName = auth.user.name?.trim().split(' ')[0] ?? '';

    const lastSession = stats.lastSessionAt
        ? new Date(stats.lastSessionAt).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
          })
        : null;

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="mx-auto max-w-3xl px-6 py-9 sm:px-10">
                <h1 className="text-[26px] font-bold text-gray-900">
                    Welkom terug, {firstName}
                </h1>
                <p className="mt-1 text-[15px] text-gray-600">
                    {minutesRemaining !== null
                        ? `Je hebt nog ${minutesRemaining} minuten gesprekstegoed.`
                        : 'Start wanneer het jou uitkomt.'}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Beschikbare minuten"
                        value={minutesRemaining ?? '—'}
                    />
                    <StatCard
                        label="Gesprekken gevoerd"
                        value={stats.totalSessions}
                        detail={
                            lastSession ? `Laatste op ${lastSession}` : null
                        }
                    />
                    <StatCard
                        label="Minuten gesproken"
                        value={stats.minutesPracticed}
                    />
                </div>

                <div className="mt-6 flex flex-col gap-5 rounded-[14px] border border-[#D8E6E2] bg-[#EEF5F3] px-7 py-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            Start een gesprek
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Stel je vraag of bespreek een situatie uit de
                            praktijk. De avatar helpt je om perspectieven te
                            verkennen en passende communicatiekeuzes te maken.
                        </p>
                    </div>
                    <Link
                        href={route('avatar.page')}
                        className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-[26px] py-3.5 text-base font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Start een gesprek
                    </Link>
                </div>

                <p className="mt-10 text-[13px] text-gray-600">
                    ObizCare geeft communicatieadvies, geen medisch advies.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}
