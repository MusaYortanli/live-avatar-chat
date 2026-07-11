import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';

export default function DeleteUserForm({ className = '' }) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        clearErrors();
        reset();
    };

    return (
        <section
            className={
                `space-y-4 rounded-md border border-[#F3D2D0] bg-[#FDF6F6] p-6 sm:p-8 ` +
                className
            }
        >
            <header>
                <h2 className="text-sm font-bold text-[#8F1F19]">
                    Account verwijderen
                </h2>

                <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
                    Als je je account verwijdert, worden al je gegevens
                    definitief gewist — ook je resterende minutentegoed en je
                    transcripten. Dit kan niet ongedaan worden gemaakt.
                </p>
            </header>

            <button
                onClick={confirmUserDeletion}
                className="inline-flex items-center justify-center rounded-[10px] border border-error bg-transparent px-5 py-2 text-sm font-semibold text-error transition hover:bg-error-soft focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
            >
                Verwijderen…
            </button>

            <Modal show={confirmingUserDeletion} onClose={closeModal}>
                <form onSubmit={deleteUser} className="p-7">
                    <h2 className="text-[17px] font-bold text-gray-900">
                        Weet je zeker dat je je account wilt verwijderen?
                    </h2>

                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                        Al je gegevens worden definitief gewist. Vul ter
                        bevestiging je wachtwoord in.
                    </p>

                    <div className="mt-5">
                        <InputLabel
                            htmlFor="password"
                            value="Wachtwoord"
                            className="sr-only"
                        />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            className="mt-1 block w-full sm:w-3/4"
                            isFocused
                            placeholder="Wachtwoord"
                        />

                        <InputError
                            message={errors.password}
                            className="mt-2"
                        />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={closeModal}>
                            Annuleren
                        </SecondaryButton>

                        <DangerButton disabled={processing}>
                            Account verwijderen
                        </DangerButton>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
