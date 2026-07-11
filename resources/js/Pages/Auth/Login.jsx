import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Inloggen" />

            {status && (
                <div className="mb-4 text-sm font-semibold text-success">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="email" value="E-mailadres" />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full"
                        autoComplete="username"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                    />

                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="password" value="Wachtwoord" />

                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full"
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-4 block">
                    <label className="flex items-center">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) =>
                                setData('remember', e.target.checked)
                            }
                        />
                        <span className="ms-2 text-sm text-gray-600">
                            Ingelogd blijven
                        </span>
                    </label>
                </div>

                <PrimaryButton className="mt-6 w-full" disabled={processing}>
                    Inloggen
                </PrimaryButton>

                <div className="mt-4 flex items-center justify-between text-[13px]">
                    {canResetPassword ? (
                        <Link
                            href={route('password.request')}
                            className="rounded-md text-primary hover:text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            Wachtwoord vergeten?
                        </Link>
                    ) : (
                        <span />
                    )}

                    <Link
                        href={route('register')}
                        className="rounded-md text-primary hover:text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Account aanmaken
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
