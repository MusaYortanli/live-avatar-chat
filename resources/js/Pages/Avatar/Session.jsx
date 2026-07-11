import { useEffect, useRef, useState, useCallback } from 'react';
import { Head } from '@inertiajs/react';
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
    const sessionIdRef = useRef(null);        // onze eigen avatar_sessions.id

    const [status, setStatus] = useState('idle'); // idle | connecting | active | ended | error
    const [secondsRemaining, setSecondsRemaining] = useState(minutesRemaining * 60);
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
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
        setStatus('ended');
    }, []);

    const startSession = async () => {
        setError(null);
        setStatus('connecting');

        try {
            // 1. Poortwachter: token ophalen bij onze eigen backend
            const { data } = await axios.post('/avatar/session', {
                disclaimer_accepted: disclaimerAccepted,
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
                        addTranscript('system', 'Je minuten zijn op. De sessie is beëindigd.');
                        await stopSession(false);
                    }
                } catch {
                    await stopSession(false);
                }
            }, HEARTBEAT_INTERVAL_MS);
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

    const mins = Math.floor(secondsRemaining / 60);
    const secs = String(secondsRemaining % 60).padStart(2, '0');

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">Gespreksassistent</h2>}
        >
            <Head title="Gespreksassistent" />

            <div className="mx-auto max-w-4xl space-y-4 p-4">
                {/* Minutenteller */}
                <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow">
                    <span className="text-sm text-gray-600">Resterende tijd</span>
                    <span
                        className={`font-mono text-lg font-bold ${
                            secondsRemaining < 120 ? 'text-red-600' : 'text-gray-900'
                        }`}
                    >
                        {mins}:{secs}
                    </span>
                </div>

                {/* Video */}
                <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-900 shadow">
                    {/* scale zoomt in zodat de avatar dichterbij lijkt; de randen vallen buiten het kader */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="h-full w-full scale-125 object-cover"
                    />

                    {status === 'idle' && (
                        <DisclaimerOverlay
                            accepted={disclaimerAccepted}
                            onAccept={setDisclaimerAccepted}
                            onStart={startSession}
                        />
                    )}

                    {status === 'connecting' && (
                        <Overlay>Verbinden met de assistent…</Overlay>
                    )}

                    {status === 'ended' && (
                        <Overlay>
                            <p className="mb-3">De sessie is beëindigd.</p>
                            <button
                                onClick={() => { setStatus('idle'); setTranscript([]); }}
                                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
                            >
                                Nieuwe sessie
                            </button>
                        </Overlay>
                    )}

                    {status === 'error' && (
                        <Overlay>
                            <p className="mb-3 text-red-300">{error}</p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
                            >
                                Opnieuw proberen
                            </button>
                        </Overlay>
                    )}
                </div>

                {/* Transcript */}
                {transcript.length > 0 && (
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg bg-white p-4 text-sm shadow">
                        {transcript.map((m, i) => (
                            <p key={i}>
                                <span className="font-semibold">
                                    {m.role === 'user' ? 'Jij: ' : m.role === 'assistant' ? 'Assistent: ' : ''}
                                </span>
                                <span className={m.role === 'system' ? 'italic text-gray-500' : ''}>
                                    {m.text}
                                </span>
                            </p>
                        ))}
                    </div>
                )}

                {/* Tekst-input + stopknop */}
                {status === 'active' && (
                    <div className="flex gap-2">
                        <form onSubmit={sendMessage} className="flex flex-1 gap-2">
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={
                                        mode === 'FULL'
                                            ? 'Typ je vraag (praten kan ook)…'
                                            : 'Beschrijf je casus of stel je vraag…'
                                    }
                                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    disabled={busy}
                                />
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    {busy ? '…' : 'Verstuur'}
                                </button>
                            </form>
                        <button
                            onClick={() => stopSession(true)}
                            className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300"
                        >
                            Stop sessie
                        </button>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function Overlay({ children }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 p-6 text-center text-white">
            {children}
        </div>
    );
}

/**
 * MDR-verplichte disclaimer vóór elke sessiestart.
 * Acceptatie wordt server-side gelogd op de sessie.
 */
function DisclaimerOverlay({ accepted, onAccept, onStart }) {
    return (
        <Overlay>
            <div className="max-w-md space-y-4">
                <h3 className="text-lg font-semibold">Voordat je begint</h3>
                <p className="text-sm text-gray-200">
                    Deze tool ondersteunt communicatie en reflectie en vervangt geen
                    medisch oordeel of klinische besluitvorming. Voer geen herleidbare
                    patiëntgegevens in.
                </p>
                <label className="flex items-start gap-2 text-left text-sm">
                    <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => onAccept(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300"
                    />
                    <span>Ik begrijp dit en ga akkoord.</span>
                </label>
                <button
                    onClick={onStart}
                    disabled={!accepted}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Start gesprek
                </button>
            </div>
        </Overlay>
    );
}
