/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#3b82f6',
                    dark: '#2563eb',
                },
                accent: {
                    DEFAULT: '#8b5cf6',
                    dark: '#7c3aed',
                }
            }
        },
    },
    plugins: [],
}
