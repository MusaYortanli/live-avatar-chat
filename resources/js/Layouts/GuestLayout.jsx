import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-8">
            <div className="w-full max-w-[340px] rounded-md border border-[#E2E8E6] bg-surface p-8 shadow-sm">
                <div className="mb-6 flex flex-col items-center text-center">
                    <Link href="/" className="flex items-center gap-2">
                        <ApplicationLogo className="h-[34px] w-[34px]" />
                        <span className="text-[19px] font-bold text-gray-900">
                            ObizCare
                        </span>
                    </Link>
                    <p className="mt-2 text-sm text-gray-600">
                        Ontvang praktische ondersteuning bij complexe
                        vraagstukken in de zorg.
                    </p>
                </div>

                {children}
            </div>
        </div>
    );
}
