/**
 * Minutenbadge (handoff): pill die op elk scherm terugkomt.
 * Normaal: success-soft; bij ≤ 10 minuten de warning-variant.
 */
export default function MinutesBadge({ minutes, className = '' }) {
    const low = minutes <= 10;

    return (
        <span
            className={
                `inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${
                    low ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
                } ` + className
            }
        >
            <span
                className={`h-[7px] w-[7px] rounded-full ${
                    low ? 'bg-[#B45309]' : 'bg-success'
                }`}
            />
            {low ? `${minutes} min tegoed (bijna op)` : `${minutes} min tegoed`}
        </span>
    );
}
