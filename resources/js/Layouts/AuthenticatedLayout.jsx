import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import MinutesBadge from '@/Components/MinutesBadge';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function AuthenticatedLayout({ header, children }) {
    const { auth, minutesRemaining } = usePage().props;
    const user = auth.user;

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    const initial = (user.name?.trim()[0] ?? '?').toUpperCase();

    return (
        <div className="min-h-screen bg-canvas">
            <nav className="border-b border-[#E2E8E6] bg-surface">
                <div className="flex items-center justify-between px-6 py-3.5">
                    <div className="flex items-center gap-8">
                        <Link
                            href={route('dashboard')}
                            className="flex items-center gap-2"
                        >
                            <ApplicationLogo className="h-[26px] w-[26px]" />
                            <span className="text-[15px] font-bold text-gray-900">
                                ObizCare
                            </span>
                        </Link>

                        <div className="hidden items-center gap-6 sm:flex">
                            <NavLink
                                href={route('dashboard')}
                                active={route().current('dashboard')}
                            >
                                Dashboard
                            </NavLink>
                            <NavLink
                                href={route('avatar.page')}
                                active={route().current('avatar.page')}
                            >
                                Gesprek
                            </NavLink>
                        </div>
                    </div>

                    <div className="hidden items-center gap-3 sm:flex">
                        {minutesRemaining !== null && (
                            <MinutesBadge minutes={minutesRemaining} />
                        )}

                        <Dropdown>
                            <Dropdown.Trigger>
                                <button
                                    type="button"
                                    className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gray-200 text-[13px] font-semibold text-gray-700 transition hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                    aria-label="Accountmenu"
                                >
                                    {initial}
                                </button>
                            </Dropdown.Trigger>

                            <Dropdown.Content>
                                <Dropdown.Link href={route('profile.edit')}>
                                    Profiel
                                </Dropdown.Link>
                                {user.is_admin && (
                                    <Dropdown.Link
                                        href={route('admin.users.index')}
                                    >
                                        Beheer
                                    </Dropdown.Link>
                                )}
                                <Dropdown.Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                >
                                    Uitloggen
                                </Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>

                    <div className="flex items-center gap-3 sm:hidden">
                        {minutesRemaining !== null && (
                            <MinutesBadge minutes={minutesRemaining} />
                        )}
                        <button
                            onClick={() =>
                                setShowingNavigationDropdown(
                                    (previousState) => !previousState,
                                )
                            }
                            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-500 focus:bg-gray-100 focus:text-gray-500 focus:outline-none"
                            aria-label="Menu"
                        >
                            <svg
                                className="h-6 w-6"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    className={
                                        !showingNavigationDropdown
                                            ? 'inline-flex'
                                            : 'hidden'
                                    }
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                                <path
                                    className={
                                        showingNavigationDropdown
                                            ? 'inline-flex'
                                            : 'hidden'
                                    }
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <div
                    className={
                        (showingNavigationDropdown ? 'block' : 'hidden') +
                        ' border-t border-[#E2E8E6] sm:hidden'
                    }
                >
                    <div className="space-y-1 pb-3 pt-2">
                        <ResponsiveNavLink
                            href={route('dashboard')}
                            active={route().current('dashboard')}
                        >
                            Dashboard
                        </ResponsiveNavLink>
                        <ResponsiveNavLink
                            href={route('avatar.page')}
                            active={route().current('avatar.page')}
                        >
                            Gesprek
                        </ResponsiveNavLink>
                    </div>

                    <div className="border-t border-gray-200 pb-1 pt-4">
                        <div className="px-4">
                            <div className="text-base font-semibold text-gray-800">
                                {user.name}
                            </div>
                            <div className="text-sm font-medium text-gray-500">
                                {user.email}
                            </div>
                        </div>

                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={route('profile.edit')}>
                                Profiel
                            </ResponsiveNavLink>
                            {user.is_admin && (
                                <ResponsiveNavLink
                                    href={route('admin.users.index')}
                                >
                                    Beheer
                                </ResponsiveNavLink>
                            )}
                            <ResponsiveNavLink
                                method="post"
                                href={route('logout')}
                                as="button"
                            >
                                Uitloggen
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {header && (
                <header className="px-6 pt-8 sm:px-10">{header}</header>
            )}

            <main>{children}</main>
        </div>
    );
}
