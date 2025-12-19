import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Api from "../common/SummaryAPI";
import { useToast } from "../hooks/useToast";
import { startRegistration } from "@simplewebauthn/browser";
import Loading from "../components/Loading";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

// Import modal
import EditProfileModal from "../components/EditProfileModal";
import ChangePasswordModal from "../components/ChangePasswordModal";

const Profile = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [invalidFile, setInvalidFile] = useState(false);

  const { user, logout } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [isSettingUpPasskey, setIsSettingUpPasskey] = useState(false);
  const [passkeyToDelete, setPasskeyToDelete] = useState(null);
  const [showDeletePasskeyModal, setShowDeletePasskeyModal] = useState(false);
  const [isDeletingPasskey, setIsDeletingPasskey] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    gender: "",
    dob: "",
    image: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const firstInputRef = useRef(null);
  const { showToast } = useToast();

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
        'image/webp', 'image/svg+xml', 'image/bmp',
        'image/x-icon', 'image/tiff', 'image/x-tiff'
      ];
      if (!validTypes.includes(file.type.toLowerCase())) {
        showToast("Please select a valid image type", "error", 3000);
        setInvalidFile(true);
        setSelectedFile(null);
        setPreviewUrl("");
        return;
      }
      setInvalidFile(false);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setInvalidFile(false);
      setSelectedFile(null);
      setPreviewUrl("");
    }
  };

  const fetchProfile = useCallback(async () => {
    if (!user || !user._id) return;
    setLoading(true);
    setError('');
    try {
      const response = await Api.accounts.getById(user._id);
      setProfile(response);
      setIsDeleted(response.is_deleted === true);
      setFormData({
        username: response.username,
        name: response.name || "",
        email: response.email,
        phone: response.phone || "",
        address: response.address || "",
        gender: response.gender || "",
        dob: response.dob ? new Date(response.dob).toISOString().split('T')[0] : "",
        image: response.image || "",
      });
    } catch (err) {
      console.error("Fetch profile error:", err.response || err.message);
      let errorMessage = "Failed to fetch profile";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 401) {
        errorMessage = "You are not authorized to view profile";
      } else if (err.response?.status === 404) {
        errorMessage = "Profile not found";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to fetch profile: ${err.message}`;
      }
      setError(errorMessage);
      showToast(errorMessage, "error", 4000);
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  const fetchPasskeys = useCallback(async () => {
    if (!user || !user._id) return;
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await Api.passkeys.getUserPasskeys(token);
        setPasskeys(response.data.passkeys || []);
      }
    } catch (err) {
      console.error('Fetch passkeys error:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  useEffect(() => {
    if (editMode) {
      firstInputRef.current?.focus();
      if (!selectedFile && profile?.image) {
        setPreviewUrl(profile.image);
      }
    } else {
      setPreviewUrl("");
    }
  }, [editMode, profile, selectedFile]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    const { username, name, email, phone, address } = formData;

    if (!username.trim()) newErrors.username = "Please fill in all required fields";
    if (!name.trim()) newErrors.name = "Please fill in all required fields";
    if (!email.trim()) newErrors.email = "Please fill in all required fields";
    if (!phone.trim()) newErrors.phone = "Please fill in all required fields";
    if (!address.trim()) newErrors.address = "Please fill in all required fields";

    const hasImage = Boolean(formData.image?.trim() || selectedFile || profile?.image);
    if (!hasImage) newErrors.image = "Please fill in all required fields";

    if (username && (username.length < 5 || username.length > 30)) {
      newErrors.username = "Username must be between 5 and 30 characters";
    }
    if (name && name.length > 50) {
      newErrors.name = "Name must be at most 50 characters";
    }
    if (name && !/^[\p{L}\s]+$/u.test(name))
      newErrors.name = "Name must contain only letters and spaces";
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      newErrors.email = "Valid email is required";
    if (phone && !/^\d{10}$/.test(phone))
      newErrors.phone = "Phone must be exactly 10 digits";
    if (address && address.length > 200)
      newErrors.address = "Address must be at most 200 characters";

    // Validate image format if provided - allow all image types
    if (hasImage) {
      if (selectedFile) {
        const validTypes = [
          'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
          'image/webp', 'image/svg+xml', 'image/bmp',
          'image/x-icon', 'image/tiff', 'image/x-tiff'
        ];
        if (!validTypes.includes(selectedFile.type.toLowerCase())) {
          newErrors.image = "Please select a valid image type";
        }
      } else if (formData.image?.trim()) {
        const imageUrl = formData.image.trim().toLowerCase();
        if (!imageUrl.match(/\.(png|jpg|jpeg)$/i) && !imageUrl.startsWith('data:image/')) {
          newErrors.image = "Please select a valid image type";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      Object.values(newErrors).forEach((msg) =>
        showToast(msg, "error", 3000)
      );
      return false;
    }
    return true;
  }, [formData, profile, selectedFile, showToast]);

  const updateProfile = useCallback(async () => {
    setLoading(true);
    try {
      const updateData = {
        username: formData.username,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        gender: formData.gender,
        dob: formData.dob,
        image: formData.image,
      };
      const response = await Api.accounts.updateProfile(user._id, updateData);
      await fetchProfile();
      setEditMode(false);
      showToast("Profile edited successfully", "success", 2000);
    } catch (err) {
      console.error("Update profile error:", err.response || err.message);
      const errorMessage =
        err.response?.status === 409
          ? "Username or email already exists"
          : err.response?.data?.errors?.[0]?.msg || "Failed to update profile";
      showToast(errorMessage, "error", 4000);
    } finally {
      setLoading(false);
    }
  }, [formData, user, showToast, fetchProfile]);

  const updateProfileWithImage = useCallback(
    (imageUrl) => {
      const updateData = {
        ...formData,
        image: imageUrl,
        gender: formData.gender,
        dob: formData.dob,
      };
      Api.accounts
        .updateProfile(user._id, updateData)
        .then(async (response) => {
          await fetchProfile();
          setEditMode(false);
          showToast("Profile edited successfully", "success", 2000);
        })
        .catch((err) => {
          console.error("Update profile with image error:", err.response || err.message);
          const errorMessage =
            err.response?.status === 409
              ? "Username or email already exists"
              : err.response?.data?.errors?.[0]?.msg ||
              "Failed to update profile";
          showToast(errorMessage, "error", 4000);
        })
        .finally(() => setLoading(false));
    },
    [formData, user, showToast, fetchProfile]
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      if (invalidFile) {
        showToast("Please select a valid image type", "error", 3000);
        return;
      }

      setLoading(true);

      if (selectedFile) {
        Api.upload
          .image(selectedFile)
          .then((response) => {
            const imageUrl = response.data?.url || response.data?.imageUrl;
            if (imageUrl) {
              showToast("Image uploaded successfully", "success", 2000);
              updateProfileWithImage(imageUrl);
            } else {
              showToast(
                "Upload completed but server did not return URL.",
                "error",
                3000
              );
              setLoading(false);
            }
          })
          .catch((err) => {
            console.error("Upload failed details:", {
              message: err.message,
              status: err.response?.status,
              data: err.response?.data,
              config: err.config
            });
            showToast(`Upload failed: ${err.response?.data?.message || err.message}`, "error", 5000);
            setLoading(false);
          });
      } else {
        updateProfile();
      }
    },
    [
      validateForm,
      selectedFile,
      invalidFile,
      updateProfile,
      updateProfileWithImage,
      showToast,
    ]
  );

  const handleCancel = useCallback(() => {
    setEditMode(false);
    setFormData({
      username: profile?.username || "",
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      address: profile?.address || "",
      gender: profile?.gender || "",
      dob: profile?.dob || "",
      image: profile?.image || "",
    });
    setSelectedFile(null);
    setPreviewUrl("");
    setInvalidFile(false);
  }, [profile]);

  const handleSetupPasskey = useCallback(async () => {
    setIsSettingUpPasskey(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Please log in again', 'error', 3000);
        return;
      }

      // Get registration options
      const regResponse = await Api.passkeys.generateRegistrationOptions(token);
      const { options, challenge } = regResponse.data;

      // Start registration
      const registrationResponse = await startRegistration(options);

      // Detect device type
      const deviceType = navigator.userAgent.includes('Mobile') ? 'mobile' :
        navigator.userAgent.includes('Tablet') ? 'tablet' : 'desktop';

      // Prepare verification data
      const verifyData = {
        id: registrationResponse.id,
        rawId: registrationResponse.rawId,
        response: registrationResponse.response,
        type: registrationResponse.type,
        challenge: challenge,
        deviceType,
      };

      await Api.passkeys.verifyRegistration(verifyData, token);

      showToast('Passkey authentication set up successfully', 'success', 2000);
      fetchPasskeys();
    } catch (err) {
      console.error('Passkey setup error:', err);
      const errorMsg = err.response?.data?.message || 'Failed to set up passkey authentication';
      showToast(errorMsg, 'error', 3000);
    } finally {
      setIsSettingUpPasskey(false);
    }
  }, [showToast, fetchPasskeys]);

  const handleDeletePasskey = useCallback((passkeyId) => {
    setPasskeyToDelete(passkeyId);
    setShowDeletePasskeyModal(true);
  }, []);

  const confirmDeletePasskey = useCallback(async () => {
    if (!passkeyToDelete) return;

    try {
      setIsDeletingPasskey(true);
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Please log in again', 'error', 3000);
        return;
      }

      await Api.passkeys.deletePasskey(passkeyToDelete, token);
      showToast('Passkey authentication removed successfully', 'success', 2000);
      fetchPasskeys();
      setShowDeletePasskeyModal(false);
      setPasskeyToDelete(null);
    } catch (err) {
      console.error('Delete passkey error:', err);
      const errorMsg = err.response?.data?.message || 'Failed to remove passkey authentication';
      showToast(errorMsg, 'error', 3000);
    } finally {
      setIsDeletingPasskey(false);
    }
  }, [passkeyToDelete, showToast, fetchPasskeys]);

  const cancelDeletePasskey = useCallback(() => {
    if (isDeletingPasskey) return;
    setShowDeletePasskeyModal(false);
    setPasskeyToDelete(null);
  }, [isDeletingPasskey]);

  if (!user) {
    return <div className="w-full h-full"></div>;
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">
      <div className="max-w-6xl mx-auto">
        {loading || error || !profile ? (
          <div className="backdrop-blur-xl rounded-xl border p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status">
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
              {/* ── LOADING ── */}
              {loading ? (
                <Loading
                  type="page"
                  size="medium"
                  message="Loading your profile..."
                />
              ) : error ? (
                /* ── NETWORK ERROR ── */
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-semibold text-gray-900">Network Error</h3>
                    <p className="text-sm text-gray-500 mt-1">{error}</p>
                  </div>

                  <button
                    onClick={fetchProfile}
                    className="px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                /* ── NO PROFILE ── */
                <>
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-semibold text-gray-900">Profile Not Found</h3>
                    <p className="text-sm text-gray-500 mt-1">We couldn't find your profile information. Please try refreshing the page.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">My Profile</h1>
                {/* <p className="text-gray-600 text-sm sm:text-base lg:text-lg">View and manage your profile information</p> */}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {/* Profile Card */}
              <div className="lg:col-span-1 flex">
                <div className="backdrop-blur-xl rounded-xl border overflow-hidden w-full flex flex-col" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#FCEFCB] to-white p-6 sm:p-8 text-center border-b" style={{ borderColor: '#A86523' }}>
                    <div className="relative inline-block">
                      <img
                        src={profile.image || "https://via.placeholder.com/120x120?text=No+Image"}
                        alt={profile.username || "Profile"}
                        className="w-24 h-24 rounded-full object-cover border-2"
                        style={{ borderColor: '#A86523' }}
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/120x120?text=No+Image";
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900 mt-4">{profile.name || profile.username}</h1>
                    <p className="text-gray-500 text-base">@{profile.username}</p>
                  </div>

                  {/* Action Buttons */}
                  {!isDeleted ? (
                    <div className="p-4 sm:p-6 space-y-3 flex-grow flex flex-col justify-end">
                      <button
                        className="w-full text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                        onClick={() => setEditMode(true)}
                      >
                        Edit Profile
                      </button>
                      <button
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 border border-gray-300 hover:border-gray-400"
                        onClick={() => setShowChangePassword(true)}
                      >
                        Change Password
                      </button>
                      <button
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 border border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleSetupPasskey}
                        disabled={isSettingUpPasskey || passkeys.length > 0}
                      >
                        {isSettingUpPasskey
                          ? 'Setting up...'
                          : passkeys.length > 0
                            ? 'Passkeys Already Set Up'
                            : 'Set Up Passkeys'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-6 flex-grow flex flex-col justify-end">
                      <div className="backdrop-blur-xl rounded-xl border p-4 mb-4" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                        <div className="flex items-center justify-center mb-2">
                          <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-red-800 font-semibold">Account Deleted</span>
                        </div>
                        <p className="text-red-600 text-sm text-center">
                          This account has been soft deleted and is no longer active.
                        </p>
                      </div>
                      <button
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                        onClick={logout}
                      >
                        Return to Login
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Details */}
              <div className="lg:col-span-2 flex">
                <div className="backdrop-blur-xl rounded-xl border overflow-hidden w-full flex flex-col" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                  <div className="bg-gradient-to-r from-[#FCEFCB] to-white border-b p-4 sm:p-5" style={{ borderColor: '#A86523' }}>
                    <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                  </div>

                  <div className="p-4 sm:p-5 lg:p-6 flex-grow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                      {/* Personal Information */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2" style={{ borderColor: '#A86523' }}>Personal Information</h3>

                        <div className="space-y-2">
                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Username</p>
                              <p className="font-medium text-gray-900">@{profile.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Full Name</p>
                              <p className="font-medium text-gray-900">{profile.name || "Not provided"}</p>
                            </div>
                          </div>

                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                              <p className="font-medium text-gray-900">{profile.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                              <p className="font-medium text-gray-900">{profile.phone || "Not provided"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2" style={{ borderColor: '#A86523' }}>Additional Information</h3>

                        <div className="space-y-2">
                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Address</p>
                              <p className="font-medium text-gray-900">{profile.address || "Not provided"}</p>
                            </div>
                          </div>

                          {profile.gender && (
                            <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Gender</p>
                                <p className="font-medium text-gray-900 capitalize">{profile.gender}</p>
                              </div>
                            </div>
                          )}

                          {profile.dob && (
                            <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Date of Birth</p>
                                <p className="font-medium text-gray-900">{new Date(profile.dob).toLocaleDateString('vi-VN')}</p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border" style={{ borderColor: '#A86523' }}>
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Member Since</p>
                              <p className="font-medium text-gray-900">{new Date(profile.createdAt).toLocaleDateString('vi-VN')}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Passkeys Section */}
                      <div className="mt-6 space-y-3">
                        <h3 className="text-lg font-medium text-gray-900">Passkey Authentication</h3>
                        {passkeys.length > 0 ? (
                          <div className="space-y-2">
                            {passkeys.map((passkey) => (
                              <div key={passkey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
                                <div className="flex items-center">
                                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 capitalize">{passkey.deviceType || 'Unknown Device'}</p>
                                    <p className="text-xs text-gray-500">
                                      Added {new Date(passkey.createdAt).toLocaleDateString('vi-VN')}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeletePasskey(passkey.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  aria-label="Remove passkey authentication"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-md border border-gray-200 text-center">
                            <p className="text-sm text-gray-600">No passkey authentication set up yet. Click "Set Up Passkey" to use Touch ID, Face ID, or Windows Hello.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Edit Profile */}
      {editMode && (
        <EditProfileModal
          formData={formData}
          setFormData={setFormData}
          previewUrl={previewUrl}
          handleFileChange={handleFileChange}
          handleSubmit={handleSubmit}
          handleCancel={handleCancel}
          selectedFile={selectedFile}
          profile={profile}
          loading={loading}
        />
      )}

      {/* Modal Change Password */}
      {showChangePassword && (
        <ChangePasswordModal handleCancel={() => setShowChangePassword(false)} />
      )}

      <DeleteConfirmModal
        isOpen={showDeletePasskeyModal && !!passkeyToDelete}
        title="Remove Passkey Authentication"
        message={
          <>
            Are you sure you want to remove this passkey device?
            <br />
            <span className="text-sm text-gray-500">You will need to set it up again to use passkey login.</span>
          </>
        }
        onConfirm={confirmDeletePasskey}
        onCancel={cancelDeletePasskey}
        confirmText="Remove"
        isLoading={isDeletingPasskey}
      />
    </div>
  );
};

export default Profile;