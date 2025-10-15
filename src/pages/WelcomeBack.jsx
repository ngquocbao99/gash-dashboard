import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaShoppingCart, FaBox, FaComments, FaChartLine, FaGift, FaFileImport } from 'react-icons/fa';

const WelcomeBack = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Simple quick actions
    const quickActions = [
        { title: 'Orders', path: '/orders', icon: FaShoppingCart },
        { title: 'Products', path: '/products', icon: FaBox },
        { title: 'Chat', path: '/chat', icon: FaComments },
        { title: 'Statistics', path: '/statistics', icon: FaChartLine },
        { title: 'Vouchers', path: '/vouchers', icon: FaGift },
        { title: 'Imports', path: '/imports', icon: FaFileImport }
    ];

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="bg-blue-600 rounded-2xl p-8 text-white">
                    <h1 className="text-4xl font-bold mb-2">
                        Welcome Back, {user?.username || 'Manager'}! 👋
                    </h1>
                    <p className="text-blue-100 text-lg">Gash Dashboard Management Portal</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {quickActions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(action.path)}
                            className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-center"
                        >
                            <action.icon className="text-2xl text-blue-600 mx-auto mb-2" />
                            <p className="text-sm font-medium text-gray-900">{action.title}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WelcomeBack;
