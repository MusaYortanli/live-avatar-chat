import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Wachtwoord vergeten" />

            <div className="mb-4 text-sm leading-relaxed text-gray-600">
                Wachtwoord vergeten? Geen probleem. Vul je e-mailadres in en we
                sturen je een link waarmee je een nieuw wachtwoord kunt
                instellen.
            </div>

            {status && (
                <div className="mb-4 text-sm font-semibold text-success">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>
                <InputLabel htmlFor="email" value="E-mailadres" />

                <TextInput
                    id="email"
                    type="email"
                    name="email"
                    value={data.email}
                    className="mt-1 block w-full"
                    isFocused={true}
                    onChange={(e) => setData('email', e.target.value)}
                />

                <InputError message={errors.email} className="mt-2" />

                <PrimaryButton className="mt-6 w-full" disabled={processing}>
                    Verstuur herstellink
                </PrimaryButton>

                <div className="mt-4 text-center text-[13px]">
                    <Link
                        href={route('login')}
                        className="rounded-md text-primary hover:text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Terug naar inloggen
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
