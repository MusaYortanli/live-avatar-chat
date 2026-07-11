export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center justify-center rounded-[10px] border border-transparent bg-error px-5 py-2.5 text-[15px] font-semibold text-white transition duration-150 ease-in-out hover:bg-[#8F1F19] focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 active:bg-[#8F1F19] ${
                    disabled && 'opacity-50'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
