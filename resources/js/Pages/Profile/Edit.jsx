import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ mustVerifyEmail, status }) {
    return (
        <AuthenticatedLayout>
            <Head title="Profiel" />

            <div className="mx-auto max-w-3xl space-y-6 px-6 py-9 sm:px-10">
                <h1 className="text-xl font-bold text-gray-900">Profiel</h1>

                <div className="rounded-md border border-[#E2E8E6] bg-surface p-6 shadow-sm sm:p-8">
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                    />
                </div>

                <div className="rounded-md border border-[#E2E8E6] bg-surface p-6 shadow-sm sm:p-8">
                    <UpdatePasswordForm />
                </div>

                <DeleteUserForm />
            </div>
        </AuthenticatedLayout>
    );
}
