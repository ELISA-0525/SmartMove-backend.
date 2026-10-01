/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./portal.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        'yellow': {
          50: '#FFFBF0',
          100: '#FFEDCC',
          400: '#FFD966',
          500: '#FFC857',
          600: '#FFB700',
          700: '#F39C12',
        },
        // Additional palette
        'blue': {
          50: '#EBF8FF',
          100: '#BEE3F8',
          400: '#63B3ED',
          500: '#4299E1',
          600: '#3182CE',
          700: '#2C5AA0',
        },
        'green': {
          50: '#F0FFF4',
          100: '#C6F6D5',
          400: '#68D391',
          500: '#48BB78',
          600: '#38A169',
          700: '#22543D',
        },
        'red': {
          50: '#FFF5F5',
          100: '#FED7D7',
          400: '#FC8787',
          500: '#F56565',
          600: '#E53E3E',
          700: '#C53030',
        },
        'gray': {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        'purple': {
          50: '#FAF5FF',
          100: '#F3E8FF',
          400: '#C084FC',
          500: '#A78BFA',
          600: '#9333EA',
          700: '#7E22CE',
        },
      },
      fontFamily: {
        'sans': ['Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        'mono': ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      spacing: {
        '0': '0',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
      },
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'base': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        'full': '9999px',
      },
      boxShadow: {
        'none': 'none',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'base': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      transitionDuration: {
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      width: {
        'full': '100%',
        'screen': '100vw',
      },
      height: {
        'full': '100%',
        'screen': '100vh',
      },
      maxWidth: {
        'none': 'none',
        'sm': '24rem',
        'md': '28rem',
        'lg': '32rem',
        'xl': '36rem',
        '2xl': '42rem',
        '3xl': '48rem',
        '4xl': '56rem',
        '5xl': '64rem',
        '6xl': '72rem',
        '7xl': '80rem',
        'full': '100%',
      },
      minHeight: {
        '0': '0',
        'full': '100%',
        'screen': '100vh',
      },
    },
  },
  plugins: [
    function({ addComponents, theme }) {
      addComponents({
        // Button styles
        '.btn': {
          '@apply px-4 py-2 rounded-lg font-semibold text-sm transition': {},
        },
        '.btn-primary': {
          '@apply bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:shadow-lg disabled:opacity-50': {},
        },
        '.btn-secondary': {
          '@apply bg-gray-200 text-gray-900 hover:bg-gray-300': {},
        },
        '.btn-danger': {
          '@apply bg-red-600 text-white hover:bg-red-700': {},
        },
        '.btn.sm': {
          '@apply px-3 py-1 text-xs': {},
        },
        '.btn.lg': {
          '@apply px-6 py-3 text-base': {},
        },

        // Form styles
        'input[type="text"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'input[type="email"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'input[type="password"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'input[type="tel"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'input[type="number"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'input[type="date"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'input[type="datetime-local"]': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'select': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'textarea': {
          '@apply px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500': {},
        },
        'label': {
          '@apply block text-sm font-medium text-gray-700 mb-2': {},
        },

        // Card styles
        '.card': {
          '@apply bg-white rounded-lg border border-gray-200 p-6': {},
        },
        '.card-hover': {
          '@apply hover:border-yellow-400 hover:shadow-md transition': {},
        },

        // Status badge
        '.badge': {
          '@apply px-3 py-1 rounded-full text-xs font-semibold': {},
        },
        '.badge-success': {
          '@apply bg-green-100 text-green-800': {},
        },
        '.badge-warning': {
          '@apply bg-yellow-100 text-yellow-800': {},
        },
        '.badge-danger': {
          '@apply bg-red-100 text-red-800': {},
        },
        '.badge-info': {
          '@apply bg-blue-100 text-blue-800': {},
        },

        // Table styles
        'table': {
          '@apply w-full': {},
        },
        'thead': {
          '@apply bg-gray-50 border-b border-gray-200': {},
        },
        'th': {
          '@apply text-left px-6 py-3 font-semibold text-gray-900 text-sm': {},
        },
        'tbody tr': {
          '@apply border-b border-gray-200 hover:bg-gray-50 transition': {},
        },
        'td': {
          '@apply px-6 py-4 text-sm': {},
        },

        // Alert/Message styles
        '.alert': {
          '@apply rounded-lg px-6 py-4 border': {},
        },
        '.alert-success': {
          '@apply bg-green-100 border-green-300 text-green-800': {},
        },
        '.alert-danger': {
          '@apply bg-red-100 border-red-300 text-red-800': {},
        },
        '.alert-warning': {
          '@apply bg-yellow-100 border-yellow-300 text-yellow-800': {},
        },
        '.alert-info': {
          '@apply bg-blue-100 border-blue-300 text-blue-800': {},
        },

        // Modal/Dialog
        'dialog': {
          '@apply backdrop:bg-black/50 rounded-lg shadow-2xl max-w-2xl w-full': {},
        },

        // Input group
        '.input-group': {
          '@apply space-y-2': {},
        },
        '.input-group label': {
          '@apply block text-sm font-semibold text-gray-700': {},
        },

        // Grid layouts
        '.grid': {
          '@apply grid gap-6': {},
        },
        '.grid-cols-1': {
          '@apply grid-cols-1': {},
        },
        '.grid-cols-2': {
          '@apply md:grid-cols-2': {},
        },
        '.grid-cols-3': {
          '@apply md:grid-cols-2 lg:grid-cols-3': {},
        },
        '.grid-cols-4': {
          '@apply md:grid-cols-2 lg:grid-cols-4': {},
        },

        // Flex utilities
        '.flex-center': {
          '@apply flex items-center justify-center': {},
        },
        '.flex-between': {
          '@apply flex items-center justify-between': {},
        },

        // Text utilities
        '.text-truncate': {
          '@apply truncate': {},
        },
        '.text-clamp': {
          '@apply line-clamp-2': {},
        },

        // Visibility
        '.hidden-mobile': {
          '@apply hidden md:block': {},
        },
        '.hidden-desktop': {
          '@apply md:hidden': {},
        },
      });
    },
  ],
};
