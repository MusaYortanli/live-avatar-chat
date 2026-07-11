import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export default forwardRef(function TextInput(
    { type = 'text', className = '', isFocused = false, ...props },
    ref,
) {
    const localRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    return (
        <input
            {...props}
            type={type}
            className={
                'rounded-[10px] border-gray-300 bg-gray-50 px-3 py-2.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary ' +
                className
            }
            ref={localRef}
        />
    );
});
