/**
 * ObizCare-logo "stemgolven" (handoff optie 2d): cirkel in primary
 * met drie witte verticale golfbalkjes.
 */
export default function ApplicationLogo(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 42 42"
        >
            <circle cx="21" cy="21" r="17" fill="#0E7569" />
            <rect x="12" y="17" width="3.5" height="8" rx="1.75" fill="#fff" />
            <rect x="19.2" y="12" width="3.5" height="18" rx="1.75" fill="#fff" />
            <rect x="26.4" y="15" width="3.5" height="12" rx="1.75" fill="#fff" />
        </svg>
    );
}
