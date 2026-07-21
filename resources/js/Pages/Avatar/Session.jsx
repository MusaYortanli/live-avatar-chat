import { useEffect, useRef, useState, useCallback } from 'react';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import {
    LiveAvatarSession,
    SessionEvent,
    AgentEventsEnum,
    CommandEventsEnum,
} from '@heygen/liveavatar-web-sdk';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

const HEARTBEAT_INTERVAL_MS = 30_000;

export default function Session({ minutesRemaining, mode }) {
    const videoRef = useRef(null);
    const sessionRef = useRef(null);          // LiveAvatarSession instance
    const heartbeatRef = useRef(null);
    const tickRef = useRef(null);             // lokale 1s-aftelling tussen heartbeats
    const sessionIdRef = useRef(null);        // onze eigen avatar_sessions.id
    const startedAtRef = useRef(null);        // voor de sessieduur op de eindkaart
    const transcriptEndRef = useRef(null);

    const [status, setStatus] = useState('idle'); // idle | connecting | active | ended | error
    const [secondsRemaining, setSecondsRemaining] = useState(minutesRemaining * 60);
    const [exhausted, setExhausted] = useState(minutesRemaining <= 0);
    const [speaking, setSpeaking] = useState(false);
    const [duration, setDuration] = useState(0);
    const [transcript, setTranscript] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const addTranscript = (role, text) =>
        setTranscript((t) => [...t.slice(-30), { role, text }]);

    /* ---------------- Sessie beheer ---------------- */

    // SDK-workaround: repeat() weigert zolang start() intern hangt op de
    // sessie-websocket (die heeft geen onerror-afhandeling). Het datakanaal
    // van de videoverbinding accepteert hetzelfde spreekcommando wél.
    const speak = useCallback((text) => {
        const session = sessionRef.current;
        if (!session) return false;
        try {
            session.repeat(text);
            return true;
        } catch {
            try {
                session.publishAgentControl({
                    event_id: crypto.randomUUID(),
                    event_type: CommandEventsEnum.AVATAR_SPEAK_TEXT,
                    text,
                });
                return true;
            } catch {
                return false;
            }
        }
    }, []);

    const stopSession = useCallback(async (notifyBackend = true) => {
        clearInterval(heartbeatRef.current);
        clearInterval(tickRef.current);

        try {
            await sessionRef.current?.stop();
        } catch { /* al gesloten */ }
        // stop() weigert stilletjes als de sessie in "connecting" hangt —
        // verbreek dan de LiveKit-verbinding direct, anders lopen de
        // LiveAvatar-credits door tot de server zelf afbreekt.
        try {
            sessionRef.current?.room?.disconnect?.();
        } catch { /* al verbroken */ }
        sessionRef.current = null;

        if (notifyBackend && sessionIdRef.current) {
            try {
                await axios.post(`/avatar/session/${sessionIdRef.current}/stop`);
            } catch { /* backend cleanup vangt dit op */ }
        }

        sessionIdRef.current = null;
        setSpeaking(false);
        if (startedAtRef.current) {
            setDuration(Math.round((Date.now() - startedAtRef.current) / 1000));
        }
        setStatus('ended');
    }, []);

    const startSession = async () => {
        setError(null);
        setStatus('connecting');

        try {
            // 1. Poortwachter: token ophalen bij onze eigen backend.
            // De klik op "Ik begrijp het" op de disclaimerkaart ís de acceptatie.
            const { data } = await axios.post('/avatar/session', {
                disclaimer_accepted: true,
            });

            sessionIdRef.current = data.session_id;
            setSecondsRemaining(data.seconds_remaining);

            // 2. LiveAvatar sessie opzetten met het kortlevende token
            const session = new LiveAvatarSession(data.session_token, {
                voiceChat: mode === 'FULL', // LITE: tekst-input in MVP
            });
            sessionRef.current = session;

            session.on(SessionEvent.SESSION_STREAM_READY, () => {
                if (videoRef.current) {
                    session.attach(videoRef.current);
                    videoRef.current.muted = false;
                    videoRef.current.volume = 1.0;
                    videoRef.current.play().catch(() => {
                        addTranscript('system', 'Klik op de video om het geluid te activeren.');
                    });
                }
                startedAtRef.current = Date.now();
                setStatus('active');
            });

            session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
                addTranscript(
                    'system',
                    `De avatar-verbinding is gesloten (${reason ?? 'onbekende reden'}).`
                );
                stopSession(true);
            });

            // Transcripties tonen (FULL mode / voice)
            session.on(AgentEventsEnum.USER_TRANSCRIPTION, (e) =>
                addTranscript('user', e.text)
            );
            session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (e) =>
                addTranscript('assistant', e.text)
            );

            // "Avatar spreekt…"-indicator (handoff)
            session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () =>
                setSpeaking(true)
            );
            session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () =>
                setSpeaking(false)
            );

            // SDK-workaround: start() blijft eeuwig hangen als de interne
            // websocket niet opent. Na 15s gaan we door — spreken loopt dan
            // via het datakanaal (zie speak()).
            const startPromise = session.start().then(() => true);
            startPromise.catch(() => {}); // geen unhandled rejection na de race
            const fullyStarted = await Promise.race([
                startPromise,
                new Promise((resolve) => setTimeout(() => resolve(false), 15000)),
            ]);
            if (!fullyStarted) {
                addTranscript(
                    'system',
                    'De volledige verbinding kwam niet tot stand; antwoorden lopen via het reservekanaal.'
                );
            }

            // Begroeting: maakt meteen hoorbaar of de audio werkt
            if (mode === 'LITE') {
                const welcome =
                    'Welkom. Beschrijf je casus of stel je vraag, dan denk ik met je mee.';
                if (speak(welcome)) {
                    addTranscript('assistant', welcome);
                }
            }

            // 3. Heartbeat: elke 30s afrekenen bij onze backend
            heartbeatRef.current = setInterval(async () => {
                try {
                    const { data: hb } = await axios.post(
                        `/avatar/session/${sessionIdRef.current}/heartbeat`
                    );
                    setSecondsRemaining(hb.seconds_remaining);

                    if (hb.status === 'ended') {
                        setExhausted(true);
                        await stopSession(false);
                    }
                } catch {
                    await stopSession(false);
                }
            }, HEARTBEAT_INTERVAL_MS);

            // Lokale aftelling tussen de heartbeats door (server blijft leidend)
            tickRef.current = setInterval(() => {
                setSecondsRemaining((s) => Math.max(0, s - 1));
            }, 1000);
        } catch (e) {
            setError(
                e.response?.data?.error ??
                e.response?.data?.message ??
                'Kon de sessie niet starten.'
            );
            setStatus('error');
        }
    };

    // Cleanup bij unmount / tab sluiten
    useEffect(() => {
        const onUnload = () => stopSession(false);
        window.addEventListener('beforeunload', onUnload);
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            stopSession(false);
        };
    }, [stopSession]);

    // Transcript: automatisch naar het nieuwste bericht scrollen
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    /* ---------------- Tekst-input (LITE én FULL) ---------------- */

    const sendMessage = async (e) => {
        e.preventDefault();
        const message = input.trim();
        if (!message || busy || status !== 'active') return;

        setInput('');
        addTranscript('user', message);

        // FULL mode: tekst rechtstreeks naar de LiveAvatar-agent; die
        // genereert zelf het antwoord (komt terug via AVATAR_TRANSCRIPTION).
        if (mode === 'FULL') {
            try {
                sessionRef.current?.message(message);
            } catch {
                addTranscript(
                    'system',
                    'Het bericht kon niet worden verstuurd; de verbinding is mogelijk weggevallen.'
                );
            }
            return;
        }

        setBusy(true);

        try {
            // Eigen backend → Claude (MDR system prompt) → tekst
            const { data } = await axios.post(
                `/avatar/session/${sessionIdRef.current}/chat`,
                { message }
            );

            addTranscript('assistant', data.reply);

            // Avatar spreekt ONZE tekst letterlijk uit (LITE):
            if (!speak(data.reply)) {
                addTranscript(
                    'system',
                    'De avatar-verbinding is weggevallen, dus het antwoord kon niet worden ' +
                        'uitgesproken. Start een nieuwe sessie.'
                );
                await stopSession(true);
            }
        } catch {
            addTranscript('system', 'Het antwoord kon niet worden opgehaald bij de server.');
        } finally {
            setBusy(false);
        }
    };

    /* ---------------- UI ---------------- */

    const fmt = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60);
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${m}:${s}`;
    };

    const timerColor =
        secondsRemaining < 60
            ? 'text-error'
            : secondsRemaining < 300
              ? 'text-warning'
              : 'text-gray-800';

    const restart = () => {
        setTranscript([]);
        setDuration(0);
        startedAtRef.current = null;
        setStatus('idle');
    };

    return (
        <AuthenticatedLayout>
            <Head title="Gesprek" />

            <div className="px-4 py-6 sm:px-8">
                <div className="mx-auto max-w-6xl overflow-hidden rounded-[14px] border border-[#E2E8E6] bg-surface shadow-md">
                    {/* Sessie-topbar */}
                    <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8E6] px-5 py-3.5">
                        <h1 className="text-[17px] font-bold text-gray-900">
                            Gesprek
                        </h1>

                        <StatusBadge status={status} />

                        <div className="ms-auto flex items-center gap-3">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[13px] font-semibold tabular-nums ${timerColor}`}
                            >
                                ⏱ {fmt(secondsRemaining)} resterend
                            </span>

                            {status === 'active' && (
                                <button
                                    onClick={() => stopSession(true)}
                                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-error px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#8F1F19] focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
                                >
                                    ■ Stop gesprek
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_340px]">
                        {/* Videovlak */}
                        <div
                            className="relative min-h-[430px] overflow-hidden bg-[#122523]"
                            style={
                                status === 'active'
                                    ? {
                                          background:
                                              'radial-gradient(circle at 50% 35%, #24443F 0%, #122523 75%)',
                                      }
                                    : undefined
                            }
                        >
                            {/* scale zoomt in zodat de avatar dichterbij lijkt; de randen vallen buiten het kader */}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="absolute inset-0 h-full w-full scale-125 object-cover"
                            />

                            {speaking && status === 'active' && (
                                <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-[#8EE6CF]">
                                    <span className="h-[7px] w-[7px] rounded-full bg-[#4FD1B5] animate-dot-pulse-fast" />
                                    Avatar spreekt…
                                </div>
                            )}

                            {status === 'idle' &&
                                (exhausted ? (
                                    <ExhaustedCard />
                                ) : (
                                    <DisclaimerCard onStart={startSession} />
                                ))}

                            {status === 'connecting' && <ConnectingCard />}

                            {status === 'ended' &&
                                (exhausted ? (
                                    <ExhaustedCard />
                                ) : (
                                    <EndedCard
                                        duration={duration}
                                        onRestart={restart}
                                    />
                                ))}

                            {status === 'error' && (
                                <ErrorCard
                                    message={error}
                                    onRetry={() => setStatus('idle')}
                                />
                            )}
                        </div>

                        {/* Transcript */}
                        <aside className="flex max-h-[560px] flex-col border-t border-[#E2E8E6] bg-gray-50 lg:border-s lg:border-t-0">
                            <h2 className="px-4 pb-2 pt-4 text-[13px] font-bold text-gray-900">
                                Transcript
                            </h2>

                            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
                                {transcript.map((m, i) => (
                                    <TranscriptMessage key={i} message={m} />
                                ))}
                                <div ref={transcriptEndRef} />
                            </div>

                            <form
                                onSubmit={sendMessage}
                                className="flex gap-2 border-t border-[#E2E8E6] p-3"
                            >
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={
                                        mode === 'FULL'
                                            ? 'Typ je vraag (praten kan ook)…'
                                            : 'Beschrijf je casus of stel je vraag…'
                                    }
                                    className="min-w-0 flex-1 rounded-[10px] border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary"
                                    disabled={busy || status !== 'active'}
                                />
                                <button
                                    type="submit"
                                    disabled={busy || status !== 'active'}
                                    aria-label="Verstuur"
                                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-primary text-white transition hover:bg-primary-dark disabled:opacity-40"
                                >
                                    {busy ? '…' : '➤'}
                                </button>
                            </form>
                        </aside>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

/* ---------------- Presentatie-componenten (handoff) ---------------- */

function StatusBadge({ status }) {
    const variants = {
        active: {
            label: 'Actief',
            classes: 'bg-success-soft text-success',
            dot: 'bg-success animate-dot-pulse',
        },
        connecting: {
            label: 'Verbinden',
            classes: 'bg-info-soft text-info',
            dot: 'bg-info animate-dot-pulse',
        },
        error: {
            label: 'Fout',
            classes: 'bg-error-soft text-error',
            dot: 'bg-error',
        },
    };

    const variant = variants[status];
    if (!variant) return null;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${variant.classes}`}
        >
            <span className={`h-[7px] w-[7px] rounded-full ${variant.dot}`} />
            {variant.label}
        </span>
    );
}

function OverlayCard({ children }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
            <div className="w-full max-w-md rounded-[14px] bg-surface p-7 shadow-lg">
                {children}
            </div>
        </div>
    );
}

/**
 * MDR-verplichte disclaimer vóór elke sessiestart; de klik op de knop
 * geldt als acceptatie en wordt server-side gelogd op de sessie.
 */
function DisclaimerCard({ onStart }) {
    return (
        <OverlayCard>
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF5F3] text-lg">
                    🛡
                </span>
                <h3 className="text-[17px] font-bold text-gray-900">
                    Voordat je begint
                </h3>
            </div>

            <p className="mt-4 text-sm leading-[1.55] text-gray-700">
                ObizCare ondersteunt je bij <strong>communicatie</strong> in
                cultuursensitieve situaties. De avatar helpt je door vragen te
                stellen, perspectieven te verkennen en praktische
                communicatieadviezen te bieden. De avatar geeft{' '}
                <strong>géén medisch advies</strong>, geen diagnoses en geen
                behandelinformatie. Twijfel je over medische zaken? Overleg dan
                altijd met een collega of behandelaar.
            </p>

            <p className="mt-4 rounded-sm bg-gray-100 p-3 text-[13px] leading-snug text-gray-600">
                <strong>Voer geen herleidbare patiëntgegevens in</strong>{' '}
                (zoals namen of geboortedata). Gesprekken kunnen door OBIZ
                Care worden teruggelezen, uitsluitend voor kwaliteitsverbetering
                van de avatar.
            </p>

            <button
                onClick={onStart}
                className="mt-5 w-full rounded-[10px] bg-primary px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
                Ik begrijp het, start het gesprek
            </button>
        </OverlayCard>
    );
}

function ConnectingCard() {
    return (
        <OverlayCard>
            <div className="flex flex-col items-center py-2 text-center">
                <div className="h-11 w-11 animate-spin rounded-full border-4 border-gray-200 border-t-[#4FD1B5]" />
                <p className="mt-4 text-[15px] font-semibold text-gray-900">
                    Verbinden met de avatar…
                </p>
                <p className="mt-1 text-[13px] text-gray-600">
                    Dit duurt meestal een paar seconden
                </p>
            </div>
        </OverlayCard>
    );
}

function EndedCard({ duration, onRestart }) {
    const m = Math.floor(duration / 60);
    const s = String(duration % 60).padStart(2, '0');

    return (
        <OverlayCard>
            <div className="flex flex-col items-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-lg font-bold text-success">
                    ✓
                </span>
                <h3 className="mt-3 text-[17px] font-bold text-gray-900">
                    Sessie beëindigd
                </h3>
                {duration > 0 && (
                    <p className="mt-1 text-sm text-gray-600">
                        Gespreksduur: {m}:{s} minuten
                    </p>
                )}

                <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
                    <button
                        onClick={onRestart}
                        className="flex-1 rounded-[10px] bg-primary px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Nieuw gesprek
                    </button>
                    <Link
                        href={route('dashboard')}
                        className="flex-1 rounded-[10px] border border-gray-300 px-4 py-2.5 text-center text-[15px] font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Naar dashboard
                    </Link>
                </div>
            </div>
        </OverlayCard>
    );
}

function ErrorCard({ message, onRetry }) {
    return (
        <OverlayCard>
            <div className="flex flex-col items-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error-soft text-lg font-bold text-error">
                    !
                </span>
                <h3 className="mt-3 text-[17px] font-bold text-gray-900">
                    De verbinding is verbroken
                </h3>
                {message && (
                    <p className="mt-1 text-sm text-gray-600">{message}</p>
                )}
                <p className="mt-1 text-[13px] text-gray-600">
                    Je tegoed loopt niet door.
                </p>

                <button
                    onClick={onRetry}
                    className="mt-5 w-full rounded-[10px] bg-primary px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Opnieuw verbinden
                </button>
            </div>
        </OverlayCard>
    );
}

function ExhaustedCard() {
    return (
        <OverlayCard>
            <div className="flex flex-col items-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-soft text-lg">
                    ⏱
                </span>
                <h3 className="mt-3 text-[17px] font-bold text-gray-900">
                    Je minutentegoed is op
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                    Het gesprek is netjes afgerond en het transcript is
                    bewaard. Vraag nieuw tegoed aan via je organisatie.
                </p>

                <Link
                    href={route('dashboard')}
                    className="mt-5 w-full rounded-[10px] bg-primary px-4 py-2.5 text-center text-[15px] font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Naar dashboard
                </Link>
            </div>
        </OverlayCard>
    );
}

function TranscriptMessage({ message }) {
    if (message.role === 'system') {
        return (
            <p className="mx-auto max-w-[92%] rounded-sm bg-gray-100 px-3 py-1.5 text-center text-xs text-gray-500">
                {message.text}
            </p>
        );
    }

    if (message.role === 'assistant') {
        return (
            <div className="max-w-[92%]">
                <p className="mb-0.5 text-[11px] font-bold text-primary">
                    Avatar
                </p>
                <p className="rounded-[10px] rounded-bl-[3px] bg-[#EEF5F3] px-3 py-2 text-[13.5px] leading-[1.5] text-gray-800">
                    {message.text}
                </p>
            </div>
        );
    }

    return (
        <div className="ms-auto flex max-w-[92%] flex-col items-end">
            <p className="mb-0.5 text-[11px] font-bold text-gray-500">Jij</p>
            <p className="rounded-[10px] rounded-br-[3px] bg-primary px-3 py-2 text-[13.5px] leading-[1.5] text-white">
                {message.text}
            </p>
        </div>
    );
}
