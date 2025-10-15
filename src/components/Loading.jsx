import React from 'react';

const Loading = ({
    type = 'default', // 'default', 'auth', 'page', 'inline'
    size = 'large', // 'small', 'medium', 'large'
    message = 'Loading...',
    subMessage = '',
    fullScreen = false,
    className = ''
}) => {
    // Size configurations
    const sizeConfig = {
        small: {
            spinner: 'w-8 h-8',
            text: 'text-sm',
            subText: 'text-xs',
            spacing: 'mb-2'
        },
        medium: {
            spinner: 'w-12 h-12',
            text: 'text-base',
            subText: 'text-sm',
            spacing: 'mb-3'
        },
        large: {
            spinner: 'w-20 h-20',
            text: 'text-xl',
            subText: 'text-base',
            spacing: 'mb-6'
        }
    };

    // Type configurations
    const typeConfig = {
        default: {
            spinnerColor: 'border-blue-200 border-t-blue-600',
            textColor: 'text-gray-800',
            subTextColor: 'text-gray-600',
            bgColor: 'bg-gray-100'
        },
        auth: {
            spinnerColor: 'border-blue-200 border-t-blue-600',
            textColor: 'text-gray-600',
            subTextColor: 'text-gray-500',
            bgColor: 'bg-gray-100'
        },
        page: {
            spinnerColor: 'border-blue-200 border-t-blue-600',
            textColor: 'text-gray-800',
            subTextColor: 'text-gray-600',
            bgColor: 'bg-white'
        },
        inline: {
            spinnerColor: 'border-gray-200 border-t-gray-600',
            textColor: 'text-gray-700',
            subTextColor: 'text-gray-500',
            bgColor: 'bg-transparent'
        }
    };

    const config = sizeConfig[size];
    const typeStyle = typeConfig[type];

    // Container classes
    const containerClasses = fullScreen
        ? `min-h-screen ${typeStyle.bgColor} flex items-center justify-center ${className}`
        : `flex items-center justify-center ${className}`;

    // Content classes
    const contentClasses = fullScreen
        ? 'text-center'
        : 'text-center';

    return (
        <div className={containerClasses} role="status" aria-live="true">
            <div className={contentClasses}>
                {/* Spinner */}
                <div className={`${config.spinner} border-4 ${typeStyle.spinnerColor} rounded-full animate-spin mx-auto ${config.spacing} shadow-lg`}></div>

                {/* Main message */}
                <h3 className={`${config.text} font-bold ${typeStyle.textColor} mb-2`}>
                    {message}
                </h3>

                {/* Sub message */}
                {subMessage && (
                    <p className={`${config.subText} font-medium ${typeStyle.subTextColor}`}>
                        {subMessage}
                    </p>
                )}
            </div>
        </div>
    );
};

export default Loading;

