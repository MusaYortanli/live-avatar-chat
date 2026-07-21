import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

export default function UserSessions({ account, sessions }) {
    return (
        <AuthenticatedLayout>
            <Head title={`Gesprekken van ${account.name}`} />

            <div className="mx-auto max-w-4xl px-6 py-9 sm:px-10">
                <Link
                    href={route('admin.users.index')}
                    className="text-[13px] text-primary hover:text-primary-dark hover:underline"
                >
                    &larr; Terug naar gebruikers
                </Link>

                <h1 className="mt-2 text-[26px] font-bold text-gray-900">
                    Gesprekken van {account.name}
                </h1>
                <p className="mt-1 text-[15px] text-gray-600">
                    {account.email}
                    {account.organization ? ` · ${account.organization}` : ''}
                </p>

                <p className="mt-4 rounded-sm bg-gray-100 p-3 text-[13px] leading-snug text-gray-600">
                    Transcripten worden live opgevraagd bij LiveAvatar en niet
                    op onze servers opgeslagen. Uitsluitend bedoeld voor
                    kwaliteitsverbetering van OBIZ Care.
                </p>

                <div className="mt-6 space-y-3">
                    {sessions.data.map((s) => (
                        <SessionCard key={s.id} session={s} />
                    ))}
                    {sessions.data.length === 0 && (
                        <p className="rounded-[14px] border border-[#E2E8E6] bg-surface px-5 py-8 text-center text-sm text-gray-500">
                            Deze gebruiker heeft nog geen gesprekken gevoerd.
                        </p>
                    )}
                </div>

                {sessions.last_page > 1 && (
                    <div className="mt-4 flex gap-1">
                        {sessions.links.map((link, i) =>
                            link.url ? (
                                <Link
                                    key={i}
                                    href={link.url}
                                    preserveScroll
                                    className={
                                        'rounded-md px-3 py-1.5 text-sm transition ' +
                                        (link.active
                                            ? 'bg-primary font-semibold text-white'
                                            : 'text-gray-700 hover:bg-gray-100')
                                    }
                                    dangerouslySetInnerHTML={{
                                        __html: link.label,
                                    }}
                                />
                            ) : (
                                <span
                                    key={i}
                                    className="rounded-md px-3 py-1.5 text-sm text-gray-300"
                                    dangerouslySetInnerHTML={{
                                        __html: link.label,
                                    }}
                                />
                            ),
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function SessionCard({ session }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [transcript, setTranscript] = useState(null);
    const [error, setError] = useState(null);

    const toggle = async () => {
        if (open) {
            setOpen(false);
            return;
        }

        setOpen(true);

        if (transcript || error) return;

        setLoading(true);
        try {
            const { data } = await axios.get(
                route('admin.sessions.transcript', session.id),
            );
            setTranscript(data.transcript);
        } catch (e) {
            setError(
                e.response?.data?.error ??
                    'Het transcript kon niet worden opgehaald.',
            );
        } finally {
            setLoading(false);
        }
    };

    const startedAt = new Date(session.started_at).toLocaleDateString(
        'nl-NL',
        {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        },
    );

    return (
        <div className="rounded-[14px] border border-[#E2E8E6] bg-surface">
            <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
                <div>
                    <span className="text-sm font-semibold text-gray-900">
                        {startedAt}
                    </span>
                    <span className="ms-3 text-[13px] text-gray-500">
                        {session.minutes_used} min
                        {session.status === 'active' ? ' · actief' : ''}
                    </span>
                </div>
                <span className="text-[13px] font-medium text-primary">
                    {open ? 'Verbergen' : 'Bekijk transcript'}
                </span>
            </button>

            {open && (
                <div className="border-t border-[#EEF2F0] px-5 py-4">
                    {loading && (
                        <p className="text-sm text-gray-500">
                            Transcript ophalen bij LiveAvatar…
                        </p>
                    )}

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    {transcript && transcript.length === 0 && (
                        <p className="text-sm text-gray-500">
                            Geen gespreksinhoud gevonden voor deze sessie.
                        </p>
                    )}

                    {transcript && transcript.length > 0 && (
                        <div className="max-h-96 space-y-3 overflow-y-auto">
                            {transcript.map((entry, i) => (
                                <div
                                    key={i}
                                    className={
                                        entry.role === 'avatar'
                                            ? 'me-8 rounded-lg bg-[#EEF5F3] px-3.5 py-2.5'
                                            : 'ms-8 rounded-lg bg-gray-100 px-3.5 py-2.5'
                                    }
                                >
                                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                        {entry.role === 'avatar'
                                            ? 'Avatar'
                                            : 'Gebruiker'}
                                    </span>
                                    <p className="mt-0.5 text-sm text-gray-800">
                                        {entry.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
