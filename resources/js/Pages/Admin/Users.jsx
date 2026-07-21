import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

function CreditCard({ label, value, detail, valueClassName = '' }) {
    return (
        <div className="rounded-[14px] border border-[#E2E8E6] bg-surface px-6 py-5">
            <div className="text-sm font-medium text-gray-600">{label}</div>
            <div
                className={
                    'mt-1.5 text-[26px] font-bold text-gray-900 ' +
                    valueClassName
                }
            >
                {value}
            </div>
            {detail && (
                <div className="mt-0.5 text-[13px] text-gray-500">{detail}</div>
            )}
        </div>
    );
}

function CreditOverview({ credits }) {
    const available = credits.minutes_available;
    const outstanding = credits.minutes_outstanding;
    const distributable = available !== null ? available - outstanding : null;

    return (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CreditCard
                label="Beschikbaar tegoed"
                value={available !== null ? `${available} min` : '—'}
                detail={
                    available !== null
                        ? `${credits.credits_left} credits (${credits.mode}-modus)`
                        : 'Tegoed kon niet worden opgehaald'
                }
            />
            <CreditCard
                label="Uitstaand bij gebruikers"
                value={`${outstanding} min`}
                detail="Totaal saldo van alle accounts"
            />
            <CreditCard
                label="Nog vrij te verdelen"
                value={distributable !== null ? `${distributable} min` : '—'}
                detail="Tegoed min uitstaand saldo"
                valueClassName={
                    distributable !== null && distributable < 0
                        ? '!text-red-600'
                        : ''
                }
            />
        </div>
    );
}

export default function Users({ users, zoek, credits }) {
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState(zoek ?? '');
    const firstRender = useRef(true);

    // Zoeken met korte vertraging, zodat niet elke toetsaanslag een request is
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(
                route('admin.users.index'),
                search ? { zoek: search } : {},
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);

        return () => clearTimeout(timeout);
    }, [search]);

    return (
        <AuthenticatedLayout>
            <Head title="Gebruikersbeheer" />

            <div className="mx-auto max-w-5xl px-6 py-9 sm:px-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-[26px] font-bold text-gray-900">
                            Gebruikers
                        </h1>
                        <p className="mt-1 text-[15px] text-gray-600">
                            {users.total}{' '}
                            {users.total === 1 ? 'account' : 'accounts'}. Beheer
                            minuten en maak nieuwe accounts aan.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowCreate((v) => !v)}
                        className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {showCreate ? 'Sluiten' : '+ Nieuwe gebruiker'}
                    </button>
                </div>

                <CreditOverview credits={credits} />

                {showCreate && (
                    <CreateUserCard onCreated={() => setShowCreate(false)} />
                )}

                <div className="mt-6">
                    <TextInput
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Zoek op naam, e-mailadres of organisatie…"
                        className="block w-full sm:max-w-sm"
                        aria-label="Zoek gebruikers"
                    />
                </div>

                <div className="mt-4 overflow-x-auto rounded-[14px] border border-[#E2E8E6] bg-surface">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8E6] text-[13px] text-gray-500">
                                <th className="px-5 py-3 font-medium">Naam</th>
                                <th className="px-5 py-3 font-medium">
                                    E-mailadres
                                </th>
                                <th className="px-5 py-3 font-medium">
                                    Organisatie
                                </th>
                                <th className="px-5 py-3 font-medium">
                                    Laatste sessie
                                </th>
                                <th className="px-5 py-3 font-medium">
                                    Huidige minuten
                                </th>
                                <th className="px-5 py-3 font-medium">
                                    Bijboeken
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.data.map((u) => (
                                <UserRow key={u.id} user={u} />
                            ))}
                            {users.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-5 py-8 text-center text-gray-500"
                                    >
                                        Geen gebruikers gevonden
                                        {zoek ? ` voor "${zoek}"` : ''}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination paginator={users} />
            </div>
        </AuthenticatedLayout>
    );
}

function Pagination({ paginator }) {
    if (paginator.last_page <= 1) return null;

    return (
        <div className="mt-4 flex items-center justify-between">
            <p className="text-[13px] text-gray-500">
                {paginator.from}-{paginator.to} van {paginator.total}
            </p>
            <div className="flex gap-1">
                {paginator.links.map((link, i) =>
                    link.url ? (
                        <Link
                            key={i}
                            href={link.url}
                            preserveScroll
                            preserveState
                            className={
                                'rounded-md px-3 py-1.5 text-sm transition ' +
                                (link.active
                                    ? 'bg-primary font-semibold text-white'
                                    : 'text-gray-700 hover:bg-gray-100')
                            }
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ) : (
                        <span
                            key={i}
                            className="rounded-md px-3 py-1.5 text-sm text-gray-300"
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ),
                )}
            </div>
        </div>
    );
}

function UserRow({ user }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        minutes: '',
    });

    const added = parseInt(data.minutes, 10);
    const newTotal = Number.isNaN(added)
        ? null
        : Math.max(0, user.minutes_remaining + added);

    const submit = (e) => {
        e.preventDefault();
        if (!data.minutes) return;

        post(route('admin.users.minutes', user.id), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <tr className="border-b border-[#EEF2F0] last:border-0">
            <td className="px-5 py-3.5 font-medium text-gray-900">
                <Link
                    href={route('admin.users.sessions', user.id)}
                    className="hover:text-primary hover:underline"
                    title={`Gesprekken van ${user.name} bekijken`}
                >
                    {user.name}
                </Link>
                {user.is_admin && (
                    <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        admin
                    </span>
                )}
            </td>
            <td className="px-5 py-3.5 text-gray-600">{user.email}</td>
            <td className="px-5 py-3.5 text-gray-600">
                {user.organization ?? '-'}
            </td>
            <td className="px-5 py-3.5 text-gray-600">
                {user.last_session_at
                    ? new Date(user.last_session_at).toLocaleDateString(
                          'nl-NL',
                          {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                          },
                      )
                    : 'Nog geen sessie'}
            </td>
            <td className="px-5 py-3.5 font-mono font-semibold text-gray-900">
                {user.minutes_remaining}
            </td>
            <td className="px-5 py-3.5">
                <form onSubmit={submit} className="flex items-center gap-2">
                    <input
                        type="number"
                        value={data.minutes}
                        onChange={(e) => setData('minutes', e.target.value)}
                        className="w-20 rounded-md border-gray-300 py-1.5 text-sm shadow-sm focus:border-primary focus:ring-primary"
                        aria-label={`Minuten bijboeken voor ${user.name}`}
                    />
                    <button
                        type="submit"
                        disabled={processing || !data.minutes}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                    >
                        +
                    </button>
                    {/* Vaste breedte zodat de tabel niet verspringt als de preview verschijnt */}
                    <span
                        className={
                            'inline-block w-[100px] whitespace-nowrap text-xs ' +
                            (errors.minutes ? 'text-red-600' : 'text-gray-500')
                        }
                    >
                        {errors.minutes ??
                            (newTotal !== null ? `wordt ${newTotal} min` : '')}
                    </span>
                </form>
            </td>
        </tr>
    );
}

function CreateUserCard({ onCreated }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        organization: '',
        password: '',
        minutes: 30,
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('admin.users.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onCreated();
            },
        });
    };

    return (
        <form
            onSubmit={submit}
            className="mt-6 rounded-[14px] border border-[#D8E6E2] bg-[#EEF5F3] px-7 py-6"
        >
            <h2 className="text-lg font-bold text-gray-900">
                Nieuwe gebruiker
            </h2>
            <p className="mt-1 text-sm text-gray-600">
                Kies een tijdelijk wachtwoord en geef het door aan de
                gebruiker; die kan het daarna zelf wijzigen via de
                profielpagina.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                    <InputLabel htmlFor="new-name" value="Naam" />
                    <TextInput
                        id="new-name"
                        value={data.name}
                        className="mt-1 block w-full"
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="new-email" value="E-mailadres" />
                    <TextInput
                        id="new-email"
                        type="email"
                        value={data.email}
                        className="mt-1 block w-full"
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <InputLabel
                        htmlFor="new-organization"
                        value="Organisatie (optioneel)"
                    />
                    <TextInput
                        id="new-organization"
                        value={data.organization}
                        className="mt-1 block w-full"
                        onChange={(e) =>
                            setData('organization', e.target.value)
                        }
                    />
                    <InputError
                        message={errors.organization}
                        className="mt-2"
                    />
                </div>

                <div>
                    <InputLabel
                        htmlFor="new-password"
                        value="Tijdelijk wachtwoord"
                    />
                    <TextInput
                        id="new-password"
                        type="text"
                        value={data.password}
                        className="mt-1 block w-full"
                        placeholder="Minimaal 10 tekens"
                        onChange={(e) => setData('password', e.target.value)}
                        required
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="new-minutes" value="Startminuten" />
                    <TextInput
                        id="new-minutes"
                        type="number"
                        value={data.minutes}
                        className="mt-1 block w-full"
                        onChange={(e) => setData('minutes', e.target.value)}
                        required
                    />
                    <InputError message={errors.minutes} className="mt-2" />
                </div>
            </div>

            <PrimaryButton className="mt-5" disabled={processing}>
                Account aanmaken
            </PrimaryButton>
        </form>
    );
}
