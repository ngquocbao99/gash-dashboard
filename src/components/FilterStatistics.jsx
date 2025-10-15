import React from 'react';
import { FaFilter, FaChevronDown } from 'react-icons/fa';

const Filter = ({
    // Data
    data = [],
    filteredData = [],
    selectedItems = [],

    // Filter states
    showFilter = false,
    showCustomFilter = false,
    defaultItemsToShow = 4,
    showAllItems = false,

    // Filter options
    defaultOptions = [2, 4, 6, 8, 10, 12],
    itemKey = 'id',
    itemLabel = 'label',

    // Labels
    itemType = 'items', // 'weeks', 'months', 'years'
    itemTypeCapitalized = 'Items', // 'Weeks', 'Months', 'Years'

    // Handlers
    onToggleFilter = () => { },
    onToggleCustomFilter = () => { },
    onShowAllItems = () => { },
    onShowDefaultItems = () => { },
    onChangeDefaultItems = () => { },
    onItemToggle = () => { },
    onSelectAll = () => { },
    onClearAll = () => { }
}) => {
    return (
        <div className="relative">
            {/* Filter Button */}
            <button
                onClick={onToggleFilter}
                className="group flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors duration-300">
                    <FaFilter className="text-sm" />
                </div>
                <span className="font-semibold text-lg">Show {defaultItemsToShow} {itemTypeCapitalized}</span>
                <FaChevronDown className="text-sm" />
            </button>

            {/* Filter Dropdown */}
            {showFilter && (
                <div className="absolute top-full right-0 mt-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 backdrop-blur-sm">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                                <FaFilter className="text-white text-sm" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-800">Select Number of {itemTypeCapitalized}</h4>
                                <p className="text-sm text-gray-600">Choose how many to display</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-3">
                            {defaultOptions.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => onChangeDefaultItems(option)}
                                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${defaultItemsToShow === option
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                        }`}
                                >
                                    <div className="text-center">
                                        <div className="text-2xl font-bold">{option}</div>
                                        <div className="text-sm font-medium">{itemTypeCapitalized}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Show All Option */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                                onClick={onShowAllItems}
                                className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${showAllItems
                                    ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-lg font-bold">Show All</div>
                                    <div className="text-sm font-medium">All {data.length} {itemType}</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <p className="text-sm font-medium text-gray-700">
                                    {showAllItems
                                        ? `Showing all ${data.length} ${itemType}`
                                        : `Showing ${defaultItemsToShow} of ${data.length} ${itemType}`
                                    }
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">
                                        {showAllItems ? data.length : defaultItemsToShow}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Filter;
