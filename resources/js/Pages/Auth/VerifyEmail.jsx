import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="E-mailadres bevestigen" />

            <div className="mb-4 text-sm leading-relaxed text-gray-600">
                Bedankt voor je aanmelding! Bevestig eerst je e-mailadres via
                de link die we je zojuist hebben gemaild. Geen e-mail
                ontvangen? Dan sturen we je graag een nieuwe.
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-sm font-semibold text-success">
                    Er is een nieuwe bevestigingslink verstuurd naar het
                    e-mailadres dat je bij je registratie hebt opgegeven.
                </div>
            )}

            <form onSubmit={submit}>
                <PrimaryButton className="w-full" disabled={processing}>
                    Verstuur bevestigingsmail opnieuw
                </PrimaryButton>

                <div className="mt-4 text-center text-[13px]">
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="rounded-md text-primary hover:text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Uitloggen
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
