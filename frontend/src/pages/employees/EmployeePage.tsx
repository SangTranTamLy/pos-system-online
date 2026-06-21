import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import AdminLayout from "../../layouts/AdminLayout";
import { translateRole } from "../../utils/role";
import {
  fetchUsers,
  fetchRoles,
  createUser,
  updateUser,
  updateUserStatus,
  type User,
  type Role,
} from "../../api/users.api";

export default function EmployeePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    pinCode: "",
    password: "",
    roleId: "",
    isActive: true,
  });
  
  const [formErrors, setFormErrors] = useState({
    phone: "",
    pinCode: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error: any) {
      toast.error(error.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || "",
        pinCode: "", // Không hiển thị PIN cũ
        password: "", // Không hiển thị password cũ
        roleId: user.roleId,
        isActive: user.isActive,
      });
    } else {
      setEditingUser(null);
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        pinCode: "",
        password: "",
        roleId: roles.length > 0 ? roles[0].id : "",
        isActive: true,
      });
    }
    setShowPassword(false);
    setFormErrors({ phone: "", pinCode: "" });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormErrors({ phone: "", pinCode: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({ phone: "", pinCode: "" });
    
    // Client-side validation
    const selectedRoleName = roles.find(r => r.id === formData.roleId)?.name?.toLowerCase() || '';
    const isStaff = selectedRoleName !== 'admin' && selectedRoleName !== 'manager' && selectedRoleName !== '';

    if (isStaff) {
      let hasError = false;
      const newErrors = { phone: "", pinCode: "" };
      
      if (!/^0\d{9}$/.test(formData.phone)) {
        newErrors.phone = "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.";
        hasError = true;
      }
      
      if (!editingUser && (!formData.pinCode || formData.pinCode.length !== 6)) {
        newErrors.pinCode = "Mã PIN phải bao gồm đúng 6 chữ số.";
        hasError = true;
      } else if (editingUser && formData.pinCode && formData.pinCode.length !== 6) {
        newErrors.pinCode = "Mã PIN phải bao gồm đúng 6 chữ số.";
        hasError = true;
      }

      if (hasError) {
        setFormErrors(newErrors);
        return;
      }
    }

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          ...formData,
          password: formData.password || undefined,
          pinCode: formData.pinCode || undefined,
        });
        toast.success("Cập nhật nhân viên thành công");
      } else {
        await createUser({
          ...formData,
        });
        toast.success("Tạo nhân viên thành công");
      }
      handleCloseModal();
      loadData();
    } catch (error: any) {
      const msg = error.message || "Có lỗi xảy ra";
      if (msg.toLowerCase().includes("mã pin")) {
        setFormErrors(prev => ({ ...prev, pinCode: msg }));
      } else if (msg.toLowerCase().includes("số điện thoại")) {
        setFormErrors(prev => ({ ...prev, phone: msg }));
      } else {
        toast.error(msg);
      }
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await updateUserStatus(user.id, !user.isActive);
      toast.success(user.isActive ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  return (
    <AdminLayout title="Quản lý nhân viên" subtitle="Thêm, sửa và phân quyền tài khoản">
      <div className="p-2 sm:p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-gray-800 hidden sm:block">Danh sách nhân viên</h1>
          <button
            onClick={() => handleOpenModal()}
            className="bg-[#f97316] hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow transition-colors text-sm font-semibold ml-auto"
          >
            + Thêm nhân viên
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">Đang tải...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-160">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-semibold text-slate-600">Họ tên</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 w-1/4">Email / SĐT</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 w-1/4">Mật khẩu / PIN</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-slate-700">Vai trò</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-slate-700">Trạng thái</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 whitespace-nowrap w-32">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-[#0b1c30]">{user.fullName}</td>
                      <td className="px-6 py-4">
                        {user.email ? (
                          <span className="text-slate-600">{user.email}</span>
                        ) : (
                          <span className="text-slate-500 text-sm">SĐT: {user.phone}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm tracking-wider text-slate-600">
                            {visiblePasswords[user.id] 
                              ? (user.passwordHash || user.pinCode ? "Đã mã hóa" : "Chưa thiết lập") 
                              : "••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setVisiblePasswords(prev => ({...prev, [user.id]: !prev[user.id]}))}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {visiblePasswords[user.id] ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-orange-50 text-[#f97316] text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                          {translateRole(user.roleName)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                            user.isActive
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {user.isActive ? "Hoạt động" : "Bị khóa"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleOpenModal(user)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition-colors"
                          >
                            Sửa
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`${user.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'} font-semibold text-sm transition-colors`}
                          >
                            {user.isActive ? 'Khóa' : 'Mở'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Chưa có nhân viên nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-[#0b1c30]/45 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4 text-[#0b1c30]">
                {editingUser ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
              </h2>
              {(() => {
                const selectedRoleName = roles.find(r => r.id === formData.roleId)?.name?.toLowerCase() || '';
                const isManagerOrAdmin = selectedRoleName === 'admin' || selectedRoleName === 'manager';
                const isStaff = !isManagerOrAdmin && selectedRoleName !== '';

                return (
                  <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Họ tên</label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                        placeholder="Nhập họ tên"
                        autoComplete="off"
                        data-lpignore="true"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Vai trò</label>
                      <select
                        required
                        value={formData.roleId}
                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] bg-white"
                      >
                        <option value="" disabled>Chọn vai trò</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {translateRole(role.name)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isManagerOrAdmin && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                            placeholder="Nhập email"
                            autoComplete="new-password"
                            data-lpignore="true"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Mật khẩu {editingUser && "(Bỏ trống nếu không đổi)"}
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              required={!editingUser}
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg py-2 pl-2 pr-10 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                              placeholder="Nhập mật khẩu"
                              autoComplete="new-password"
                              data-lpignore="true"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                              <span className="material-symbols-outlined text-lg">
                                {showPassword ? "visibility_off" : "visibility"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {isStaff && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Số điện thoại</label>
                          <input
                            type="text"
                            required
                            pattern="[0-9]*"
                            maxLength={10}
                            value={formData.phone}
                            onChange={(e) => {
                              setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) });
                              if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" });
                            }}
                            className={`w-full border ${formErrors.phone ? 'border-red-500' : 'border-slate-300'} rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]`}
                            placeholder="Nhập số điện thoại (10 chữ số)"
                            autoComplete="off"
                            data-lpignore="true"
                          />
                          {formErrors.phone && (
                            <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.phone}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Mã PIN đăng nhập nhanh {editingUser && "(Bỏ trống nếu không đổi)"}
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              required={!editingUser}
                              maxLength={6}
                              value={formData.pinCode}
                              onChange={(e) => {
                                setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) });
                                if (formErrors.pinCode) setFormErrors({ ...formErrors, pinCode: "" });
                              }}
                              className={`w-full border ${formErrors.pinCode ? 'border-red-500' : 'border-slate-300'} rounded-lg py-2 pl-2 pr-10 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]`}
                              placeholder="Nhập 6 chữ số PIN"
                              autoComplete="new-password"
                              data-lpignore="true"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                              <span className="material-symbols-outlined text-lg">
                                {showPassword ? "visibility_off" : "visibility"}
                              </span>
                            </button>
                          </div>
                          {formErrors.pinCode && (
                            <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.pinCode}</p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#f97316] text-white rounded-lg hover:bg-orange-600 font-semibold shadow-sm"
                      >
                        {editingUser ? "Cập nhật" : "Lưu"}
                      </button>
                    </div>
                  </form>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
