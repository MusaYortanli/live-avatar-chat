import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/**
 * ObizCare design tokens — variant 1a "Zeegroen"
 * Bron: design_handoff_obizcare/ObizCare Tokens.dc.html
 */

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            colors: {
                primary: { DEFAULT: '#0E7569', dark: '#0A5B51' },
                secondary: '#2B6CB0',
                surface: '#FFFFFF',
                canvas: '#F4F6F5',
                gray: {
                    50: '#FBFCFC',
                    100: '#EEF2F0',
                    200: '#DBE6E3',
                    300: '#CFD9D6',
                    400: '#9AA8A5',
                    500: '#7A8A87',
                    600: '#5C6B69',
                    700: '#41504E',
                    800: '#2A3735',
                    900: '#1C2B2A',
                },
                success: { DEFAULT: '#16803C', soft: '#E7F5EC' },
                warning: { DEFAULT: '#946300', soft: '#FCF3DC' },
                error: { DEFAULT: '#B3261E', soft: '#FBEAE9' },
                info: { DEFAULT: '#2B6CB0', soft: '#E8F0F8' },
                status: {
                    actief: '#16803C',
                    verbinden: '#2B6CB0',
                    fout: '#B3261E',
                    'tegoed-laag': '#B45309',
                    'tegoed-op': '#B3261E',
                },
            },
            fontFamily: {
                sans: ['"Source Sans 3"', ...defaultTheme.fontFamily.sans],
                heading: ['"Source Sans 3"', 'sans-serif'],
                body: ['"Source Sans 3"', 'sans-serif'],
            },
            borderRadius: {
                sm: '8px',
                md: '12px',
                lg: '16px',
            },
            boxShadow: {
                sm: '0 1px 2px rgba(20,35,32,.06)',
                md: '0 1px 3px rgba(20,35,32,.08), 0 4px 12px rgba(20,35,32,.06)',
                lg: '0 8px 30px rgba(20,35,32,.16)',
            },
        },
    },

    plugins: [forms],
};
