export default function InputError({ message, className = '', ...props }) {
    return message ? (
        <p {...props} className={'text-[13px] text-error ' + className}>
            {message}
        </p>
    ) : null;
}
