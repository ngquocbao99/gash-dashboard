import React from 'react';

const Loading = ({
    type = 'default', // 'default', 'auth', 'page', 'inline'
    size = 'large', // 'small', 'medium', 'large'
    message = 'Loading...',
    subMessage = '',
    fullScreen = false,
    className = ''
}) => {
    const sizeConfig = {
        small: {
            spinner: 'w-6 h-6',
            text: 'text-sm',
            subText: 'text-xs',
            spacing: 'mb-1',
            borderWidth: 'border-2'
        },
        medium: {
            spinner: 'w-12 h-12',
            text: 'text-base',
            subText: 'text-sm',
            spacing: 'mb-3',
            borderWidth: 'border-4'
        },
        large: {
            spinner: 'w-20 h-20',
            text: 'text-xl',
            subText: 'text-base',
            spacing: 'mb-6',
            borderWidth: 'border-4'
        }
    };

    const typeConfig = {
        default: {
            spinnerBorderColor: '#FCEFCB',
            spinnerTopColor: '#E9A319',
            textColor: 'text-gray-800',
            subTextColor: 'text-gray-600',
            bgColor: 'bg-gray-100'
        },
        auth: {
            spinnerBorderColor: '#FCEFCB',
            spinnerTopColor: '#E9A319',
            textColor: 'text-gray-600',
            subTextColor: 'text-gray-500',
            bgColor: 'bg-gray-100'
        },
        page: {
            spinnerBorderColor: '#FCEFCB',
            spinnerTopColor: '#E9A319',
            textColor: 'text-gray-800',
            subTextColor: 'text-gray-600',
            bgColor: 'bg-white'
        },
        inline: {
            spinnerBorderColor: '#FCEFCB',
            spinnerTopColor: '#E9A319',
            textColor: 'text-gray-700',
            subTextColor: 'text-gray-500',
            bgColor: 'bg-transparent'
        }
    };

    const config = sizeConfig[size] || sizeConfig.large;
    const typeStyle = typeConfig[type] || typeConfig.default;
    const isInline = type === 'inline';

    const containerClasses = fullScreen
        ? `min-h-screen ${typeStyle.bgColor} flex items-center justify-center ${className}`
        : isInline
            ? `inline-flex items-center ${className}`
            : `flex items-center justify-center ${className}`;

    const spinnerClasses = [
        config.spinner,
        config.borderWidth,
        'rounded-full',
        'animate-spin',
        isInline ? '' : 'mx-auto',
        isInline ? '' : config.spacing,
        isInline ? '' : 'shadow-lg'
    ]
        .filter(Boolean)
        .join(' ');

    const spinnerStyle = {
        borderColor: typeStyle.spinnerBorderColor,
        borderTopColor: typeStyle.spinnerTopColor
    };

    const renderMessageBlock = () => (
        <>
            {message && (
                <h3 className={`${config.text} font-bold ${typeStyle.textColor} ${subMessage ? 'mb-2' : ''}`}>
                    {message}
                </h3>
            )}
            {subMessage && (
                <p className={`${config.subText} font-medium ${typeStyle.subTextColor}`}>
                    {subMessage}
                </p>
            )}
        </>
    );

    if (isInline) {
        return (
            <div className={containerClasses} role="status" aria-live="polite">
                <div
                    className={`${spinnerClasses} ${message || subMessage ? 'mr-2' : ''}`}
                    style={spinnerStyle}
                />
                {(message || subMessage) && (
                    <div className="flex flex-col">
                        {message && (
                            <span className={`${config.text} font-semibold ${typeStyle.textColor}`}>
                                {message}
                            </span>
                        )}
                        {subMessage && (
                            <span className={`${config.subText} font-medium ${typeStyle.subTextColor}`}>
                                {subMessage}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={containerClasses} role="status" aria-live="polite">
            <div className="text-center">
                <div className={spinnerClasses} style={spinnerStyle} />
                {renderMessageBlock()}
            </div>
        </div>
    );
};

export default Loading;

